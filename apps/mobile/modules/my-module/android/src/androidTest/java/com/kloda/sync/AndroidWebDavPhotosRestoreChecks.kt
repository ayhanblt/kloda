package com.kloda.sync

import android.app.Instrumentation
import android.content.Context
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.util.UUID

// Exact user-approved test exception: only new owned source/import URIs in the disposable emulator test package.
internal object AndroidWebDavPhotosRestoreChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    check(instrumentation.targetContext.packageName == "com.kloda.sync.test" && context.packageName == "com.kloda.sync.test")
    check(Build.VERSION.SDK_INT >= 30 && Build.HARDWARE in setOf("ranchu", "goldfish"))
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = context.packageName + ".webdav.profile.v1"; check(!keys.containsAlias(alias))
    AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT).forEach { instrumentation.uiAutomation.grantRuntimePermission(instrumentation.targetContext.packageName, it) }
    val folder = "KlodaOwnedDavPhoto-" + UUID.randomUUID()
    val resolver = context.contentResolver
    val knownTargets = mutableMapOf<Uri, WebDavPhotoImportIntent>()
    var activity: AndroidLifecycleActivity? = null
    val source = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, "owned-source.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
    }) ?: error("Owned source insert failed")
    try {
      val png = android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", android.util.Base64.DEFAULT)
      val bytes = png + ByteArray(1048576) { (it % 251).toByte() }
      resolver.openOutputStream(source, "wt")!!.use { it.write(bytes) }
      check(resolver.update(source, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val sources = AndroidPhotosSources(context)
      sources.selectAlbum(sources.albums().single { it["displayName"] == folder }.getValue("id"))
      val visible = instrumentation.startActivitySync(Intent(instrumentation.targetContext, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(50) }
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://10.0.2.2:26443/dav", "owned-photos-" + UUID.randomUUID(), "owned", "disposable-https-fixture")
      AndroidWebDavVault(context).write(profile)
      lateinit var latest: WebDavUpload
      lateinit var manifest: WebDavPhotoManifest
      AndroidSyncJournal.webdav(context).use { database ->
        val journal = AndroidWebDavJournal(database.writableDatabase); journal.setEnabled("webdav", profile.targetId(), true, profile.revision)
        fun backup() {
          val captured = AndroidWebDavContext.capture(context, journal)
          val snapshots = AndroidFilesSnapshots(context, true) { captured.check(context, journal) }
          val publisher = AndroidWebDavPublisher(profile.targetId(), captured.binding, journal, snapshots,
            AndroidWebDavTransport(context, profile, snapshots) { captured.check(context, journal) }, { captured.check(context, journal) }, { captured.complete(context, journal, it) }, {})
          val runner = AndroidWebDavPhotosRunner(context, publisher); runner.run(captured.sources.sources)
          check(runner.errorCode == null) { "Owned backup failed: ${runner.errorCode}" }
        }
        backup()
        val first = journal.uploads(profile.targetId()); check(first.size == 2 && first.all { it.phase == "completed" })
        check(resolver.update(source, ContentValues().apply { put(MediaStore.MediaColumns.IS_FAVORITE, 1) }, null, null) == 1)
        backup()
        val rows = journal.uploads(profile.targetId())
        check(rows.size == 3 && rows.count { it.kind == "photo_resource" } == 1 && rows.all { it.phase == "completed" })
        latest = rows.filter { it.kind == "photo_manifest" }.maxBy { it.revision.toLong() }
        val snapshots = AndroidFilesSnapshots(context, true) {}
        val reader = AndroidWebDavDownload(context, profile, journal, snapshots) {}
        manifest = reader.manifest(latest.id); reader.cancel()
        check(manifest.favorite == true && manifest.revision > 1 && manifest.resources.single().size == bytes.size.toLong())
      }
      fun restore(binding: String = FilesRunContext.webdav(context).binding): Map<String, String> {
        val session = AndroidWebDavPhotosRestore(context, profile, binding, UUID.randomUUID()) {
          if (!visible.resumed || !visible.focused) throw FilesFailure("candidate_stale")
        }
        return try { session.restore(latest.id) } finally {
          AndroidSyncJournal.webdav(context).use { database ->
            val state = AndroidWebDavPhotosJournal(database.writableDatabase, profile.targetId()) { it() }
            val current = state.get(AndroidWebDavPhotosJournal.identity(profile.targetId(), manifest.sourceDeviceId, manifest.assetId))
            if (current?.uri != null && current.owned) knownTargets[Uri.parse(current.uri)] = current
          }
          session.pause()
        }
      }
      check(restore()["state"] == "completed")
      val imported = knownTargets.values.single(); check(imported.phase == "completed" && imported.uri != source.toString())
      val media = AndroidPhotosMedia(context) {}
      val target = media.receipt(imported)!!
      check(media.owned(imported, target) && target.favorite == true && !target.pending)
      media.verify(imported.resource, target)
      check(restore()["state"] == "completed" && knownTargets.size == 1 && media.markers(imported).size == 1)
      val oldBinding = FilesRunContext.webdav(context).binding
      check(FilesRunContext.stamp(context.getSharedPreferences("kloda-sync", 0).edit()).commit())
      var changed: String? = null
      try { restore(oldBinding) } catch (error: FilesFailure) { changed = error.code }
      check(changed == "settings_changed" && media.markers(imported).size == 1)
      // Seed an unknown creation with no recorded URI; full native SDK reconciliation must not create a blind copy.
      AndroidSyncJournal.webdav(context).use { database ->
        val state = AndroidWebDavPhotosJournal(database.writableDatabase, profile.targetId()) { it() }
        var unknown = imported.copy(token = UUID.randomUUID().toString().replace("-", ""), phase = "prepared", uri = null)
        state.save(unknown); unknown = unknown.copy(phase = "creating"); state.save(unknown)
      }
      var uncertain: String? = null
      try { restore() } catch (error: FilesFailure) { uncertain = error.code }
      check(uncertain == "review_required" && media.markers(imported).size == 1)
      AndroidSyncJournal.webdav(context).use { database ->
        val state = AndroidWebDavPhotosJournal(database.writableDatabase, profile.targetId()) { it() }
        state.save(imported.copy(token = UUID.randomUUID().toString().replace("-", ""), phase = "prepared", uri = null, library = "owned-other-library"))
      }
      var libraryChanged: String? = null
      try { restore() } catch (error: FilesFailure) { libraryChanged = error.code }
      check(libraryChanged == "review_required" && media.markers(imported).size == 1)
      AndroidSyncJournal.webdav(context).use { database ->
        val state = AndroidWebDavPhotosJournal(database.writableDatabase, profile.targetId()) { it() }
        check(state.get(imported.key)?.reason == "target_library_changed")
      }
    } finally {
      val media = AndroidPhotosMedia(context) {}
      for ((uri, intent) in knownTargets) {
        val target = media.receipt(intent)
        check(target != null && media.owned(intent, target)) { "Owned cleanup receipt no longer matches; retained" }
        check(resolver.delete(uri, null, null) == 1)
      }
      // Exactly the source URI returned by this test's insert; never a search/name/hash deletion.
      check(resolver.delete(source, null, null) == 1)
      if (keys.containsAlias(alias)) keys.deleteEntry(alias)
      instrumentation.runOnMainSync { activity?.finish() }
    }
  }
}
