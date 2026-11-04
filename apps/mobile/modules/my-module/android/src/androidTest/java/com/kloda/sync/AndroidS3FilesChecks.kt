package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import android.content.Intent
import android.provider.DocumentsContract
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal object AndroidS3FilesChecks {
  fun run(instrumentation: Instrumentation, scratch: File) {
    val base = instrumentation.targetContext; check(base.packageName == "com.kloda.sync.test")
    val token = UUID.randomUUID().toString().replace("-", "")
    val root = File(base.cacheDir, "kloda-owned-saf-$token"); check(!root.exists() && root.mkdir())
    val folder = File(root, "source").apply { check(mkdir()) }
    val targetFolder = File(root, "target").apply { check(mkdir()) }
    val bytes = ByteArray(4097) { (it % 251).toByte() }; File(folder, "payload.bin").writeBytes(bytes)
    val tree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY, "$token:source")
    val targetTree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY, "$token:target")
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.sources." + token
      override fun getNoBackupFilesDir() = File(scratch, "s3-files-$token").apply { check(mkdirs() || isDirectory) }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".s3-sources." + token, mode)
    }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "s3-compatible")
    var granted = false; var targetGranted = false; var activity: AndroidLifecycleActivity? = null
    try {
      val rows = JSONArray().put(JSONObject().put("id", UUID.randomUUID().toString()).put("reference", tree.toString())).toString()
      check(FilesRunContext.stamp(app.getSharedPreferences("kloda-sync", 0).edit().putString("directorySources", rows)).commit())
      app.grantUriPermission(base.packageName, tree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      app.contentResolver.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); granted = true
      val owner = AndroidS3Profiles(app, journal); val generation = UUID.randomUUID().toString()
      val target = S3Target("s3-compatible", "https://localhost:52408", "us-east-1", "kloda17-native", "android-files-$token", true,
        S3Target.hash("kloda17fixture"), generation, generation)
      owner.save(target, "kloda17fixture", "synthetic-only-kloda17-fixture", null) {}; journal.setEnabled(true)
      val visible = instrumentation.startActivitySync(Intent(base, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(50) }
      val files = AndroidS3Files(app, owner)
      var first: AndroidS3Job? = null; var second: AndroidS3Job? = null
      val cancelled = { !visible.resumed || !visible.focused }
      files.run(cancelled) { first = it }; files.run(cancelled) { second = it }
      val completed = first!!; check(second == completed && journal.receipt(completed.id, owner.capture()!!.profile.target) == completed)
      check(journal.text("SELECT COUNT(*) FROM s3_job") == "1")
      check(runCatching { journal.receipt(completed.id, completed.target.copy(prefix = "other")) }.isFailure)
      check(AndroidS3Job.decode(completed.payload()) == completed)
      check(runCatching { AndroidS3Job.decode(JSONObject(completed.payload()).put("secret", "unexpected").toString()) }.isFailure)
      app.grantUriPermission(base.packageName, targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      app.contentResolver.takePersistableUriPermission(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION); targetGranted = true
      val captured = owner.capture()!!
      fun restore(): Map<String, String> {
        val task = AndroidS3FilesRestore(app, journal, owner, captured, FilesRunContext.webdav(app).binding, UUID.randomUUID()) {
          if (cancelled()) throw FilesFailure("candidate_stale")
        }
        task.choosing = false
        return try { task.restore(targetTree.toString(), completed.id) } finally { task.pause() }
      }
      check(restore()["state"] == "completed" && targetFolder.listFiles()!!.single().readBytes().contentEquals(bytes))
      val history = AndroidS3RestoreJournal(journal.database)
      val prior = history.latest(captured.profile.target.archiveId(), completed.id)!!
      check(restore()["state"] == "completed" && targetFolder.listFiles()!!.size == 1)
      check(history.latest(captured.profile.target.archiveId(), completed.id) == prior)
      check(runCatching { history.save(prior.copy(document = prior.document + "-foreign")) }.isFailure)
      check(runCatching { journal.database.execSQL("DELETE FROM s3_locator WHERE job=?", arrayOf(completed.id)) }.isFailure)
      check(runCatching { journal.database.execSQL("DELETE FROM s3_file_restore WHERE id=?", arrayOf(prior.id)) }.isFailure)
      println("Owned SAF S3 job=${completed.id}; one publication; repeated restore same recorded URI")
    } finally {
      if (targetGranted) { app.contentResolver.releasePersistableUriPermission(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION); app.revokeUriPermission(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
      if (granted) { app.contentResolver.releasePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); app.revokeUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
      instrumentation.runOnMainSync { activity?.finish() }; journal.database.close()
      if (store.containsAlias(alias)) store.deleteEntry(alias)
      check(!store.containsAlias(alias)); base.deleteSharedPreferences("kloda-sync.s3-sources." + token)
      check(root.name == "kloda-owned-saf-$token"); root.deleteRecursively()
    }
  }
}
