package com.kloda.sync

import android.app.Instrumentation
import android.content.ComponentName
import java.io.File
import org.json.JSONObject

internal object AndroidSftpProductChecks {
  fun run(instrumentation: Instrumentation) {
    val app = instrumentation.targetContext
    check(app.packageName == "com.kloda.sync.test" && AndroidSftpRuntime.supported())
    val directory = File(app.noBackupFilesDir,"kloda-sftp")
    val ledger = File(directory,"owned-product-fixture.json")
    if (directory.exists() && !ledger.exists()) {
      // Unconfigured boot reconciliation can create this empty test-app store before the fixture ledger.
      check(app.getSharedPreferences("kloda-sync", 0).all.isEmpty())
      check(AndroidSftpVault(app).read() == null)
      check(!java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias(app.packageName + ".sftp.profile.v1"))
      check(directory.listFiles()!!.all { it.name in setOf("journal.sqlite", "journal.sqlite-wal", "journal.sqlite-shm") })
      val before = android.database.sqlite.SQLiteDatabase.openDatabase(File(directory,"journal.sqlite").path,null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
      val counts = JSONObject()
      try {
        before.rawQuery("PRAGMA quick_check",null).use { check(it.moveToFirst() && it.getString(0) == "ok") }
        val tables = before.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sftp_%'",null).use { cursor -> buildList { while(cursor.moveToNext()) add(cursor.getString(0)) } }
        check(tables.containsAll(listOf("sftp_installation", "sftp_context")))
        for (name in tables) {
          check(Regex("sftp_[a-z_]+").matches(name))
          val count = before.rawQuery("SELECT COUNT(*) FROM " + name,null).use { check(it.moveToFirst()); it.getLong(0) }
          check(if (name in setOf("sftp_installation","sftp_context","sftp_sources")) count in 0L..1L else count == 0L)
          counts.put(name,count)
        }
      } finally { before.close() }
      File(app.cacheDir,"owned-sftp-empty-runtime.json").writeText(counts.toString())
      ledger.writeText(JSONObject().put("owner","kloda-sftp16-product-fixture").put("emptyRuntimeVerified",true).toString())
    }
    if (directory.exists()) check(ledger.isFile && JSONObject(ledger.readText()).getString("owner") == "kloda-sftp16-product-fixture")
    // Reset only our proved pre-publication fixture failure; unknown SFTP writes are never discarded.
    val dbFile = File(directory,"journal.sqlite")
    if (ledger.isFile && dbFile.isFile) {
      val db = android.database.sqlite.SQLiteDatabase.openDatabase(dbFile.path,null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
      val profile = AndroidSftpVault(app).read()
      if (profile != null) {
        check(profile.target.address == "10.0.2.2" && profile.target.username == "owned-sftp" && profile.target.root == "/home/owned-sftp" && profile.password == "owned-disposable-fixture")
        db.rawQuery("SELECT COUNT(*) FROM sftp_upload",null).use { check(it.moveToFirst() && it.getInt(0) == 0) }
        val failure = db.rawQuery("SELECT payload FROM sftp_run ORDER BY rowid DESC LIMIT 1",null).use { check(it.moveToFirst()); it.getString(0) }
        val run = SftpRun.decode(failure); check(run.phase == "needs_attention" && run.error == "source_changed")
        File(app.cacheDir,"owned-sftp-os-prepublication-failure.json").writeText(failure)
        db.close()
        check(android.database.sqlite.SQLiteDatabase.deleteDatabase(dbFile))
        android.util.AtomicFile(File(app.noBackupFilesDir,"kloda-sftp-profile.v1")).delete()
        java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(app.packageName + ".sftp.profile.v1") }
      } else db.close()
    }
    val queue = AndroidSftpRuntime.queue(app)
    check(!queue.journal.hasProfile() && queue.status()["configured"] == false)
    val context = queue.journal.context()
    check(AndroidSftpRuntime.queue(app) === queue && queue.journal.context() == context)
    ledger.writeText(JSONObject().put("owner","kloda-sftp16-product-fixture").put("installation",queue.journal.installation()).toString())
    val service = app.packageManager.getServiceInfo(ComponentName(app,AndroidSftpJob::class.java),0)
    check(service.exported && service.permission == "android.permission.BIND_JOB_SERVICE")
    check(AndroidSftpScheduler.JOB == 2708 && AndroidSftpScheduler.WATCH == 2709)
    // The packaged JNI library was loaded by the actual runtime factory; no asset loader.
    check(SftpNativeEngine.readBound("{}",-1,-1,object : SftpNativeReceipt { override fun onEvent(event: Int, bytes: Long) = 1 }) != 0)
  }
}
