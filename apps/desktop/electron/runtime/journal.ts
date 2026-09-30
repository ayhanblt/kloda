import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { BackupDraft, DesktopSource, StorageForm, SyncProgress } from './types.js';

export class DesktopSyncJournal {
  readonly database: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.database = new Database(filePath);
    this.database.pragma('journal_mode = WAL');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source (id TEXT PRIMARY KEY, path TEXT NOT NULL, display_name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_progress (
        id TEXT PRIMARY KEY, status TEXT NOT NULL, bytes_transferred INTEGER NOT NULL,
        bytes_total INTEGER NOT NULL, completed_files INTEGER NOT NULL, total_files INTEGER NOT NULL
      );
    `);
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

  replaceSources(sources: readonly { id: string; path: string; displayName: string }[]): void {
    const save = this.database.transaction(() => {
      this.database.prepare('DELETE FROM source').run();
      const insert = this.database.prepare('INSERT INTO source (id, path, display_name) VALUES (?, ?, ?)');
      for (const source of sources) insert.run(source.id, source.path, source.displayName);
    });
    save();
  }

  getSourcePaths(): readonly { id: string; path: string; displayName: string }[] {
    return this.database.prepare('SELECT id, path, display_name AS displayName FROM source').all() as {
      id: string; path: string; displayName: string;
    }[];
  }

  saveSchedule(intervalHours: 12 | 24, localTime: string): void {
    this.setSetting('schedule', JSON.stringify({ intervalHours, localTime }));
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

  private getSetting(key: string): string | undefined {
    return (this.database.prepare('SELECT value FROM setting WHERE key = ?').get(key) as { value?: string } | undefined)?.value;
  }

  private setSetting(key: string, value: string): void {
    this.database.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(key, value);
  }
}
