import { fetch as nativeFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { testWebDavWriteAccess } from './webdav';
import { loadWebDavSettings, testAndSaveWebDavSettings } from './webdav-settings';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7 }));
const storage = { endpoint: 'https://fixture.example/dav/', targetPath: 'Kloda', username: 'fixture', password: 'public-test-secret' };
const memory = new Map<string, string>();
const network = jest.mocked(nativeFetch);
const set = jest.mocked(SecureStore.setItemAsync);
const get = jest.mocked(SecureStore.getItemAsync);
function response(status: number, text = 'kloda-connection-test') {
  let read = false;
  const reader = { read: jest.fn(async () => {
    if (read) return { done: true, value: undefined };
    read = true; return { done: false, value: Uint8Array.from(text, (char) => char.charCodeAt(0)) };
  }), cancel: jest.fn(async () => undefined), releaseLock: jest.fn() };
  return { status, body: { cancel: jest.fn(async () => undefined), getReader: () => reader } } as unknown as Awaited<ReturnType<typeof nativeFetch>>;
}
function success() {
  network.mockImplementation(async (_url, options) => response(
    options?.method === 'PROPFIND' ? 207 : options?.method === 'GET' ? 200 : options?.method === 'DELETE' ? 204 : 201));
}
beforeEach(() => {
  jest.clearAllMocks(); memory.clear();
  get.mockImplementation(async (key) => memory.get(key) ?? null);
  set.mockImplementation(async (key, value) => { memory.set(key, value); });
  success();
});

it('binds config, secret and previous test in one secure value and returns no password to the form', async () => {
  const saved = await testAndSaveWebDavSettings(storage, () => true);
  expect(saved.config).toEqual({ endpoint: storage.endpoint, targetPath: storage.targetPath, username: storage.username });
  expect(saved).not.toHaveProperty('password'); expect(saved.config).not.toHaveProperty('password');
  expect(set).toHaveBeenCalledTimes(2);
  const [key, raw, options] = set.mock.calls[1];
  expect(key).toBe('kloda.webdav.profile.v1'); expect(options).toEqual({ keychainAccessible: 7 });
  expect(JSON.parse(raw)).toEqual({ version: 1, storage, testedAt: saved.testedAt, probeWarning: false });
  expect(await loadWebDavSettings()).toEqual(saved);
  expect(network.mock.calls.map(([, init]) => init?.method)).toEqual(['PROPFIND', 'MKCOL', 'PUT', 'MOVE', 'GET', 'DELETE', 'DELETE']);
  for (const [url, init] of network.mock.calls) {
    expect(String(url).startsWith('https://fixture.example/dav/Kloda/')).toBe(true);
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error' });
  }
  expect(network.mock.calls[2][1]?.headers).toMatchObject({ 'If-None-Match': '*' });
  expect(network.mock.calls[3][1]?.headers).toMatchObject({ Overwrite: 'F' });
});

it('invalidates the old test before retesting and keeps its whole old context on a failed new target', async () => {
  await testAndSaveWebDavSettings(storage, () => true);
  network.mockRejectedValue(new Error('fixture offline'));
  await expect(testAndSaveWebDavSettings({ ...storage, targetPath: 'another', password: 'another-secret' }, () => true)).rejects.toThrow('webdav_connection');
  expect(await loadWebDavSettings()).toEqual({ config: { endpoint: storage.endpoint, targetPath: storage.targetPath, username: storage.username }, testedAt: null, probeWarning: false });
  expect(JSON.parse([...memory.values()][0]).storage).toEqual(storage);
});

it.each([
  { endpoint: 'http://fixture.example' }, { endpoint: 'https://user:pass@fixture.example' },
  { endpoint: 'https://fixture.example?token=x' }, { endpoint: 'https://fixture.example#x' },
  { targetPath: '' }, { targetPath: ' / ' }, { targetPath: '/' }, { targetPath: '../archive' }, { username: '' }, { username: 'a:b' }, { password: '' },
])('rejects missing/unsafe fields before credentials or network %#', async (change) => {
  await expect(testAndSaveWebDavSettings({ ...storage, ...change }, () => true)).rejects.toThrow('webdav_fields');
  expect(network).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
});

