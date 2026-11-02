package com.kloda.sync

import android.app.Instrumentation
import android.content.ComponentName
import java.io.File
import org.json.JSONObject

internal object AndroidSmbProductChecks {
  fun run(instrumentation: Instrumentation) {
    val app = instrumentation.targetContext
    check(app.packageName == "com.kloda.sync.test" && AndroidSmbRuntime.supported())
    val directory = File(app.noBackupFilesDir,"kloda-smb")
    val ledger = File(directory,"owned-product-fixture.json")
    if (directory.exists()) check(ledger.isFile && JSONObject(ledger.readText()).getString("owner") == "kloda-smb16-product-fixture")
    // Reset only our proved pre-publication fixture failure; unknown SMB writes are never discarded.
    val dbFile = File(directory,"journal.sqlite")
    if (ledger.isFile && dbFile.isFile) {
      val db = android.database.sqlite.SQLiteDatabase.openDatabase(dbFile.path,null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
      val profile = AndroidSmbVault(app).read()
      if (profile != null) {
        check(profile.target.address == "10.0.2.2" && profile.target.share == "owned" && profile.target.username == "owned" && profile.target.root.startsWith("android-smb-os-") && profile.password == "owned-disposable-fixture")
        db.rawQuery("SELECT COUNT(*) FROM smb_upload",null).use { check(it.moveToFirst() && it.getInt(0) == 0) }
        val failure = db.rawQuery("SELECT payload FROM smb_run ORDER BY rowid DESC LIMIT 1",null).use { check(it.moveToFirst()); it.getString(0) }
        val run = SmbRun.decode(failure); check(run.phase == "needs_attention" && run.error == "source_changed")
        File(app.cacheDir,"owned-smb-os-prepublication-failure.json").writeText(failure)
        db.close()
        check(android.database.sqlite.SQLiteDatabase.deleteDatabase(dbFile))
        android.util.AtomicFile(File(app.noBackupFilesDir,"kloda-smb-profile.v1")).delete()
        java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(app.packageName + ".smb.profile.v1") }
      } else db.close()
    }
    val queue = AndroidSmbRuntime.queue(app)
    check(!queue.journal.hasProfile() && queue.status()["configured"] == false)
    val context = queue.journal.context()
    check(AndroidSmbRuntime.queue(app) === queue && queue.journal.context() == context)
    ledger.writeText(JSONObject().put("owner","kloda-smb16-product-fixture").put("installation",queue.journal.installation()).toString())
    val service = app.packageManager.getServiceInfo(ComponentName(app,AndroidSmbJob::class.java),0)
    check(service.exported && service.permission == "android.permission.BIND_JOB_SERVICE")
    check(AndroidSmbScheduler.JOB == 2706 && AndroidSmbScheduler.WATCH == 2707)
    // The packaged JNI library was loaded by the actual runtime factory; no asset loader.
    check(SmbNativeEngine.readBound("{}",-1,-1,object : SmbNativeReceipt { override fun onEvent(event: Int, bytes: Long) = 1 }) != 0)
  }
}
