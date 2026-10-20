// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  open: vi.fn(), status: vi.fn(), approve: vi.fn(), revoke: vi.fn(), close: vi.fn(), suspend: vi.fn(), receiver: vi.fn(), activity: vi.fn(),
  pick: vi.fn(), consent: vi.fn(), devices: vi.fn(), device: vi.fn(), remove: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => '/unused-native-fixture' },
  ipcMain: { handle: (name: string, callback: (...args: unknown[]) => Promise<unknown>) => boundary.handlers.set(name, callback) },
  dialog: { showOpenDialog: boundary.pick, showMessageBox: boundary.consent },
}));
vi.mock('node:module', async (actual) => ({
  ...await actual<typeof import('node:module')>(),
  createRequire: () => () => ({ openPairing: boundary.open }),
}));

const record = Buffer.alloc(16, 1).toString('base64url');
const fingerprint = Buffer.alloc(32, 3).toString('base64url');
interface WindowFixture {
  window: BrowserWindow;
  contents: EventEmitter;
  event: IpcMainInvokeEvent;
  focus(value: boolean): void;
}
let snapshot: Record<string, unknown>;
let fixture: WindowFixture;
let runtime: typeof import('./pairing.js');

function windowFixture(): WindowFixture {
  const frame = { url: 'http://127.0.0.1:5173/' };
  const contents = Object.assign(new EventEmitter(), { mainFrame: frame });
  let focused = true;
  const window = Object.assign(new EventEmitter(), {
    webContents: contents, isDestroyed: () => false, isVisible: () => true,
    isMinimized: () => false, isFocused: () => focused,
  });
  return { window: window as unknown as BrowserWindow, contents,
    event: { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent,
    focus: (value: boolean) => { focused = value; },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
function approve(event = fixture.event) {
  return boundary.handlers.get('kloda:pairing:approve-backup')!(event, record);
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  boundary.handlers.clear();
  vi.stubEnv('VITE_DEV_SERVER_URL', 'http://127.0.0.1:5173/');
  snapshot = { phase: 'complete', recordId: record, peerFingerprint: fingerprint,
    backupScope: { state: 'approved', revision: '1', folder: '/selected' } };
  boundary.status.mockImplementation(async () => JSON.stringify(snapshot));
  boundary.close.mockResolvedValue('{}');
  boundary.suspend.mockResolvedValue('{}');
  boundary.receiver.mockResolvedValue('{"available":true,"activeTransfers":1}');
  boundary.devices.mockResolvedValue(JSON.stringify({ items: [{ ...snapshot, trust: 'complete' }] }));
  boundary.device.mockImplementation(async () => JSON.stringify({ ...snapshot, trust: snapshot.phase }));
  boundary.activity.mockResolvedValue('{"receiverAvailable":true,"items":[]}');
  boundary.open.mockResolvedValue({ status: boundary.status, approveBackup: boundary.approve,
    revokeBackup: boundary.revoke, close: boundary.close, suspendPairing: boundary.suspend,
    receiverStatus: boundary.receiver, receiverActivity: boundary.activity, pairedDevices: boundary.devices, pairedDevice: boundary.device, removeDevice: boundary.remove });
  boundary.pick.mockResolvedValue({ canceled: false, filePaths: ['/selected'] });
  boundary.consent.mockResolvedValue({ response: 0 });
  fixture = windowFixture();
  runtime = await import('./pairing.js');
  runtime.bindPairingWindow(fixture.window);
  runtime.registerPairingHandlers(() => fixture.window);
});
afterEach(async () => { await runtime.closeNativePairing(); vi.unstubAllEnvs(); });

it('rejects foreign frames and incomplete QR trust before opening a scope consent dialog', async () => {
  const foreign = { ...fixture.event, senderFrame: { url: 'http://127.0.0.1:5173/' } } as unknown as IpcMainInvokeEvent;
  expect(await approve(foreign)).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.open).not.toHaveBeenCalled();
  snapshot.phase = 'consumed_pending_ack';
  expect(await approve()).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.pick).not.toHaveBeenCalled();
  expect(boundary.approve).not.toHaveBeenCalled();
});

