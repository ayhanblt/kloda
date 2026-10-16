import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type WebContents } from 'electron';
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
  approveBackup(record: string, folder: string, revision?: string): Promise<string>;
  revokeBackup(record: string): Promise<string>;
  close(): Promise<string>;
}
interface NativeAddon { openPairing(directory: string): Promise<NativePairingOwner> }
const require = createRequire(import.meta.url);
const errorCodes: Record<string, true> = {
  invalid_qr: true, unsupported_version: true, lan_unavailable: true, native_unsupported: true,
  identity_unavailable: true, continuity_lost: true, tls_rejected: true, proof_rejected: true,
  invitation_expired: true, candidate_stale: true, already_paired: true, storage_failure: true,
  connection_closed: true, outcome_unknown: true, cancelled: true, revoked: true,
  acl_busy: true, acl_unavailable: true, backup_unavailable: true, backup_permission_denied: true,
  backup_path_rejected: true, backup_scope_changed: true,
  backup_full: true, backup_busy: true,
};
let owner: Promise<NativePairingOwner> | null = null;
let closing: Promise<void> | null = null;
let closeFailed = false;
let renderer: { contents: WebContents; generation: number; scopeConsent: boolean } | null = null;

export function bindPairingWindow(window: BrowserWindow): void {
  if (renderer) void closeNativePairing().catch(() => undefined);
  const binding = { contents: window.webContents, generation: 0, scopeConsent: false };
  renderer = binding;
  const abandon = () => {
    if (renderer !== binding) return;
    binding.generation += 1;
    void closeNativePairing().catch(() => undefined);
  };
  binding.contents.on('destroyed', abandon);
  binding.contents.on('render-process-gone', abandon);
  window.on('hide', abandon);
  window.on('minimize', abandon);
  window.on('blur', () => { if (!binding.scopeConsent) abandon(); });
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

function trusted(event: IpcMainInvokeEvent, window: BrowserWindow | null, cleanupOnly = false): void {
  if (!window || window.isDestroyed() ||
    (!cleanupOnly && (!window.isVisible() || window.isMinimized() || !window.isFocused())) ||
    event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
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

function scopeSnapshot(native: unknown, record: string): { fingerprint: string; revision?: string } {
  if (!native || typeof native !== 'object') throw new Error('candidate_stale');
  const status = native as { phase?: unknown; recordId?: unknown; peerFingerprint?: unknown; backupScope?: { revision?: unknown } };
  if (status.phase !== 'complete' || status.recordId !== record ||
    typeof status.peerFingerprint !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(status.peerFingerprint)) {
    throw new Error('candidate_stale');
  }
  const revision = status.backupScope?.revision;
  if (revision !== undefined && (typeof revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(revision))) {
    throw new Error('candidate_stale');
  }
  return { fingerprint: status.peerFingerprint, revision };
}

async function approveBackup(
  native: NativePairingOwner, event: IpcMainInvokeEvent, window: () => BrowserWindow | null, record: unknown,
): Promise<unknown> {
  reference(record);
  const binding = renderer;
  const parent = window();
  const generation = binding?.generation;
  const observed = scopeSnapshot(JSON.parse(await native.status()) as unknown, record);
  trusted(event, parent);
  if (!binding || renderer !== binding || binding.generation !== generation || binding.scopeConsent ||
    !parent || closing || closeFailed) throw new Error('candidate_stale');
  const check = () => {
    trusted(event, window());
    if (renderer !== binding || binding.generation !== generation || window() !== parent ||
      closing || closeFailed) throw new Error('candidate_stale');
  };
  binding.scopeConsent = true;
  try {
    const selected = await dialog.showOpenDialog(parent, {
      properties: ['openDirectory'], title: 'Select this device’s PC backup folder', buttonLabel: 'Select folder',
    });
    check();
    if (selected.canceled || selected.filePaths.length !== 1) return JSON.parse(await native.status()) as unknown;
    const folder = selected.filePaths[0]!;
    const consent = await dialog.showMessageBox(parent, {
      type: 'question', title: 'Kloda — photo backup permission', message: 'Allow this paired device to back up photos?',
      detail: `Device fingerprint: ${observed.fingerprint}\nFolder: ${folder}\n\nUpload photos, view upload status, finalize uploads, and list or restore only this device’s backed-up photos. No deletion or other-device access.\n\nThis configures permission; LAN photo transfer is not yet implemented.`,
      buttons: ['Allow photo backup', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true,
    });
    check();
    if (consent.response !== 0) return JSON.parse(await native.status()) as unknown;
    const latest = scopeSnapshot(JSON.parse(await native.status()) as unknown, record);
    check();
    if (latest.fingerprint !== observed.fingerprint || latest.revision !== observed.revision) throw new Error('candidate_stale');
    return JSON.parse(await native.approveBackup(record, folder, observed.revision)) as unknown;
  } finally {
    binding.scopeConsent = false;
    if (renderer === binding && (parent.isDestroyed() || !parent.isVisible() || parent.isMinimized() || !parent.isFocused())) {
      binding.generation += 1;
      void closeNativePairing().catch(() => undefined);
    }
  }
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
  ipcMain.handle('kloda:pairing:approve-backup', async (event, record: unknown) => {
    try { return { ok: true, value: await approveBackup(await nativeOwner(event, window), event, window, record) }; }
    catch (error) { return { ok: false, code: code(error) }; }
  });
  ipcMain.handle('kloda:pairing:revoke-backup', async (event, record: unknown) => {
    try {
      reference(record);
      const native = await nativeOwner(event, window);
      const binding = renderer;
      const generation = binding?.generation;
      scopeSnapshot(JSON.parse(await native.status()) as unknown, record);
      trusted(event, window());
      if (!binding || renderer !== binding || binding.generation !== generation || closing || closeFailed) {
        throw new Error('candidate_stale');
      }
      return { ok: true, value: JSON.parse(await native.revokeBackup(record)) as unknown };
    } catch (error) { return { ok: false, code: code(error) }; }
  });
  ipcMain.handle('kloda:pairing:close', async (event) => {
    // Hidden-renderer cleanup may close an existing owner, never open one.
    try { trusted(event, window(), true); await closeNativePairing(); return { ok: true, value: undefined }; }
    catch (error) { return { ok: false, code: code(error) }; }
  });
}
