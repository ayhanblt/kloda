package com.kloda.sync

import android.app.Instrumentation
import android.content.ContentValues
import android.content.Context
import android.provider.MediaStore
import java.util.UUID

// Real source/snapshot + HTTPS/OS trust + SQLite, only against the owned loopback fixture server.
internal object AndroidWebDavHttpsChecks {
  private fun rejects(code: String, action: () -> Unit) {
    var observed: String? = null
    try { action() } catch (error: FilesFailure) { observed = error.code }
    check(observed == code) { "Expected $code; observed $observed" }
  }
  fun run(instrumentation: Instrumentation, isolated: Context) {
    val namespace = UUID.randomUUID().toString().replace("-", "")
    val context = object : android.content.ContextWrapper(isolated) {
      override fun getPackageName() = isolated.packageName + ".webdav.http." + namespace
    }
    val alias = context.packageName + ".webdav.profile.v1"
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    check(!keys.containsAlias(alias))
    check(android.os.Build.VERSION.SDK_INT >= 29)
    AndroidPhotosSources.requiredPermissions(android.os.Build.VERSION.SDK_INT).forEach {
      instrumentation.uiAutomation.grantRuntimePermission(instrumentation.targetContext.packageName, it)
    }
    val folder = "KlodaDavFixture-${AndroidFilesSnapshots.randomId()}"
    val resolver = context.contentResolver
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, "payload.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
    }) ?: error("Fixture insert failed")
    try {
      val png = android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", android.util.Base64.DEFAULT)
      val bytes = png + ByteArray(1048576) { (it % 251).toByte() }
      resolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
      check(resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val photos = AndroidPhotosSources(context)
      val album = photos.albums().single { it["displayName"] == folder }
      val selection = photos.selectAlbum(album.getValue("id"))!!
      val source = selection.getValue("id"); val tree = selection.getValue("reference")
      val scanned = photos.scan(tree).single { it.reference == uri.toString() }
      check(scanned.size == bytes.size.toLong())
      val snapshots = AndroidFilesSnapshots(context, webdav = true) {}
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://10.0.2.2:26443/dav",
        "owned-" + UUID.randomUUID().toString(), "owned", "disposable-https-fixture")
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        fun row(mode: String): WebDavUpload {
          val snapshot = snapshots.stage(tree, scanned.reference)
          val hash = AndroidFilesSnapshots.digest(java.io.ByteArrayInputStream(bytes))
          check(snapshot.digest == hash)
          return WebDavUpload(UUID.randomUUID().toString(), profile.targetId(), "owned-fixture-binding", source, scanned.reference,
            "$source/$mode/payload.bin", scanned.revision, snapshot.id, snapshot.digest.sha256, snapshot.digest.size).also { journal.insert(it) }
        }
        val transport = AndroidWebDavTransport(context, profile, snapshots) {}
        val publication = AndroidWebDavPublication(journal, transport::inspect, transport::upload, transport::move, {}, { journal.advance(it, "completed") })
        val normal = row("normal")
        check(publication.execute(normal.id)); check(journal.find(normal.id)!!.phase == "completed")
        check(transport.inspect(normal.relativePath, normal) == "match")
        val lostPut = row("lost-put")
        rejects("connection_unavailable") { publication.execute(lostPut.id) }
        check(journal.find(lostPut.id)!!.phase == "prepared")
        check(transport.inspect(AndroidWebDavPublication.temporary(lostPut), lostPut) == "match")
        rejects("review_required") { publication.execute(lostPut.id) }
        val lostMove = row("lost-move")
        rejects("connection_unavailable") { publication.execute(lostMove.id) }
        check(journal.find(lostMove.id)!!.phase == "moving")
        check(transport.inspect(lostMove.relativePath, lostMove) == "match")
        rejects("review_required") { publication.execute(lostMove.id) }
        val foreign = row("foreign-final")
        rejects("conflict") { publication.execute(foreign.id) }
        check(journal.find(foreign.id)!!.phase == "uploaded")
        val full = row("disk-full")
        rejects("disk_full") { publication.execute(full.id) }
        check(journal.find(full.id)!!.phase == "prepared")
        val excess = row("excess")
        rejects("review_required") { publication.execute(excess.id) }
        check(journal.find(excess.id)!!.phase == "uploaded")
        val redirect = normal.copy(relativePath = "$source/redirect/payload.bin")
        rejects("webdav_response") { transport.inspect(redirect.relativePath, redirect) }
        val auth = AndroidWebDavTransport(context, profile.copy(password = "wrong-fixture-password"), snapshots) {}
        rejects("webdav_auth") { auth.inspect(normal.relativePath, normal) }
        val badHost = AndroidWebDavTransport(context, profile.copy(endpoint = "https://10.0.2.2:26444/dav"), snapshots) {}
        rejects("connection_unavailable") { badHost.inspect(normal.relativePath, normal) }
        val counts = java.io.ByteArrayOutputStream()
        val inspect = AndroidWebDavClient(context, profile.copy(targetPath = "__fixture")) {}
        AndroidWebDavClient.require(inspect.request("counts", "GET", receive = { data, size -> counts.write(data, 0, size) }), 200)
        val remote = org.json.JSONObject(counts.toString("UTF-8"))
        check(remote.getInt("cookies") == 0 && remote.getInt("redirectSink") == 0 && remote.getInt("wrongHostRequests") == 0)
        check(journal.uploads(profile.targetId()).count { it.phase == "completed" } == 1)
        AndroidWebDavVault(context).write(profile)
        journal.setEnabled("webdav", profile.targetId(), true, profile.revision)
        val captured = AndroidWebDavContext.capture(context, journal)
        val run = WebDavRun(UUID.randomUUID().toString(), profile.targetId(), captured.binding, false, System.currentTimeMillis())
        journal.runs.save(run)
        val publisher = AndroidWebDavPublisher(profile.targetId(), captured.binding, journal, snapshots,
          AndroidWebDavTransport(context, profile, snapshots) { captured.check(context, journal) }, { captured.check(context, journal) }, { captured.complete(context, journal, it) }, { journal.runs.track(run, it) })
        val runner = AndroidWebDavPhotosRunner(context, publisher)
        runner.run(captured.sources.sources)
        check(runner.errorCode == null)
        var completed = journal.uploads(profile.targetId()).filter { it.phase == "completed" }
        check(completed.count { it.relativePath.contains("/original/") } == 1)
        check(completed.count { it.relativePath.contains("/kloda-webdav-photo-v1-") } == 1)
        val manifestJob = completed.single { it.relativePath.contains("/kloda-webdav-photo-v1-") }
        val manifestBytes = java.io.ByteArrayOutputStream()
        AndroidWebDavClient.require(AndroidWebDavClient(context, profile) {}.request(manifestJob.relativePath, "GET", maximum = manifestJob.size,
          receive = { data, size -> manifestBytes.write(data, 0, size) }), 200)
        val manifest = WebDavPhotoManifestCodec.decode(manifestBytes.toByteArray())
        WebDavPhotoManifestCodec.requireReceipts(manifest, profile.targetId(), journal)
        check(manifest.revision == 1L && manifest.resources.single().size == bytes.size.toLong())
        val media = completed.single { it.kind == "photo_resource" }
        rejects("source_identity_unknown") {
          publisher.publish(source, media.reference, media.relativePath, media.revision, FilesDigest(media.sha256, media.size),
            "changed-source-identity", { error("Cannot adopt or reupload bytes from a different source") }, {})
        }
        check(resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_FAVORITE, 1) }, null, null) == 1)
        val again = AndroidWebDavPhotosRunner(context, publisher)
        again.run(captured.sources.sources)
        check(again.errorCode == null)
        completed = journal.uploads(profile.targetId()).filter { it.phase == "completed" }
        check(completed.count { it.relativePath.contains("/original/") } == 1) // Metadata-only revision cannot reupload media.
        check(completed.count { it.relativePath.contains("/kloda-webdav-photo-v1-") } == 2)
        val itemCounts = journal.runs.counts(run.id)
        check(itemCounts["photos"] == "1" && itemCounts["completedPhotos"] == "1")
        check(itemCounts["operations"] == "3" && itemCounts["completedOperations"] == "3")
        val afterAck = AndroidWebDavPublisher(profile.targetId(), captured.binding, journal, snapshots,
          AndroidWebDavTransport(context, profile, snapshots) { captured.check(context, journal) }, { captured.check(context, journal) }, { value ->
            check(FilesRunContext.stamp(context.getSharedPreferences("kloda-sync", 0).edit()).commit())
            captured.complete(context, journal, value)
          }, { journal.runs.track(run, it) })
        val reference = "$source/cancel-after-ack/payload.bin"
        val digest = snapshots.currentDigest(tree, scanned.reference)
        rejects("settings_changed") {
          afterAck.publish(source, reference, reference, scanned.revision, digest, "fixture-source", { snapshots.stage(tree, scanned.reference) }, {})
        }
        val fenced = journal.candidates(profile.targetId(), source, reference).single()
        check(fenced.phase == "moved")
        val current = AndroidWebDavContext.capture(context, journal)
        val fresh = AndroidWebDavPublisher(profile.targetId(), current.binding, journal, snapshots,
          AndroidWebDavTransport(context, profile, snapshots) { current.check(context, journal) }, { current.check(context, journal) }, { current.complete(context, journal, it) }, { journal.runs.track(run, it) })
        rejects("review_required") { fresh.publish(source, reference, reference, scanned.revision, digest, "fixture-source", { error("Cannot create a replacement intent") }, {}) }
        check(journal.find(fenced.id)!!.phase == "moved")
        val visible = java.util.concurrent.atomic.AtomicBoolean(false)
        val queue = AndroidWebDavQueue(context) { visible.get() }
        rejects("candidate_stale") { queue.start() }
        visible.set(true)
        val done = java.util.concurrent.CountDownLatch(1)
        var result: WebDavRun? = null
        queue.start(finished = { result = it; done.countDown() })
        check(done.await(30, java.util.concurrent.TimeUnit.SECONDS))
        check(result?.phase == "finished")
        @Suppress("UNCHECKED_CAST")
        val queueRun = queue.status()["run"] as Map<String, Any>
        @Suppress("UNCHECKED_CAST")
        val queueCounts = queueRun["counts"] as Map<String, String>
        check(queueCounts["photos"] == "1" && queueCounts["operations"] == "2")
        val pcBefore = FilesRunContext.capture(context).binding
        val davBefore = AndroidWebDavContext.capture(context, journal).binding
        queue.disable()
        rejects("destination_disabled") { queue.start() }
        queue.configure(profile)
        check(AndroidWebDavVault(context).read() == profile)
        check(AndroidWebDavContext.capture(context, journal).binding != davBefore)
        check(FilesRunContext.capture(context).binding == pcBefore)
        check(journal.find(fenced.id)!!.phase == "moved")
        queue.disable()
      }
    } finally {
      resolver.delete(uri, null, null)
      // Random fixture-only AES namespace; never delete a production/identity key.
      if (keys.containsAlias(alias)) keys.deleteEntry(alias)
    }
  }
}
