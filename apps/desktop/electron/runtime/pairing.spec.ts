// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  open: vi.fn(), status: vi.fn(), approve: vi.fn(), revoke: vi.fn(), close: vi.fn(),
  pick: vi.fn(), consent: vi.fn(),
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
  boundary.open.mockResolvedValue({ status: boundary.status, approveBackup: boundary.approve,
    revokeBackup: boundary.revoke, close: boundary.close });
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
  expect(boundary.close).toHaveBeenCalledOnce();
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
