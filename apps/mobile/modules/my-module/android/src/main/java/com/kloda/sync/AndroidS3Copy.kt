package com.kloda.sync

// One foreground request authorizes new bytes under a new key; it never repairs/adopts the old job.
internal class AndroidS3Copy(private val profiles: AndroidS3Profiles, id: String, private val request: String, private val current: () -> Boolean) {
  private val journal = profiles.journal
  private val old: AndroidS3Job
  private var used = false
  init {
    val target = profiles.capture()?.profile?.target ?: throw S3Failure("profile_missing")
    old = AndroidS3Job.decode(journal.text("SELECT header FROM s3_job WHERE id=?", arrayOf(id)))
    if (old.id != id || old.installation != journal.installation() || old.target.archiveId() != target.archiveId() ||
      journal.state(old) != "review" || old.kind !in listOf(null, "file") || !current()) throw S3Failure("review_required")
    journal.database.execSQL("CREATE TABLE IF NOT EXISTS s3_copy_request(request TEXT PRIMARY KEY,original TEXT NOT NULL REFERENCES s3_job(id),replacement TEXT NOT NULL REFERENCES s3_job(id),target TEXT NOT NULL,context TEXT NOT NULL)")
    for (operation in listOf("UPDATE", "DELETE")) journal.database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_s3_copy_${operation.lowercase()} BEFORE $operation ON s3_copy_request BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun matches(source: String, reference: String) = source == old.source && reference == old.reference
  fun record(job: AndroidS3Job) {
    if (used || !current() || !matches(job.source, job.reference) || job.target.archiveId() != old.target.archiveId() ||
      job.sha256 != old.sha256 || job.size != old.size || job.revision != old.revision || job.kind !in listOf(null, "file") || job.key == old.key) throw S3Failure("source_changed")
    journal.database.execSQL("INSERT INTO s3_copy_request VALUES(?,?,?,?,?)", arrayOf(request, old.id, job.id, job.target.archiveId(), job.context)); used = true
  }
}