it('never grants from a folder callback after same-origin main-frame navigation', async () => {
  const selected = deferred<{ canceled: boolean; filePaths: string[] }>();
  boundary.pick.mockReturnValue(selected.promise);
  const pending = approve();
  await vi.waitFor(() => expect(boundary.pick).toHaveBeenCalled());
  fixture.contents.emit('did-start-navigation', {}, 'http://127.0.0.1:5173/', false, true);
  selected.resolve({ canceled: false, filePaths: ['/selected'] });
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.consent).not.toHaveBeenCalled();
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.suspend).toHaveBeenCalledOnce();
  expect(boundary.close).not.toHaveBeenCalled();
});

it('does not turn late consent into a regrant after the native revision changed', async () => {
  const consent = deferred<{ response: number }>();
  boundary.consent.mockReturnValue(consent.promise);
  const pending = approve();
  await vi.waitFor(() => expect(boundary.consent).toHaveBeenCalled());
  snapshot.backupScope = { state: 'revoked', revision: '2', folder: '/selected' };
  consent.resolve({ response: 0 });
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.approve).not.toHaveBeenCalled();
});

it('allows an owned native-dialog blur without granting when consent is cancelled', async () => {
  const selected = deferred<{ canceled: boolean; filePaths: string[] }>();
  boundary.pick.mockReturnValue(selected.promise);
  boundary.consent.mockResolvedValue({ response: 1 });
  const pending = approve();
  await vi.waitFor(() => expect(boundary.pick).toHaveBeenCalled());
  fixture.focus(false);
  fixture.window.emit('blur');
  fixture.focus(true);
  selected.resolve({ canceled: false, filePaths: ['/selected'] });
  const reply = await pending as { ok: boolean };
  expect(reply.ok).toBe(true);
  expect(boundary.close).not.toHaveBeenCalled();
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.consent).toHaveBeenCalledWith(fixture.window, expect.objectContaining({
    defaultId: 1, cancelId: 1, buttons: ['Allow backup', 'Cancel'],
    detail: expect.stringContaining('No deletion, other-device access or two-way sync.'),
  }));
});

it('rejects a revoke whose caller navigated while native status was pending', async () => {
  const status = deferred<string>();
  boundary.status.mockReturnValue(status.promise);
  boundary.revoke.mockResolvedValue('{}');
  const pending = boundary.handlers.get('kloda:pairing:revoke-backup')!(fixture.event, record);
  await vi.waitFor(() => expect(boundary.status).toHaveBeenCalled());
  fixture.contents.emit('did-start-navigation', {}, 'http://127.0.0.1:5173/', false, true);
  status.resolve(JSON.stringify(snapshot));
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.revoke).not.toHaveBeenCalled();
});

it.each(['blur', 'hide', 'minimize'])('keeps the existing receiver alive after %s and rejects hidden grants', async (event) => {
  await runtime.startNativeReceiver();
  fixture.focus(false);
  fixture.window.emit(event);
  await vi.waitFor(() => expect(boundary.suspend).toHaveBeenCalledOnce());
  expect(await runtime.receiverStatus()).toEqual({ available: true, activeTransfers: 1 });
  expect(await approve()).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.close).not.toHaveBeenCalled();
  expect(boundary.open).toHaveBeenCalledOnce();
});

it('route cleanup suspends invitations without closing or reopening the receiver', async () => {
  await runtime.startNativeReceiver();
  expect(await boundary.handlers.get('kloda:pairing:close')!(fixture.event)).toEqual({ ok: true, value: undefined });
  expect(boundary.suspend).toHaveBeenCalledOnce();
  expect(boundary.close).not.toHaveBeenCalled();
  expect(await runtime.receiverStatus()).toEqual({ available: true, activeTransfers: 1 });
  expect(boundary.open).toHaveBeenCalledOnce();
});

