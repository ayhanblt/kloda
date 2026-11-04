package com.kloda.sync

import android.app.Instrumentation
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.io.File
import java.util.UUID

// Requires the separate exact owned FTPS Photos fixture approval; not part of ftps-files.
internal object AndroidFtpsPhotosRestoreChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    check(context.packageName == "com.kloda.sync.test" && instrumentation.targetContext.packageName == context.packageName)
    check(Build.VERSION.SDK_INT >= 33 && Build.HARDWARE in setOf("ranchu", "goldfish"))
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = context.packageName + ".ftps.profile.v1"; check(!keys.containsAlias(alias))
    val permissions = AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT)
    val newlyGranted = permissions.filter { context.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
    newlyGranted.forEach { instrumentation.uiAutomation.grantRuntimePermission(context.packageName, it) }
    val token = UUID.randomUUID().toString()
    val folder = "KlodaOwnedFtpsPhoto-$token"
    val resolver = context.contentResolver
    var source: Uri? = null
    val knownTargets = mutableMapOf<Uri, FtpsPhotoImportIntent>()
    var activity: AndroidLifecycleActivity? = null
    val database = SQLiteDatabase.openOrCreateDatabase(File(context.noBackupFilesDir, "ftps-photos.sqlite"), null)
    val ledger = File(context.noBackupFilesDir, "ftps-media-ledger.json")
    fun record() { ledger.writeText(org.json.JSONObject().put("token", token).put("source", source?.toString())
      .put("targets", org.json.JSONArray(knownTargets.keys.map(Uri::toString))).toString()) }
    try {
      check(database.enableWriteAheadLogging()); database.execSQL("PRAGMA synchronous=FULL")
      source = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, "owned-source.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
        put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
      }) ?: error("Owned source insert failed")
      record()
      val png = instrumentation.context.assets.open("kloda-ftps16/owned-photo.png").use { it.readBytes() }; check(png.size == 68)
      resolver.openOutputStream(source, "wt")!!.use { it.write(png) }
      check(resolver.update(source, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val photos = AndroidPhotosSources(context)
      val selection = photos.selectAlbum(photos.albums().single { it["displayName"] == folder }.getValue("id"))!!
      check(photos.scan(selection.getValue("reference")).map { it.reference }.toList() == listOf(source.toString()))
      val visible = instrumentation.startActivitySync(Intent(instrumentation.targetContext, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(50) }
      val journal = AndroidFtpsJournal(database)
      val profiles = AndroidFtpsProfiles(context, journal)
      profiles.save(FtpsTarget("10.0.2.2", 27449, instrumentation.context.assets.open("kloda-ftps16/hostname.txt").bufferedReader().use { it.readText().trim() }, "/", "probe", "ignored", "ignored"), "unused")
      AndroidFtpsLan(context).use { lan ->
        Thread.sleep(250)
        val runner = AndroidFtpsPhotos(context, journal, profiles, lan)
        runner.run { false }; runner.run { false }
        var rows = journal.catalog(profiles.capture()!!.profile.target).jobs
        check(rows.size == 2 && rows.count { it.kind == "photo_resource" } == 1)
        // Only the approved PNG is mutated by seed/import; no favorite edit is needed.
        runner.run { false }
        rows = journal.catalog(profiles.capture()!!.profile.target).jobs
        check(rows.size == 2 && rows.count { it.kind == "photo_resource" } == 1)
        val latest = rows.filter { it.kind == "photo_manifest" }.maxBy { it.revision.toLong() }
        val snapshots = AndroidFilesSnapshots(context, ftps = true) {}
        val reader = AndroidFtpsDownload(context, journal, profiles, lan, snapshots) {}
        val manifest = reader.manifest(latest.id); reader.cancel()
        check(manifest.favorite != true && manifest.revision == 1L && manifest.resources.single().size == png.size.toLong())
        fun restore(binding: String = FilesRunContext.webdav(context).binding): Map<String, String> {
          val session = AndroidFtpsPhotosRestore(context, journal, profiles, profiles.capture()!!, lan, binding, UUID.randomUUID()) {
            if (!visible.resumed || !visible.focused) throw FilesFailure("candidate_stale")
          }
          return try { session.restore(latest.id) } finally {
            val state = AndroidFtpsPhotosJournal(database, latest.target.archiveId()) { it() }
            val current = state.get(AndroidFtpsPhotosJournal.identity(latest.target.archiveId(), manifest.sourceDeviceId, manifest.assetId))
            if (current?.uri != null && current.owned) { knownTargets[Uri.parse(current.uri)] = current; record() }
            session.pause()
          }
        }
        check(restore()["state"] == "completed")
        val imported = knownTargets.values.single()
        check(imported.phase == "completed" && imported.uri != source.toString())
        val media = AndroidPhotosMedia(context) {}
        val target = media.receipt(imported)!!
        check(media.owned(imported, target) && target.favorite != true && !target.pending)
        media.verify(imported.resource, target)
        check(restore()["state"] == "completed" && knownTargets.size == 1 && media.markers(imported).size == 1)
        val binding = FilesRunContext.webdav(context).binding
        check(FilesRunContext.stamp(context.getSharedPreferences("kloda-sync", 0).edit()).commit())
        check(runCatching { restore(binding) }.exceptionOrNull().let { it is FilesFailure && it.code == "settings_changed" })
        check(media.markers(imported).size == 1)
        val state = AndroidFtpsPhotosJournal(database, latest.target.archiveId()) { it() }
        val unknown = imported.copy(token = UUID.randomUUID().toString().replace("-", ""), phase = "prepared", uri = null)
        state.save(unknown); state.save(unknown.copy(phase = "creating"))
        check(runCatching { restore() }.exceptionOrNull().let { it is FilesFailure && it.code == "review_required" })
        check(media.markers(imported).size == 1)
      }
    } finally {
      record()
      val media = AndroidPhotosMedia(context) {}
      for ((uri, intent) in knownTargets) {
        val target = media.receipt(intent)
        check(target != null && media.owned(intent, target)) { "Owned cleanup receipt no longer matches; retained" }
        check(resolver.delete(uri, null, null) == 1)
      }
      source?.let {
        resolver.query(it, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.MIME_TYPE), null, null, null)!!.use { row ->
          check(row.moveToFirst() && row.getString(0) == "owned-source.png" && row.getString(1) == "Pictures/$folder/" && row.getString(2) == "image/png" && !row.moveToNext())
        }
        val bytes = resolver.openInputStream(it)!!.use { input -> input.readBytes() }
        check(java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { b -> "%02x".format(b) } == "7ac2abfce2be8b46dd9826d597d94edeefc1570b4a992622721b90a1850e3ee9")
        check(resolver.delete(it, null, null) == 1)
      }
      if (keys.containsAlias(alias)) keys.deleteEntry(alias)
      instrumentation.runOnMainSync { activity?.finish() }
      database.close()
      newlyGranted.forEach { instrumentation.uiAutomation.revokeRuntimePermission(context.packageName, it) }
    }
  }
}
