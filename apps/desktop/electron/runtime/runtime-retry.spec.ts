// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import { DesktopSyncRuntime } from './runtime.js';
import { WebDavFailure } from './webdav-errors.js';

const network = vi.hoisted(() => ({ upload: vi.fn(), inspect: vi.fn(), finalize: vi.fn() }));
vi.mock('electron', () => ({ dialog: {}, safeStorage: {
  isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString(),
} }));
vi.mock('./webdav.js', () => ({ NodeWebDavClient: class {
  inspectFile = network.inspect; uploadTemporary = network.upload; finalizeUpload = network.finalize;
} }));

let root: string;
let journal: DesktopSyncJournal;
let runtime: DesktopSyncRuntime;
let remote: Set<string>;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
  remote = new Set();
  network.inspect.mockImplementation(async (path: string) => remote.has(path) ? 'match' : 'missing');
  network.upload.mockImplementation(async (path: string) => { remote.add(path); });
  network.finalize.mockImplementation(async (path: string, temporary: string) => { remote.add(path); remote.delete(temporary); return 'moved'; });
  root = mkdtempSync(join(tmpdir(), 'kloda-runtime-retry-'));
  const source = join(root, 'source'); mkdirSync(source); writeFileSync(join(source, 'fixture.txt'), 'fixture');
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  journal.replaceSources([{ path: source, displayName: 'fixture' }]);
  runtime = new DesktopSyncRuntime(journal, () => null);
  await runtime.saveStorage({ endpoint: 'https://fixture.invalid', username: 'fixture', password: 'fixture', targetPath: 'backup' });
  journal.setStorageTested();
});
afterEach(() => { runtime.prepareToQuit(); journal.database.close(); rmSync(root, { recursive: true, force: true }); vi.useRealTimers(); });

async function waiting(attempts: number) {
  await vi.waitFor(() => expect(journal.getLatestProgress()).toMatchObject({ status: 'waiting_retry', attempts }));
  return journal.getLatestProgress()!;
}

it('runs exactly five transient attempts, waits sixty seconds after each failure, and preserves exhaustion until the next scheduled opportunity', async () => {
  const failedAt: number[] = [];
  network.upload.mockImplementation(async () => { failedAt.push(Date.now()); throw new WebDavFailure('connection_unavailable'); });
  const outcome = runtime.startSync().catch(error => error);
  const first = await waiting(1);
  const id = first.id;
  for (let attempt = 1; attempt < 5; attempt += 1) {
    const saved = await waiting(attempt);
    expect(saved.id).toBe(id);
    expect(saved.retryAt).toBe(failedAt[attempt - 1] + 60_000);
    const remaining = saved.retryAt! - Date.now();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(60_000);
    await vi.advanceTimersByTimeAsync(remaining - 1);
    expect(network.upload).toHaveBeenCalledTimes(attempt);
    await vi.advanceTimersByTimeAsync(1);
    if (attempt < 4) await waiting(attempt + 1);
  }
  expect(await outcome).toMatchObject({ code: 'connection_unavailable' });
  expect(network.upload).toHaveBeenCalledTimes(5);
  const exhausted = journal.getLatestProgress()!;
  expect(exhausted).toMatchObject({ id, status: 'failed', errorCode: 'retry_exhausted', attempts: 5 });
  expect(exhausted.nextOpportunityAt).toBeGreaterThan(Date.now());
  await expect(runtime.startScheduledSync()).rejects.toMatchObject({ code: 'retry_exhausted' });
  expect(network.upload).toHaveBeenCalledTimes(5);
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
  await expect(runtime.startScheduledSync()).rejects.toMatchObject({ code: 'retry_exhausted' });
  expect(network.upload).toHaveBeenCalledTimes(5);
});

it('stops retrying after success and shares one active attempt for simultaneous requests in the same context', async () => {
  network.upload.mockRejectedValueOnce(new WebDavFailure('connection_unavailable'));
  const running = runtime.startSync();
  expect(runtime.startSync()).toBe(running);
  const saved = await waiting(1);
  expect(runtime.startSync()).toBe(running);
  await vi.advanceTimersByTimeAsync(saved.retryAt! - Date.now());
  expect(await running).toMatchObject({ id: saved.id, status: 'completed', attempts: 2 });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(network.upload).toHaveBeenCalledTimes(2);
  expect(journal.getLatestProgress()?.retryAt).toBeUndefined();
});