it.each(['MKCOL', 'PUT', 'MOVE', 'GET', 'DELETE'])('rejects partial/incorrect %s results without deleting unknown paths', async (method) => {
  network.mockImplementation(async (_url, init) => response(init?.method === method ? 207 : init?.method === 'PROPFIND' ? 207 : init?.method === 'GET' ? 200 : 201));
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_probe_incomplete');
  expect(await loadWebDavSettings()).toMatchObject({ testedAt: null, probeWarning: true });
  const methods = network.mock.calls.map(([, init]) => init?.method);
  expect(methods[methods.length - 1]).toBe(method);
});

it('preserves ambiguous MOVE outcomes instead of blindly deleting or adopting', async () => {
  network.mockImplementation(async (_url, init) => {
    if (init?.method === 'MOVE') throw new Error('lost reply');
    return response(init?.method === 'PROPFIND' ? 207 : 201);
  });
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_probe_incomplete');
  expect(network.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  expect(await loadWebDavSettings()).toMatchObject({ testedAt: null, probeWarning: true });
});

it('rejects readback mismatch/oversize and keeps unverified remote content intact', async () => {
  network.mockImplementation(async (_url, init) => response(init?.method === 'PROPFIND' ? 207 : init?.method === 'GET' ? 200 : 201, 'kloda-connection-test-extra'));
  await expect(testWebDavWriteAccess(storage)).rejects.toThrow('webdav_probe_incomplete');
  expect(network.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
});

it('refuses storage failure and lost readback rather than claiming saved success', async () => {
  set.mockRejectedValueOnce(new Error('fixture disk'));
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_storage');
  expect(await loadWebDavSettings()).toBeNull();
  get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_storage');
});

it('a lost intent write reply leaves only a complete unverified profile, never mixed credentials', async () => {
  set.mockImplementationOnce(async (key, raw) => { memory.set(key, raw); throw new Error('lost reply'); });
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_storage');
  const loaded = await loadWebDavSettings(); expect(loaded?.config.targetPath).toBe(storage.targetPath);
  expect(loaded?.testedAt).toBeNull(); expect(loaded?.probeWarning).toBe(true); expect(JSON.parse([...memory.values()][0]).storage).toEqual(storage);
});

it('does not save a stale form and blocks concurrent tests without duplicating probes', async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const implementation = network.getMockImplementation()!;
  network.mockImplementationOnce(async (...args) => { await waiting; return implementation(...args); });
  let current = true;
  const running = testAndSaveWebDavSettings(storage, () => current);
  await Promise.resolve(); await Promise.resolve();
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_busy');
  current = false; release();
  await expect(running).rejects.toThrow('webdav_cancelled');
  expect(set).not.toHaveBeenCalled();
});

it('rejects corrupt secure metadata and does not adopt legacy split settings as verified', async () => {
  expect(await loadWebDavSettings()).toBeNull();
  memory.set('kloda.webdav.profile.v1', '{"version":1}');
  await expect(loadWebDavSettings()).rejects.toThrow('webdav_storage');
  expect(set).not.toHaveBeenCalled();
});

it('persists uncertainty before remote mutation and retains it through reopening and a later successful probe', async () => {
  network.mockImplementation(async (_url, init) => {
    if (init?.method === 'MKCOL') {
      expect(JSON.parse([...memory.values()][0])).toMatchObject({ storage, testedAt: null, probeWarning: true });
      throw new Error('fixture lost reply');
    }
    return response(207);
  });
  await expect(testAndSaveWebDavSettings(storage, () => true)).rejects.toThrow('webdav_probe_incomplete');
  expect(await loadWebDavSettings()).toMatchObject({ testedAt: null, probeWarning: true });
  success();
  const saved = await testAndSaveWebDavSettings({ ...storage, targetPath: 'new-target' }, () => true);
  expect(saved.probeWarning).toBe(true); expect(saved.testedAt).not.toBeNull();
  expect(await loadWebDavSettings()).toEqual(saved);
});

it('accepts the prior v1 profile without an automatic rewrite or a fabricated warning', async () => {
  memory.set('kloda.webdav.profile.v1', JSON.stringify({ version: 1, storage, testedAt: null }));
  expect(await loadWebDavSettings()).toEqual({ config: { endpoint: storage.endpoint, targetPath: storage.targetPath, username: storage.username }, testedAt: null });
  expect(set).not.toHaveBeenCalled();
});
