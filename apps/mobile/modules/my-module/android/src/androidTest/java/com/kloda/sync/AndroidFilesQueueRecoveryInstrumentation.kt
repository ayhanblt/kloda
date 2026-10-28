package com.kloda.sync

import android.app.Activity
import android.app.Instrumentation
import android.content.Context
import android.content.ContextWrapper
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.os.Bundle
import java.io.File

class AndroidFilesQueueRecoveryInstrumentation : Instrumentation() {
  private var restartPhase: String? = null
  private var restartToken: String? = null
  private var scope: String? = null
  override fun onCreate(arguments: Bundle?) {
    restartPhase = arguments?.getString("restartPhase")
    restartToken = arguments?.getString("restartToken")
    scope = arguments?.getString("scope")
    super.onCreate(arguments); start()
  }

  override fun onStart() {
    if (scope !in listOf("local-files", "media-fixture")) {
      finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", "Explicit scope required: local-files or media-fixture\n") })
      return
    }
    restartPhase?.let { phase ->
      try {
        check(phase in listOf("write", "read") && Regex("[0-9a-f]{32}").matches(restartToken.orEmpty()))
        val root = File(targetContext.cacheDir, "kloda-restart-$restartToken")
        if (phase == "write") check(!root.exists() && root.mkdirs()) else check(root.isDirectory)
        AndroidRestartChecks.run(IsolatedContext(targetContext, root), phase)
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "PASS restart-$phase\n") })
        if (phase == "read") root.deleteRecursively()
      } catch (error: Throwable) {
        finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", error.stackTraceToString()) })
      }
      return
    }
    val scratch = File(targetContext.cacheDir, "kloda-files-check-${AndroidFilesSnapshots.randomId()}")
    try {
      check(scratch.mkdirs())
      fun group(name: String, check: () -> Unit) {
        sendStatus(0, Bundle().apply { putString("stream", "START $name\n") })
        check()
        sendStatus(0, Bundle().apply { putString("stream", "PASS $name\n") })
      }
      group("native-library-load") { Class.forName("com.kloda.sync.KlodaPairingJni") }
      group("files-runs") { AndroidFilesRunChecks.run(IsolatedContext(targetContext, File(scratch, "runs").also { check(it.mkdirs()) })) }
      group("scheduled-journal") { AndroidScheduleChecks.run(IsolatedContext(targetContext, File(scratch, "schedule").also { check(it.mkdirs()) })) }
      group("files-recovery") { AndroidFilesQueueRecoveryChecks.run(IsolatedContext(targetContext, scratch)) }
      if (scope == "local-files") {
        group("foreground-service") { AndroidLifecycleChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Local Files/runtime checks passed; Photos/restore/transport NOT_RUN\n") })
        return
      }
      group("photos-sources") { AndroidPhotosSourceChecks.run(this, IsolatedContext(targetContext, scratch)) }
      group("own-restore") { AndroidOwnRestoreChecks.run(IsolatedContext(targetContext, scratch)) }
      group("photos-manifest") { AndroidPhotoManifestChecks.run(this, IsolatedContext(targetContext, scratch)) }
      group("photos-rebackup") { AndroidPhotoRebackupChecks.run(IsolatedContext(targetContext, File(scratch, "rebackup").also { check(it.mkdirs()) })) }
      group("photos-import") { AndroidPhotosImportChecks.run(this, IsolatedContext(targetContext, scratch)) }
      group("photos-catalog") { AndroidPhotosCatalogChecks.run(IsolatedContext(targetContext, scratch)) }
      group("foreground-service") { AndroidLifecycleChecks.run(this, IsolatedContext(targetContext, scratch)) }
      finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Android Files recovery, Photos manifest publication, import crash reconciliation and latest-asset catalog checks passed\n") })
    } catch (error: Throwable) {
      finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", error.stackTraceToString()) })
    } finally { scratch.deleteRecursively() }
  }

  private class IsolatedContext(context: Context, private val scratch: File) : ContextWrapper(context) {
    private fun directory(name: String): File = File(scratch, name).also { check(it.isDirectory || it.mkdirs()) }
    override fun getDatabasePath(name: String): File = if (File(name).isAbsolute) File(name) else File(directory("databases"), name)
    override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?): SQLiteDatabase =
      SQLiteDatabase.openOrCreateDatabase(getDatabasePath(name).path, factory)
    override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?, errorHandler: DatabaseErrorHandler?): SQLiteDatabase =
      SQLiteDatabase.openOrCreateDatabase(getDatabasePath(name).path, factory, errorHandler)
    override fun deleteDatabase(name: String): Boolean = SQLiteDatabase.deleteDatabase(getDatabasePath(name))
    override fun getFilesDir(): File = directory("files")
    override fun getNoBackupFilesDir(): File = directory("no-backup")
    override fun getCacheDir(): File = directory("cache")
    override fun getSharedPreferences(name: String, mode: Int) = super.getSharedPreferences("${scratch.name}-$name", mode)
  }
}
