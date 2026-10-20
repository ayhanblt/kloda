// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import { DesktopSyncRuntime } from './runtime.js';

const network = vi.hoisted(() => ({ upload: vi.fn(), inspect: vi.fn(), finalize: vi.fn() }));
vi.mock('electron', () => ({
  dialog: {}, safeStorage: { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString() },
}));
vi.mock('./webdav.js', () => ({ NodeWebDavClient: class {
  inspectFile = network.inspect;
  uploadTemporary = network.upload;
  finalizeUpload = network.finalize;
} }));

let root: string;
let journal: DesktopSyncJournal;
let runtime: DesktopSyncRuntime;
beforeEach(() => {
  vi.resetAllMocks();
  root = mkdtempSync(join(tmpdir(), 'kloda-runtime-lifecycle-'));
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
});
afterEach(() => { journal.database.close(); rmSync(root, { recursive: true, force: true }); });

it('projects a crash-interrupted running record as a failure consistently after reopen', async () => {
  journal.saveProgress({ id: 'interrupted', status: 'running', bytesTransferred: 7, bytesTotal: 20, completedFiles: 1, totalFiles: 2 });
  journal.database.close();
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
  expect(runtime.getBackgroundState()).toEqual({ active: false, failed: true });
  expect(await runtime.getProgress()).toMatchObject({ status: 'failed', completedFiles: 1 });
});

it('preserves pending upload recovery and cannot publish completed run state after confirmed exit', async () => {
  const source = join(root, 'source');
  mkdirSync(source);
  writeFileSync(join(source, 'public-fixture.txt'), 'fixture');
  journal.replaceSources([{ path: source, displayName: 'fixture' }]);
  await runtime.saveStorage({ endpoint: 'https://fixture.invalid', username: 'fixture', password: 'fixture', targetPath: 'backup' });
  journal.setStorageTested();
  let finishUpload!: () => void;
  network.upload.mockImplementation(() => new Promise<void>((resolve) => { finishUpload = resolve; }));
  const running = runtime.startSync();
  await vi.waitFor(() => expect(network.upload).toHaveBeenCalledOnce());
  expect(runtime.getBackgroundState().active).toBe(true);
  runtime.prepareToQuit();
  expect(await runtime.getProgress()).toMatchObject({ status: 'failed', completedFiles: 0 });
  network.inspect.mockResolvedValue('missing');
  finishUpload();
  await expect(running).rejects.toThrow();
  expect(await runtime.getProgress()).toMatchObject({ status: 'failed', completedFiles: 0 });
  const rows = journal.database.prepare('SELECT * FROM pending_upload').all();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ phase: 'uploaded' });
  expect(network.finalize).not.toHaveBeenCalled();
  expect(journal.database.prepare('SELECT * FROM upload_receipt').all()).toHaveLength(0);
  await expect(runtime.startSync()).rejects.toThrow('shutting down');
});

it('does not classify a never-configured idle setup as a backup failure', () => {
  expect(runtime.getBackgroundState()).toEqual({ active: false, failed: false });
});

it('does not start a new upload after quitting during receipt revalidation', async () => {
  const source = join(root, 'source');
  mkdirSync(source);
  writeFileSync(join(source, 'fixture.txt'), 'fixture');
  journal.replaceSources([{ path: source, displayName: 'fixture' }]);
  const storage = { endpoint: 'https://fixture.invalid', username: 'fixture', password: 'fixture', targetPath: 'backup' };
  await runtime.saveStorage(storage);
  journal.setStorageTested();
  journal.database.prepare('INSERT INTO upload_receipt(target_id,source_id,relative_path,revision) VALUES (?,?,?,?)').run(
    JSON.stringify([storage.endpoint, storage.targetPath, storage.username]), journal.getSourcePaths()[0].id,
    'fixture.txt', `sha256:${createHash('sha256').update('fixture').digest('hex')}`,
  );
  let inspected!: (state: string) => void;
  network.inspect.mockReturnValue(new Promise<string>((resolve) => { inspected = resolve; }));
  const running = runtime.startSync();
  await vi.waitFor(() => expect(network.inspect).toHaveBeenCalledOnce());
  runtime.prepareToQuit();
  inspected('mismatch');
  await expect(running).rejects.toThrow('shutting down');
  expect(network.upload).not.toHaveBeenCalled();
  expect(journal.database.prepare('SELECT * FROM pending_upload').all()).toHaveLength(0);
  expect(await runtime.getProgress()).toMatchObject({ status: 'failed' });
});

it('persists explicit login choice separately from externally observed OS state', () => {
  expect(journal.getAutostartChoice()).toBeUndefined();
  journal.saveAutostartChoice(true);
  journal.database.close();
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  expect(journal.getAutostartChoice()).toBe(true);
  journal.saveAutostartChoice(false);
  expect(journal.getAutostartChoice()).toBe(false);
});
