package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor

// Reuse only native same-archive Completed proof, then verify its remote bytes again.
internal class AndroidSftpPublisher(private val app: Context, private val journal: AndroidSftpJournal,
  private val profiles: AndroidSftpProfiles, private val lan: AndroidSftpLan,
  val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  fun publish(job: SftpUpload, snapshot: ParcelFileDescriptor, reuseKnown: Boolean = true,
    completedSource: () -> Boolean, currentSource: () -> Boolean): SftpUpload {
    check()
    val captured = profiles.capture() ?: throw SftpFailure("profile_missing")
    if (job.installation != journal.installation() || job.context != captured.context || job.target != captured.profile.target) throw SftpFailure("context_changed")
    if (reuseKnown) {
      val known = journal.knownCompleted(job)
      if (known != null) {
        var staged: FilesSnapshot? = null
        try {
          val download = AndroidSftpDownload(app, journal, profiles, lan, snapshots) {
            check(); if (!currentSource()) throw SftpFailure("source_changed")
          }
          staged = download.stage(known.id)
          if (!completedSource()) throw SftpFailure("source_changed")
          check(); AndroidSftpReviewEntries(journal).verified(known); return known
        } catch (error: SftpFailure) { if (error.code == "native_7") AndroidSftpReviewEntries(journal).mismatch(known); throw SftpFailure(error.code, known.id) }
        finally { staged?.let(snapshots::discard) }
      }
      journal.unresolved(job)?.let { throw SftpFailure("review_required", it.id) }
    }
    try {
      lan.publish(profiles, job, snapshot, completedSource = { check(); completedSource() }) { check(); currentSource() }
      return job
    } catch (error: SftpFailure) { throw SftpFailure(error.code, job.id) }
  }
}
