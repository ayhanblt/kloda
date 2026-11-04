package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.io.File
import java.util.UUID

internal object AndroidS3PhotosChecks {
  fun run(instrumentation: Instrumentation, scratch: File) {
    val base = instrumentation.targetContext
    check(base.packageName == "com.kloda.sync.test" && Build.VERSION.SDK_INT >= 33 && Build.HARDWARE in setOf("ranchu", "goldfish"))
    val nonce = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getNoBackupFilesDir() = File(scratch, "s3-photos").apply { mkdirs() }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".s3-photos." + nonce, mode)
    }
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"; check(!keys.containsAlias(alias))
    val permissions = AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT)
    val newlyGranted = permissions.filter { base.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
    newlyGranted.forEach { instrumentation.uiAutomation.grantRuntimePermission(base.packageName, it) }
    val folder = "KlodaOwnedS3Photos17-$nonce"; val resolver = app.contentResolver
    var source: Uri? = null; var activity: AndroidLifecycleActivity? = null
    val known = mutableMapOf<Uri, S3PhotoImportIntent>(); val journal = AndroidS3Journal(app, "s3-compatible")
    val ledger = File(app.noBackupFilesDir, "media-ledger.json")
    fun record() { ledger.writeText(org.json.JSONObject().put("nonce", nonce).put("source", source?.toString()).put("targets", org.json.JSONArray(known.keys.map(Uri::toString))).toString()) }
    try {
      source = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, "owned-source.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
        put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
      }) ?: error("Owned source insert failed")
      record()
      val png = instrumentation.context.assets.open("kloda-ftps16/owned-photo.png").use { it.readBytes() }; check(png.size == 68)
      resolver.openOutputStream(source, "wt")!!.use { it.write(png) }
      check(resolver.update(source, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0); put(MediaStore.MediaColumns.IS_FAVORITE, 1) }, null, null) == 1)
      val photos = AndroidPhotosSources(app)
      val selection = photos.selectAlbum(photos.albums().single { it["displayName"] == folder }.getValue("id"))!!
      check(photos.scan(selection.getValue("reference")).map { it.reference }.toList() == listOf(source.toString()))
      val visible = instrumentation.startActivitySync(Intent(base, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(25) }
      val profiles = AndroidS3Profiles(app, journal)
      profiles.save(S3Target("s3-compatible", "https://127.0.0.1:52376", "us-east-1", "owned-bucket", "android-photos-$nonce", true, S3Target.hash("kloda17fixture"), nonce, nonce), "kloda17fixture", "synthetic-only-kloda17-fixture", null) {}
      journal.setEnabled(true)
      val tracked = mutableListOf<AndroidS3Job>(); val runner = AndroidS3Photos(app, profiles) { tracked.add(it) }
      runner.run { false }; check(tracked.size == 2)
      val ids = tracked.map { it.id }.toSet(); runner.run { false }; check(tracked.size == 4 && tracked.map { it.id }.toSet() == ids)
      val latest = tracked.first { it.kind == "photo_manifest" }; val snapshots = AndroidFilesSnapshots(app, s3 = journal.provider) {}
      val reader = AndroidS3Download(app, profiles, snapshots) {}; val manifest = reader.manifest(latest.id); reader.cancel()
      check(manifest.favorite == true && manifest.revision == 1L && manifest.resources.single().size == png.size.toLong() && manifest.albums.size == 1)
      fun restore(owner: AndroidS3Profiles = profiles) {
        val session = AndroidS3PhotosRestore(app, owner.journal, owner, owner.capture()!!, FilesRunContext.webdav(app).binding, UUID.randomUUID()) {
          if (!visible.resumed || !visible.focused) throw FilesFailure("candidate_stale")
        }
        try { check(session.restore(latest.id)["state"] == "completed") }
        finally {
          val state = AndroidS3PhotosJournal(owner.journal.database, latest.target.archiveId()) { it() }
          val intent = state.get(AndroidS3PhotosJournal.identity(latest.target.archiveId(), manifest.sourceDeviceId, manifest.assetId))
          if (intent?.uri != null && intent.owned) { known[Uri.parse(intent.uri)] = intent; record() }; session.pause()
        }
      }
      restore(); val imported = known.values.single(); check(imported.phase == "completed" && imported.uri != source.toString())
      val media = AndroidPhotosMedia(app) {}; check(media.markers(imported).size == 1)
      restore(); check(known.size == 1 && media.markers(imported).size == 1)
      val reopened = AndroidS3Journal(app, "s3-compatible")
      try { restore(AndroidS3Profiles(app, reopened)); check(known.size == 1 && media.markers(imported).size == 1) } finally { reopened.database.close() }
      val current = media.receipt(imported)!!; check(current.favorite == true && media.owned(imported, current))
    } finally {
      record()
      val media = AndroidPhotosMedia(app) {}
      for ((uri, intent) in known) {
        val receipt = media.receipt(intent); check(receipt != null && media.owned(intent, receipt)); check(resolver.delete(uri, null, null) == 1)
      }
      source?.let { uri ->
        resolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.MIME_TYPE), null, null, null)!!.use { row ->
          check(row.moveToFirst() && row.getString(0) == "owned-source.png" && row.getString(1) == "Pictures/$folder/" && row.getString(2) == "image/png" && !row.moveToNext())
        }
        val bytes = resolver.openInputStream(uri)!!.use { it.readBytes() }; check(bytes.contentEquals(instrumentation.context.assets.open("kloda-ftps16/owned-photo.png").use { it.readBytes() }))
        check(resolver.delete(uri, null, null) == 1)
      }
      if (keys.containsAlias(alias)) keys.deleteEntry(alias); check(!keys.containsAlias(alias))
      instrumentation.runOnMainSync { activity?.finish() }; journal.database.close()
      newlyGranted.forEach { instrumentation.uiAutomation.revokeRuntimePermission(base.packageName, it) }
    }
  }
}
