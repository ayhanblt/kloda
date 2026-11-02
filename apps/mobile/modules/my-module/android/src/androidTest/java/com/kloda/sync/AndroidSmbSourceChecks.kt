package com.kloda.sync

import android.app.Instrumentation
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.provider.DocumentsContract
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

// Only a freshly allocated DocumentsProvider tree/Keystore alias/preferences namespace.
internal object AndroidSmbSourceChecks {
  fun run(instrumentation: Instrumentation, scratch: File) {
    val base = instrumentation.targetContext
    check(base.packageName == "com.kloda.sync.test")
    val token = UUID.randomUUID().toString().replace("-", "")
    val root = File(base.cacheDir, "kloda-owned-saf-$token")
    check(!root.exists() && root.mkdirs())
    val folder = File(root, "source").also { check(it.mkdir()) }
    val targetFolder = File(root, "target").also { check(it.mkdir()) }
    val originalBytes = ByteArray(65537) { (it % 251).toByte() }
    File(folder, "payload.bin").writeBytes(originalBytes)
    val tree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY, "$token:source")
    val targetTree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY, "$token:target")
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.smb.sources." + token
      override fun getNoBackupFilesDir() = File(scratch, "smb-sources-$token").apply { check(mkdirs() || isDirectory) }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".smb-sources." + token, mode)
    }
    val alias = app.packageName + ".smb.profile.v1"
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    check(!store.containsAlias(alias))
    var granted = false
    var targetGranted = false
    var activity: AndroidLifecycleActivity? = null
    val database = SQLiteDatabase.openOrCreateDatabase(File(app.noBackupFilesDir, "smb.sqlite"), null)
    try {
      check(database.enableWriteAheadLogging()); database.execSQL("PRAGMA synchronous=FULL")
      val journal = AndroidSmbJournal(database)
      val profiles = AndroidSmbProfiles(app, journal)
      val source = UUID.randomUUID().toString()
      val prefs = app.getSharedPreferences("kloda-sync", 0)
      val rows = JSONArray().put(JSONObject().put("id", source).put("reference", tree.toString())).toString()
      check(FilesRunContext.stamp(prefs.edit().putString("directorySources", rows)).commit())
      app.grantUriPermission(base.packageName, tree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      app.contentResolver.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); granted = true
      val reference = AndroidSafSourceScanner(app.contentResolver).scan(tree.toString()).single().reference
      val target = SmbTarget("10.0.2.2", 27445, "owned", "android-smb-sources-$token", "owned", "", "ignored", "ignored")
      profiles.save(target, "owned-disposable-fixture")
      AndroidSmbLan(app).use { lan ->
        // Callback metadata arrives asynchronously; prove readiness without opening a connection.
        Thread.sleep(250)
        AndroidSmbFiles(app, journal, profiles, lan).run { false }
        // A second unchanged scan verifies the old remote receipt; it must not create another upload row.
        AndroidSmbFiles(app, journal, profiles, lan).run { false }
      }
      database.rawQuery("SELECT step,completed FROM smb_upload", null).use {
        check(it.moveToFirst() && it.getInt(0) == 5 && it.getInt(1) == 1 && !it.moveToNext())
      }
      val page = journal.catalog(profiles.capture()!!.profile.target)
      check(page.jobs.size == 1 && page.next == null)
      val completed = page.jobs.single()
      val changedBytes = originalBytes.map { (it.toInt() xor 1).toByte() }.toByteArray()
      File(folder, "payload.bin").writeBytes(changedBytes)
      check(File(folder, "payload.bin").setLastModified(System.currentTimeMillis() + 2000))
      AndroidSmbLan(app).use { lan -> Thread.sleep(250); AndroidSmbFiles(app, journal, profiles, lan).run { false } }
      val versions = journal.catalog(profiles.capture()!!.profile.target).jobs
      check(versions.size == 2 && versions.map { it.relativePath }.toSet().size == 2)
      check(journal.ownReceipt(completed.id, completed.target) == completed)
      check(journal.catalog(completed.target.copy(root = "other")).jobs.isEmpty())
      check(runCatching { journal.ownReceipt(completed.id, completed.target.copy(root = "other")) }.isFailure)
      val visible = instrumentation.startActivitySync(Intent(base, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(50) }
      AndroidSmbLan(app).use { lan ->
        Thread.sleep(250)
        val files = AndroidSmbFiles(app, journal, profiles, lan)
        val request = UUID.randomUUID()
        val owner = { !visible.resumed || !visible.focused }
        val copy = files.keepBoth(completed.id, request, owner)
        check(copy.id != completed.id && copy.relativePath.contains(" (Kloda ") && copy.sha256 != completed.sha256)
        check(files.keepBoth(completed.id, request, owner) == copy)
        check(journal.catalog(completed.target).jobs.size == 3)
        check(journal.ownReceipt(completed.id, completed.target) == completed)
        check(runCatching { files.keepBoth(completed.id, UUID.randomUUID()) { true } }.isFailure)
        check(journal.catalog(completed.target).jobs.size == 3)
      }
      val queue = AndroidSmbQueue(app, journal) { visible.resumed && visible.focused }
      queue.configure(target, "owned-disposable-fixture")
      Thread.sleep(250)
      val done = java.util.concurrent.CountDownLatch(1)
      var outcome: SmbRun? = null
      queue.start { result -> outcome = result; done.countDown() }
      check(done.await(30, java.util.concurrent.TimeUnit.SECONDS))
      check(outcome?.phase == "finished") { "Queue failed: $outcome" }
      check(queue.runs.counts(outcome!!.id)["files"] == "1" && queue.runs.counts(outcome!!.id)["completedOperations"] == "1")
      val heldReview = UUID.randomUUID()
      queue.beginReview(heldReview)
      check(runCatching { AndroidSmbReview(app,queue) { visible.resumed && visible.focused }.perform(completed.id,heldReview) }.isFailure)
      check(!queue.available()) // A rejected request cannot release somebody else's control lease.
      queue.endReview(heldReview)
      val pauseCallbacks = java.util.concurrent.atomic.AtomicInteger()
      var pauseResult: SmbRun? = null
      synchronized(AndroidSyncJournal.sourceLock) {
        // Hold the worker before its first admission; make the real run-state write fail.
        queue.start { result -> pauseResult = result; pauseCallbacks.incrementAndGet() }
        database.execSQL("CREATE TRIGGER owned_fail_smb_pause BEFORE UPDATE ON smb_run BEGIN SELECT RAISE(ABORT,'owned_failure'); END")
        check(runCatching { queue.pause() }.exceptionOrNull().let { it is FilesFailure && it.code == "storage_failure" })
        check(pauseCallbacks.get() == 1 && pauseResult?.phase == "needs_attention" && pauseResult?.error == "storage_failure")
        database.execSQL("DROP TRIGGER owned_fail_smb_pause")
      }
      check(queue.available())
      val beforeDisable = journal.context()
      database.execSQL("CREATE TRIGGER owned_fail_smb_disable BEFORE UPDATE ON smb_enabled BEGIN SELECT RAISE(ABORT,'owned_failure'); END")
      check(runCatching { queue.disable() }.isFailure)
      check(journal.context() == beforeDisable && queue.status()["enabled"] == true)
      database.execSQL("DROP TRIGGER owned_fail_smb_disable")
      queue.disable()
      check(queue.status()["enabled"] == false && runCatching { queue.start() }.isFailure)
      val disabledContext = journal.context()
      queue.enable()
      check(queue.status()["enabled"] == true && journal.context() != disabledContext)
      queue.disable()
      // A selected-source generation mutation cannot complete an older header.
      val captured = AndroidSmbSources.capture(app, journal)
      val profile = profiles.capture()!!
      val id = UUID.randomUUID().toString()
      val old = SmbUpload(id, UUID.randomUUID().toString(), profile.profile.target, captured.context, source,
        "owned-empty.bin", "1", "owned-empty.bin", "$id.snapshot", "A".repeat(43), 0, "file")
      journal.insert(old); for (event in 1..5) journal.record(old, event, 0)
      synchronized(AndroidSyncJournal.sourceLock) {
        check(FilesRunContext.stamp(prefs.edit().putString("directorySources", "[]")).commit())
        check(FilesRunContext.stamp(prefs.edit().putString("directorySources", rows)).commit())
      }
      check(runCatching { captured.check(app, journal) }.isFailure)
      check(runCatching { journal.complete(old) { captured.check(app, journal); true } }.isFailure)
      check(AndroidSmbSources.capture(app, journal).context != old.context && !journal.state(old).completed)
      app.contentResolver.releasePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      app.revokeUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); granted = false
      check(runCatching { AndroidFilesSnapshots(app, smb = true) {}.stage(tree.toString(), reference) }.isFailure)
      // New credentials authorize a fresh read of the same archive; old upload headers stay immutable.
      val rotated = profiles.save(target, "owned-disposable-fixture")
      check(rotated.target.profileGeneration != completed.target.profileGeneration)
      check(journal.ownReceipt(completed.id, rotated.target) == completed)
      AndroidSmbLan(app).use { lan ->
        Thread.sleep(250)
        val snapshots = AndroidFilesSnapshots(app, smb = true) {}
        var denied = false
        val download = AndroidSmbDownload(app, journal, profiles, lan, snapshots) { if (denied) throw SmbFailure("cancelled") }
        val staged = download.stage(completed.id)
        check(snapshots.verifiedFile(staged).readBytes().contentEquals(originalBytes))
        snapshots.discard(staged)
        denied = true
        check(runCatching { download.stage(completed.id) }.isFailure)
        denied = false
        check(runCatching { download.stage(UUID.randomUUID().toString()) }.isFailure)
      }
      app.grantUriPermission(base.packageName, targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      app.contentResolver.takePersistableUriPermission(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      targetGranted = true
      AndroidSmbLan(app).use { lan ->
        Thread.sleep(250)
        val fresh = profiles.capture()!!
        fun restore() = AndroidSmbFilesRestore(app, journal, profiles, fresh, lan, FilesRunContext.webdav(app).binding, UUID.randomUUID()) {
          if (!visible.resumed || !visible.focused) throw FilesFailure("candidate_stale")
        }.let { task -> task.choosing = false; try { task.restore(targetTree.toString(), completed.id) } finally { task.pause() } }
        check(restore()["state"] == "completed")
        check(targetFolder.listFiles()!!.single().readBytes().contentEquals(originalBytes))
        check(restore()["state"] == "completed" && targetFolder.listFiles()!!.size == 1)
        // Reopening the ledger owner must preserve the recorded creation URI.
        val history = AndroidSmbRestoreJournal(database)
        val prior = history.latest(fresh.profile.target.archiveId(), completed.id)!!
        check(prior.phase == "completed" && prior.document != null)
        check(runCatching { history.save(prior.copy(document = prior.document + "-foreign")) }.isFailure)
        check(runCatching { database.execSQL("DELETE FROM smb_file_restore WHERE id=?", arrayOf(prior.id)) }.isFailure)
      }
      val beforeRecovery = journal.context()
      journal.recoverInterrupted()
      check(journal.context() != beforeRecovery && journal.state(old).issue == "restart_review_required")
      check(!journal.state(old).completed && journal.ownReceipt(completed.id, profiles.capture()!!.profile.target) == completed)
    } finally {
      if (targetGranted) {
        app.contentResolver.releasePersistableUriPermission(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        app.revokeUriPermission(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }
      instrumentation.runOnMainSync { activity?.finish() }
      database.close()
      if (granted) {
        app.contentResolver.releasePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        app.revokeUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      if (store.containsAlias(alias)) store.deleteEntry(alias)
      base.deleteSharedPreferences("kloda-sync.smb-sources." + token)
      check(root.name == "kloda-owned-saf-$token"); root.deleteRecursively()
    }
  }
}
