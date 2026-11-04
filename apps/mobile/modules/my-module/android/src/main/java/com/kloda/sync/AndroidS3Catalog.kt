package com.kloda.sync

import java.util.UUID

internal fun AndroidS3Journal.createCatalog() {
  database.execSQL("CREATE TABLE IF NOT EXISTS s3_locator(job TEXT PRIMARY KEY REFERENCES s3_job(id),archive TEXT NOT NULL,installation TEXT NOT NULL,source TEXT NOT NULL,reference TEXT NOT NULL,revision TEXT NOT NULL,sha256 TEXT NOT NULL)")
  database.execSQL("CREATE INDEX IF NOT EXISTS s3_source_locator ON s3_locator(archive,installation,source,reference,revision,sha256)")
  for (operation in listOf("UPDATE", "DELETE")) {
    database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_s3_locator_${operation.lowercase()} BEFORE $operation ON s3_locator BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
}
internal fun AndroidS3Journal.index(job: AndroidS3Job) {
  database.execSQL("INSERT INTO s3_locator VALUES(?,?,?,?,?,?,?)", arrayOf(job.id, job.target.archiveId(), job.installation, job.source, job.reference, job.revision, job.sha256))
}
internal fun AndroidS3Journal.receipt(id: String, target: S3Target): AndroidS3Job {
  if (!runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false)) throw S3Failure("invalid_request")
  val job = AndroidS3Job.decode(text("SELECT header FROM s3_job WHERE id=?", arrayOf(id)))
  if (job.id != id || job.installation != installation() || job.target.archiveId() != target.archiveId()) throw S3Failure("binding_changed")
  if (state(job) != "completed" || events(job, "complete-ack").size != 1) throw S3Failure("receipt_missing")
  return job
}
internal fun AndroidS3Journal.known(job: AndroidS3Job): AndroidS3Job? {
  val id = database.rawQuery("""SELECT l.job FROM s3_locator l JOIN s3_job j ON j.id=l.job
    WHERE l.archive=? AND l.installation=? AND l.source=? AND l.reference=? AND l.revision=? AND l.sha256=? AND j.state='completed'
    ORDER BY l.rowid DESC LIMIT 1""", arrayOf(job.target.archiveId(), job.installation, job.source, job.reference, job.revision, job.sha256)).use {
      if (it.moveToFirst()) it.getString(0) else null
    } ?: return null
  val known = receipt(id, job.target)
  if (known.source != job.source || known.reference != job.reference || known.revision != job.revision || known.sha256 != job.sha256 || known.size != job.size || known.kind != job.kind || known.asset != job.asset || known.name != job.name || known.mimeType != job.mimeType) throw S3Failure("binding_changed")
  return known
}
internal fun AndroidS3Journal.unresolved(job: AndroidS3Job): Boolean = database.rawQuery("""
  SELECT 1 FROM s3_locator l JOIN s3_job j ON j.id=l.job
  WHERE l.archive=? AND l.installation=? AND l.source=? AND l.reference=? AND j.state NOT IN('completed','aborted') LIMIT 1
  """, arrayOf(job.target.archiveId(), job.installation, job.source, job.reference)).use { it.moveToFirst() }
