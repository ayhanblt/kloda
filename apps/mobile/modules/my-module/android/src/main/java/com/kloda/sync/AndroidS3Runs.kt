package com.kloda.sync

import java.util.UUID

internal data class S3Run(val id: String, val target: String, val binding: String, val phase: String = "running", val error: String? = null)
internal class AndroidS3Runs(private val journal: AndroidS3Journal) {
  private val database = journal.database
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_run(id TEXT PRIMARY KEY,target TEXT NOT NULL,binding TEXT NOT NULL,phase TEXT NOT NULL CHECK(phase IN('running','finished','paused','needs_attention')),error TEXT)")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_s3_run BEFORE UPDATE ON s3_run
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.binding IS NOT OLD.binding OR OLD.phase!='running'
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_s3_run BEFORE DELETE ON s3_run BEGIN SELECT RAISE(ABORT,'retained'); END")
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_run_job(run TEXT NOT NULL REFERENCES s3_run(id),job TEXT NOT NULL REFERENCES s3_job(id),PRIMARY KEY(run,job))")
    for (operation in listOf("UPDATE", "DELETE")) database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_s3_run_job_${operation.lowercase()} BEFORE $operation ON s3_run_job BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun start(value: S3Run) {
    if (UUID.fromString(value.id).toString() != value.id || value.phase != "running" || value.error != null || value.binding != journal.context()) throw S3Failure("binding_changed")
    database.execSQL("INSERT INTO s3_run VALUES(?,?,?,'running',NULL)", arrayOf(value.id, value.target, value.binding))
  }
  fun finish(value: S3Run) {
    if (value.phase !in listOf("finished", "paused", "needs_attention") || value.error?.let { !Regex("[a-z][a-z0-9_]{0,127}").matches(it) } == true) throw S3Failure("invalid_request")
    database.execSQL("UPDATE s3_run SET phase=?,error=? WHERE id=? AND target=? AND binding=? AND phase='running'",
      arrayOf(value.phase, value.error, value.id, value.target, value.binding))
    if (read(value.target) != value) throw S3Failure("binding_changed")
  }
  fun read(target: String): S3Run? = database.rawQuery("SELECT id,target,binding,phase,error FROM s3_run WHERE target=? ORDER BY rowid DESC LIMIT 1", arrayOf(target)).use {
    if (!it.moveToFirst()) null else S3Run(it.getString(0), it.getString(1), it.getString(2), it.getString(3), if (it.isNull(4)) null else it.getString(4))
  }
  fun recover() = database.execSQL("UPDATE s3_run SET phase='paused',error='os_interrupted' WHERE phase='running'")
  fun track(run: S3Run, job: AndroidS3Job) {
    if (job.installation != journal.installation() || job.target.archiveId() != run.target || journal.state(job) != "completed" || journal.events(job, "complete-ack").size != 1) throw S3Failure("binding_changed")
    database.execSQL("INSERT OR IGNORE INTO s3_run_job SELECT ?,? WHERE EXISTS(SELECT 1 FROM s3_run WHERE id=? AND target=? AND binding=? AND phase='running')",
      arrayOf(run.id, job.id, run.id, run.target, run.binding))
    database.rawQuery("SELECT 1 FROM s3_run_job WHERE run=? AND job=?", arrayOf(run.id, job.id)).use { if (!it.moveToFirst()) throw S3Failure("binding_changed") }
  }
  fun counts(id: String): Map<String, String> = database.rawQuery("SELECT j.header FROM s3_run_job r JOIN s3_job j ON j.id=r.job WHERE r.run=? AND j.state='completed'", arrayOf(id)).use {
    var files = 0L; var bytes = 0L
    while (it.moveToNext()) {
      val job = AndroidS3Job.decode(it.getString(0))
      if (files == Long.MAX_VALUE || job.size > Long.MAX_VALUE - bytes) throw S3Failure("outcome_unknown")
      files++; bytes += job.size
    }
    mapOf("verifiedFiles" to files.toString(), "verifiedBytes" to bytes.toString())
  }
}
