import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { migrateUploadJournal } from './journal-migration.js';
import type { BackupDraft, DesktopSource, StorageForm, SyncProgress } from './types.js';

export interface PendingUpload {
  targetId: string;
  sourceId: string;
  relativePath: string;
  revision: string;
  temporaryPath: string;
  issueCode?: string;
  skipped?: boolean;
  publishedPath?: string;
  phase: 'prepared' | 'uploaded' | 'moving' | 'moved' | 'conflict' | 'unknown';
}

export class DesktopSyncJournal {
  readonly database: Database.Database;
  readonly completePendingUpload: (targetId: string, pending: PendingUpload) => void;

  constructor(filePath: string, nativeBinding?: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.database = new Database(filePath, { nativeBinding });
    this.database.pragma('journal_mode = WAL');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source (id TEXT PRIMARY KEY, path TEXT NOT NULL, display_name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_progress (
        id TEXT PRIMARY KEY, status TEXT NOT NULL, bytes_transferred INTEGER NOT NULL,
        bytes_total INTEGER NOT NULL, completed_files INTEGER NOT NULL, total_files INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS upload_receipt (
        target_id TEXT NOT NULL, source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        PRIMARY KEY (target_id, source_id, relative_path, revision)
      );
      CREATE TABLE IF NOT EXISTS pending_upload (
        target_id TEXT NOT NULL, source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
        temporary_path TEXT NOT NULL, phase TEXT NOT NULL DEFAULT 'unknown',
        PRIMARY KEY (target_id, source_id, relative_path, revision)
      );
    `);
    try {
      migrateUploadJournal(this.database);
      const removePending = this.database.prepare(`
        DELETE FROM pending_upload WHERE target_id = ? AND source_id = ? AND relative_path = ?
          AND revision = ? AND temporary_path = ? AND phase = 'moved'
          AND issue_code IS ? AND skipped = ? AND published_path IS ?
      `);
      const saveReceipt = this.database.prepare(`
        INSERT INTO upload_receipt (target_id, source_id, relative_path, revision, published_path) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(target_id, source_id, relative_path, revision) DO UPDATE SET published_path=excluded.published_path
      `);
      this.completePendingUpload = this.database.transaction((targetId: string, pending: PendingUpload) => {
        if (pending.targetId !== targetId) throw new Error('Pending upload target changed before settlement.');
        if (pending.phase !== 'moved') throw new Error('Cannot settle an unacknowledged upload.');
        const removed = removePending.run(targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath, ...this.pendingDetail(pending));
        if (removed.changes !== 1) throw new Error('Pending upload ownership changed before settlement.');
        saveReceipt.run(targetId, pending.sourceId, pending.relativePath, pending.revision, pending.publishedPath ?? null);
      });
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  getDraft(): BackupDraft {
    const schedule = this.getSetting('schedule');
    const storage = this.getSetting('storage');
    const sources = this.database
      .prepare('SELECT id, display_name AS displayName FROM source ORDER BY display_name')
      .all() as DesktopSource[];
    return {
      intervalHours: schedule ? JSON.parse(schedule).intervalHours : 12,
      localTime: schedule ? JSON.parse(schedule).localTime : '12:00',
      sources,
      storage: storage ? JSON.parse(storage) : null,
      storageTested: this.getSetting('storageTested') === 'true',
    };
  }

  replaceSources(sources: readonly { path: string; displayName: string }[]): void {
    const save = this.database.transaction(() => {
      const existing = new Map(this.getSourcePaths().map((source) => [source.path, source.id]));
      const selectedPaths = new Set<string>();
      this.database.prepare('DELETE FROM source').run();
      const insert = this.database.prepare('INSERT INTO source (id, path, display_name) VALUES (?, ?, ?)');
      for (const source of sources) {
        if (selectedPaths.has(source.path)) continue;
        selectedPaths.add(source.path);
        insert.run(existing.get(source.path) ?? randomUUID(), source.path, source.displayName);
      }
      if (selectedPaths.size !== existing.size || [...selectedPaths].some(path => !existing.has(path))) this.bumpWorkRevision();
    });
    save();
  }

  getSourcePaths(): readonly { id: string; path: string; displayName: string }[] {
    return this.database.prepare('SELECT id, path, display_name AS displayName FROM source').all() as {
      id: string; path: string; displayName: string;
    }[];
  }

  saveSchedule(intervalHours: 12 | 24, localTime: string): void {
    const value = JSON.stringify({ intervalHours, localTime });
    this.database.transaction(() => {
      if (this.getSetting('schedule') === value) return;
      this.setSetting('schedule', value);
      this.database.prepare("DELETE FROM setting WHERE key = 'scheduleDue'").run();
    })();
  }

  getScheduleDue(): number | undefined {
    const value = this.getSetting('scheduleDue');
    if (value === undefined) return undefined;
    const due: unknown = JSON.parse(value);
    if (typeof due !== 'number' || !Number.isSafeInteger(due) || Math.abs(due) > 8.64e15) {
      throw new Error('Invalid persisted schedule occurrence.');
    }
    return due;
  }

  saveScheduleDue(due: number): void {
    this.setSetting('scheduleDue', JSON.stringify(due));
  }

  getWorkRevision(): string { return this.getSetting('workRevision') ?? 'legacy'; }

  private bumpWorkRevision(): void { this.setSetting('workRevision', randomUUID()); }

  saveStorage(storage: Omit<StorageForm, 'password'>, changed = true): void {
    this.setSetting('storage', JSON.stringify(storage));
    this.setSetting('storageTested', 'false');
    if (changed) this.bumpWorkRevision();
  }

  setStorageTested(): void { this.setSetting('storageTested', 'true'); }

  getAutostartChoice(): boolean | undefined {
    const value = this.getSetting('autostartChoice');
    return value === undefined ? undefined : value === 'true';
  }

  saveAutostartChoice(enabled: boolean): void { this.setSetting('autostartChoice', String(enabled)); }

  saveProgress(progress: SyncProgress): void {
    const { id, status, bytesTransferred, bytesTotal, completedFiles, totalFiles, ...detail } = progress;
    this.database.prepare(`INSERT OR REPLACE INTO sync_progress
      (id, status, bytes_transferred, bytes_total, completed_files, total_files, detail) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, status, bytesTransferred, bytesTotal, completedFiles, totalFiles, JSON.stringify(detail));
  }

  getLatestProgress(): SyncProgress | null {
    const row = this.database.prepare(`SELECT id, status, bytes_transferred AS bytesTransferred,
      bytes_total AS bytesTotal, completed_files AS completedFiles, total_files AS totalFiles, detail
      FROM sync_progress ORDER BY rowid DESC LIMIT 1`).get() as (SyncProgress & { detail: string }) | undefined;
    if (!row) return null;
    const { detail, ...progress } = row;
    return { ...JSON.parse(detail), ...progress };
  }

  getUploadReceiptPath(targetId: string, sourceId: string, relativePath: string, revision: string): string | undefined {
    const row = this.database.prepare(`SELECT published_path AS path FROM upload_receipt
      WHERE target_id = ? AND source_id = ? AND relative_path = ? AND revision = ?`)
      .get(targetId, sourceId, relativePath, revision) as { path: string | null } | undefined;
    return row ? row.path ?? `${sourceId}/${relativePath}` : undefined;
  }

  hasUploadReceipt(targetId: string, sourceId: string, relativePath: string, revision: string): boolean {
    return this.database.prepare(
      'SELECT 1 FROM upload_receipt WHERE target_id = ? AND source_id = ? AND relative_path = ? AND revision = ?',
    ).get(targetId, sourceId, relativePath, revision) !== undefined;
  }

  savePendingUpload(targetId: string, sourceId: string, relativePath: string, revision: string, temporaryPath: string): void {
    this.database.prepare(`
      INSERT INTO pending_upload (target_id, source_id, relative_path, revision, temporary_path, phase)
      VALUES (?, ?, ?, ?, ?, 'prepared')
    `).run(targetId, sourceId, relativePath, revision, temporaryPath);
  }

  advancePendingUpload(targetId: string, pending: PendingUpload, phase: 'uploaded' | 'moving' | 'moved' | 'conflict'): void {
    if (pending.targetId !== targetId) throw new Error('Pending upload target changed before transition.');
    const allowed = (pending.phase === 'prepared' && phase === 'uploaded') ||
      (pending.phase === 'uploaded' && (phase === 'moving' || phase === 'conflict')) ||
      (pending.phase === 'moving' && (phase === 'moving' || phase === 'moved' || phase === 'conflict')) ||
      (pending.phase === 'conflict' && phase === 'moving');
    if (!allowed) throw new Error('Invalid pending upload transition.');
    const result = this.database.prepare(`
      UPDATE pending_upload SET phase = ? WHERE target_id = ? AND source_id = ? AND relative_path = ?
        AND revision = ? AND temporary_path = ? AND phase = ?
        AND issue_code IS ? AND skipped = ? AND published_path IS ?
    `).run(phase, targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath, pending.phase, ...this.pendingDetail(pending));
    if (result.changes !== 1) throw new Error('Pending upload ownership changed before transition.');
    pending.phase = phase;
  }

  clearPendingUpload(targetId: string, pending: PendingUpload): void {
    if (pending.targetId !== targetId) throw new Error('Pending upload target changed before cleanup.');
    const result = this.database.prepare(`
      DELETE FROM pending_upload WHERE target_id = ? AND source_id = ? AND relative_path = ?
        AND revision = ? AND temporary_path = ? AND phase = ?
        AND issue_code IS ? AND skipped = ? AND published_path IS ?
    `).run(targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath, pending.phase, ...this.pendingDetail(pending));
    if (result.changes !== 1) throw new Error('Pending upload ownership changed before cleanup.');
  }

  setPendingIssue(targetId: string, pending: PendingUpload, code: string | undefined, skipped = false): void {
    this.updatePending(targetId, pending, 'issue_code = ?, skipped = ?', [code ?? null, Number(skipped)]);
    if (code === undefined) delete pending.issueCode;
    else pending.issueCode = code;
    if (skipped) pending.skipped = true;
    else delete pending.skipped;
  }

  setPendingPublication(targetId: string, pending: PendingUpload, path: string): void {
    if (pending.phase !== 'uploaded' && pending.phase !== 'conflict') throw new Error('Cannot change an in-flight publication.');
    this.updatePending(targetId, pending, 'published_path = ?', [path]);
    pending.publishedPath = path;
  }

  private updatePending(targetId: string, pending: PendingUpload, assignment: string, values: (string | number | null)[]): void {
    if (pending.targetId !== targetId) throw new Error('Pending upload target changed before update.');
    const result = this.database.prepare(`UPDATE pending_upload SET ${assignment}
      WHERE target_id = ? AND source_id = ? AND relative_path = ? AND revision = ? AND temporary_path = ? AND phase = ?
        AND issue_code IS ? AND skipped = ? AND published_path IS ?`)
      .run(...values, targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath, pending.phase, ...this.pendingDetail(pending));
    if (result.changes !== 1) throw new Error('Pending upload ownership changed before update.');
  }

  private pendingDetail(pending: PendingUpload): [string | null, number, string | null] {
    return [pending.issueCode ?? null, Number(pending.skipped ?? false), pending.publishedPath ?? null];
  }

  getPendingUploads(targetId: string): readonly PendingUpload[] { return this.pendingRows('target_id = ?', [targetId]); }

  getReviewUploads(includeOtherScopes = false): readonly PendingUpload[] {
    const current = this.getDraft().storage;
    const target = current ? JSON.stringify([current.endpoint, current.targetPath, current.username]) : '';
    const otherScopes = includeOtherScopes ? ' OR target_id <> ? OR source_id NOT IN (SELECT id FROM source)' : '';
    return this.pendingRows("issue_code IS NOT NULL OR phase IN ('conflict', 'unknown') OR target_id = ''" + otherScopes,
      includeOtherScopes ? [target] : []);
  }

  private pendingRows(where: string, values: string[]): PendingUpload[] {
    const rows = this.database.prepare(`SELECT target_id AS targetId, source_id AS sourceId, relative_path AS relativePath,
      revision, temporary_path AS temporaryPath, phase, issue_code AS issueCode, skipped, published_path AS publishedPath
      FROM pending_upload WHERE ${where}`).all(...values) as (Omit<PendingUpload, 'skipped' | 'issueCode' | 'publishedPath'> & { skipped: number; issueCode: string | null; publishedPath: string | null })[];
    return rows.map(({ issueCode, skipped, publishedPath, ...row }) => ({ ...row,
      ...(issueCode === null ? {} : { issueCode }), ...(skipped ? { skipped: true } : {}),
      ...(publishedPath === null ? {} : { publishedPath }),
    }));
  }

  hasUnscopedPendingUploads(): boolean {
    return this.database.prepare("SELECT 1 FROM pending_upload WHERE target_id = '' LIMIT 1").get() !== undefined;
  }

  private getSetting(key: string): string | undefined {
    return (this.database.prepare('SELECT value FROM setting WHERE key = ?').get(key) as { value?: string } | undefined)?.value;
  }

  private setSetting(key: string, value: string): void {
    this.database.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(key, value);
  }
}