it('reads history only from the retained owner and never opens failed or absent authority', async () => {
  const read = boundary.handlers.get('kloda:pairing:activity')!;
  expect(await read(fixture.event)).toEqual({ ok: false, code: 'outcome_unknown' });
  expect(boundary.open).not.toHaveBeenCalled();
  await runtime.startNativeReceiver();
  fixture.focus(false);
  expect(await read(fixture.event, record)).toEqual({ ok: true, value: { receiverAvailable: true, items: [] } });
  expect(boundary.activity).toHaveBeenCalledWith(record);
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.close).not.toHaveBeenCalled();
  await runtime.closeNativePairing();
  expect(await read(fixture.event)).toEqual({ ok: false, code: 'outcome_unknown' });
  expect(boundary.open).toHaveBeenCalledOnce();
});

it('rejects foreign history readers and malformed cursors before native dispatch', async () => {
  await runtime.startNativeReceiver();
  const read = boundary.handlers.get('kloda:pairing:activity')!;
  const foreign = { ...fixture.event, senderFrame: { url: 'http://127.0.0.1:5173/' } };
  expect(await read(foreign)).toEqual({ ok: false, code: 'candidate_stale' });
  for (const cursor of [null, 1, [], 'x', '../escape']) {
    expect(await read(fixture.event, cursor)).toEqual({ ok: false, code: 'candidate_stale' });
  }
  expect(boundary.activity).not.toHaveBeenCalled();
});

it('does not deliver a late history response to a replaced renderer generation', async () => {
  await runtime.startNativeReceiver();
  const response = deferred<string>();
  boundary.activity.mockReturnValue(response.promise);
  const pending = boundary.handlers.get('kloda:pairing:activity')!(fixture.event);
  await vi.waitFor(() => expect(boundary.activity).toHaveBeenCalledOnce());
  fixture.contents.emit('did-start-navigation', {}, 'http://127.0.0.1:5173/', false, true);
  response.resolve('{"receiverAvailable":true,"items":[]}');
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.close).not.toHaveBeenCalled();
});


it('lists durable devices without opening absent authority or changing the selected pairing', async () => {
  const read = boundary.handlers.get('kloda:pairing:devices')!;
  expect(await read(fixture.event)).toEqual({ ok: false, code: 'outcome_unknown' });
  expect(boundary.open).not.toHaveBeenCalled();
  await runtime.startNativeReceiver();
  fixture.focus(false);
  expect(await read(fixture.event, record)).toMatchObject({ ok: true, value: { items: [{ recordId: record }] } });
  expect(boundary.devices).toHaveBeenCalledWith(record);
  expect(await read({ ...fixture.event, senderFrame: {} })).toEqual({ ok: false, code: 'candidate_stale' });
  expect(await read(fixture.event, '../invalid')).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.close).not.toHaveBeenCalled();
});

it('uses the exact listed device for consent without selecting it as the current pairing', async () => {
  const other = Buffer.alloc(16, 5).toString('base64url');
  boundary.device.mockResolvedValue(JSON.stringify({ ...snapshot, recordId: other, trust: 'complete' }));
  boundary.approve.mockResolvedValue('{}');
  expect(await boundary.handlers.get('kloda:pairing:device-approve')!(fixture.event, other)).toEqual({ ok: true, value: {} });
  expect(boundary.device).toHaveBeenCalledTimes(2);
  expect(boundary.device).toHaveBeenLastCalledWith(other);
  expect(boundary.approve).toHaveBeenCalledWith(other, '/selected', '1');
  expect(boundary.status).not.toHaveBeenCalled();
  expect(boundary.consent).toHaveBeenCalledWith(fixture.window, expect.objectContaining({ defaultId: 1, detail: expect.stringContaining(fingerprint) }));
});

it('rejects stale device consent and hidden management without stopping the receiver', async () => {
  const consent = deferred<{ response: number }>();
  boundary.consent.mockReturnValue(consent.promise);
  const pending = boundary.handlers.get('kloda:pairing:device-approve')!(fixture.event, record);
  await vi.waitFor(() => expect(boundary.consent).toHaveBeenCalled());
  snapshot.backupScope = { state: 'revoked', revision: '2' };
  consent.resolve({ response: 0 });
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.approve).not.toHaveBeenCalled();
  fixture.focus(false);
  expect(await boundary.handlers.get('kloda:pairing:device-revoke')!(fixture.event, record)).toMatchObject({ ok: false });
  expect(boundary.revoke).not.toHaveBeenCalled();
  expect(boundary.close).not.toHaveBeenCalled();
});

