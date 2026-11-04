package com.kloda.sync

internal class AndroidFtpsReviewEntries(private val journal: AndroidFtpsJournal) {
  init { journal.database.execSQL("CREATE TABLE IF NOT EXISTS ftps_review_required(job TEXT PRIMARY KEY,reason TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0 CHECK(resolved IN(0,1)))") }
  fun mismatch(job: FtpsUpload) {
    journal.ownReceipt(job.id, job.target)
    journal.database.execSQL("INSERT INTO ftps_review_required(job,reason,resolved) VALUES(?,'native_7',0) ON CONFLICT(job) DO UPDATE SET resolved=0", arrayOf(job.id))
  }
  fun verified(job: FtpsUpload) {
    journal.ownReceipt(job.id, job.target)
    journal.database.execSQL("UPDATE ftps_review_required SET resolved=1 WHERE job=?", arrayOf(job.id))
  }
}
