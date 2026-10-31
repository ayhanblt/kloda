package com.kloda.sync

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File

internal data class QueuedSourceFile(val reference: String, val relativePath: String, val revision: String, val size: Long)
internal data class FilesJob(
  val id: String, val recordId: String, val sourceId: String, val reference: String, val treeReference: String,
  val name: String, val wireSourceId: String, val sha256: String, val size: Long, val operationId: String?,
  val offset: Long, val state: String, val errorCode: String?, val rebackupOf: String? = null
)

internal class AndroidSyncJournal(context: Context, databaseName: String = "kloda-sync.sqlite", private val deviceLocal: Boolean = false) : SQLiteOpenHelper(context, databaseName, null, 6) {
  companion object {
    val sourceLock = Any()
    fun webdav(context: Context) = AndroidSyncJournal(context, File(context.noBackupFilesDir, "kloda-webdav.sqlite").absolutePath, deviceLocal = true)
  }
  init { setWriteAheadLoggingEnabled(true) }

  override fun onConfigure(database: SQLiteDatabase) {
    database.execSQL("PRAGMA synchronous=FULL")
    if (deviceLocal) database.setForeignKeyConstraintsEnabled(true)
  }
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL("""CREATE TABLE queued_source_file (
      source_id TEXT NOT NULL, reference TEXT NOT NULL, relative_path TEXT NOT NULL,
      revision TEXT NOT NULL, size_bytes INTEGER NOT NULL, status TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1, tree_reference TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (source_id, reference))""")
    createTransfers(database)
    createDisposition(database)
    AndroidFilesRunJournal.create(database)
    AndroidScheduleJournal.create(database)
  }

  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion == 1) {
      database.execSQL("ALTER TABLE queued_source_file ADD COLUMN available INTEGER NOT NULL DEFAULT 1")
      database.execSQL("ALTER TABLE queued_source_file ADD COLUMN tree_reference TEXT NOT NULL DEFAULT ''")
      createTransfers(database)
    }
    if (oldVersion == 2) {
    database.execSQL("DROP TRIGGER retain_files_job")
    database.execSQL("DROP TRIGGER immutable_files_job")
    database.execSQL("ALTER TABLE files_job RENAME TO legacy_files_job")
    createTransfers(database)
    database.execSQL("INSERT INTO files_job SELECT *,'' FROM legacy_files_job")
    database.execSQL("DROP TABLE legacy_files_job")
    }
    if (oldVersion < 3) createDisposition(database)
    if (oldVersion < 4) AndroidFilesRunJournal.create(database)
    else if (oldVersion < 5) AndroidFilesRunJournal.upgradeContext(database)
    if (oldVersion < 6) AndroidScheduleJournal.create(database)
  }

  private fun createTransfers(database: SQLiteDatabase) {
    database.execSQL("""CREATE TABLE files_job (
      id TEXT PRIMARY KEY, record_id TEXT NOT NULL, source_id TEXT NOT NULL,
      reference TEXT NOT NULL, tree_reference TEXT NOT NULL, name TEXT NOT NULL,
      wire_source_id TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes>=0),
      operation_id TEXT, acknowledged_bytes INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged_bytes>=0 AND acknowledged_bytes<=size_bytes),
      state TEXT NOT NULL, error_code TEXT, rebackup_of TEXT NOT NULL DEFAULT '',
      UNIQUE(record_id,source_id,reference,tree_reference,name,sha256,size_bytes,rebackup_of))""")
    database.execSQL("""CREATE TRIGGER retain_files_job BEFORE DELETE ON files_job
      BEGIN SELECT RAISE(ABORT,'retained'); END""")
    database.execSQL("""CREATE TRIGGER immutable_files_job BEFORE UPDATE ON files_job
      WHEN NEW.id IS NOT OLD.id OR NEW.record_id IS NOT OLD.record_id OR NEW.source_id IS NOT OLD.source_id
      OR NEW.reference IS NOT OLD.reference OR NEW.tree_reference IS NOT OLD.tree_reference OR NEW.name IS NOT OLD.name
      OR NEW.rebackup_of IS NOT OLD.rebackup_of OR NEW.wire_source_id IS NOT OLD.wire_source_id OR NEW.sha256 IS NOT OLD.sha256 OR NEW.size_bytes IS NOT OLD.size_bytes
      OR (OLD.operation_id IS NOT NULL AND NEW.operation_id IS NOT OLD.operation_id)
      OR NEW.acknowledged_bytes<OLD.acknowledged_bytes OR (OLD.state='completed' AND NEW.state!='completed')
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
  }

  private fun createDisposition(database: SQLiteDatabase) {
    database.execSQL("CREATE TABLE owner_deleted (job TEXT PRIMARY KEY REFERENCES files_job(id))")
  }

  fun reconcileSourceFiles(sourceId: String, treeReference: String, files: Sequence<QueuedSourceFile>): Int = synchronized(sourceLock) {
    val database = writableDatabase
    database.beginTransaction()
    try {
      database.execSQL("UPDATE queued_source_file SET available=0 WHERE source_id=?", arrayOf(sourceId))
      var count = 0
      files.forEach { file ->
        val values = ContentValues().apply {
          put("source_id", sourceId); put("reference", file.reference); put("relative_path", file.relativePath)
          put("revision", file.revision); put("size_bytes", file.size); put("available", 1); put("tree_reference", treeReference)
        }
        if (database.update("queued_source_file", values, "source_id=? AND reference=?", arrayOf(sourceId, file.reference)) == 0) {
          values.put("status", "queued")
          database.insertOrThrow("queued_source_file", null, values)
        }
        count++
      }
      database.execSQL("""UPDATE files_job SET state='blocked',error_code='source_changed'
        WHERE source_id=? AND state!='completed' AND NOT EXISTS(SELECT 1 FROM queued_source_file q
        WHERE q.source_id=files_job.source_id AND q.reference=files_job.reference AND q.available=1
        AND q.tree_reference=files_job.tree_reference)""", arrayOf(sourceId))
      database.setTransactionSuccessful()
      count
    } finally { database.endTransaction() }
  }

  fun removeSource(sourceId: String) = synchronized(sourceLock) {
    val database = writableDatabase
    database.beginTransaction()
    try {
      database.execSQL("UPDATE queued_source_file SET available=0 WHERE source_id=?", arrayOf(sourceId))
      database.execSQL("UPDATE files_job SET state='blocked',error_code='source_permission_lost' WHERE source_id=? AND state!='completed'", arrayOf(sourceId))
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }

  fun sourceFiles(sourceId: String, after: String?): List<QueuedSourceFile> = readableDatabase.rawQuery(
    "SELECT reference,relative_path,revision,size_bytes FROM queued_source_file WHERE source_id=? AND available=1 AND reference>? ORDER BY reference LIMIT 32",
    arrayOf(sourceId, after.orEmpty())
  ).use { cursor -> buildList {
    while (cursor.moveToNext()) add(QueuedSourceFile(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getLong(3)))
  } }

  fun sourceAvailable(job: FilesJob): Boolean = readableDatabase.rawQuery(
    "SELECT 1 FROM queued_source_file WHERE source_id=? AND reference=? AND tree_reference=? AND available=1",
    arrayOf(job.sourceId, job.reference, job.treeReference)
  ).use { it.moveToFirst() }

  fun version(record: String, source: String, file: QueuedSourceFile, tree: String, hash: String, size: Long): FilesJob? = readableDatabase.rawQuery(
    "SELECT * FROM files_job WHERE record_id=? AND reference=? AND tree_reference=? AND name=? AND sha256=? AND size_bytes=? ORDER BY rowid DESC LIMIT 1",
    arrayOf(record, file.reference, tree, file.relativePath.substringAfterLast('/'), hash, size.toString())
  ).use { if (it.moveToFirst()) decode(it) else null }

  fun find(id: String): FilesJob? = readableDatabase.rawQuery("SELECT * FROM files_job WHERE id=?", arrayOf(id)).use {
    if (it.moveToFirst()) decode(it) else null
  }

  fun parent(job: FilesJob): FilesJob? = readableDatabase.rawQuery("""SELECT * FROM files_job WHERE wire_source_id=?
    AND reference=? AND tree_reference=? AND name=? AND sha256=? AND size_bytes=? AND operation_id IS NOT NULL
    ORDER BY rowid DESC LIMIT 2""", arrayOf(job.wireSourceId, job.reference, job.treeReference, job.name, job.sha256, job.size.toString())
  ).use { cursor ->
    if (!cursor.moveToFirst()) null else decode(cursor).also {
      if (cursor.moveToNext()) throw FilesFailure("source_identity_unknown")
    }
  }

  fun deleted(id: String): Boolean = readableDatabase.rawQuery("SELECT 1 FROM owner_deleted WHERE job=?", arrayOf(id)).use { it.moveToFirst() }

  fun clearDeleted(id: String) { writableDatabase.delete("owner_deleted", "job=?", arrayOf(id)) }

  fun markDeleted(id: String) { writableDatabase.execSQL("INSERT OR IGNORE INTO owner_deleted(job) SELECT id FROM files_job WHERE id=?", arrayOf(id)) }

  fun wireSource(record: String, file: QueuedSourceFile, tree: String): String {
    val bindings = readableDatabase.rawQuery("""SELECT record_id,wire_source_id FROM files_job
      WHERE reference=? AND tree_reference=? AND name=? ORDER BY (record_id=?) DESC,rowid""",
      arrayOf(file.reference, tree, file.relativePath.substringAfterLast('/'), record)).use { cursor -> buildList {
      while (cursor.moveToNext()) add(cursor.getString(0) to cursor.getString(1))
    } }
    val current = bindings.firstOrNull { it.first == record }?.second
    if (current != null) return current
    val wires = bindings.map { it.second }.distinct()
    if (wires.size > 1) throw FilesFailure("source_identity_unknown")
    return wires.singleOrNull() ?: AndroidFilesSnapshots.randomId()
  }

  fun retainsSnapshot(id: String): Boolean = readableDatabase.rawQuery(
    "SELECT 1 FROM files_job WHERE id=?", arrayOf(id)
  ).use { it.moveToFirst() }

  fun snapshotCompleted(id: String): Boolean = readableDatabase.rawQuery(
    "SELECT 1 FROM files_job WHERE id=? AND state='completed'", arrayOf(id)
  ).use { it.moveToFirst() }

  fun insert(job: FilesJob) {
    writableDatabase.insertOrThrow("files_job", null, ContentValues().apply {
      put("id", job.id); put("record_id", job.recordId); put("source_id", job.sourceId); put("reference", job.reference)
      put("tree_reference", job.treeReference); put("name", job.name); put("wire_source_id", job.wireSourceId)
      put("sha256", job.sha256); put("size_bytes", job.size); put("state", "queued"); put("rebackup_of", job.rebackupOf.orEmpty())
    })
  }

  fun jobs(record: String, source: String, after: String?): List<FilesJob> = readableDatabase.rawQuery(
    "SELECT * FROM files_job WHERE record_id=? AND source_id=? AND state!='completed' AND NOT EXISTS(SELECT 1 FROM owner_deleted d WHERE d.job=files_job.id) AND id>? ORDER BY id LIMIT 32",
    arrayOf(record, source, after.orEmpty())
  ).use { cursor -> buildList { while (cursor.moveToNext()) add(decode(cursor)) } }

  fun update(id: String, state: String, code: String? = null, operation: String? = null, offset: Long? = null) {
    writableDatabase.update("files_job", ContentValues().apply {
      put("state", state); if (code == null) putNull("error_code") else put("error_code", code)
      if (operation != null) put("operation_id", operation)
      if (offset != null) put("acknowledged_bytes", offset)
    }, "id=? AND state!='completed'", arrayOf(id))
  }

  fun interrupt(record: String, code: String) {
    writableDatabase.execSQL("UPDATE files_job SET state='paused',error_code=? WHERE record_id=? AND state IN ('queued','preparing','uploading','finalizing')", arrayOf(code, record))
  }

  fun blockSource(source: String, code: String) {
    writableDatabase.execSQL("UPDATE files_job SET state='blocked',error_code=? WHERE source_id=? AND state!='completed'", arrayOf(code, source))
  }
  fun status(running: Boolean, errorCode: String?): Map<String, Any> {
    val database = readableDatabase
    val count = database.rawQuery("SELECT COUNT(*) FROM files_job", null).use { it.moveToFirst(); it.getLong(0) }
    val jobs = database.rawQuery("SELECT * FROM files_job ORDER BY (state='completed'), CASE WHEN state='completed' THEN -rowid ELSE rowid END LIMIT 100", null).use { cursor ->
      buildList { while (cursor.moveToNext()) {
        val job = decode(cursor)
        add(buildMap<String, Any> {
          put("id", job.id); put("recordId", job.recordId); put("sourceId", job.sourceId); put("name", job.name)
          put("state", if (deleted(job.id)) "owner_deleted" else if (!running && job.state in setOf("uploading", "finalizing", "preparing")) "paused" else job.state)
          put("acknowledgedBytes", job.offset.toString()); put("totalBytes", job.size.toString())
          if (deleted(job.id)) put("errorCode", "owner_deleted") else job.errorCode?.let { put("errorCode", it) }
        })
      } }
    }
    return buildMap {
      put("running", running); put("jobs", jobs); put("totalJobs", count.toString()); put("hasMore", count > jobs.size)
      errorCode?.let { put("errorCode", it) }
    }
  }

  internal fun decode(cursor: Cursor): FilesJob {
    fun text(name: String) = cursor.getString(cursor.getColumnIndexOrThrow(name))
    fun number(name: String) = cursor.getLong(cursor.getColumnIndexOrThrow(name))
    return FilesJob(text("id"), text("record_id"), text("source_id"), text("reference"), text("tree_reference"), text("name"),
      text("wire_source_id"), text("sha256"), number("size_bytes"), text("operation_id"), number("acknowledged_bytes"), text("state"), text("error_code"), text("rebackup_of").ifEmpty { null })
  }
}
