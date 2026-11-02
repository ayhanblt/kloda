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

// Requires the separate exact owned SFTP Photos fixture approval; not part of sftp-files.
internal object AndroidSftpPhotosRestoreChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    check(context.packageName == "com.kloda.sync.test" && instrumentation.targetContext.packageName == context.packageName)
    check(Build.VERSION.SDK_INT >= 33 && Build.HARDWARE in setOf("ranchu", "goldfish"))
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = context.packageName + ".sftp.profile.v1"; check(!keys.containsAlias(alias))
    val permissions = AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT)
    val newlyGranted = permissions.filter { context.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
    newlyGranted.forEach { instrumentation.uiAutomation.grantRuntimePermission(context.packageName, it) }
    val token = UUID.randomUUID().toString()
    val folder = "KlodaOwnedSftpPhoto-$token"
    val resolver = context.contentResolver
    var source: Uri? = null
    val knownTargets = mutableMapOf<Uri, SftpPhotoImportIntent>()
    var activity: AndroidLifecycleActivity? = null
    val database = SQLiteDatabase.openOrCreateDatabase(File(context.noBackupFilesDir, "sftp-photos.sqlite"), null)
    val ledger = File(context.noBackupFilesDir, "sftp-media-ledger.json")
    fun record() { ledger.writeText(org.json.JSONObject().put("token", token).put("source", source?.toString())
      .put("targets", org.json.JSONArray(knownTargets.keys.map(Uri::toString))).toString()) }
    try {
      check(database.enableWriteAheadLogging()); database.execSQL("PRAGMA synchronous=FULL")
      source = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, "owned-source.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
        put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
      }) ?: error("Owned source insert failed")
      record()
      val png = android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", android.util.Base64.DEFAULT)
      resolver.openOutputStream(source, "wt")!!.use { it.write(png) }
      check(resolver.update(source, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val photos = AndroidPhotosSources(context)
      val selection = photos.selectAlbum(photos.albums().single { it["displayName"] == folder }.getValue("id"))!!
      check(photos.scan(selection.getValue("reference")).map { it.reference }.toList() == listOf(source.toString()))
      val visible = instrumentation.startActivitySync(Intent(instrumentation.targetContext, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(50) }
      val journal = AndroidSftpJournal(database)
      val profiles = AndroidSftpProfiles(context, journal)
      profiles.save(SftpTarget("10.0.2.2", 27448, instrumentation.context.assets.open("kloda-sftp16/fingerprint.txt").bufferedReader().use { it.readText().trim() }, "/home/owned-sftp", "owned-sftp", "ignored", "ignored"), "owned-disposable-fixture")
      AndroidSftpLan(context).use { lan ->
        Thread.sleep(250)
        val runner = AndroidSftpPhotos(context, journal, profiles, lan)
        runner.run { false }; runner.run { false }
        var rows = journal.catalog(profiles.capture()!!.profile.target).jobs
        check(rows.size == 2 && rows.count { it.kind == "photo_resource" } == 1)
        check(resolver.update(source, ContentValues().apply { put(MediaStore.MediaColumns.IS_FAVORITE, 1) }, null, null) == 1)
        runner.run { false }
        rows = journal.catalog(profiles.capture()!!.profile.target).jobs
        check(rows.size == 3 && rows.count { it.kind == "photo_resource" } == 1)
        val latest = rows.filter { it.kind == "photo_manifest" }.maxBy { it.revision.toLong() }
        val snapshots = AndroidFilesSnapshots(context, sftp = true) {}
        val reader = AndroidSftpDownload(context, journal, profiles, lan, snapshots) {}
        val manifest = reader.manifest(latest.id); reader.cancel()
        check(manifest.favorite == true && manifest.revision == 2L && manifest.resources.single().size == png.size.toLong())
        fun restore(binding: String = FilesRunContext.webdav(context).binding): Map<String, String> {
          val session = AndroidSftpPhotosRestore(context, journal, profiles, profiles.capture()!!, lan, binding, UUID.randomUUID()) {
            if (!visible.resumed || !visible.focused) throw FilesFailure("candidate_stale")
          }
          return try { session.restore(latest.id) } finally {
            val state = AndroidSftpPhotosJournal(database, latest.target.archiveId()) { it() }
            val current = state.get(AndroidSftpPhotosJournal.identity(latest.target.archiveId(), manifest.sourceDeviceId, manifest.assetId))
            if (current?.uri != null && current.owned) { knownTargets[Uri.parse(current.uri)] = current; record() }
            session.pause()
          }
        }
        check(restore()["state"] == "completed")
        val imported = knownTargets.values.single()
        check(imported.phase == "completed" && imported.uri != source.toString())
        val media = AndroidPhotosMedia(context) {}
        val target = media.receipt(imported)!!
        check(media.owned(imported, target) && target.favorite == true && !target.pending)
        media.verify(imported.resource, target)
        check(restore()["state"] == "completed" && knownTargets.size == 1 && media.markers(imported).size == 1)
        val binding = FilesRunContext.webdav(context).binding
        check(FilesRunContext.stamp(context.getSharedPreferences("kloda-sync", 0).edit()).commit())
        check(runCatching { restore(binding) }.exceptionOrNull().let { it is FilesFailure && it.code == "settings_changed" })
        check(media.markers(imported).size == 1)
        val state = AndroidSftpPhotosJournal(database, latest.target.archiveId()) { it() }
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
      source?.let { check(resolver.delete(it, null, null) == 1) }
      if (keys.containsAlias(alias)) keys.deleteEntry(alias)
      instrumentation.runOnMainSync { activity?.finish() }
      database.close()
      newlyGranted.forEach { instrumentation.uiAutomation.revokeRuntimePermission(context.packageName, it) }
    }
  }
}
