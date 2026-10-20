// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal, type PendingUpload } from './journal.js';
import { listWebDavIssues, reviewWebDavUpload } from './webdav-management.js';
import { pendingId } from './webdav-pending.js';
import { WebDavFailure } from './webdav-errors.js';
import type { NodeWebDavClient } from './webdav.js';

vi.mock('node:os', async original => ({ ...await original<typeof import('node:os')>(), hostname: () => 'Fixture PC' }));
const revision = `sha256:${'a'.repeat(64)}`;
const storage = { endpoint: 'https://fixture.invalid', username: 'fixture', targetPath: 'backup' };
const target = JSON.stringify([storage.endpoint, storage.targetPath, storage.username]);
let root: string;
let journal: DesktopSyncJournal;
let source: string;
let remote: Map<string, string>;
let inspect: ReturnType<typeof vi.fn>;
let finalize: ReturnType<typeof vi.fn>;
let client: NodeWebDavClient;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T12:34:56.000Z'));
  root = mkdtempSync(join(tmpdir(), 'kloda-webdav-management-'));
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  journal.replaceSources([{ path: '/fixture', displayName: 'fixture' }]); source = journal.getSourcePaths()[0].id;
  journal.saveStorage(storage);
  remote = new Map();
  inspect = vi.fn(async (path: string, expected: string) => remote.has(path) ? remote.get(path) === expected ? 'match' : 'mismatch' : 'missing');
  finalize = vi.fn(async (path: string, temporary: string) => {
    if (remote.has(path)) return 'conflict';
    remote.set(path, remote.get(temporary)!); remote.delete(temporary); return 'moved';
  });
  client = { inspectFile: inspect, finalizeUpload: finalize } as unknown as NodeWebDavClient;
});
afterEach(() => { journal.database.close(); rmSync(root, { recursive: true, force: true }); vi.useRealTimers(); });
const check = () => undefined;
function conflict(name = 'foto.jpg'): PendingUpload {
  journal.savePendingUpload(target, source, name, revision, `${source}/${name}.temporary`);
  const pending = journal.getPendingUploads(target).find(row => row.relativePath === name)!;
  journal.advancePendingUpload(target, pending, 'uploaded'); journal.advancePendingUpload(target, pending, 'conflict');
  journal.setPendingIssue(target, pending, 'review_required');
  remote.set(pending.temporaryPath, revision); remote.set(`${source}/${name}`, 'unrelated original');
  return pending;
}

it('lists durable review separately and skips locally without completing, deleting or issuing network requests', async () => {
  const pending = conflict();
  const [issue] = listWebDavIssues(journal);
  expect(issue).toMatchObject({ id: pendingId(pending), errorCode: 'review_required', canKeepBoth: true, skipped: false });
  await reviewWebDavUpload(journal, client, issue.id, 'skip', check);
  expect(listWebDavIssues(journal)[0].skipped).toBe(true);
  expect(journal.hasUploadReceipt(target, source, 'foto.jpg', revision)).toBe(false);
  expect(inspect).not.toHaveBeenCalled(); expect(finalize).not.toHaveBeenCalled();
  expect(remote.get(`${source}/foto.jpg`)).toBe('unrelated original');
});

it('keeps both only with a verified owned temporary file and records the frozen name before MOVE', async () => {
  const pending = conflict();
  const expected = `${source}/foto (Kloda Fixture_PC 20261020-123456 aaaaaaaa).jpg`;
  finalize.mockImplementationOnce(async (path: string, temporary: string) => {
    expect(journal.getPendingUploads(target)[0]).toMatchObject({ phase: 'moving', publishedPath: expected });
    remote.set(path, remote.get(temporary)!); remote.delete(temporary); return 'moved';
  });
  await reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check);
  expect(journal.getPendingUploads(target)).toEqual([]);
  expect(journal.getUploadReceiptPath(target, source, 'foto.jpg', revision)).toBe(expected);
  expect(remote.get(expected)).toBe(revision);
  expect(remote.get(`${source}/foto.jpg`)).toBe('unrelated original');
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  expect(journal.getUploadReceiptPath(target, source, 'foto.jpg', revision)).toBe(expected);
});

it.each(['missing', 'mismatch'])('refuses keep-both when temporary identity is %s', async state => {
  const pending = conflict();
  if (state === 'missing') remote.delete(pending.temporaryPath); else remote.set(pending.temporaryPath, 'other bytes');
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check)).rejects.toMatchObject({ code: 'review_required' });
  expect(finalize).not.toHaveBeenCalled();
  expect(journal.getPendingUploads(target)[0].publishedPath).toBeUndefined();
  expect(remote.get(`${source}/foto.jpg`)).toBe('unrelated original');
});

it('reuses a persisted alias across restart and recheck without creating a new name', async () => {
  const pending = conflict();
  const alias = `${source}/foto (Kloda Old_PC 20260101-000000 aaaaaaaa).jpg`;
  journal.setPendingPublication(target, pending, alias);
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
  await reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check);
  expect(finalize).toHaveBeenCalledWith(alias, pending.temporaryPath);
  expect(journal.getUploadReceiptPath(target, source, 'foto.jpg', revision)).toBe(alias);
});

it('does not adopt a matching final after a lost MOVE reply and never rotates an ambiguous publication', async () => {
  const pending = conflict();
  finalize.mockImplementationOnce(async (path: string, temporary: string) => {
    remote.set(path, remote.get(temporary)!); remote.delete(temporary);
    throw new WebDavFailure('connection_unavailable');
  });
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check)).rejects.toMatchObject({ code: 'connection_unavailable' });
  const uncertain = journal.getPendingUploads(target)[0];
  expect(uncertain).toMatchObject({ phase: 'moving', issueCode: 'connection_unavailable' });
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check)).rejects.toMatchObject({ code: 'review_required' });
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check)).rejects.toMatchObject({ code: 'review_required' });
  expect(journal.getPendingUploads(target)[0].publishedPath).toBe(uncertain.publishedPath);
  expect(journal.hasUploadReceipt(target, source, 'foto.jpg', revision)).toBe(false);
  expect(finalize).toHaveBeenCalledOnce();
});

