package com.kloda.sync

internal class AndroidSmbReviewEntries(private val journal: AndroidSmbJournal) {
  init { journal.database.execSQL("CREATE TABLE IF NOT EXISTS smb_review_required(job TEXT PRIMARY KEY,reason TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0 CHECK(resolved IN(0,1)))") }
  fun mismatch(job: SmbUpload) {
    journal.ownReceipt(job.id, job.target)
    journal.database.execSQL("INSERT INTO smb_review_required(job,reason,resolved) VALUES(?,'native_7',0) ON CONFLICT(job) DO UPDATE SET resolved=0", arrayOf(job.id))
  }
  fun verified(job: SmbUpload) {
    journal.ownReceipt(job.id, job.target)
    journal.database.execSQL("UPDATE smb_review_required SET resolved=1 WHERE job=?", arrayOf(job.id))
  }
}
