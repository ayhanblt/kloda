package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import java.io.File
import java.util.UUID

// Pure codecs and owned SQLite only. This check never writes the media library.
internal object AndroidSmbPhotosChecks {
  fun run(scratch: File) {
    val database = SQLiteDatabase.openOrCreateDatabase(File(scratch, "smb-photos-${UUID.randomUUID()}.sqlite"), null)
    try {
      check(database.enableWriteAheadLogging()); database.execSQL("PRAGMA synchronous=FULL")
      val journal = AndroidSmbJournal(database)
      val state = AndroidSmbPhotosState(journal)
      val source = UUID.randomUUID().toString()
      val asset = state.identity("asset", "owned-fixture")
      check(asset == state.identity("asset", "owned-fixture") && asset != state.identity("album", "owned-fixture"))
      val target = SmbTarget("192.168.1.10", 445, "owned", "", "owned", "", UUID.randomUUID().toString(), UUID.randomUUID().toString())
      val resource = SmbPhotoResource("$source/media/owned.bin", "original", "Original ?.png", "image/png", "A".repeat(43), 0)
      val manifest = SmbPhotoManifest(journal.installation(), asset, 1, listOf(resource), emptyList(), false)
      val bytes = SmbPhotoManifestCodec.encode(manifest)
      check(SmbPhotoManifestCodec.decode(bytes) == manifest)
      check(runCatching { SmbPhotoManifestCodec.requireReceipts(manifest, target, journal) }.isFailure)
      val id = UUID.randomUUID().toString()
      val job = SmbUpload(id, journal.installation(), target, journal.context(), source, "$asset:original", resource.sha256,
        resource.relativePath, "$id.snapshot", resource.sha256, 0, "photo_resource", asset, resource.name, "$asset/original", resource.mimeType)
      journal.insert(job); for (event in 1..5) journal.record(job, event, 0)
      check(runCatching { SmbPhotoManifestCodec.requireReceipts(manifest, target, journal) }.isFailure)
      journal.complete(job) { true }
      SmbPhotoManifestCodec.requireReceipts(manifest, target, journal)
      check(runCatching { SmbPhotoManifestCodec.requireReceipts(manifest.copy(sourceDeviceId = "foreign"), target, journal) }.isFailure)
      check(runCatching { SmbPhotoManifestCodec.requireReceipts(manifest, target.copy(root = "other"), journal) }.isFailure)
      for (path in listOf("../escape", "$source/CON.txt", "$source/a?b", "$source/tail.", "$source/tail ", "$source/a:b", "$source/LPT1.txt")) {
        check(runCatching { SmbPhotoManifestCodec.encode(manifest.copy(resources = listOf(resource.copy(relativePath = path)))) }.isFailure)
      }
      val text = bytes.toString(Charsets.UTF_8)
      for (bad in listOf(text.replace("\"version\":1", "\"version\":1,\"version\":1"),
        text.replace("\"size\":\"0\"", "\"size\":\"00\""), text.replace("\"version\":1", "\"version\":1,\"unknown\":true"))) {
        check(runCatching { SmbPhotoManifestCodec.decode(bad.toByteArray()) }.isFailure)
      }
      val pendingId = UUID.randomUUID().toString()
      val pending = SmbUpload(pendingId, journal.installation(), target, journal.context(), source, "uncertain-create",
        resource.sha256, "$source/uncertain.bin", "$pendingId.snapshot", resource.sha256, 0, "file")
      journal.insert(pending); journal.markIssue(pending, 4)
      check(journal.unresolved(pending) == pending)
      val copies = AndroidSmbCopyRequests(journal)
      val request = UUID.randomUUID(); val copyId = UUID.randomUUID().toString()
      val path = AndroidSmbCopyRequests.path(pending.relativePath, resource.sha256, copyId)
      check(path.contains(" (Kloda ") && path.endsWith(".bin"))
      val copy = pending.copy(id = copyId, relativePath = path, snapshot = "$copyId.snapshot")
      check(copies.result(request, pending.id, target) == null)
      copies.reserve(request, pending.id, copy)
      check(runCatching { copies.result(request, pending.id, target) }.isFailure)
      check(runCatching { copies.reserve(request, pending.id, copy) }.isFailure)
      journal.insert(copy); for (event in 1..5) journal.record(copy, event, 0)
      journal.complete(copy) { true }
      check(copies.result(request, pending.id, target) == copy)
      check(runCatching { copies.result(request, copy.id, target) }.isFailure)
      check(runCatching { database.execSQL("DELETE FROM smb_copy_request") }.isFailure)
      check(journal.state(pending).step == 0 && journal.state(pending).issue == "native_4")
      val runs = AndroidSmbRuns(journal)
      val run = SmbRun(UUID.randomUUID().toString(), target.archiveId(), journal.context(), false, 1000)
      runs.save(run); runs.track(run, copy)
      check(runs.counts(run.id)["completedOperations"] == "1" && runs.counts(run.id)["completedFiles"] == "1")
      val clock = SmbRun.Clock(1000, 1000, "owned-boot")
      for (code in listOf("native_3", "native_4", "native_5", "review_required")) check(run.failed(code, clock).phase == "needs_attention")
      val waiting = run.failed("lan_unavailable", clock)
      check(waiting.phase == "waiting" && waiting.attempts == 1 && waiting.osAttempts == 1 && waiting.retried(clock) == null)
      val retried = waiting.retried(SmbRun.Clock(waiting.retryAt!!, waiting.retryElapsed!!, clock.boot))!!
      check(retried.attempts == 2 && retried.osAttempts == 1 && retried.phase == "running")
      val os = run.failed("os_interrupted", clock)
      check(os.retried(SmbRun.Clock(os.retryAt!!, os.retryElapsed!!, clock.boot))!!.osAttempts == 2)
      runs.save(run.copy(phase = "finished")); check(runCatching { runs.save(run) }.isFailure)
      val schedule = AndroidSmbSchedule(database)
      val plan = SmbPlan(run.target, run.binding, 1000, 1000)
      schedule.save(plan); schedule.save(plan.copy(run = run.id), plan)
      check(runCatching { schedule.save(plan, plan) }.isFailure)
      val review = AndroidSmbReviewEntries(journal)
      review.mismatch(copy); check(journal.issues(target).jobs.any { it.id == copy.id })
      review.verified(copy); check(journal.issues(target).jobs.none { it.id == copy.id || it.id == pending.id })
      check(state.revision(asset, "first") == 1L && state.revision(asset, "first") == 1L)
      check(state.revision(asset, "metadata-only") == 2L && state.revision(asset, "first") == 3L)
      database.execSQL("UPDATE smb_photo_revision SET revision=9223372036854775807 WHERE asset=?", arrayOf(asset))
      check(runCatching { state.revision(asset, "overflow") }.isFailure)
    } finally { database.close() }
  }
}
