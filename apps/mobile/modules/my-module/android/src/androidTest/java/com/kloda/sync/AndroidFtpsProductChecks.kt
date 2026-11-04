package com.kloda.sync

import android.app.Instrumentation
import android.content.ComponentName
import java.io.File
import org.json.JSONObject

internal object AndroidFtpsProductChecks {
  fun run(instrumentation: Instrumentation) {
    val app = instrumentation.targetContext
    check(app.packageName == "com.kloda.sync.test" && AndroidFtpsRuntime.supported())
    val directory = File(app.noBackupFilesDir,"kloda-ftps")
    val ledger = File(directory,"owned-product-fixture.json")
    if (directory.exists() && !ledger.exists()) {
      // Unconfigured boot reconciliation can create this empty test-app store before the fixture ledger.
      check(app.getSharedPreferences("kloda-sync", 0).all.isEmpty())
      check(AndroidFtpsVault(app).read() == null)
      check(!java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias(app.packageName + ".ftps.profile.v1"))
      check(directory.listFiles()!!.all { it.name in setOf("journal.sqlite", "journal.sqlite-wal", "journal.sqlite-shm") })
      val before = android.database.sqlite.SQLiteDatabase.openDatabase(File(directory,"journal.sqlite").path,null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
      val counts = JSONObject()
      try {
        before.rawQuery("PRAGMA quick_check",null).use { check(it.moveToFirst() && it.getString(0) == "ok") }
        val tables = before.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ftps_%'",null).use { cursor -> buildList { while(cursor.moveToNext()) add(cursor.getString(0)) } }
        check(tables.containsAll(listOf("ftps_installation", "ftps_context")))
        for (name in tables) {
          check(Regex("ftps_[a-z_]+").matches(name))
          val count = before.rawQuery("SELECT COUNT(*) FROM " + name,null).use { check(it.moveToFirst()); it.getLong(0) }
          check(if (name in setOf("ftps_installation","ftps_context","ftps_sources")) count in 0L..1L else count == 0L)
          counts.put(name,count)
        }
      } finally { before.close() }
      File(app.cacheDir,"probe-empty-runtime.json").writeText(counts.toString())
      ledger.writeText(JSONObject().put("owner","kloda-ftps16-product-fixture").put("emptyRuntimeVerified",true).toString())
    }
    if (directory.exists()) check(ledger.isFile && JSONObject(ledger.readText()).getString("owner") == "kloda-ftps16-product-fixture")
    // Reset only our proved pre-publication fixture failure; unknown FTPS writes are never discarded.
    val dbFile = File(directory,"journal.sqlite")
    if (ledger.isFile && dbFile.isFile) {
      val db = android.database.sqlite.SQLiteDatabase.openDatabase(dbFile.path,null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
      val profile = AndroidFtpsVault(app).read()
      if (profile != null) {
        check(profile.target.address == "10.0.2.2" && profile.target.username == "probe" && profile.target.root == "/" && profile.password == "unused")
        db.rawQuery("SELECT COUNT(*) FROM ftps_upload",null).use { check(it.moveToFirst() && it.getInt(0) == 0) }
        val failure = db.rawQuery("SELECT payload FROM ftps_run ORDER BY rowid DESC LIMIT 1",null).use { check(it.moveToFirst()); it.getString(0) }
        val run = FtpsRun.decode(failure); check(run.phase == "needs_attention" && run.error == "source_changed")
        File(app.cacheDir,"probe-os-prepublication-failure.json").writeText(failure)
        db.close()
        check(android.database.sqlite.SQLiteDatabase.deleteDatabase(dbFile))
        android.util.AtomicFile(File(app.noBackupFilesDir,"kloda-ftps-profile.v1")).delete()
        java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(app.packageName + ".ftps.profile.v1") }
      } else db.close()
    }
    val queue = AndroidFtpsRuntime.queue(app)
    check(!queue.journal.hasProfile() && queue.status()["configured"] == false)
    val context = queue.journal.context()
    check(AndroidFtpsRuntime.queue(app) === queue && queue.journal.context() == context)
    ledger.writeText(JSONObject().put("owner","kloda-ftps16-product-fixture").put("installation",queue.journal.installation()).toString())
    val service = app.packageManager.getServiceInfo(ComponentName(app,AndroidFtpsJob::class.java),0)
    check(service.exported && service.permission == "android.permission.BIND_JOB_SERVICE")
    check(AndroidFtpsScheduler.JOB == 2710 && AndroidFtpsScheduler.WATCH == 2711)
    // The packaged JNI library was loaded by the actual runtime factory; no asset loader.
    check(FtpsNativeEngine.readBound("{}",-1,-1,object : FtpsNativeReceipt { override fun onEvent(event: Int, bytes: Long) = 1; override fun connect(address: String, port: Int) = -1 }) != 0)
  }
}
