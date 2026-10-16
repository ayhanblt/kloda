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
  override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }

  override fun onStart() {
    val scratch = File(targetContext.cacheDir, "kloda-files-check-${AndroidFilesSnapshots.randomId()}")
    try {
      check(scratch.mkdirs())
      AndroidFilesQueueRecoveryChecks.run(IsolatedContext(targetContext, scratch))
      AndroidPhotosSourceChecks.run(this, IsolatedContext(targetContext, scratch))
      AndroidOwnRestoreChecks.run(IsolatedContext(targetContext, scratch))
      AndroidPhotoManifestChecks.run(this, IsolatedContext(targetContext, scratch))
      AndroidPhotosImportChecks.run(this, IsolatedContext(targetContext, scratch))
      AndroidPhotosCatalogChecks.run(IsolatedContext(targetContext, scratch))
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
