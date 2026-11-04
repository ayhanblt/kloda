package com.kloda.sync

import android.content.Context
import android.os.Looper

internal class AndroidS3Files(private val app: Context, private val profiles: AndroidS3Profiles, private val copying: AndroidS3Copy? = null) {
  fun run(cancelled: () -> Boolean, completed: (AndroidS3Job) -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) throw S3Failure("worker_required")
    val journal = profiles.journal
    val sources = AndroidS3Sources.capture(app, journal)
    val captured = profiles.capture() ?: throw S3Failure("profile_missing")
    val check = {
      if (cancelled() || !profiles.current(captured)) throw S3Failure("context_changed")
      sources.check(app, journal)
    }
    val snapshots = AndroidFilesSnapshots(app, s3 = journal.provider, checkPaused = check)
    val scanner = AndroidSafSourceScanner(app.contentResolver)
    for ((source, tree) in sources.sources.sources.filterValues { !AndroidPhotosSources.isPhotos(it) }) {
      check()
      for (file in scanner.scan(tree)) {
        check(); if (copying != null && !copying.matches(source, file.reference)) continue
        val staged = snapshots.stage(tree, file.reference)
        val job = AndroidS3Job(staged.id, journal.installation(), captured.context, captured.profile.target, source, file.reference,
          file.revision, sources.sources.binding, staged.id + ".snapshot", "objects/${journal.installation()}/${staged.id}", staged.digest.sha256,
          staged.digest.size, file.relativePath.substringAfterLast('/'), file.relativePath)
        fun completedSource() {
          check(); snapshots.checkAccess(tree, file.reference)
          if (snapshots.currentDigest(tree, file.reference) != staged.digest) throw S3Failure("source_changed")
          check()
        }
        var retained = false
        try {
          val known = if (copying == null) journal.known(job) else null
          if (known != null) {
            snapshots.discard(AndroidS3Download(app, profiles, snapshots, check).stage(known.id))
            completedSource(); completed(known); continue
          }
          if (copying == null && journal.unresolved(job)) throw S3Failure("review_required")
          snapshots.open(staged.id, staged.digest.size).use { descriptor ->
            journal.insert(job); copying?.record(job); retained = true
            AndroidS3Publisher(app, profiles, check).publish(job, descriptor, { check(); snapshots.checkAccess(tree, file.reference); true }, ::completedSource)
          }
          check(); completed(job); snapshots.discard(staged)
        } finally { if (!retained) snapshots.discard(staged) }
      }
    }
  }
}
