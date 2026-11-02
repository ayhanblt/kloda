package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobScheduler
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.os.Bundle
import android.provider.MediaStore
import java.io.File
import java.util.UUID

internal object AndroidWebDavOsChecks {
  fun run(instrumentation: Instrumentation, targets: Boolean = false) {
    val context = instrumentation.targetContext.applicationContext
    check(context.packageName == "com.kloda.sync.test") // Never run against a product application container.
    val preferences = context.getSharedPreferences("kloda-sync", 0)
    val vaultFile = File(context.noBackupFilesDir, "kloda-webdav-profile.v1")
    val davDatabase = File(context.noBackupFilesDir, "kloda-webdav.sqlite")
    val pcDatabase = context.getDatabasePath("kloda-sync.sqlite")
    val alias = context.packageName + ".webdav.profile.v1"
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    check(preferences.all.isEmpty() && !vaultFile.exists() && !davDatabase.exists() && !pcDatabase.exists() && !keys.containsAlias(alias)) {
      "A fresh owned test application container is required; existing data was not touched"
    }
    AndroidPhotosSources.requiredPermissions(android.os.Build.VERSION.SDK_INT).forEach {
      instrumentation.uiAutomation.grantRuntimePermission(context.packageName, it)
    }
    val folder = "KlodaOwnedOs-${UUID.randomUUID()}"
    val resolver = context.contentResolver
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, "owned-os.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
    }) ?: error("Fixture insert failed")
    try {
      val png = android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", android.util.Base64.DEFAULT)
      resolver.openOutputStream(uri, "wt")!!.use { it.write(png); it.write(ByteArray(1048576) { (it % 251).toByte() }) }
      check(resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val photos = AndroidPhotosSources(context)
      photos.selectAlbum(photos.albums().single { it["displayName"] == folder }.getValue("id"))
      check(preferences.edit().putString("backupMode", "live").commit())
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://10.0.2.2:26443/dav", "os-" + UUID.randomUUID(), "owned", "disposable-https-fixture")
      val queue = AndroidWebDavRuntime.queue(context)
      queue.configure(profile)
      AndroidWebDavScheduler.reconcile(context)
      check(context.getSystemService(JobScheduler::class.java).getPendingJob(AndroidWebDavScheduler.JOB) != null)
      instrumentation.sendStatus(0, Bundle().apply { putString("stream", "READY owned JobScheduler2704; only emulator-5584 test package may be forced\n") })
      val deadline = android.os.SystemClock.elapsedRealtime() + 30000
      var run: WebDavRun? = null
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
          run = journal.runs.read(target = profile.targetId(), automatic = true)
          if (run?.phase == "finished" && journal.schedule.read(profile.targetId())?.run == null && !AndroidWebDavRuntime.hasAutomatic(run!!.id)) break
          Thread.sleep(100)
        }
        check(run?.phase == "finished") { "OS fixture did not complete: ${run?.phase}:${run?.error}:${AndroidWebDavScheduler.error(context)}" }
        check(run!!.automatic && run!!.attempts == 1 && run!!.osAttempts == 1)
        val counts = journal.runs.counts(run!!.id)
        check(counts["photos"] == "1" && counts["completedPhotos"] == "1" && counts["operations"] == "2" && counts["completedOperations"] == "2")
        check(journal.schedule.read(profile.targetId())!!.due > System.currentTimeMillis())
        check(AndroidPairingRuntime.owner == null) // No PC session/identity or LAN grant was needed.
      }
      if (targets) AndroidWebDavTargetChecks.run(context, profile) { instrumentation.sendStatus(0, Bundle().apply { putString("stream", "$it\n") }) }
      AndroidBackupScheduler.pause(context); AndroidWebDavScheduler.reconcile(context)
      check(AndroidBackupScheduler.paused(context))
      check(context.getSystemService(JobScheduler::class.java).getPendingJob(AndroidWebDavScheduler.JOB) == null)
      check(context.getSystemService(JobScheduler::class.java).getPendingJob(AndroidWebDavScheduler.WATCH) == null)
    } finally {
      // These paths and this AES alias were absent on entry and created only by this fixture.
      runCatching { AndroidBackupScheduler.pause(context) }
      AndroidWebDavScheduler.cancel(context)
      runCatching { AndroidWebDavRuntime.queue(context).disable() }
      resolver.delete(uri, null, null)
      if (keys.containsAlias(alias)) keys.deleteEntry(alias)
      check(preferences.edit().clear().commit())
      SQLiteDatabase.deleteDatabase(davDatabase); SQLiteDatabase.deleteDatabase(pcDatabase)
      android.util.AtomicFile(vaultFile).delete()
    }
  }
}
