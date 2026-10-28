package com.kloda.sync

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase

// OS occurrence metadata references the existing files_run; it never replaces transfer receipts or access retries.
internal class AndroidScheduleJournal(private val journal: AndroidSyncJournal) {
  companion object {
    private val lock = Any()
    fun create(db: SQLiteDatabase) {
      db.execSQL("""CREATE TABLE files_run_job (run_id TEXT NOT NULL,job_id TEXT NOT NULL,
        PRIMARY KEY(run_id,job_id))""")
      db.execSQL("""CREATE TRIGGER validate_files_run_job BEFORE INSERT ON files_run_job
        WHEN NOT EXISTS(SELECT 1 FROM files_run r JOIN files_job f ON f.record_id=r.record_id
          WHERE r.id=NEW.run_id AND f.id=NEW.job_id)
        BEGIN SELECT RAISE(ABORT,'run_job_binding'); END""")
      db.execSQL("""CREATE TRIGGER immutable_files_run_job BEFORE UPDATE ON files_run_job
        BEGIN SELECT RAISE(ABORT,'run_job_binding'); END""")
      db.execSQL("""CREATE TRIGGER retain_files_run_job BEFORE DELETE ON files_run_job
        BEGIN SELECT RAISE(ABORT,'run_job_retained'); END""")
      db.execSQL("""CREATE TABLE scheduled_occurrence (
        id TEXT PRIMARY KEY, context_binding TEXT NOT NULL, record_id TEXT NOT NULL,
        occurrence_ms INTEGER NOT NULL CHECK(occurrence_ms>=0),
        os_attempts INTEGER NOT NULL CHECK(os_attempts BETWEEN 1 AND 5),
        updated INTEGER NOT NULL CHECK(updated IN (0,1)),
        phase TEXT NOT NULL CHECK(phase IN ('running','waiting','finished','exhausted','paused')),
        retry_at INTEGER, retry_elapsed INTEGER, retry_boot INTEGER, run_id TEXT, error_code TEXT,
        UNIQUE(context_binding,occurrence_ms),
        CHECK(updated=0 OR phase='finished'),
        CHECK((phase='waiting' AND retry_at>=0 AND retry_elapsed>=0 AND retry_boot>=0
          AND retry_at IS NOT NULL AND retry_elapsed IS NOT NULL AND retry_boot IS NOT NULL)
          OR (phase!='waiting' AND retry_at IS NULL AND retry_elapsed IS NULL AND retry_boot IS NULL)))""")
      db.execSQL("""CREATE TRIGGER immutable_scheduled_occurrence BEFORE UPDATE ON scheduled_occurrence
        WHEN NEW.id IS NOT OLD.id OR NEW.context_binding IS NOT OLD.context_binding
        OR NEW.record_id IS NOT OLD.record_id OR NEW.occurrence_ms IS NOT OLD.occurrence_ms
        OR NEW.os_attempts<OLD.os_attempts OR NEW.os_attempts>OLD.os_attempts+1
        OR (OLD.run_id IS NOT NULL AND NEW.run_id IS NOT OLD.run_id)
        OR (OLD.phase IN ('finished','exhausted') AND
          (NEW.phase IS NOT OLD.phase OR NEW.updated IS NOT OLD.updated OR NEW.os_attempts IS NOT OLD.os_attempts))
        BEGIN SELECT RAISE(ABORT,'occurrence_binding'); END""")
      db.execSQL("""CREATE TRIGGER retain_scheduled_occurrence BEFORE DELETE ON scheduled_occurrence
        BEGIN SELECT RAISE(ABORT,'occurrence_retained'); END""")
    }

    fun track(db: SQLiteDatabase, runId: String, jobId: String, record: String) {
      val valid = db.rawQuery("""SELECT 1 FROM files_run r JOIN files_job f ON f.record_id=r.record_id
        WHERE r.id=? AND f.id=? AND r.record_id=?""", arrayOf(runId, jobId, record)).use { it.moveToFirst() }
      if (!valid) throw FilesFailure("settings_changed")
      db.execSQL("INSERT OR IGNORE INTO files_run_job(run_id,job_id) VALUES(?,?)", arrayOf(runId, jobId))
    }
  }

