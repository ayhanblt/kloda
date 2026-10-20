// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import type { SyncProgress } from './types.js';
import type { NodeWebDavClient } from './webdav.js';
import { runWebDavFiles } from './webdav-run-files.js';
import { reviewWebDavUpload } from './webdav-management.js';
import { pendingId } from './webdav-pending.js';

let root: string;
let journal: DesktopSyncJournal;
let source: string;
let progress: SyncProgress;
let remote: Map<string, string>;
let upload: ReturnType<typeof vi.fn>;
let inspect: ReturnType<typeof vi.fn>;
let finalize: ReturnType<typeof vi.fn>;
let client: NodeWebDavClient;
const storage = { endpoint: 'https://fixture.invalid', targetPath: 'backup', username: 'fixture' };
const target = JSON.stringify([storage.endpoint, storage.targetPath, storage.username]);
const revision = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const check = () => undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kloda-webdav-run-'));
  const directory = join(root, 'source'); mkdirSync(directory);
  writeFileSync(join(directory, 'dependent.jpg'), 'dependent'); writeFileSync(join(directory, 'independent.jpg'), 'independent');
  journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  journal.replaceSources([{ path: directory, displayName: 'fixture' }]); source = journal.getSourcePaths()[0].id;
  journal.saveStorage(storage);
  progress = { id: 'run', status: 'running', targetId: target, completedFiles: 0, totalFiles: 0, bytesTransferred: 0, bytesTotal: 0 };
  remote = new Map();
  inspect = vi.fn(async (path: string, expected: string) => remote.has(path) ? revision(remote.get(path)!) === expected ? 'match' : 'mismatch' : 'missing');
  upload = vi.fn(async (path: string, body: Blob) => { remote.set(path, await body.text()); });
  finalize = vi.fn(async (path: string, temporary: string) => {
    if (remote.has(path)) return 'conflict';
    remote.set(path, remote.get(temporary)!); remote.delete(temporary); return 'moved';
  });
  client = { inspectFile: inspect, uploadTemporary: upload, finalizeUpload: finalize } as unknown as NodeWebDavClient;
});
afterEach(() => { journal.database.close(); rmSync(root, { recursive: true, force: true }); });

it.each(['conflict', 'unknown', 'skipped', 'unscoped', 'lost_put', 'lost_move'])(
  'preserves %s dependent work for review and completes independent files without adopting remote bytes', async state => {
    const pendingTarget = state === 'unscoped' ? '' : target;
    const temporary = `${source}/dependent.jpg.temporary`;
    journal.savePendingUpload(pendingTarget, source, 'dependent.jpg', revision('dependent'), temporary);
    const pending = journal.getPendingUploads(pendingTarget)[0];
    if (state === 'unknown' || state === 'unscoped') journal.database.prepare('UPDATE pending_upload SET phase = ?').run('unknown');
    else if (state !== 'lost_put') {
      journal.advancePendingUpload(pendingTarget, pending, 'uploaded');
      journal.advancePendingUpload(pendingTarget, pending, 'conflict');
      if (state === 'lost_move') journal.advancePendingUpload(pendingTarget, pending, 'moving');
      if (state === 'skipped') journal.setPendingIssue(pendingTarget, pending, 'review_required', true);
    }
    if (state !== 'lost_move') remote.set(temporary, 'dependent');
    remote.set(`${source}/dependent.jpg`, state === 'lost_move' ? 'dependent' : 'unrelated existing file');
    await runWebDavFiles(journal, client, journal.getSourcePaths(), progress, check);
    expect(progress).toMatchObject({ status: 'needs_review', completedFiles: 1, reviewCount: 1 });
    expect(journal.hasUploadReceipt(target, source, 'dependent.jpg', revision('dependent'))).toBe(false);
    expect(journal.hasUploadReceipt(target, source, 'independent.jpg', revision('independent'))).toBe(true);
    expect(remote.get(`${source}/dependent.jpg`)).toBe(state === 'lost_move' ? 'dependent' : 'unrelated existing file');
    expect(remote.get(`${source}/independent.jpg`)).toBe('independent');
    expect(journal.getPendingUploads(pendingTarget)).toHaveLength(1);
    expect(upload).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledTimes(1);
  },
);

