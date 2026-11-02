package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobScheduler
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

// Only the owned disposable test package; no Photos writes, personal sources or PC authority.
internal object AndroidSftpOsChecks {
  fun run(instrumentation: Instrumentation) {
    val app = instrumentation.targetContext.applicationContext
    check(app.packageName == "com.kloda.sync.test" && android.os.Build.HARDWARE in setOf("ranchu","goldfish"))
    val prefs = app.getSharedPreferences("kloda-sync",0)
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val vault = File(app.noBackupFilesDir,"kloda-sftp-profile.v1")
    val snapshots = File(app.noBackupFilesDir,"kloda-sftp-snapshots")
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = app.packageName + ".sftp.profile.v1"
    check(prefs.all.isEmpty() && !vault.exists() && !snapshots.exists() && !keys.containsAlias(alias) && scheduler.allPendingJobs.isEmpty())
    val queue = AndroidSftpRuntime.queue(app)
    check(!queue.journal.hasProfile())
    val token = UUID.randomUUID().toString().replace("-","")
    val root = File(app.cacheDir,"kloda-owned-saf-$token")
    check(!root.exists() && root.mkdirs())
    val source = File(root,"source").also { check(it.mkdir()) }
    File(source,"payload.bin").writeBytes(ByteArray(65537) { (it % 251).toByte() })
    val tree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY,"$token:source")
    var granted = false; var completed = false
    try {
      app.grantUriPermission(app.packageName,tree,Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      app.contentResolver.takePersistableUriPermission(tree,Intent.FLAG_GRANT_READ_URI_PERMISSION); granted = true
      check(AndroidSafSourceScanner(app.contentResolver).scan(tree.toString()).single().relativePath == "payload.bin")
      val rows = JSONArray().put(JSONObject().put("id",UUID.randomUUID().toString()).put("reference",tree.toString()))
      check(FilesRunContext.stamp(prefs.edit().putString("directorySources",rows.toString()).putString("backupMode","live")).commit())
      queue.configure(SftpTarget("10.0.2.2",27448,instrumentation.context.assets.open("kloda-sftp16/fingerprint.txt").bufferedReader().use { it.readText().trim() },"/home/owned-sftp","owned-sftp","native","native"),"owned-disposable-fixture")
      AndroidSftpScheduler.reconcile(app)
      check(scheduler.getPendingJob(AndroidSftpScheduler.JOB) != null)
      // Force only our own scheduled job; admission still requires its exact native plan/token/lease.
      ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("cmd jobscheduler run -f com.kloda.sync.test 2708")).use { it.readBytes() }
      val deadline = android.os.SystemClock.elapsedRealtime()+30000
      var result: SftpRun? = null
      while (android.os.SystemClock.elapsedRealtime()<deadline) {
        result = queue.runs.read(automatic = true)
        if (result?.phase == "finished" && queue.schedule.read()?.run == null && !AndroidSftpRuntime.hasAutomatic(result!!.id) && scheduler.getPendingJob(AndroidSftpScheduler.JOB)?.extras?.getLong("dispatch") == queue.schedule.read()?.due) break
        Thread.sleep(100)
      }
      check(result?.phase == "finished") { "Owned SFTP OS run failed: $result/${AndroidSftpScheduler.error(app)}" }
      check(result!!.automatic && result!!.attempts == 1 && result!!.osAttempts == 1)
      val counts = queue.runs.counts(result!!.id)
      check(counts["files"] == "1" && counts["completedFiles"] == "1" && counts["operations"] == "1" && counts["completedOperations"] == "1")
      check(queue.schedule.read()!!.due > System.currentTimeMillis() && AndroidPairingRuntime.owner == null)
      queue.disable(); AndroidSftpScheduler.reconcile(app)
      check(scheduler.getPendingJob(AndroidSftpScheduler.JOB) == null && scheduler.getPendingJob(AndroidSftpScheduler.WATCH) == null)
      completed = true
    } finally {
      runCatching { queue.disable() }; AndroidSftpScheduler.cancel(app)
      if (granted) {
        app.contentResolver.releasePersistableUriPermission(tree,Intent.FLAG_GRANT_READ_URI_PERMISSION)
        app.revokeUriPermission(tree,Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      check(prefs.edit().clear().commit()) // Empty on entry; only this fixture populated these keys.
      check(root.name == "kloda-owned-saf-$token"); root.deleteRecursively()
      if (completed) {
        // Preserve unknown native evidence on failure; on success every path/key below is fixture-owned.
        if (keys.containsAlias(alias)) keys.deleteEntry(alias)
        android.util.AtomicFile(vault).delete()
        queue.journal.database.close()
        val directory = File(app.noBackupFilesDir,"kloda-sftp")
        check(SQLiteDatabase.deleteDatabase(File(directory,"journal.sqlite")))
        File(directory,"owned-product-fixture.json").delete()
        check(directory.listFiles()!!.isEmpty() && directory.delete())
        if (snapshots.exists()) check(snapshots.listFiles()!!.isEmpty() && snapshots.delete())
      }
    }
  }
}