  fun get(binding: String, occurrenceMs: Long): ScheduledOccurrence? = journal.readableDatabase.rawQuery(
    "SELECT * FROM scheduled_occurrence WHERE context_binding=? AND occurrence_ms=?", arrayOf(binding, occurrenceMs.toString())
  ).use { if (it.moveToFirst()) decode(it) else null }

  fun find(id: String): ScheduledOccurrence? = journal.readableDatabase.rawQuery(
    "SELECT * FROM scheduled_occurrence WHERE id=?", arrayOf(id)
  ).use { if (it.moveToFirst()) decode(it) else null }

  fun latest(binding: String, record: String): ScheduledOccurrence? = journal.readableDatabase.rawQuery(
    "SELECT * FROM scheduled_occurrence WHERE context_binding=? AND record_id=? ORDER BY occurrence_ms DESC LIMIT 1", arrayOf(binding, record)
  ).use { if (it.moveToFirst()) decode(it) else null }

  fun claim(binding: String, record: String, occurrenceMs: Long, wall: Long, elapsed: Long, boot: Int?, dueByElapsed: Boolean = false): ScheduledOccurrence? = transaction {
    require(binding.isNotEmpty() && record.isNotEmpty() && occurrenceMs >= 0 && wall >= 0 && elapsed >= 0 && (boot == null || boot >= 0))
    val old = get(binding, occurrenceMs)
    if (old == null) {
      if (wall < occurrenceMs && !dueByElapsed) return@transaction null
      val item = ScheduledOccurrence(AndroidFilesSnapshots.randomId(), binding, record, occurrenceMs)
      journal.writableDatabase.execSQL("INSERT INTO scheduled_occurrence(id,context_binding,record_id,occurrence_ms,os_attempts,updated,phase) VALUES(?,?,?,?,1,0,'running')",
        arrayOf<Any>(item.id, binding, record, occurrenceMs))
      return@transaction item
    }
    if (old.record != record || old.phase != "waiting") return@transaction null
    if (boot == null) { save(old.copy(phase = "exhausted", retryAt = null, retryElapsed = null, retryBoot = null, error = "retry_clock_unavailable"), old); return@transaction null }
    if (old.retryBoot != boot || old.retryElapsed == null || elapsed < old.retryElapsed - ScheduledOccurrence.RETRY_MS) {
      save(old.waiting(wall, elapsed, boot, old.error), old); return@transaction null
    }
    if (!old.due(elapsed, boot)) return@transaction null
    if (old.osAttempts >= 5) {
      save(old.copy(phase = "exhausted", retryAt = null, retryElapsed = null, retryBoot = null), old); return@transaction null
    }
    old.claimed().also { save(it, old) }
  }

  fun attachRun(id: String, runId: String, expectedAttempt: Int) = transaction {
    val item = find(id) ?: throw FilesFailure("queue_unavailable")
    if (item.phase != "running" || item.osAttempts != expectedAttempt) throw FilesFailure("paused")
    val valid = journal.readableDatabase.rawQuery("SELECT 1 FROM files_run WHERE id=? AND record_id=? AND context_binding=?",
      arrayOf(runId, item.record, item.binding)).use { it.moveToFirst() }
    if (!valid || item.runId != null && item.runId != runId) throw FilesFailure("settings_changed")
    save(item.copy(runId = runId), item)
  }

  fun stop(id: String, wall: Long, elapsed: Long, boot: Int?, expectedAttempt: Int, userPause: Boolean = false, error: String? = null) = transaction {
    find(id)?.takeIf { it.phase == "running" && it.osAttempts == expectedAttempt }?.let { save(it.stopped(wall, elapsed, boot, userPause, error), it) }
  }

