package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor

// Reuse only native same-archive Completed proof, then verify its remote bytes again.
internal class AndroidFtpsPublisher(private val app: Context, private val journal: AndroidFtpsJournal,
  private val profiles: AndroidFtpsProfiles, private val lan: AndroidFtpsLan,
  val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  fun publish(job: FtpsUpload, snapshot: ParcelFileDescriptor, reuseKnown: Boolean = true,
    completedSource: () -> Boolean, currentSource: () -> Boolean): FtpsUpload {
    check()
    val captured = profiles.capture() ?: throw FtpsFailure("profile_missing")
    if (job.installation != journal.installation() || job.context != captured.context || job.target != captured.profile.target) throw FtpsFailure("context_changed")
    if (reuseKnown) {
      val known = journal.knownCompleted(job)
      if (known != null) {
        var staged: FilesSnapshot? = null
        try {
          val download = AndroidFtpsDownload(app, journal, profiles, lan, snapshots) {
            check(); if (!currentSource()) throw FtpsFailure("source_changed")
          }
          staged = download.stage(known.id)
          if (!completedSource()) throw FtpsFailure("source_changed")
          check(); AndroidFtpsReviewEntries(journal).verified(known); return known
        } catch (error: FtpsFailure) { if (error.code == "native_7") AndroidFtpsReviewEntries(journal).mismatch(known); throw FtpsFailure(error.code, known.id).also { it.initCause(error) } }
        finally { staged?.let(snapshots::discard) }
      }
      journal.unresolved(job)?.let { throw FtpsFailure("review_required", it.id) }
    }
    try {
      lan.publish(profiles, job, snapshot, completedSource = { check(); completedSource() }) { check(); currentSource() }
      return job
    } catch (error: FtpsFailure) { throw FtpsFailure(error.code, job.id).also { it.initCause(error) } }
  }
}
