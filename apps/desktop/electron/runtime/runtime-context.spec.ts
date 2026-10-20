// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import { DesktopSyncRuntime } from './runtime.js';

const fixture = vi.hoisted(() => ({ upload: vi.fn(), inspect: vi.fn(), finalize: vi.fn(), picker: vi.fn(), decrypt: vi.fn() }));
vi.mock('electron', () => ({ dialog: { showOpenDialog: fixture.picker }, safeStorage: {
  isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value), decryptString: fixture.decrypt,
} }));
vi.mock('./webdav.js', () => ({ NodeWebDavClient: class {
  inspectFile = fixture.inspect; uploadTemporary = fixture.upload; finalizeUpload = fixture.finalize;
} }));

let root: string;
let source: string;
let journal: DesktopSyncJournal;
let runtime: DesktopSyncRuntime;
const storage = { endpoint: 'https://fixture.invalid', username: 'fixture', password: 'fixture', targetPath: 'old' };
beforeEach(async () => {
  vi.resetAllMocks();
  fixture.decrypt.mockImplementation((value: Buffer) => value.toString());
  const published = new Set<string>();
  fixture.inspect.mockImplementation(async (path: string) => path.includes('.kloda-upload-') || published.has(path) ? 'match' : 'missing');
  fixture.finalize.mockImplementation(async (path: string) => { published.add(path); return 'moved'; });
  root = mkdtempSync(join(tmpdir(), 'kloda-runtime-context-'));
  source = join(root, 'source'); mkdirSync(source); writeFileSync(join(source, 'public-fixture.txt'), 'fixture');
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  journal.replaceSources([{ path: source, displayName: 'fixture' }]);
  runtime = new DesktopSyncRuntime(journal, () => null);
  await runtime.saveStorage(storage); journal.setStorageTested();
});
afterEach(() => { runtime.prepareToQuit(); journal.database.close(); rmSync(root, { recursive: true, force: true }); });

async function heldUpload() {
  let finish!: () => void;
  fixture.upload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const running = runtime.startSync();
  const outcome = running.catch(error => error);
  await vi.waitFor(() => expect(fixture.upload).toHaveBeenCalledOnce());
  return { finish, outcome };
}

it('persists uploaded recovery before stopping old work on genuine target change', async () => {
  const context = journal.getWorkRevision();
  const { finish, outcome } = await heldUpload();
  await runtime.saveStorage({ ...storage, targetPath: 'new' });
  finish();
  expect(await outcome).toMatchObject({ code: 'settings_changed' });
  expect(journal.getLatestProgress()).toMatchObject({ contextId: context, status: 'stopped', errorCode: 'settings_changed', completedFiles: 0 });
  expect(journal.getDraft().storage?.targetPath).toBe('new');
  expect(journal.getReviewUploads()).toEqual([]);
  expect(journal.getPendingUploads(JSON.stringify([storage.endpoint, storage.targetPath, storage.username]))[0].phase).toBe('uploaded');
  expect(fixture.finalize).not.toHaveBeenCalled();
  expect(runtime.getBackgroundState()).toEqual({ active: false, failed: false });
});

it.each(['picker', 'journal'])('fences changed source paths through %s without erasing pending work', async mode => {
  const context = journal.getWorkRevision();
  const { finish, outcome } = await heldUpload();
  const replacement = join(root, 'replacement'); mkdirSync(replacement);
  if (mode === 'picker') {
    fixture.picker.mockResolvedValue({ canceled: false, filePaths: [replacement] });
    await runtime.pickSources();
  } else journal.replaceSources([{ path: replacement, displayName: 'replacement' }]);
  finish();
  expect(await outcome).toMatchObject({ code: 'settings_changed' });
  expect(journal.getLatestProgress()).toMatchObject({ contextId: context, status: 'stopped' });
  expect(fixture.finalize).not.toHaveBeenCalled();
  expect(journal.database.prepare('SELECT phase FROM pending_upload').all()).toEqual([{ phase: 'uploaded' }]);
});

it('does not stop an active job when the same target and password are saved again', async () => {
  const context = journal.getWorkRevision();
  const { finish, outcome } = await heldUpload();
  await runtime.saveStorage(storage);
  expect(journal.getWorkRevision()).toBe(context);
  finish();
  expect(await outcome).toMatchObject({ status: 'completed', contextId: context });
  expect(fixture.finalize).toHaveBeenCalledOnce();
});