  fun recoverStopped(id: String, queueIdle: Boolean, wall: Long, elapsed: Long, boot: Int?, expectedAttempt: Int) {
    if (queueIdle) stop(id, wall, elapsed, boot, expectedAttempt, error = "os_interrupted")
  }

  fun resumePaused(id: String, wall: Long, elapsed: Long, boot: Int?): ScheduledOccurrence? = transaction {
    require(wall >= 0 && elapsed >= 0 && (boot == null || boot >= 0))
    val item = find(id) ?: return@transaction null
    if (item.phase != "paused") return@transaction null
    item.copy(phase = "running", error = null).also { save(it, item) }
  }

  fun reconcileLinked(id: String, expectedAttempt: Int): Boolean = transaction {
    val item = find(id) ?: return@transaction false
    if (item.osAttempts != expectedAttempt || item.phase !in setOf("running", "waiting", "paused") || item.runId == null) return@transaction false
    val terminal = journal.readableDatabase.rawQuery("""SELECT r.state,r.error_code,
      EXISTS(SELECT 1 FROM files_run_job m WHERE m.run_id=r.id) AND NOT EXISTS(
        SELECT 1 FROM files_run_job m LEFT JOIN files_job f ON f.id=m.job_id WHERE m.run_id=r.id
        AND (f.id IS NULL OR f.record_id!=r.record_id OR f.state!='completed'
          OR EXISTS(SELECT 1 FROM owner_deleted d WHERE d.job=f.id)))
      FROM files_run r WHERE r.id=? AND r.record_id=? AND r.context_binding=?
      AND r.state IN ('finished','needs_attention','failed')""", arrayOf(item.runId, item.record, item.binding)).use { c ->
      if (!c.moveToFirst()) return@transaction false
      val error = c.getString(1)
      (c.getString(0) == "finished" && error == null && c.getInt(2) == 1) to error
    }
    // A crash after the linked run settles must not create a new run or reset either retry budget.
    save(item.copy(phase = "finished", updated = if (terminal.first) 1 else 0,
      retryAt = null, retryElapsed = null, retryBoot = null, error = terminal.second), item)
    true
  }

  fun finish(id: String, verifiedComplete: Boolean, expectedAttempt: Int, error: String? = null) = transaction {
    val item = find(id) ?: return@transaction
    if (item.phase == "running" && item.osAttempts == expectedAttempt) save(item.copy(phase = "finished", updated = if (verifiedComplete) 1 else 0,
      retryAt = null, retryElapsed = null, retryBoot = null, error = error), item)
  }

  private fun save(item: ScheduledOccurrence, expected: ScheduledOccurrence) {
    journal.writableDatabase.execSQL("UPDATE scheduled_occurrence SET os_attempts=?,updated=?,phase=?,retry_at=?,retry_elapsed=?,retry_boot=?,run_id=?,error_code=? WHERE id=? AND os_attempts=? AND phase=?",
      arrayOf<Any?>(item.osAttempts, item.updated, item.phase, item.retryAt, item.retryElapsed, item.retryBoot, item.runId, item.error, item.id, expected.osAttempts, expected.phase))
  }

  private fun <T> transaction(body: () -> T): T = synchronized(lock) {
    val db = journal.writableDatabase
    db.beginTransaction()
    try { body().also { db.setTransactionSuccessful() } } finally { db.endTransaction() }
  }

  private fun decode(c: Cursor): ScheduledOccurrence {
    fun text(name: String): String? = c.getString(c.getColumnIndexOrThrow(name))
    fun number(name: String): Long? = c.getColumnIndexOrThrow(name).let { if (c.isNull(it)) null else c.getLong(it) }
    return ScheduledOccurrence(text("id")!!, text("context_binding")!!, text("record_id")!!, number("occurrence_ms")!!,
      number("os_attempts")!!.toInt(), number("updated")!!.toInt(), text("phase")!!, number("retry_at"), number("retry_elapsed"),
      number("retry_boot")?.toInt(), text("run_id"), text("error_code"))
  }
}
