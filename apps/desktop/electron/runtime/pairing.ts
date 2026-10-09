import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface NativePairingOwner {
  status(): Promise<string>;
  createInvitation(): Promise<string>;
  approve(operation: string, generation: string): Promise<string>;
  deny(operation: string, generation: string): Promise<string>;
  cancel(operation: string): Promise<string>;
  resume(record: string): Promise<string>;
  close(): Promise<string>;
}
interface NativeAddon { openPairing(directory: string): Promise<NativePairingOwner> }
const require = createRequire(import.meta.url);
const errorCodes: Record<string, true> = {
  invalid_qr: true, unsupported_version: true, lan_unavailable: true, native_unsupported: true,
  identity_unavailable: true, continuity_lost: true, tls_rejected: true, proof_rejected: true,
  invitation_expired: true, candidate_stale: true, already_paired: true, storage_failure: true,
  connection_closed: true, outcome_unknown: true, cancelled: true, revoked: true,
};
let owner: Promise<NativePairingOwner> | null = null;
let closing: Promise<void> | null = null;
let closeFailed = false;
let renderer: { contents: WebContents; generation: number } | null = null;

export function bindPairingWindow(window: BrowserWindow): void {
  if (renderer) void closeNativePairing().catch(() => undefined);
  const binding = { contents: window.webContents, generation: 0 };
  renderer = binding;
  const abandon = () => {
    if (renderer !== binding) return;
    binding.generation += 1;
    void closeNativePairing().catch(() => undefined);
  };
  binding.contents.on('destroyed', abandon);
  binding.contents.on('render-process-gone', abandon);
  binding.contents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) abandon();
  });
}

async function nativeOwner(event: IpcMainInvokeEvent, window: () => BrowserWindow | null): Promise<NativePairingOwner> {
  const binding = renderer;
  const generation = binding?.generation;
  if (closing) await closing;
  trusted(event, window());
  if (!binding || renderer !== binding || binding.contents !== event.sender || binding.generation !== generation || closeFailed) {
    throw Object.assign(new Error('outcome_unknown'), { code: 'outcome_unknown' });
  }
  if (!owner) {
    owner = (async () => {
      let addon: NativeAddon;
      try { addon = require(fileURLToPath(new URL('../../native/kloda_pairing.node', import.meta.url))) as NativeAddon; }
      catch { throw Object.assign(new Error('native_unsupported'), { code: 'native_unsupported' }); }
      if (typeof addon.openPairing !== 'function') throw Object.assign(new Error('native_unsupported'), { code: 'native_unsupported' });
      return addon.openPairing(join(app.getPath('userData'), 'pairing'));
    })();
    void owner.catch(() => { owner = null; });
  }
  const native = await owner;
  trusted(event, window());
  if (renderer !== binding || binding.generation !== generation || closing || closeFailed) {
    throw Object.assign(new Error('candidate_stale'), { code: 'candidate_stale' });
  }
  return native;
}

export async function closeNativePairing(): Promise<void> {
  if (closing) return closing;
  const retained = owner;
  if (!retained) return;
  closing = (async () => {
    try {
      await (await retained).close();
      owner = null;
      closeFailed = false;
    } catch (error) {
      closeFailed = true;
      throw error;
    }
  })();
  try { await closing; } finally { closing = null; }
}

function trusted(event: IpcMainInvokeEvent, window: BrowserWindow | null): void {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
    throw Object.assign(new Error('candidate_stale'), { code: 'candidate_stale' });
  }
  const actual = new URL(event.senderFrame.url);
  const expected = process.env.VITE_DEV_SERVER_URL ? new URL(process.env.VITE_DEV_SERVER_URL)
    : new URL('../../renderer/index.html', import.meta.url);
  if (actual.protocol !== expected.protocol || actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.search !== expected.search) {
    throw Object.assign(new Error('candidate_stale'), { code: 'candidate_stale' });
  }
}
function reference(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(value)) throw Object.assign(new Error('candidate_stale'), { code: 'candidate_stale' });
}
function generation(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9]{1,20}$/.test(value)) throw Object.assign(new Error('candidate_stale'), { code: 'candidate_stale' });
}
function code(error: unknown): string {
  if (error && typeof error === 'object') {
    const source = error as Record<string, unknown>;
    for (const field of ['code', 'message'] as const) {
      const value = Object.hasOwn(source, field) ? source[field] : undefined;
      if (typeof value === 'string' && Object.hasOwn(errorCodes, value)) return value;
    }
  }
  return 'outcome_unknown';
}
export function registerPairingHandlers(window: () => BrowserWindow | null): void {
  const handle = (method: string, action: (native: NativePairingOwner, ...args: unknown[]) => Promise<unknown>) => {
    ipcMain.handle(`kloda:pairing:${method}`, async (event, ...args: unknown[]) => {
      try { return { ok: true, value: await action(await nativeOwner(event, window), ...args) }; }
      catch (error) { return { ok: false, code: code(error) }; }
    });
  };
  handle('status', async (native) => JSON.parse(await native.status()) as unknown);
  handle('create', async (native) => JSON.parse(await native.createInvitation()) as unknown);
  handle('approve', async (native, operation, candidate) => {
    reference(operation); generation(candidate);
    return JSON.parse(await native.approve(operation, candidate)) as unknown;
  });
  handle('deny', async (native, operation, candidate) => {
    reference(operation); generation(candidate);
    return JSON.parse(await native.deny(operation, candidate)) as unknown;
  });
  handle('cancel', async (native, operation) => {
    reference(operation); return JSON.parse(await native.cancel(operation)) as unknown;
  });
  handle('resume', async (native, record) => {
    reference(record); return JSON.parse(await native.resume(record)) as unknown;
  });
  ipcMain.handle('kloda:pairing:close', async (event) => {
    try { trusted(event, window()); await closeNativePairing(); return { ok: true, value: undefined }; }
    catch (error) { return { ok: false, code: code(error) }; }
  });
}
