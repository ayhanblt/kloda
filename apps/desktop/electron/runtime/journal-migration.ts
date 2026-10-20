import type Database from 'better-sqlite3';

export function migrateUploadJournal(database: Database.Database): void {
  database.transaction(() => {
    const receiptColumns = database.prepare('PRAGMA table_info(upload_receipt)').all() as { name: string }[];
    if (!receiptColumns.some(column => column.name === 'target_id')) {
      database.exec(`
        CREATE TABLE scoped_upload_receipt (
          target_id TEXT NOT NULL, source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
          PRIMARY KEY (target_id, source_id, relative_path, revision)
        );
        INSERT INTO scoped_upload_receipt SELECT '', source_id, relative_path, revision FROM upload_receipt;
        DROP TABLE upload_receipt;
        ALTER TABLE scoped_upload_receipt RENAME TO upload_receipt;
      `);
    }
    const pendingColumns = database.prepare('PRAGMA table_info(pending_upload)').all() as { name: string }[];
    if (!pendingColumns.some(column => column.name === 'target_id')) {
      database.exec(`
        CREATE TABLE scoped_pending_upload (
          target_id TEXT NOT NULL, source_id TEXT NOT NULL, relative_path TEXT NOT NULL, revision TEXT NOT NULL,
          temporary_path TEXT NOT NULL, PRIMARY KEY (target_id, source_id, relative_path, revision)
        );
        INSERT INTO scoped_pending_upload SELECT '', source_id, relative_path, revision, temporary_path FROM pending_upload;
        DROP TABLE pending_upload;
        ALTER TABLE scoped_pending_upload RENAME TO pending_upload;
      `);
    }
    const scopedPendingColumns = database.prepare('PRAGMA table_info(pending_upload)').all() as { name: string }[];
    if (!scopedPendingColumns.some(column => column.name === 'phase')) {
      database.exec("ALTER TABLE pending_upload ADD COLUMN phase TEXT NOT NULL DEFAULT 'unknown'");
    }
    for (const [table, name, definition] of [
      ['sync_progress', 'detail', "TEXT NOT NULL DEFAULT '{}'"],
      ['pending_upload', 'issue_code', 'TEXT'],
      ['pending_upload', 'skipped', 'INTEGER NOT NULL DEFAULT 0'],
      ['pending_upload', 'published_path', 'TEXT'],
      ['upload_receipt', 'published_path', 'TEXT'],
    ]) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!columns.some(column => column.name === name)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  })();
}
