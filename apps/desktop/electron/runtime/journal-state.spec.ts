// @vitest-environment node
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import type { SyncProgress } from './types.js';

describe('persistent WebDAV work context and review state', () => {
  let root: string;
  let journal: DesktopSyncJournal;
  const progress: SyncProgress = {
    id: 'run', status: 'waiting_retry', bytesTransferred: 2, bytesTotal: 9, completedFiles: 0, totalFiles: 1,
    contextId: 'revision', targetId: 'target', sourceIds: ['source'], errorCode: 'connection',
    startedAt: '2026-10-20T12:00:00.000Z', attempts: 3, retryAt: 1792497660000, reviewCount: 1,
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kloda-journal-state-'));
    journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
  });
  afterEach(() => { journal.database.close(); rmSync(root, { recursive: true, force: true }); });
  const reopen = () => { journal.database.close(); journal = new DesktopSyncJournal(join(root, 'journal.sqlite')); };

  it('retains retry budget, timing, context and outcome across reopen without adding defaults to legacy progress', () => {
    journal.saveProgress(progress);
    reopen();
    expect(journal.getLatestProgress()).toEqual(progress);
    const legacy: SyncProgress = { id: 'legacy', status: 'failed', bytesTransferred: 0, bytesTotal: 0, completedFiles: 0, totalFiles: 0 };
    journal.saveProgress(legacy);
    expect(journal.getLatestProgress()).toEqual(legacy);
    reopen();
    expect(journal.getLatestProgress()).toEqual(legacy);
  });

  it('changes revision only for a genuine source path-set change and rolls it back with source persistence', () => {
    expect(journal.getWorkRevision()).toBe('legacy');
    journal.replaceSources([{ path: '/a', displayName: 'a' }, { path: '/b', displayName: 'b' }]);
    const revision = journal.getWorkRevision();
    const ids = journal.getSourcePaths().map(row => row.id).sort();
    expect(revision).not.toBe('legacy');
    journal.replaceSources([{ path: '/b', displayName: 'new b' }, { path: '/a', displayName: 'new a' }, { path: '/a', displayName: 'duplicate' }]);
    expect(journal.getWorkRevision()).toBe(revision);
    expect(journal.getSourcePaths().map(row => row.id).sort()).toEqual(ids);
    journal.database.exec(`CREATE TRIGGER reject_revision BEFORE INSERT ON setting
      WHEN NEW.key = 'workRevision' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
    expect(() => journal.replaceSources([{ path: '/new', displayName: 'new' }])).toThrow();
    expect(journal.getSourcePaths().map(row => row.id).sort()).toEqual(ids);
    expect(journal.getWorkRevision()).toBe(revision);
    journal.database.exec('DROP TRIGGER reject_revision');
    journal.replaceSources([{ path: '/a', displayName: 'a' }]);
    expect(journal.getWorkRevision()).not.toBe(revision);
    reopen();
    expect(journal.getSourcePaths()).toHaveLength(1);
  });

  it('ties storage revision to the existing credential/config transaction and leaves unchanged configuration stable', () => {
    const storage = { endpoint: 'https://fixture.invalid', username: 'user', targetPath: '/backup' };
    journal.database.transaction(() => journal.saveStorage(storage))();
    const revision = journal.getWorkRevision();
    journal.database.transaction(() => journal.saveStorage(storage, false))();
    expect(journal.getWorkRevision()).toBe(revision);
    expect(() => journal.database.transaction(() => {
      journal.saveStorage({ ...storage, targetPath: '/changed' });
      throw new Error('fixture interruption');
    })()).toThrow();
    reopen();
    expect(journal.getWorkRevision()).toBe(revision);
    expect(journal.getDraft().storage).toEqual(storage);
    expect(journal.getDraft().storageTested).toBe(false);
  });

  it('retains review, skip and alternate publication state and settles the exact path atomically', () => {
    journal.savePendingUpload('target', 'source', 'file', 'revision', 'temp');
    const pending = journal.getPendingUploads('target')[0];
    journal.advancePendingUpload('target', pending, 'uploaded');
    journal.advancePendingUpload('target', pending, 'conflict');
    journal.setPendingIssue('target', pending, 'name_conflict', true);
    journal.setPendingPublication('target', pending, 'source/file-copy');
    reopen();
    expect(journal.getReviewUploads()).toEqual([pending]);
    const restored = journal.getPendingUploads('target')[0];
    const stale = { ...restored };
    journal.setPendingIssue('target', restored, undefined);
    expect(journal.getReviewUploads()).toEqual([restored]); // Unresolved conflict remains visible without an issue string.
    expect(() => journal.clearPendingUpload('target', stale)).toThrow();
    expect(() => journal.setPendingPublication('target', stale, 'other')).toThrow();
    journal.advancePendingUpload('target', restored, 'moving');
    expect(() => journal.setPendingPublication('target', restored, 'other')).toThrow();
    journal.advancePendingUpload('target', restored, 'moved');
    expect(() => journal.completePendingUpload('target', { ...restored, publishedPath: 'wrong' })).toThrow();
    journal.database.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON upload_receipt BEGIN SELECT RAISE(ABORT, 'fixture'); END");
    expect(() => journal.completePendingUpload('target', restored)).toThrow();
    expect(journal.getPendingUploads('target')).toEqual([restored]);
    expect(journal.getUploadReceiptPath('target', 'source', 'file', 'revision')).toBeUndefined();
    journal.database.exec('DROP TRIGGER reject_receipt');
    journal.completePendingUpload('target', restored);
    reopen();
    expect(journal.getPendingUploads('target')).toEqual([]);
    expect(journal.getUploadReceiptPath('target', 'source', 'file', 'revision')).toBe('source/file-copy');
    expect(journal.hasUploadReceipt('target', 'source', 'file', 'revision')).toBe(true);
    expect(journal.getUploadReceiptPath('other', 'source', 'file', 'revision')).toBeUndefined();
  });

  it('migrates legacy progress and receipts additively without adopting unknown work', () => {
    journal.database.close();
    const filename = join(root, 'journal.sqlite');
    const db = new Database(filename);
    db.exec(`DROP TABLE sync_progress; DROP TABLE pending_upload; DROP TABLE upload_receipt;
      CREATE TABLE sync_progress (id TEXT PRIMARY KEY, status TEXT NOT NULL, bytes_transferred INTEGER NOT NULL,
        bytes_total INTEGER NOT NULL, completed_files INTEGER NOT NULL, total_files INTEGER NOT NULL);
      INSERT INTO sync_progress VALUES ('old', 'running', 1, 5, 0, 1);
      CREATE TABLE pending_upload (source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        temporary_path TEXT NOT NULL, PRIMARY KEY(source_id, relative_path, revision));
      INSERT INTO pending_upload VALUES ('source', 'file', 'revision', 'temp');
      CREATE TABLE upload_receipt (source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        PRIMARY KEY(source_id, relative_path, revision));
      INSERT INTO upload_receipt VALUES ('source', 'done', 'revision');`);
    db.close();
    journal = new DesktopSyncJournal(filename);
    expect(journal.getLatestProgress()).toEqual({ id: 'old', status: 'running', bytesTransferred: 1, bytesTotal: 5, completedFiles: 0, totalFiles: 1 });
    expect(journal.getReviewUploads()).toEqual([{
      targetId: '', sourceId: 'source', relativePath: 'file', revision: 'revision', temporaryPath: 'temp', phase: 'unknown',
    }]);
    expect(journal.getUploadReceiptPath('', 'source', 'done', 'revision')).toBe('source/done');
    expect(journal.hasUploadReceipt('new-target', 'source', 'done', 'revision')).toBe(false);
  });
});