it('verifies an alternate receipt path on rescan without re-uploading or overwriting the original', async () => {
  const name = 'dependent.jpg'; const hash = revision('dependent'); const alias = `${source}/dependent (Kloda Fixture 20261020-120000 abcdef12).jpg`;
  journal.savePendingUpload(target, source, name, hash, 'temp');
  const pending = journal.getPendingUploads(target)[0];
  journal.advancePendingUpload(target, pending, 'uploaded'); journal.setPendingPublication(target, pending, alias);
  journal.advancePendingUpload(target, pending, 'moving'); journal.advancePendingUpload(target, pending, 'moved');
  journal.completePendingUpload(target, pending);
  remote.set(alias, 'dependent'); remote.set(`${source}/${name}`, 'unrelated original');
  await runWebDavFiles(journal, client, journal.getSourcePaths(), progress, check);
  expect(progress).toMatchObject({ status: 'completed', completedFiles: 2 });
  expect(inspect).toHaveBeenCalledWith(alias, hash);
  expect(upload).toHaveBeenCalledOnce(); // Only the independent file needed an upload.
  expect(upload.mock.calls[0][0]).toContain('independent.jpg.kloda-upload-');
  expect(remote.get(`${source}/${name}`)).toBe('unrelated original');
});

it('retains pending work for removed sources without publishing it or blocking current sources', async () => {
  journal.savePendingUpload(target, 'removed-source', 'preserved.jpg', revision('preserved'), 'removed.temp');
  const pending = journal.getPendingUploads(target)[0]; journal.advancePendingUpload(target, pending, 'uploaded');
  remote.set('removed.temp', 'preserved');
  await runWebDavFiles(journal, client, journal.getSourcePaths(), progress, check);
  expect(journal.getPendingUploads(target)).toEqual([{ ...pending, issueCode: 'settings_changed' }]);
  expect(remote.get('removed.temp')).toBe('preserved');
  expect(inspect).not.toHaveBeenCalledWith('removed.temp', expect.anything());
  expect(progress).toMatchObject({ status: 'needs_review', completedFiles: 2, reviewCount: 1 });
});

it('updates an older original receipt to the acknowledged alternate path and reuses it after reopen', async () => {
  journal.database.prepare(`INSERT INTO upload_receipt(target_id, source_id, relative_path, revision)
    VALUES(?, ?, ?, ?)`)
    .run(target, source, 'dependent.jpg', revision('dependent'));
  remote.set(`${source}/dependent.jpg`, 'unrelated replacement');
  await runWebDavFiles(journal, client, journal.getSourcePaths(), progress, check);
  expect(progress.status).toBe('needs_review');
  const pending = journal.getPendingUploads(target)[0];
  expect(pending.phase).toBe('conflict');
  await reviewWebDavUpload(journal, client, pendingId(pending), 'keep_both', check);
  const alias = journal.getUploadReceiptPath(target, source, 'dependent.jpg', revision('dependent'))!;
  expect(alias).not.toBe(`${source}/dependent.jpg`);
  expect(remote.get(alias)).toBe('dependent');
  journal.database.close(); journal = new DesktopSyncJournal(join(root, 'sync.sqlite'));
  upload.mockClear(); inspect.mockClear(); finalize.mockClear();
  await runWebDavFiles(journal, client, journal.getSourcePaths(), progress, check);
  expect(progress).toMatchObject({ status: 'completed', completedFiles: 2 });
  expect(inspect).toHaveBeenCalledWith(alias, revision('dependent'));
  expect(upload).not.toHaveBeenCalled(); expect(finalize).not.toHaveBeenCalled();
  expect(remote.get(`${source}/dependent.jpg`)).toBe('unrelated replacement');
});
