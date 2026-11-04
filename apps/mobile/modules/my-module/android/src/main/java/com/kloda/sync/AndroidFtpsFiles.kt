package com.kloda.sync

import android.content.Context
import android.os.Looper

internal class AndroidFtpsFiles(private val app: Context, private val journal: AndroidFtpsJournal,
  private val profiles: AndroidFtpsProfiles, private val lan: AndroidFtpsLan, private val track: (FtpsUpload) -> Unit = {}) {
  fun run(cancelled: () -> Boolean) { execute(null, null, cancelled) }
  fun keepBoth(original: String, request: java.util.UUID, cancelled: () -> Boolean): FtpsUpload =
    execute(original, request, cancelled) ?: throw FtpsFailure("source_unavailable")
  private fun execute(original: String?, request: java.util.UUID?, cancelled: () -> Boolean): FtpsUpload? {
    if (Looper.myLooper() == Looper.getMainLooper()) throw FtpsFailure("worker_required")
    val installation = journal.installation()
    val sources = AndroidFtpsSources.capture(app, journal)
    val captured = profiles.capture() ?: throw FtpsFailure("profile_missing")
    val check = {
      if (cancelled() || !profiles.current(captured)) throw FtpsFailure("context_changed")
      sources.check(app, journal)
    }
    val copies = AndroidFtpsCopyRequests(journal)
    val review = original?.let { journal.reviewJob(it, captured.profile.target) }
    if (review != null && review.kind != "file") throw FtpsFailure("manifest_invalid")
    val snapshots = AndroidFilesSnapshots(app, ftps = true, checkPaused = check)
    if (original != null && request != null) copies.result(request, original, captured.profile.target)?.let { prior ->
      check()
      val download = AndroidFtpsDownload(app, journal, profiles, lan, snapshots, check)
      snapshots.discard(download.stage(prior.id)); check(); return prior
    }
    val publisher = AndroidFtpsPublisher(app, journal, profiles, lan, snapshots, check)
    val scanner = AndroidSafSourceScanner(app.contentResolver)
    for ((source, tree) in sources.sources.sources.filterValues { !AndroidPhotosSources.isPhotos(it) }) {
      if (review != null && review.source != source) continue
      check()
      for (file in scanner.scan(tree)) {
        if (review != null && review.reference != file.reference) continue
        check()
        val staged = snapshots.stage(tree, file.reference)
        val base = "$source/files/${staged.digest.sha256}/${file.relativePath}"
        val path = if (review == null) base else AndroidFtpsCopyRequests.path(base, staged.digest.sha256, staged.id)
        val job = FtpsUpload(staged.id, installation, captured.profile.target, captured.context, source, file.reference,
          staged.digest.sha256, path, staged.id + ".snapshot", staged.digest.sha256,
          staged.digest.size, "file", null, file.relativePath.substringAfterLast('/'), file.relativePath)
        if (original != null && request != null) { check(); copies.reserve(request, original, job) }
        snapshots.open(staged.id, staged.digest.size).use { descriptor ->
          snapshots.validate(staged.digest, descriptor)
          // Full source hashing is bounded to preparation and final completion, not every wire chunk.
          val completed = publisher.publish(job, descriptor, reuseKnown = review == null, completedSource = {
            check(); snapshots.checkAccess(tree, file.reference)
            if (snapshots.currentDigest(tree, file.reference) != staged.digest) throw FtpsFailure("source_changed")
            check(); true
          }) { check(); snapshots.checkAccess(tree, file.reference); true }
          track(completed)
          if (completed.id != job.id || journal.state(job).completed) snapshots.discard(staged)
          if (review != null) return completed
        }
      }
    }
    return null
  }
}
