package com.kloda.sync

import android.content.Context
import java.util.UUID

internal object AndroidWebDavChecks {
  private fun rejects(action: () -> Unit) {
    var failed = false
    try { action() } catch (_: Exception) { failed = true }
    check(failed) { "Unsafe WebDAV transition accepted" }
  }
  fun run(context: Context) {
    val cancelledReview = AndroidWebDavReview(context) { true }
    val cancelledRequest = java.util.UUID.randomUUID()
    cancelledReview.cancel(cancelledRequest)
    var cancelledCode: String? = null
    try { cancelledReview.perform(java.util.UUID.randomUUID().toString(), "recheck", cancelledRequest) } catch (error: FilesFailure) { cancelledCode = error.code }
    check(cancelledCode == "cancelled")
    val downloadSnapshots = AndroidFilesSnapshots(context, true) {}
    val ownBytes = ByteArray(1048576) { (it % 251).toByte() }
    val ownDigest = AndroidFilesSnapshots.digest(java.io.ByteArrayInputStream(ownBytes))
    val mediaIo = AndroidPhotosMedia(context) {}
    mediaIo.verify(PhotoResource(AndroidFilesSnapshots.randomId(), "original", "own.png", "image/png", ownDigest.sha256, ownDigest.size), java.io.ByteArrayInputStream(ownBytes))
    mediaIo.verify(WebDavPhotoResource("11111111-1111-4111-8111-111111111111/own.png", "original", "own.png", "image/png", ownDigest.sha256, ownDigest.size), java.io.ByteArrayInputStream(ownBytes))
    val stagedDownload = downloadSnapshots.stageDownload(ownDigest) { it.write(ownBytes) }
    downloadSnapshots.open(stagedDownload.id, ownDigest.size).use { downloadSnapshots.validate(ownDigest, it) }
    downloadSnapshots.discard(stagedDownload)
    rejects { downloadSnapshots.stageDownload(ownDigest) { it.write(byteArrayOf(1, 2, 3)) } }
    val custody = object : android.content.ContextWrapper(context) {
      override fun getPackageName() = super.getPackageName() + ".webdav.fixture." + namespace
      val namespace = UUID.randomUUID().toString().replace("-", "")
    }
    val alias = custody.packageName + ".webdav.profile.v1"
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    check(!store.containsAlias(alias))
    try {
      val vault = AndroidWebDavVault(custody)
      check(vault.read() == null)
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://fixture.invalid/dav", "Kloda", "owned", "disposable-vault-secret-001")
      vault.write(profile); check(vault.read() == profile)
      val updated = profile.copy(revision = UUID.randomUUID().toString(), password = "disposable-vault-secret-002")
      vault.write(updated); check(vault.read() == updated)
      val file = java.io.File(custody.noBackupFilesDir, "kloda-webdav-profile.v1")
      val encrypted = file.readBytes()
      check(!encrypted.toString(Charsets.ISO_8859_1).contains(updated.password))
      encrypted[encrypted.lastIndex] = (encrypted.last().toInt() xor 1).toByte()
      file.writeBytes(encrypted)
      rejects { vault.read() }; rejects { vault.write(profile) }
      // Only this test-created random namespace key is removed; no app/identity key is touched.
      store.deleteEntry(alias)
      rejects { vault.read() }; rejects { vault.write(profile) }
      check(!store.containsAlias(alias))
    } finally { if (store.containsAlias(alias)) store.deleteEntry(alias) }
    val original = FilesRunContext.webdav(context).binding
    FilesRunContext.invalidate(context)
    check(FilesRunContext.webdav(context).binding == original) // PC trust changes cannot invalidate DAV work.
    val preferences = context.getSharedPreferences("kloda-sync", 0)
    check(FilesRunContext.stamp(preferences.edit()).commit())
    val changed = FilesRunContext.webdav(context).binding
    check(changed != original)
    check(FilesRunContext.stamp(preferences.edit()).commit())
    check(FilesRunContext.webdav(context).binding != changed) // Even equal values keep the new generation.
    val davBinding = FilesRunContext.webdav(context).binding
    val pcBinding = FilesRunContext.capture(context).binding
    val pcId = "A".repeat(22)
    check(!AndroidBackupDestinations.pcEnabled(context, pcId))
    AndroidBackupDestinations.setPcEnabled(context, pcId, true)
    check(AndroidBackupDestinations.pcEnabled(context, pcId))
    check(FilesRunContext.capture(context).binding != pcBinding && FilesRunContext.webdav(context).binding == davBinding)
    AndroidBackupDestinations.setPcEnabled(context, pcId, false)
    check(!AndroidBackupDestinations.hasEnabledPc(context) && FilesRunContext.webdav(context).binding == davBinding)
    rejects { AndroidBackupDestinations.setPcEnabled(context, "invalid", false) }
    val target = AndroidWebDavProfile.encode(java.security.MessageDigest.getInstance("SHA-256").digest("fixture-target".toByteArray()))
    AndroidSyncJournal.webdav(context).use { owner ->
      val database = owner.writableDatabase
      val journal = AndroidWebDavJournal(database)
      val originalPlan = WebDavPlan(target, "owned-plan", 1000, 2000)
      journal.schedule.save(originalPlan)
      val updatedPlan = originalPlan.copy(due = 3000)
      journal.schedule.save(updatedPlan, originalPlan)
      rejects { journal.schedule.save(originalPlan, originalPlan) }
      check(journal.schedule.read(target) == updatedPlan)
      for ((code, delay) in listOf("connection_unavailable" to 60000L, "os_interrupted" to 300000L)) {
        var run = WebDavRun(UUID.randomUUID().toString(), target, "owned-retry", false, 1000)
        journal.runs.save(run)
        for (attempt in 1..5) {
          check((if (code == "connection_unavailable") run.attempts else run.osAttempts) == attempt)
          run = run.failed(code, WebDavRun.Clock(1000, 1000, "boot")); journal.runs.save(run)
          if (attempt < 5) {
            check(run.retried(WebDavRun.Clock(999999, 999 + delay, "boot")) == null)
            val rebooted = run.retried(WebDavRun.Clock(900000, 100, "new"))!!
            check(rebooted.phase == "waiting" && rebooted.retryElapsed == 100 + delay)
            run = run.retried(WebDavRun.Clock(1000 + delay, 1000 + delay, "boot"))!!; journal.runs.save(run)
          } else check(run.phase == "exhausted")
        }
        check(journal.runs.read(id = run.id) == run)
        rejects { journal.runs.save(run.copy(phase = "running")) }
      }

      check(!journal.enabled("pc", "real-pc"))
      journal.setEnabled("webdav", target, true, "current")
      check(journal.enabled("webdav", target, "current") && !journal.enabled("pc", "real-pc"))
      check(!journal.enabled("webdav", target, "other-revision"))
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://fixture.invalid/dav", "Kloda", "owned", "disposable")
      check(profile.url("safe # ü.png").toString().contains("%23"))
      rejects { profile.url("../outside") }; rejects { profile.url("..\\outside") }
      rejects { profile.copy(endpoint = "http://fixture.invalid").validate() }
      rejects { profile.copy(endpoint = "https://other:secret@fixture.invalid").validate() }
      val source = "11111111-1111-4111-8111-111111111111"
      fun row(binding: String) = WebDavUpload(UUID.randomUUID().toString(), target, binding, source, "$source/owned.bin",
        "$source/owned.bin", "sha", AndroidFilesSnapshots.randomId(), AndroidWebDavProfile.encode(java.security.MessageDigest.getInstance("SHA-256").digest("owned".toByteArray())), 5)
      val golden = context.assets.open("webdav-photo-v1.json").use { it.readBytes() }
      val manifest = WebDavPhotoManifestCodec.decode(golden)
      val encoded = WebDavPhotoManifestCodec.encode(manifest)
      check(WebDavPhotoManifestCodec.decode(encoded) == manifest)
      rejects { PhotoManifestCodec.decode(encoded) }
      rejects { WebDavPhotoManifestCodec.decode(byteArrayOf(-1)) }
      rejects { WebDavPhotoManifestCodec.decode(ByteArray(65537)) }
      val text = encoded.toString(Charsets.UTF_8)
      rejects { WebDavPhotoManifestCodec.decode(text.replace("\"format\":", "\"format\":\"duplicate\",\"format\":").toByteArray()) }
      rejects { WebDavPhotoManifestCodec.decode(text.replace("\"revision\":\"1\"", "\"revision\":\"01\"").toByteArray()) }
      rejects { WebDavPhotoManifestCodec.decode(golden.toString(Charsets.UTF_8).replace("$source/owned.bin", "../outside").toByteArray()) }
      rejects { WebDavPhotoManifestCodec.requireReceipts(manifest, target, journal) }
      val remote = mutableMapOf<String, String>()
      var lostPut = false; var lostMove = false; var cancelAfterAck = false; var moved = false
      val sender = AndroidWebDavPublication(journal, { path, _ -> remote[path] ?: "missing" }, { path, _ ->
        remote[path] = "match"
        if (lostPut) throw FilesFailure("connection_unavailable")
      }, { from, to ->
        remote.remove(from); remote[to] = "match"; moved = true
        if (lostMove) throw FilesFailure("connection_unavailable")
      }, { if (cancelAfterAck && moved) throw FilesFailure("settings_changed") }, { journal.advance(it, "completed") })
      val captured = AndroidWebDavContext(AndroidCloudTarget.Dav(profile), FilesRunContext("unselected-native-source", emptyMap()), "unselected-native-source")
      val nativeSnapshots = AndroidFilesSnapshots(context, true) {}
      val validation = AndroidWebDavSourceValidation(context, captured, journal, nativeSnapshots, AndroidWebDavTransport(context, profile, nativeSnapshots) {}, {})
      var rejectedSource = false
      try { validation.validate(row("unselected").copy(kind = "file")) } catch (error: FilesFailure) { rejectedSource = error.code == "source_changed" }
      check(rejectedSource)
      val first = row("normal").copy(kind = "photo_resource", sourceIdentity = "photos:${manifest.sourceDeviceId}:${manifest.assetId}:${manifest.resources.single().role}"); journal.insert(first); check(sender.execute(first.id))
      WebDavPhotoManifestCodec.requireReceipts(manifest, target, journal)
      rejects { WebDavPhotoManifestCodec.requireReceipts(manifest, "other-destination", journal) }
      val put = row("lost-put"); journal.insert(put); remote.clear(); lostPut = true
      rejects { sender.execute(put.id) }; lostPut = false; rejects { sender.execute(put.id) }
      val move = row("lost-move"); journal.insert(move); remote.clear(); lostMove = true
      rejects { sender.execute(move.id) }; lostMove = false
      val moving = journal.uploads(target).single { it.id == move.id }
      rejects { sender.execute(moving.id) }
      val changed = row("cancel-after-ack"); journal.insert(changed); remote.clear(); cancelAfterAck = true; moved = false
      rejects { sender.execute(changed.id) }; cancelAfterAck = false
      val conflict = row("foreign-final"); journal.insert(conflict); remote.clear(); remote[conflict.relativePath] = "match"
      rejects { sender.execute(conflict.id) }
      rejects { database.execSQL("UPDATE webdav_upload SET payload='{}' WHERE id=?", arrayOf(first.id)) }
      rejects { database.execSQL("DELETE FROM webdav_upload") }
      rejects { journal.advance(conflict, "completed") }
      journal.issue(journal.uploads(target).single { it.id == conflict.id }, "conflict", skipped = true)
      check(!sender.execute(conflict.id))
      val aliasTarget = AndroidWebDavProfile.encode(java.security.MessageDigest.getInstance("SHA-256").digest("owned-copy-target".toByteArray()))
      val copy = row("owned-copy").copy(target = aliasTarget, reference = "$source/copy.bin", relativePath = "$source/copy.bin", kind = "file", sourceIdentity = "owned-file-fixture")
      journal.insert(copy); remote.clear(); remote[copy.relativePath] = "match"
      rejects { sender.execute(copy.id) }
      rejects { journal.publications.choose(journal.find(copy.id)!!, "$source/unapproved.bin") }
      journal.issue(journal.find(copy.id)!!, "conflict")
      val request = java.util.UUID.randomUUID()
      rejects { journal.reviewAuthority.authorize(copy, request, "", journal) }
      journal.reviewAuthority.authorize(copy, request, "new-owned-context", journal)
      journal.reviewAuthority.require(copy, request, "new-owned-context")
      rejects { journal.reviewAuthority.require(copy, java.util.UUID.randomUUID(), "new-owned-context") }
      rejects { journal.reviewAuthority.require(copy, request, "other-context") }
      rejects { journal.reviewAuthority.authorize(copy, request, "new-owned-context", journal) }
      rejects { owner.writableDatabase.execSQL("UPDATE webdav_review_authorization SET current_binding='forged'") }
      rejects { owner.writableDatabase.execSQL("DELETE FROM webdav_review_authorization") }
      check(journal.find(copy.id)!!.binding == "owned-copy")
      val restores = AndroidWebDavRestoreJournal(owner.writableDatabase)
      var ownRestore = WebDavFileRestore(java.util.UUID.randomUUID().toString(), copy.target, copy.id, "own.bin", copy.sha256, copy.size, copy.snapshot,
        "content://com.kloda.sync.test.fixture/tree/owned")
      restores.save(ownRestore)
      rejects { restores.save(ownRestore.copy(phase = "completed", document = "content://com.kloda.sync.test.fixture/document/owned")) }
      for (phase in listOf("creating", "created", "writing", "completed")) {
        ownRestore = ownRestore.copy(phase = phase, document = if (phase == "creating") null else "content://com.kloda.sync.test.fixture/document/owned")
        restores.save(ownRestore)
      }
      check(restores.latest(copy.target, copy.id) == ownRestore)
      rejects { restores.save(ownRestore.copy(phase = "verified")) }
      rejects { restores.save(ownRestore.copy(target = target)) }
      rejects { owner.writableDatabase.execSQL("DELETE FROM webdav_file_restore") }
      val davManifest = WebDavPhotoManifest("A".repeat(22), "A".repeat(22), 1,
        listOf(WebDavPhotoResource("$source/own.png", "original", "own.png", "image/png", ownDigest.sha256, ownDigest.size)), emptyList(), false)
      var allowImportCommit = false
      val imports = AndroidWebDavPhotosJournal(owner.writableDatabase, target) { action -> if (!allowImportCommit) throw FilesFailure("cancelled"); action() }
      var imported = imports.prepare(davManifest, "owned-library")
      imported = imported.copy(phase = "creating"); imports.save(imported)
      imported = imported.copy(phase = "inserted", uri = "content://media/external_primary/images/media/1"); imports.save(imported)
      rejects { imports.save(imported.copy(phase = "completed")) }
      check(imports.get(imported.key)?.phase == "inserted")
      allowImportCommit = true; imported = imported.copy(phase = "completed"); imports.save(imported)
      check(imports.get(imported.key) == imported)
      rejects { imports.save(imported.copy(uri = "content://media/external_primary/images/media/2")) }
      rejects { imports.save(imported.copy(phase = "prepared", uri = null)) }
      rejects { imports.save(imported.copy(manifest = davManifest.copy(favorite = true))) }
      rejects { owner.writableDatabase.execSQL("DELETE FROM webdav_photo_import") }
      check(sender.review(copy.id, "keep_both") { check(it.binding == "owned-copy") })
      val alias = journal.publications.read(copy)
      check(Regex(""" \(Kloda [0-9]{8}-[0-9]{6} ${Regex.escape(copy.sha256.take(8))} [0-9a-f]{8}\)\.bin$""").containsMatchIn(alias))
      check(alias != copy.relativePath && remote[alias] == "match" && remote[copy.relativePath] == "match")
      remote[copy.relativePath] = "different"; check(sender.execute(copy.id))
      rejects { journal.publications.choose(journal.find(copy.id)!!, "$source/changed.bin") }
      AndroidWebDavPublication.withJob(copy.id) { rejects { sender.execute(copy.id) } }
      check(journal.photoReceipt(target, source, first.relativePath, "photos:wrong-device:wrong-asset:original", first.sha256, first.size) == null)

    }
    AndroidSyncJournal.webdav(context).use { owner ->
      val rows = AndroidWebDavJournal(owner.writableDatabase).uploads(target)
      check(rows.size == 5 && rows.count { it.phase == "completed" } == 1)
      check(rows.single { it.binding == "cancel-after-ack" }.phase == "moved")
      check(rows.single { it.binding == "lost-move" }.phase == "moving")
      check(rows.single { it.binding == "lost-put" }.phase == "prepared")
      check(rows.single { it.binding == "foreign-final" }.skipped)
    }
  }
}