it('refuses revoked trust or an unreadable ACL and rechecks foreground after a pending device read', async () => {
  boundary.device.mockRejectedValueOnce(new Error('acl_unavailable'));
  expect(await boundary.handlers.get('kloda:pairing:device-approve')!(fixture.event, record)).toEqual({ ok: false, code: 'acl_unavailable' });
  boundary.device.mockResolvedValueOnce(JSON.stringify({ ...snapshot, trust: 'revoked' }));
  expect(await boundary.handlers.get('kloda:pairing:device-approve')!(fixture.event, record)).toEqual({ ok: false, code: 'candidate_stale' });
  const read = deferred<string>();
  boundary.device.mockReturnValue(read.promise);
  const pending = boundary.handlers.get('kloda:pairing:device-revoke')!(fixture.event, record);
  await vi.waitFor(() => expect(boundary.device).toHaveBeenCalledTimes(3));
  fixture.window.emit('hide');
  read.resolve(JSON.stringify({ ...snapshot, trust: 'complete' }));
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.revoke).not.toHaveBeenCalled();
  expect(boundary.pick).not.toHaveBeenCalled();
});

it('invalidates pending device consent on route cleanup while retaining the native receiver', async () => {
  const consent = deferred<{ response: number }>();
  boundary.consent.mockReturnValue(consent.promise);
  const pending = boundary.handlers.get('kloda:pairing:device-approve')!(fixture.event, record);
  await vi.waitFor(() => expect(boundary.consent).toHaveBeenCalled());
  expect(await boundary.handlers.get('kloda:pairing:close')!(fixture.event)).toEqual({ ok: true, value: undefined });
  consent.resolve({ response: 0 });
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.suspend).toHaveBeenCalledOnce();
  expect(boundary.approve).not.toHaveBeenCalled();
  expect(boundary.close).not.toHaveBeenCalled();
  expect(await runtime.receiverStatus()).toEqual({ available: true, activeTransfers: 1 });
});


it('fences device removal on hidden/foreign callers and route departure during native consent', async () => {
  const remove = boundary.handlers.get('kloda:pairing:device-remove')!;
  fixture.focus(false);
  expect(await remove(fixture.event, record, 'tr')).toMatchObject({ ok: false });
  fixture.focus(true);
  expect(await remove({ ...fixture.event, senderFrame: {} }, record, 'tr')).toMatchObject({ ok: false });
  const consent = deferred<{ response: number }>();
  boundary.consent.mockReturnValue(consent.promise);
  const pending = remove(fixture.event, record, 'tr');
  await vi.waitFor(() => expect(boundary.consent).toHaveBeenCalled());
  await boundary.handlers.get('kloda:pairing:close')!(fixture.event);
  consent.resolve({ response: 1 });
  expect(await pending).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.remove).not.toHaveBeenCalled();
  expect(boundary.close).not.toHaveBeenCalled();
});


it('keeps the first removal consent reservation when concurrent requests are refused', async () => {
  const remove = boundary.handlers.get('kloda:pairing:device-remove')!;
  const consent = deferred<{ response: number }>();
  boundary.consent.mockReturnValue(consent.promise);
  const first = remove(fixture.event, record, 'tr');
  await vi.waitFor(() => expect(boundary.consent).toHaveBeenCalledOnce());
  expect(await remove(fixture.event, record, 'tr')).toEqual({ ok: false, code: 'candidate_stale' });
  expect(await remove(fixture.event, record, 'tr')).toEqual({ ok: false, code: 'candidate_stale' });
  expect(boundary.consent).toHaveBeenCalledOnce();
  consent.resolve({ response: 0 });
  expect(await first).toEqual({ ok: false, code: 'cancelled' });
  expect(boundary.remove).not.toHaveBeenCalled();
});
