package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor

// Reuse only native same-archive Completed proof, then verify its remote bytes again.
internal class AndroidSmbPublisher(private val app: Context, private val journal: AndroidSmbJournal,
  private val profiles: AndroidSmbProfiles, private val lan: AndroidSmbLan,
  val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  fun publish(job: SmbUpload, snapshot: ParcelFileDescriptor, reuseKnown: Boolean = true,
    completedSource: () -> Boolean, currentSource: () -> Boolean): SmbUpload {
    check()
    val captured = profiles.capture() ?: throw SmbFailure("profile_missing")
    if (job.installation != journal.installation() || job.context != captured.context || job.target != captured.profile.target) throw SmbFailure("context_changed")
    if (reuseKnown) {
      val known = journal.knownCompleted(job)
      if (known != null) {
        var staged: FilesSnapshot? = null
        try {
          val download = AndroidSmbDownload(app, journal, profiles, lan, snapshots) {
            check(); if (!currentSource()) throw SmbFailure("source_changed")
          }
          staged = download.stage(known.id)
          if (!completedSource()) throw SmbFailure("source_changed")
          check(); AndroidSmbReviewEntries(journal).verified(known); return known
        } catch (error: SmbFailure) { if (error.code == "native_7") AndroidSmbReviewEntries(journal).mismatch(known); throw SmbFailure(error.code, known.id) }
        finally { staged?.let(snapshots::discard) }
      }
      journal.unresolved(job)?.let { throw SmbFailure("review_required", it.id) }
    }
    try {
      lan.publish(profiles, job, snapshot, completedSource = { check(); completedSource() }) { check(); currentSource() }
      return job
    } catch (error: SmbFailure) { throw SmbFailure(error.code, job.id) }
  }
}
