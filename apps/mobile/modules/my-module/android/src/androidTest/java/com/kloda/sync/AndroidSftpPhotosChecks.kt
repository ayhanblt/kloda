package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import java.io.File
import java.util.UUID

// Pure codecs and owned SQLite only. This check never writes the media library.
internal object AndroidSftpPhotosChecks {
  fun run(scratch: File) {
    val database = SQLiteDatabase.openOrCreateDatabase(File(scratch, "sftp-photos-${UUID.randomUUID()}.sqlite"), null)
    try {
      check(database.enableWriteAheadLogging()); database.execSQL("PRAGMA synchronous=FULL")
      val journal = AndroidSftpJournal(database)
      val state = AndroidSftpPhotosState(journal)
      val source = UUID.randomUUID().toString()
      val asset = state.identity("asset", "owned-fixture")
      check(asset == state.identity("asset", "owned-fixture") && asset != state.identity("album", "owned-fixture"))
      val target = SftpTarget("192.168.1.10", 22, "SHA256:" + "A".repeat(43), "/owned", "owned", UUID.randomUUID().toString(), UUID.randomUUID().toString())
      val resource = SftpPhotoResource("$source/media/owned.bin", "original", "Original ?.png", "image/png", "A".repeat(43), 0)
      val manifest = SftpPhotoManifest(journal.installation(), asset, 1, listOf(resource), emptyList(), false)
      val bytes = SftpPhotoManifestCodec.encode(manifest)
      check(SftpPhotoManifestCodec.decode(bytes) == manifest)
      check(runCatching { SftpPhotoManifestCodec.requireReceipts(manifest, target, journal) }.isFailure)
      val id = UUID.randomUUID().toString()
      val job = SftpUpload(id, journal.installation(), target, journal.context(), source, "$asset:original", resource.sha256,
        resource.relativePath, "$id.snapshot", resource.sha256, 0, "photo_resource", asset, resource.name, "$asset/original", resource.mimeType)
      journal.insert(job); for (event in 1..5) journal.record(job, event, 0)
      check(runCatching { SftpPhotoManifestCodec.requireReceipts(manifest, target, journal) }.isFailure)
      journal.complete(job) { true }
      SftpPhotoManifestCodec.requireReceipts(manifest, target, journal)
      check(runCatching { SftpPhotoManifestCodec.requireReceipts(manifest.copy(sourceDeviceId = "foreign"), target, journal) }.isFailure)
      check(runCatching { SftpPhotoManifestCodec.requireReceipts(manifest, target.copy(root = "other"), journal) }.isFailure)
      for (path in listOf("../escape", "$source/CON.txt", "$source/a?b", "$source/tail.", "$source/tail ", "$source/a:b", "$source/LPT1.txt")) {
        check(runCatching { SftpPhotoManifestCodec.encode(manifest.copy(resources = listOf(resource.copy(relativePath = path)))) }.isFailure)
      }
      val text = bytes.toString(Charsets.UTF_8)
      for (bad in listOf(text.replace("kloda-sftp-photo", "kloda-smb-photo"), text.replace("kloda-sftp-photo", "kloda-photo"), text.replace("\"version\":1", "\"version\":1,\"version\":1"),
        text.replace("\"size\":\"0\"", "\"size\":\"00\""), text.replace("\"version\":1", "\"version\":1,\"unknown\":true"))) {
        check(runCatching { SftpPhotoManifestCodec.decode(bad.toByteArray()) }.isFailure)
      }
      val pendingId = UUID.randomUUID().toString()
      val pending = SftpUpload(pendingId, journal.installation(), target, journal.context(), source, "uncertain-create",
        resource.sha256, "$source/uncertain.bin", "$pendingId.snapshot", resource.sha256, 0, "file")
      journal.insert(pending); journal.markIssue(pending, 4)
      check(journal.unresolved(pending) == pending)
      val copies = AndroidSftpCopyRequests(journal)
      val request = UUID.randomUUID(); val copyId = UUID.randomUUID().toString()
      val path = AndroidSftpCopyRequests.path(pending.relativePath, resource.sha256, copyId)
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
      check(runCatching { database.execSQL("DELETE FROM sftp_copy_request") }.isFailure)
      check(journal.state(pending).step == 0 && journal.state(pending).issue == "native_4")
      val runs = AndroidSftpRuns(journal)
      val run = SftpRun(UUID.randomUUID().toString(), target.archiveId(), journal.context(), false, 1000)
      runs.save(run); runs.track(run, copy)
      check(runs.counts(run.id)["completedOperations"] == "1" && runs.counts(run.id)["completedFiles"] == "1")
      val clock = SftpRun.Clock(1000, 1000, "owned-boot")
      for (code in listOf("native_3", "native_4", "native_5", "review_required")) check(run.failed(code, clock).phase == "needs_attention")
      val waiting = run.failed("lan_unavailable", clock)
      check(waiting.phase == "waiting" && waiting.attempts == 1 && waiting.osAttempts == 1 && waiting.retried(clock) == null)
      val retried = waiting.retried(SftpRun.Clock(waiting.retryAt!!, waiting.retryElapsed!!, clock.boot))!!
      check(retried.attempts == 2 && retried.osAttempts == 1 && retried.phase == "running")
      val os = run.failed("os_interrupted", clock)
      check(os.retried(SftpRun.Clock(os.retryAt!!, os.retryElapsed!!, clock.boot))!!.osAttempts == 2)
      runs.save(run.copy(phase = "finished")); check(runCatching { runs.save(run) }.isFailure)
      val schedule = AndroidSftpSchedule(database)
      val plan = SftpPlan(run.target, run.binding, 1000, 1000)
      schedule.save(plan); schedule.save(plan.copy(run = run.id), plan)
      check(runCatching { schedule.save(plan, plan) }.isFailure)
      val review = AndroidSftpReviewEntries(journal)
      review.mismatch(copy); check(journal.issues(target).jobs.any { it.id == copy.id })
      review.verified(copy); check(journal.issues(target).jobs.none { it.id == copy.id || it.id == pending.id })
      check(state.revision(asset, "first") == 1L && state.revision(asset, "first") == 1L)
      check(state.revision(asset, "metadata-only") == 2L && state.revision(asset, "first") == 3L)
      database.execSQL("UPDATE sftp_photo_revision SET revision=9223372036854775807 WHERE asset=?", arrayOf(asset))
      check(runCatching { state.revision(asset, "overflow") }.isFailure)
    } finally { database.close() }
  }
}