it('keeps the active context unchanged after a rejected storage transaction', async () => {
  const context = journal.getWorkRevision();
  const { finish, outcome } = await heldUpload();
  journal.database.exec(`CREATE TRIGGER reject_target BEFORE INSERT ON setting
    WHEN NEW.key = 'storage' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
  expect(() => runtime.saveStorage({ ...storage, targetPath: 'new' })).toThrow('fixture failure');
  expect(journal.getWorkRevision()).toBe(context);
  finish();
  expect(await outcome).toMatchObject({ status: 'completed', contextId: context });
});

it('runs a new scheduled context after old work stops rather than returning its old result', async () => {
  const oldContext = journal.getWorkRevision();
  const { finish, outcome } = await heldUpload();
  await runtime.saveStorage({ ...storage, targetPath: 'new' }); journal.setStorageTested();
  const newContext = journal.getWorkRevision();
  const scheduled = runtime.startScheduledSync();
  finish();
  expect(await outcome).toMatchObject({ code: 'settings_changed' });
  await expect(scheduled).rejects.toMatchObject({ code: 'review_required' });
  expect(journal.getLatestProgress()).toMatchObject({ status: 'needs_review', contextId: newContext, completedFiles: 1 });
  expect(await runtime.getWebDavIssues()).toEqual([expect.objectContaining({ errorCode: 'settings_changed', canKeepBoth: false })]);
  expect(newContext).not.toBe(oldContext);
  expect(fixture.upload).toHaveBeenCalledTimes(2);
  expect(fixture.finalize).toHaveBeenCalledOnce();
});

it.each(['credentials', 'enumeration'])('persists an early %s error over a previous completed snapshot', async stage => {
  journal.saveProgress({ id: 'historical', status: 'completed', bytesTransferred: 7, bytesTotal: 7, completedFiles: 1, totalFiles: 1 });
  if (stage === 'credentials') fixture.decrypt.mockImplementation(() => { throw new Error('credential unavailable'); });
  else journal.replaceSources([{ path: join(root, 'missing-source'), displayName: 'missing' }]);
  const context = journal.getWorkRevision();
  await expect(runtime.startSync()).rejects.toThrow();
  const saved = journal.getLatestProgress();
  expect(saved).toMatchObject({ status: 'failed', contextId: context, completedFiles: 0, attempts: 1 });
  expect(saved?.id).not.toBe('historical');
  expect(saved?.errorCode).toBe(stage === 'enumeration' ? 'source_changed' : 'unknown');
  expect(fixture.upload).not.toHaveBeenCalled();
});

it('clears the tray intervention mark after verified review resolution without inventing a completed run', async () => {
  const inspect = fixture.inspect.getMockImplementation()!;
  fixture.inspect.mockImplementation(async (path: string) => path.endsWith('/public-fixture.txt') ? 'mismatch' : inspect(path));
  expect(await runtime.startSync()).toMatchObject({ status: 'needs_review' });
  expect(runtime.getBackgroundState()).toEqual({ active: false, failed: true });
  const issue = (await runtime.getWebDavIssues())[0];
  await runtime.reviewWebDavIssue(issue.id, 'keep_both', () => {});
  expect(await runtime.getWebDavIssues()).toEqual([]);
  expect(runtime.getBackgroundState()).toEqual({ active: false, failed: false });
  expect(await runtime.getProgress()).toMatchObject({ status: 'needs_review' });
});

it('serializes review with uploads and fences a changed context during review', async () => {
  const held = await heldUpload();
  await expect(runtime.reviewWebDavIssue('a'.repeat(43), 'skip', () => {})).rejects.toMatchObject({ code: 'backup_busy' });
  held.finish(); await held.outcome;
  const source = journal.getSourcePaths()[0].id;
  const target = JSON.stringify([storage.endpoint, storage.targetPath, storage.username]);
  const revision = 'sha256:' + 'a'.repeat(64);
  journal.savePendingUpload(target, source, 'review.txt', revision, 'owned-temp');
  const pending = journal.getPendingUploads(target)[0];
  journal.advancePendingUpload(target, pending, 'uploaded'); journal.advancePendingUpload(target, pending, 'conflict');
  let finish!: (value: string) => void;
  fixture.inspect.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
  const review = runtime.reviewWebDavIssue((await runtime.getWebDavIssues())[0].id, 'keep_both', () => {}).catch(error => error);
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  await expect(runtime.startSync()).rejects.toMatchObject({ code: 'backup_busy' });
  await expect(runtime.reviewWebDavIssue('a'.repeat(43), 'skip', () => {})).rejects.toMatchObject({ code: 'backup_busy' });
  const moves = fixture.finalize.mock.calls.length;
  await runtime.saveStorage({ ...storage, targetPath: 'new' });
  finish('match');
  expect(await review).toMatchObject({ code: 'settings_changed' });
  expect(fixture.finalize.mock.calls.length).toBe(moves);
  expect(journal.getPendingUploads(target)).toHaveLength(1);
});
