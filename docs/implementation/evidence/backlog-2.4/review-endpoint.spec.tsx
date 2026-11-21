// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { NodeWebDavClient } from '../../../../apps/desktop/electron/runtime/webdav';
import { testWebDavWriteAccess } from '../../../../apps/mobile/src/shared/api/webdav';

const { mobileFetch } = vi.hoisted(() => ({ mobileFetch: vi.fn() }));
vi.mock('expo/fetch', () => ({ fetch: mobileFetch }));
vi.mock('expo-modules-core', () => ({ uuid: { v4: () => 'fixed-probe' } }));
const storage = { endpoint: 'https://fixture.example:8083/webdav/', targetPath: 'Kloda', username: 'fixture', password: 'public-test-secret' };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('G24-02: mobile real validator/probe retains endpoint port and DAV root', async () => {
  mobileFetch.mockResolvedValue({ status: 404, body: { cancel: async () => undefined } });
  await expect(testWebDavWriteAccess(storage)).rejects.toThrow('webdav_connection');
  expect(mobileFetch.mock.calls[0][0]).toBe('https://fixture.example:8083/webdav/Kloda/');
  expect(mobileFetch.mock.calls[0][1].method).toBe('PROPFIND');
  expect(mobileFetch).toHaveBeenCalledOnce();
});

it('G24-02: desktop real probe retains endpoint port and DAV root', async () => {
  const network = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', network);
  await expect(new NodeWebDavClient(storage).verifyWriteAccess()).rejects.toMatchObject({ code: 'unknown' });
  expect(String(network.mock.calls[0][0])).toBe('https://fixture.example:8083/webdav/Kloda/');
  expect(network.mock.calls[0][1].method).toBe('PROPFIND');
  expect(network).toHaveBeenCalledOnce();
});