it('reopens a waiting retry with the same run, attempt budget and deadline instead of uploading immediately', async () => {
  network.upload.mockRejectedValueOnce(new WebDavFailure('connection_unavailable'));
  const oldOutcome = runtime.startSync().catch(error => error);
  const saved = await waiting(1);
  runtime.prepareToQuit();
  expect(await oldOutcome).toMatchObject({ code: 'interrupted' });
  expect(journal.getLatestProgress()).toEqual(saved);
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
  runtime.resumeRetries();
  const resumed = runtime.startSync();
  expect(journal.getLatestProgress()).toEqual(saved);
  await vi.advanceTimersByTimeAsync(saved.retryAt! - Date.now() - 1);
  expect(network.upload).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(await resumed).toMatchObject({ id: saved.id, contextId: saved.contextId, status: 'completed', attempts: 2 });
  expect(network.upload).toHaveBeenCalledTimes(2);
});

it.each(['access_denied', 'storage_full', 'source_changed', 'review_required'] as const)(
  'retains %s for review without spending a transient retry budget', async code => {
    network.upload.mockRejectedValue(new WebDavFailure(code));
    const result = await runtime.startSync();
    expect(result).toMatchObject({ status: 'needs_review', attempts: 1, reviewCount: 1 });
    expect(journal.getReviewUploads()[0].issueCode).toBe(code);
    expect(result.retryAt).toBeUndefined();
    expect(runtime.getBackgroundState()).toEqual({ active: false, failed: true });
    await vi.advanceTimersByTimeAsync(300_000);
    expect(network.upload).toHaveBeenCalledOnce();
  },
);

it.each(['running', 'interrupted'] as const)('does not dispatch a sixth attempt after reopening %s work', async state => {
  const context = journal.getWorkRevision();
  journal.saveProgress({
    id: 'fifth-attempt', contextId: context, targetId: JSON.stringify(['https://fixture.invalid', 'backup', 'fixture']),
    sourceIds: journal.getSourcePaths().map(source => source.id), startedAt: new Date().toISOString(),
    status: state === 'running' ? 'running' : 'failed', ...(state === 'interrupted' ? { errorCode: 'interrupted' } : {}),
    attempts: 5, bytesTransferred: 0, bytesTotal: 7, completedFiles: 0, totalFiles: 1,
  });
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  runtime = new DesktopSyncRuntime(journal, () => null);
  expect(await runtime.getProgress()).toMatchObject({ status: 'failed', id: 'fifth-attempt', attempts: 5 });
  await expect(runtime.startSync()).rejects.toMatchObject({ code: 'retry_exhausted' });
  expect(journal.getLatestProgress()).toMatchObject({ status: 'failed', errorCode: 'retry_exhausted', id: 'fifth-attempt', attempts: 5 });
  expect(network.upload).not.toHaveBeenCalled(); expect(network.inspect).not.toHaveBeenCalled();
});

it('does not let an old exhausted schedule cooldown suppress a newly chosen schedule', async () => {
  const context = journal.getWorkRevision();
  journal.saveProgress({ id: 'old-plan', status: 'failed', contextId: context, errorCode: 'retry_exhausted', attempts: 5,
    retryScheduleId: JSON.stringify([12, '12:00']), nextOpportunityAt: Date.now() + 86_400_000,
    bytesTransferred: 0, bytesTotal: 7, completedFiles: 0, totalFiles: 1 });
  await expect(runtime.startScheduledSync()).rejects.toMatchObject({ code: 'retry_exhausted' });
  await runtime.saveSchedule(24, '13:00');
  expect(journal.getWorkRevision()).toBe(context);
  await runtime.startScheduledSync();
  expect(network.upload).toHaveBeenCalledOnce();
  expect(journal.getLatestProgress()).toMatchObject({ status: 'completed', contextId: context, attempts: 1 });
});
