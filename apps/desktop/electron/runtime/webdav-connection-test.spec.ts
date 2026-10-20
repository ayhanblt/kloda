// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import { testConnection } from './webdav-connection-test.js';
import { WebDavFailure } from './webdav-errors.js';

let root: string;
let journal: DesktopSyncJournal;
const context = 'fixture-work-context';
const initialTime = 1_000_000;
const storage = { endpoint: 'https://fixture.invalid/dav', targetPath: 'backup', username: 'fixture' };
const check = () => undefined;

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(initialTime);
  root = mkdtempSync(join(tmpdir(), 'kloda-connection-retry-'));
  journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
  journal.saveStorage(storage);
});
afterEach(() => { journal.database.close(); rmSync(root, { recursive: true, force: true }); vi.useRealTimers(); });

function reopen() {
  journal.database.close();
  journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
}
function seed(value: unknown) {
  journal.database.prepare('INSERT OR REPLACE INTO setting(key,value) VALUES(?,?)').run('webdavTestRetry', JSON.stringify(value));
}
function state() {
  const row = journal.database.prepare('SELECT value FROM setting WHERE key=?').get('webdavTestRetry') as { value: string } | undefined;
  return row ? JSON.parse(row.value) as Record<string, unknown> : undefined;
}
const advance = async (deadline: number) => { vi.setSystemTime(deadline); };

it('persists exactly five attempts and waits sixty seconds from each observed failure', async () => {
  const starts: number[] = [];
  const failures: number[] = [];
  const wait = vi.fn(async (deadline: number) => {
    expect(deadline).toBe(failures.at(-1)! + 60_000);
    expect(state()).toMatchObject({ contextId: context, attempts: starts.length, retryAt: deadline });
    await advance(deadline);
  });
  const verify = vi.fn(async () => {
    starts.push(Date.now());
    expect(state()).toMatchObject({ contextId: context, attempts: starts.length });
    expect(state()).not.toHaveProperty('retryAt');
    vi.setSystemTime(Date.now() + 7_000);
    failures.push(Date.now());
    throw new WebDavFailure('connection_unavailable');
  });
  await expect(testConnection(journal, context, verify, check, wait)).rejects.toMatchObject({ code: 'connection_unavailable' });
  expect(verify).toHaveBeenCalledTimes(5);
  expect(wait).toHaveBeenCalledTimes(4);
  expect(starts).toEqual([0, 1, 2, 3, 4].map(attempt => initialTime + attempt * 67_000));
  expect(state()).toMatchObject({ attempts: 5, finished: true });
  expect(journal.getDraft().storageTested).toBe(false);
});

it('marks only successful connection verification tested and clears retry metadata', async () => {
  const verify = vi.fn().mockRejectedValueOnce(new WebDavFailure('connection_unavailable')).mockResolvedValue(undefined);
  const wait = vi.fn(advance);
  await testConnection(journal, context, verify, check, wait);
  expect(verify).toHaveBeenCalledTimes(2);
  expect(wait).toHaveBeenCalledExactlyOnceWith(initialTime + 60_000);
  expect(journal.getDraft().storageTested).toBe(true);
  expect(state()).toBeUndefined();
  reopen();
  expect(journal.getDraft()).toMatchObject({ storage, storageTested: true });
});

it('reopens a pending deadline without resetting consumed attempts or sending early', async () => {
  const deadline = initialTime + 60_000;
  seed({ contextId: context, attempts: 3, retryAt: deadline });
  reopen();
  vi.setSystemTime(initialTime + 10_000);
  const wait = vi.fn(async (next: number) => { expect(next).toBe(deadline); await advance(next); });
  const verify = vi.fn(async () => {
    expect(Date.now()).toBeGreaterThanOrEqual(deadline);
    expect(state()).toMatchObject({ contextId: context, attempts: 4 });
  });
  await testConnection(journal, context, verify, check, wait);
  expect(verify).toHaveBeenCalledOnce();
  expect(wait).toHaveBeenCalledExactlyOnceWith(deadline);
  expect(journal.getDraft().storageTested).toBe(true);
});

it('never sends a sixth request after restart with the fifth attempt unfinished', async () => {
  seed({ contextId: context, attempts: 5 }); reopen();
  const verify = vi.fn(); const wait = vi.fn();
  await expect(testConnection(journal, context, verify, check, wait)).rejects.toMatchObject({ code: 'retry_exhausted' });
  expect(verify).not.toHaveBeenCalled(); expect(wait).not.toHaveBeenCalled();
  expect(state()).toMatchObject({ attempts: 5, finished: true });
  expect(journal.getDraft().storageTested).toBe(false);
});

it.each(['access_denied', 'storage_full', 'review_required', 'source_changed', 'unknown'] as const)(
  'does not automatically retry %s', async (code) => {
    const verify = vi.fn().mockRejectedValue(new WebDavFailure(code)); const wait = vi.fn();
    await expect(testConnection(journal, context, verify, check, wait)).rejects.toMatchObject({ code });
    expect(verify).toHaveBeenCalledOnce(); expect(wait).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ attempts: 1, finished: true });
    expect(journal.getDraft().storageTested).toBe(false);
  },
);

it('rejects a late success after settings change without marking the new target tested', async () => {
  const revision = journal.getWorkRevision();
  const guard = () => { if (journal.getWorkRevision() !== revision) throw new WebDavFailure('settings_changed'); };
  const nextStorage = { ...storage, targetPath: 'new-target' };
  const verify = vi.fn(async () => { journal.saveStorage(nextStorage); });
  await expect(testConnection(journal, context, verify, guard, advance)).rejects.toMatchObject({ code: 'settings_changed' });
  expect(verify).toHaveBeenCalledOnce();
  reopen();
  expect(journal.getDraft()).toMatchObject({ storage: nextStorage, storageTested: false });
});

it('rejects settings change during retry wait before issuing the next wire request', async () => {
  const revision = journal.getWorkRevision();
  const guard = () => { if (journal.getWorkRevision() !== revision) throw new WebDavFailure('settings_changed'); };
  const verify = vi.fn().mockRejectedValue(new WebDavFailure('connection_unavailable'));
  const wait = vi.fn(async (deadline: number) => { await advance(deadline); journal.saveStorage({ ...storage, username: 'new-user' }); });
  await expect(testConnection(journal, context, verify, guard, wait)).rejects.toMatchObject({ code: 'settings_changed' });
  expect(verify).toHaveBeenCalledOnce(); expect(wait).toHaveBeenCalledOnce();
  expect(journal.getDraft().storageTested).toBe(false);
});

it.each([
  null, {}, [], { contextId: context, attempts: -1 }, { contextId: context, attempts: 6 },
  { contextId: context, attempts: 1.5 }, { contextId: context, attempts: 1, retryAt: -1 },
  { contextId: context, attempts: 1, retryAt: '60000' }, { contextId: context, attempts: 5, finished: 'yes' },
])('fails closed on malformed persisted state %#', async (value) => {
  seed(value); reopen();
  const verify = vi.fn(); const wait = vi.fn();
  await expect(testConnection(journal, context, verify, check, wait)).rejects.toThrow();
  expect(verify).not.toHaveBeenCalled(); expect(wait).not.toHaveBeenCalled();
  expect(journal.getDraft().storageTested).toBe(false);
});
