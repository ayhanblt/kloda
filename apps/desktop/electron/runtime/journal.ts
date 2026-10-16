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
      `);
      const saveReceipt = this.database.prepare(`
        INSERT OR IGNORE INTO upload_receipt (target_id, source_id, relative_path, revision) VALUES (?, ?, ?, ?)
      `);
      this.completePendingUpload = this.database.transaction((targetId: string, pending: PendingUpload) => {
        if (pending.targetId !== targetId) throw new Error('Pending upload target changed before settlement.');
        if (pending.phase !== 'moved') throw new Error('Cannot settle an unacknowledged upload.');
        const removed = removePending.run(targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath);
        if (removed.changes !== 1) throw new Error('Pending upload ownership changed before settlement.');
        saveReceipt.run(targetId, pending.sourceId, pending.relativePath, pending.revision);
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

  saveStorage(storage: Omit<StorageForm, 'password'>): void {
    this.setSetting('storage', JSON.stringify(storage));
    this.setSetting('storageTested', 'false');
  }

  setStorageTested(): void { this.setSetting('storageTested', 'true'); }

  saveProgress(progress: SyncProgress): void {
    this.database.prepare(`INSERT OR REPLACE INTO sync_progress
      (id, status, bytes_transferred, bytes_total, completed_files, total_files) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(progress.id, progress.status, progress.bytesTransferred, progress.bytesTotal, progress.completedFiles, progress.totalFiles);
  }

  getLatestProgress(): SyncProgress | null {
    return (this.database.prepare(`SELECT id, status, bytes_transferred AS bytesTransferred,
      bytes_total AS bytesTotal, completed_files AS completedFiles, total_files AS totalFiles
      FROM sync_progress ORDER BY rowid DESC LIMIT 1`).get() as SyncProgress | undefined) ?? null;
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
    `).run(phase, targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath, pending.phase);
    if (result.changes !== 1) throw new Error('Pending upload ownership changed before transition.');
    pending.phase = phase;
  }

  clearPendingUpload(targetId: string, pending: PendingUpload): void {
    if (pending.targetId !== targetId) throw new Error('Pending upload target changed before cleanup.');
    const result = this.database.prepare(`
      DELETE FROM pending_upload WHERE target_id = ? AND source_id = ? AND relative_path = ?
        AND revision = ? AND temporary_path = ? AND phase = ?
    `).run(targetId, pending.sourceId, pending.relativePath, pending.revision, pending.temporaryPath, pending.phase);
    if (result.changes !== 1) throw new Error('Pending upload ownership changed before cleanup.');
  }

  getPendingUploads(targetId: string): readonly PendingUpload[] {
    return this.database.prepare(`
      SELECT target_id AS targetId, source_id AS sourceId, relative_path AS relativePath, revision, temporary_path AS temporaryPath, phase
      FROM pending_upload WHERE target_id = ?
    `).all(targetId) as PendingUpload[];
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
