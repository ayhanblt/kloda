// @vitest-environment node
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DesktopSyncJournal } from './journal.js';
import type { PendingUpload } from './journal.js';

describe('DesktopSyncJournal source selection', () => {
  let root: string;
  let journal: DesktopSyncJournal;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kloda-journal-'));
    journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
  });

  afterEach(() => {
    journal.database.close();
    rmSync(root, { recursive: true, force: true });
  });

  function seedReceipt(targetId: string, sourceId: string, relativePath: string, revision: string): void {
    journal.database.prepare(
      'INSERT INTO upload_receipt (target_id, source_id, relative_path, revision) VALUES (?, ?, ?, ?)',
    ).run(targetId, sourceId, relativePath, revision);
  }

  it('preserves retained source identity and receipt/pending links across reopen and reselection', () => {
    journal.replaceSources([{ path: '/fixture/a', displayName: 'a' }, { path: '/fixture/removed', displayName: 'removed' }]);
    const original = journal.getSourcePaths().find(source => source.path === '/fixture/a')!;
    seedReceipt('target-a', original.id, 'done.txt', 'revision');
    journal.savePendingUpload('target-a', original.id, 'pending.txt', 'revision', 'temporary');
    journal.database.close();
    journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
    journal.replaceSources([
      { path: '/fixture/new', displayName: 'new' },
      { path: '/fixture/a', displayName: 'changed label' },
      { path: '/fixture/a', displayName: 'duplicate' },
    ]);
    const sources = journal.getSourcePaths();
    expect(sources.filter(source => source.path === '/fixture/a')).toEqual([{ ...original, displayName: 'changed label' }]);
    expect(sources.some(source => source.path === '/fixture/removed')).toBe(false);
    const added = sources.find(source => source.path === '/fixture/new')!;
    expect(added.id).not.toBe(original.id);
    expect(journal.hasUploadReceipt('target-a', original.id, 'done.txt', 'revision')).toBe(true);
    expect(journal.hasUploadReceipt('target-a', added.id, 'done.txt', 'revision')).toBe(false);
    expect(journal.getPendingUploads('target-a')).toEqual([
      { targetId: 'target-a', sourceId: original.id, relativePath: 'pending.txt', revision: 'revision', temporaryPath: 'temporary', phase: 'prepared' },
    ]);
  });

  it('isolates receipts and pending uploads by target and exact descriptor', () => {
    const sourceId = 'source';
    seedReceipt('target-a', sourceId, 'shared.txt', 'revision');
    expect(journal.hasUploadReceipt('target-b', sourceId, 'shared.txt', 'revision')).toBe(false);
    seedReceipt('target-b', sourceId, 'shared.txt', 'revision');
    journal.savePendingUpload('target-a', sourceId, 'shared.txt', 'revision', 'temporary-a');
    journal.savePendingUpload('target-b', sourceId, 'shared.txt', 'revision', 'temporary-b');
    const pendingA = journal.getPendingUploads('target-a')[0];
    expect(pendingA).toEqual({ targetId: 'target-a', sourceId, relativePath: 'shared.txt', revision: 'revision', temporaryPath: 'temporary-a', phase: 'prepared' });
    expect(journal.getPendingUploads('target-b')[0].temporaryPath).toBe('temporary-b');
    journal.clearPendingUpload('target-a', pendingA);
    expect(journal.getPendingUploads('target-a')).toEqual([]);
    expect(journal.getPendingUploads('target-b')).toHaveLength(1);
    journal.database.close();
    journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
    expect(journal.hasUploadReceipt('target-a', sourceId, 'shared.txt', 'revision')).toBe(true);
    expect(journal.hasUploadReceipt('target-b', sourceId, 'shared.txt', 'revision')).toBe(true);
    expect(journal.hasUploadReceipt('target-c', sourceId, 'shared.txt', 'revision')).toBe(false);
    expect(journal.getPendingUploads('target-a')).toEqual([]);
    expect(journal.getPendingUploads('target-b')).toEqual([
      { targetId: 'target-b', sourceId, relativePath: 'shared.txt', revision: 'revision', temporaryPath: 'temporary-b', phase: 'prepared' },
    ]);
  });

  it('migrates legacy rows to an unscoped target without adopting them', () => {
    journal.database.close();
    const filename = join(root, 'unscoped-legacy.sqlite');
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE upload_receipt (
        source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        PRIMARY KEY (source_id, relative_path, revision)
      );
      CREATE TABLE pending_upload (
        source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        temporary_path TEXT NOT NULL, PRIMARY KEY (source_id, relative_path, revision)
      );
      INSERT INTO upload_receipt VALUES ('legacy-source', 'done.txt', 'legacy-revision');
      INSERT INTO pending_upload VALUES ('legacy-source', 'pending.txt', 'legacy-revision', 'legacy-temporary');
    `);
    legacy.close();
    journal = new DesktopSyncJournal(filename);
    expect(journal.hasUnscopedPendingUploads()).toBe(true);
    for (const targetId of ['target-a', 'target-b']) {
      expect(journal.hasUploadReceipt(targetId, 'legacy-source', 'done.txt', 'legacy-revision')).toBe(false);
      expect(journal.getPendingUploads(targetId)).toEqual([]);
    }
    expect(journal.database.prepare('SELECT target_id, source_id, relative_path, revision FROM upload_receipt').all())
      .toEqual([{ target_id: '', source_id: 'legacy-source', relative_path: 'done.txt', revision: 'legacy-revision' }]);
    const unknown = journal.getPendingUploads('');
    expect(unknown).toEqual([{
      targetId: '', sourceId: 'legacy-source', relativePath: 'pending.txt',
      revision: 'legacy-revision', temporaryPath: 'legacy-temporary', phase: 'unknown',
    }]);
    journal.database.close();
    journal = new DesktopSyncJournal(filename);
    expect(journal.hasUnscopedPendingUploads()).toBe(true);
    expect(journal.getPendingUploads('')).toEqual(unknown);
  });

  it('preserves legacy receipts and pending work when migration fails midway', () => {
    journal.database.close();
    const filename = join(root, 'legacy-failure.sqlite');
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE upload_receipt (
        source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        PRIMARY KEY (source_id, relative_path, revision)
      );
      CREATE TABLE pending_upload (
        source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        temporary_path TEXT NOT NULL, PRIMARY KEY (source_id, relative_path, revision)
      );
      INSERT INTO upload_receipt VALUES ('source', 'done', 'revision');
      INSERT INTO pending_upload VALUES ('source', 'pending', 'revision', 'temporary');
      CREATE TABLE scoped_pending_upload (collision TEXT);
    `);
    try {
      expect(() => new DesktopSyncJournal(filename)).toThrow();
      expect(legacy.prepare('SELECT * FROM upload_receipt').all()).toEqual([
        { source_id: 'source', relative_path: 'done', revision: 'revision' },
      ]);
      expect(legacy.prepare('SELECT * FROM pending_upload').all()).toEqual([
        { source_id: 'source', relative_path: 'pending', revision: 'revision', temporary_path: 'temporary' },
      ]);
      legacy.exec('DROP TABLE scoped_pending_upload');
    } finally {
      legacy.close();
    }
    journal = new DesktopSyncJournal(filename);
    expect(journal.hasUnscopedPendingUploads()).toBe(true);
    expect(journal.getPendingUploads('target-a')).toEqual([]);
  });

  it('migrates target-scoped no-phase rows to unknown and preserves them across reopen without receipts', () => {
    journal.database.close();
    const filename = join(root, 'legacy.sqlite');
    const legacy = new Database(filename);
    legacy.exec(`CREATE TABLE pending_upload (
      target_id TEXT NOT NULL, source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
      temporary_path TEXT NOT NULL, PRIMARY KEY (target_id, source_id, relative_path, revision));
      INSERT INTO pending_upload VALUES ('target-a', 'source', 'pending.txt', 'revision', 'old-temporary');`);
    legacy.close();
    journal = new DesktopSyncJournal(filename);
    const row = journal.getPendingUploads('target-a')[0];
    expect(row).toEqual({ targetId: 'target-a', sourceId: 'source', relativePath: 'pending.txt', revision: 'revision', temporaryPath: 'old-temporary', phase: 'unknown' });
    expect(journal.hasUploadReceipt('target-a', 'source', 'pending.txt', 'revision')).toBe(false);
    journal.database.close();
    journal = new DesktopSyncJournal(filename);
    expect(journal.getPendingUploads('target-a')).toEqual([row]);
    expect(journal.hasUploadReceipt('target-a', 'source', 'pending.txt', 'revision')).toBe(false);
  });

  it('does not replace an existing pending upload on duplicate insert', () => {
    journal.savePendingUpload('target-a', 'source', 'file', 'revision', 'first-temp');
    expect(() => journal.savePendingUpload('target-a', 'source', 'file', 'revision', 'second-temp')).toThrow();
    expect(journal.getPendingUploads('target-a').map(row => row.temporaryPath)).toEqual(['first-temp']);
  });

  it('rejects stale descriptors from another temp or target when advancing or settling', () => {
    journal.savePendingUpload('target-a', 'source', 'file', 'revision', 'temp-a');
    journal.savePendingUpload('target-b', 'source', 'file', 'revision', 'temp-a');
    journal.savePendingUpload('target-c', 'source', 'file', 'revision', 'temp-b');
    const a = journal.getPendingUploads('target-a')[0];
    const b = journal.getPendingUploads('target-b')[0];
    const staleTemp = { ...a, temporaryPath: 'temp-b' } as PendingUpload;
    expect(() => journal.advancePendingUpload('target-a', staleTemp, 'uploaded')).toThrow();
    for (const [targetId, pending] of [['target-a', a], ['target-b', b]] as const) {
      journal.advancePendingUpload(targetId, pending, 'uploaded');
      journal.advancePendingUpload(targetId, pending, 'moving');
      journal.advancePendingUpload(targetId, pending, 'moved');
    }
    expect(() => journal.completePendingUpload('target-b', { ...a })).toThrow();
    expect(journal.getPendingUploads('target-a')[0].phase).toBe('moved');
    expect(journal.getPendingUploads('target-b')[0].phase).toBe('moved');
    expect(journal.getPendingUploads('target-c')[0].phase).toBe('prepared');
    expect(journal.hasUploadReceipt('target-a', 'source', 'file', 'revision')).toBe(false);
    expect(journal.hasUploadReceipt('target-b', 'source', 'file', 'revision')).toBe(false);
  });

  it.each(['receipt', 'delete'] as const)('rolls back moved completion atomically on injected %s SQL failure', failure => {
    journal.savePendingUpload('target-a', 'source', 'file', 'revision', 'temp');
    const pending = journal.getPendingUploads('target-a')[0];
    journal.advancePendingUpload('target-a', pending, 'uploaded');
    journal.advancePendingUpload('target-a', pending, 'moving');
    journal.advancePendingUpload('target-a', pending, 'moved');
    const trigger = failure === 'receipt'
      ? `CREATE TRIGGER reject_receipt BEFORE INSERT ON upload_receipt BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`
      : `CREATE TRIGGER reject_pending_delete BEFORE DELETE ON pending_upload BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`;
    journal.database.exec(trigger);
    expect(() => journal.completePendingUpload('target-a', pending)).toThrow();
    expect(journal.hasUploadReceipt('target-a', 'source', 'file', 'revision')).toBe(false);
    expect(journal.getPendingUploads('target-a')).toEqual([pending]);
    journal.database.exec(failure === 'receipt' ? 'DROP TRIGGER reject_receipt' : 'DROP TRIGGER reject_pending_delete');
    journal.database.close();
    journal = new DesktopSyncJournal(join(root, 'journal.sqlite'));
    journal.completePendingUpload('target-a', pending);
    expect(journal.hasUploadReceipt('target-a', 'source', 'file', 'revision')).toBe(true);
    expect(journal.getPendingUploads('target-a')).toEqual([]);
  });

  it('retains other targets when completing an exact moved descriptor', () => {
    journal.savePendingUpload('target-a', 'source', 'file', 'revision', 'temp-a');
    journal.savePendingUpload('target-b', 'source', 'file', 'revision', 'temp-b');
    const pending = journal.getPendingUploads('target-a')[0];
    journal.advancePendingUpload('target-a', pending, 'uploaded');
    journal.advancePendingUpload('target-a', pending, 'moving');
    journal.advancePendingUpload('target-a', pending, 'moved');
    journal.completePendingUpload('target-a', pending);
    expect(journal.getPendingUploads('target-a')).toEqual([]);
    expect(journal.getPendingUploads('target-b')[0].temporaryPath).toBe('temp-b');
    expect(journal.hasUploadReceipt('target-a', 'source', 'file', 'revision')).toBe(true);
    expect(journal.hasUploadReceipt('target-b', 'source', 'file', 'revision')).toBe(false);
  });

  it('rolls back the entire source selection when persistence fails', () => {
    journal.replaceSources([{ path: '/fixture/a', displayName: 'a' }]);
    const before = journal.getSourcePaths();
    journal.database.exec(`CREATE TRIGGER reject_source BEFORE INSERT ON source
      WHEN NEW.path = '/fixture/rejected' BEGIN SELECT RAISE(ABORT, 'fixture refusal'); END`);
    expect(() => journal.replaceSources([
      { path: '/fixture/new', displayName: 'new' }, { path: '/fixture/rejected', displayName: 'rejected' },
    ])).toThrow();
    expect(journal.getSourcePaths()).toEqual(before);
  });
});
