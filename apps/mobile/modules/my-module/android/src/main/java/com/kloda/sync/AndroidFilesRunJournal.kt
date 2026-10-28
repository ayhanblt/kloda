package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import android.os.SystemClock
import android.provider.Settings
import android.content.Context

// Uses the existing transfer database; receipts and source-deletion tombstones are never reset.
internal class AndroidFilesRunJournal(private val journal: AndroidSyncJournal, context: Context) {
  private val boot: Int? = runCatching { Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT) }.getOrNull()
  companion object {
    private val lock = Any()
    private val resumable = setOf("running", "paused", "retry_wait")
    fun create(db: SQLiteDatabase) {
      db.execSQL("""CREATE TABLE files_run (
        id TEXT PRIMARY KEY, record_id TEXT NOT NULL, rebackup TEXT,
        attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 5),
        state TEXT NOT NULL CHECK(state IN ('running','paused','retry_wait','finished','needs_attention','failed')),
        retry_at INTEGER CHECK(retry_at>=0), error_code TEXT,
        retry_elapsed INTEGER, retry_boot INTEGER, activation INTEGER NOT NULL, context_binding TEXT)""")
      retainContext(db)
    }
    fun upgradeContext(db: SQLiteDatabase) {
      db.execSQL("ALTER TABLE files_run ADD COLUMN context_binding TEXT")
      retainContext(db)
    }
    private fun retainContext(db: SQLiteDatabase) {
      db.execSQL("""CREATE TRIGGER immutable_files_run BEFORE UPDATE ON files_run
        WHEN NEW.id IS NOT OLD.id OR NEW.record_id IS NOT OLD.record_id
        OR NEW.rebackup IS NOT OLD.rebackup OR NEW.context_binding IS NOT OLD.context_binding
        BEGIN SELECT RAISE(ABORT,'run_binding'); END""")
    }
  }

  fun latest(record: String? = null): FilesRun? = journal.readableDatabase.rawQuery(
    "SELECT * FROM files_run" + (if (record == null) "" else " WHERE record_id=?") + " ORDER BY activation DESC LIMIT 1",
    record?.let { arrayOf(it) }
  ).use { c ->
    if (!c.moveToFirst()) null else FilesRun(c.getString(0), c.getString(1), c.getString(2), c.getInt(3),
      c.getString(4), if (c.isNull(5)) null else c.getLong(5), c.getString(6), if (c.isNull(7)) null else c.getLong(7), if (c.isNull(8)) null else c.getInt(8), c.getString(10))
  }

  fun invalidate(binding: String, record: String? = null) = synchronized(lock) {
    journal.writableDatabase.execSQL("""UPDATE files_run SET state='failed',error_code='settings_changed',retry_at=NULL,retry_elapsed=NULL,retry_boot=NULL
      WHERE state IN ('running','paused','retry_wait') AND (context_binding IS NULL OR context_binding!=? OR (? IS NOT NULL AND record_id!=?))""",
      arrayOf<Any?>(binding, record, record))
  }

  fun begin(record: String, rebackup: String?, binding: String): FilesRun = synchronized(lock) {
    invalidate(binding, record)
    val retained = latest(record)
    if (retained != null && retained.state in resumable) {
      if (rebackup != null && retained.rebackup != rebackup) throw FilesFailure("backup_busy")
      journal.writableDatabase.execSQL("UPDATE files_run SET activation=(SELECT MAX(activation)+1 FROM files_run) WHERE id=?", arrayOf(retained.id))
      // Across a reboot the previous monotonic clock cannot prove elapsed time.
      if (retained.retryAt != null && (retained.retryBoot != boot || retained.retryElapsed == null)) {
        if (boot == null) throw FilesFailure("retry_clock_unavailable")
        val due = Math.addExact(System.currentTimeMillis(), 60_000L)
        val elapsed = Math.addExact(SystemClock.elapsedRealtime(), 60_000L)
        journal.writableDatabase.execSQL("UPDATE files_run SET retry_at=?,retry_elapsed=?,retry_boot=? WHERE id=?",
          arrayOf<Any?>(due, elapsed, boot, retained.id))
        return@synchronized retained.copy(retryAt = due, retryElapsed = elapsed, retryBoot = boot)
      }
      return@synchronized retained
    }
    val id = AndroidFilesSnapshots.randomId()
    journal.writableDatabase.execSQL("INSERT INTO files_run(id,record_id,rebackup,context_binding,attempts,state,activation) SELECT ?,?,?,?,1,'running',COALESCE(MAX(activation),0)+1 FROM files_run",
      arrayOf(id, record, rebackup, binding))
    latest(record) ?: throw FilesFailure("queue_unavailable")
  }

  fun startAttempt(run: FilesRun): FilesRun = synchronized(lock) {
    if (run.waiting(SystemClock.elapsedRealtime(), boot)) throw FilesFailure("retry_wait")
    val attempt = run.attempts + if (run.retryAt != null) 1 else 0
    if (attempt > 5) throw FilesFailure("retry_exhausted")
    journal.writableDatabase.compileStatement("UPDATE files_run SET state='running',attempts=?,retry_at=NULL,error_code=NULL,retry_elapsed=NULL,retry_boot=NULL WHERE id=? AND state IN ('running','paused','retry_wait')").use {
      it.bindLong(1, attempt.toLong()); it.bindString(2, run.id)
      if (it.executeUpdateDelete() != 1) throw FilesFailure("settings_changed")
    }
    run.copy(attempts = attempt, state = "running", retryAt = null, error = null, retryElapsed = null, retryBoot = null)
  }

  fun waiting(run: FilesRun): Boolean = run.waiting(SystemClock.elapsedRealtime(), boot)

  fun finish(run: FilesRun, state: String, code: String? = null) {
    if (state == "paused") {
      journal.writableDatabase.execSQL("UPDATE files_run SET state=?,error_code=? WHERE id=? AND state IN ('running','paused','retry_wait')", arrayOf(state, code, run.id))
    } else {
      journal.writableDatabase.execSQL("UPDATE files_run SET state=?,error_code=?,retry_at=NULL,retry_elapsed=NULL,retry_boot=NULL WHERE id=? AND state IN ('running','paused','retry_wait')",
        arrayOf(state, code, run.id))
    }
  }

  fun failure(run: FilesRun, code: String, now: Long): FilesRun {
    val failed = run.failed(code, now, SystemClock.elapsedRealtime(), boot)
    journal.writableDatabase.execSQL("UPDATE files_run SET state=?,retry_at=?,error_code=?,retry_elapsed=?,retry_boot=? WHERE id=? AND state IN ('running','paused','retry_wait')",
      arrayOf<Any?>(failed.state, failed.retryAt, failed.error, failed.retryElapsed, failed.retryBoot, run.id))
    return failed
  }
}