it('allows an explicit numbered choice only after a known occupied alias while preserving its frozen identity', async () => {
  const pending = conflict();
  const alias = `${source}/foto (Kloda Old_PC 20260101-000000 aaaaaaaa).jpg`;
  journal.setPendingPublication(target, pending, alias); remote.set(alias, 'occupied alias');
  await reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check);
  expect(journal.getUploadReceiptPath(target, source, 'foto.jpg', revision))
    .toBe(`${source}/foto (Kloda Old_PC 20260101-000000 aaaaaaaa) 2.jpg`);
  expect(remote.get(alias)).toBe('occupied alias');
});

it.each(['target', 'source'])('retains old %s issues visibly but refuses remote actions', async change => {
  const pending = conflict();
  if (change === 'target') journal.saveStorage({ ...storage, targetPath: 'new' }); else journal.replaceSources([]);
  expect(listWebDavIssues(journal)[0].canKeepBoth).toBe(false);
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check)).rejects.toMatchObject({ code: 'configuration_required' });
  expect(inspect).not.toHaveBeenCalled(); expect(finalize).not.toHaveBeenCalled();
  expect(journal.getPendingUploads(target)).toHaveLength(1);
});

it('does not adopt bytes from prepared or unknown ownership and clears only a missing prepared intent', async () => {
  journal.savePendingUpload(target, source, 'one.jpg', revision, 'one.temp');
  const pending = journal.getPendingUploads(target)[0]; journal.setPendingIssue(target, pending, 'review_required');
  remote.set('one.temp', revision);
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check)).rejects.toMatchObject({ code: 'review_required' });
  expect(journal.hasUploadReceipt(target, source, 'one.jpg', revision)).toBe(false);
  remote.delete('one.temp');
  await reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check);
  expect(journal.getPendingUploads(target)).toEqual([]);
  expect(finalize).not.toHaveBeenCalled();
});

it('preserves the durable ACK when foreground/context leaves during MOVE and can settle later with a full hash', async () => {
  const pending = conflict(); let active = true;
  const gate = () => { if (!active) throw new WebDavFailure('settings_changed'); };
  finalize.mockImplementationOnce(async (path: string, temporary: string) => {
    remote.set(path, remote.get(temporary)!); remote.delete(temporary); active = false; return 'moved';
  });
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', gate)).rejects.toMatchObject({ code: 'settings_changed' });
  expect(journal.getPendingUploads(target)[0]).toMatchObject({ phase: 'moved', issueCode: 'settings_changed' });
  await reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check);
  expect(journal.getPendingUploads(target)).toEqual([]);
  expect(journal.hasUploadReceipt(target, source, 'foto.jpg', revision)).toBe(true);
});

it('bounds UTF-8 names and preserves the extension for long multibyte filenames', async () => {
  const pending = conflict(`${'ğ'.repeat(180)}.jpeg`);
  await reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check);
  const path = journal.getUploadReceiptPath(target, source, pending.relativePath, revision)!;
  expect(path.endsWith('.jpeg')).toBe(true);
  expect(Buffer.byteLength(path.split('/').at(-1)!)).toBeLessThanOrEqual(255);
  expect(path).toContain(' (Kloda Fixture_PC 20261020-123456 aaaaaaaa)');
});

it('keeps legacy unknown-phase records unresolved and validates action IDs before any network access', async () => {
  journal.savePendingUpload(target, source, 'legacy.jpg', revision, 'legacy.temp');
  journal.database.prepare("UPDATE pending_upload SET phase = 'unknown'").run();
  const pending = journal.getPendingUploads(target)[0]; remote.set('legacy.temp', revision);
  expect(listWebDavIssues(journal)[0].canKeepBoth).toBe(false);
  await expect(reviewWebDavUpload(journal, client, pendingId(pending), 'recheck', check)).rejects.toMatchObject({ code: 'review_required' });
  await expect(reviewWebDavUpload(journal, client, 'invalid', 'skip', check)).rejects.toMatchObject({ code: 'configuration_required' });
  expect(journal.getPendingUploads(target)).toHaveLength(1);
  expect(inspect).not.toHaveBeenCalled(); expect(finalize).not.toHaveBeenCalled();
});

it('resolves only the selected conflict and preserves independent review records and unrelated remote files', async () => {
  const selected = conflict('selected.jpg'); const other = conflict('other.jpg');
  const unrelated = new Map(remote);
  await reviewWebDavUpload(journal, client, pendingId(selected), 'keep_both', check);
  expect(journal.getPendingUploads(target)).toEqual([other]);
  for (const [path, contents] of unrelated) {
    if (path !== selected.temporaryPath) expect(remote.get(path)).toBe(contents);
  }
  expect(journal.hasUploadReceipt(target, source, 'other.jpg', revision)).toBe(false);
});

it('allows local skip without credentials/client while denying remote review without one', async () => {
  const pending = conflict();
  journal.saveStorage({ ...storage, targetPath: 'different' });
  await reviewWebDavUpload(journal, null, pendingId(pending), 'skip', check);
  expect(journal.getPendingUploads(target)[0].skipped).toBe(true);
  await expect(reviewWebDavUpload(journal, null, pendingId(pending), 'recheck', check)).rejects.toMatchObject({ code: 'configuration_required' });
  expect(inspect).not.toHaveBeenCalled(); expect(finalize).not.toHaveBeenCalled();
});
