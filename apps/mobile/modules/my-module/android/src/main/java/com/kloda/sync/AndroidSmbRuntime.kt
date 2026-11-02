package com.kloda.sync

import android.content.Context

internal object AndroidSmbRuntime {
  private val lock = Any()
  @Volatile private var ui: Any? = null
  @Volatile private var visible = false
  private var sender: AndroidSmbQueue? = null
  private data class Lease(val token: Any, val run: String, val valid: () -> Boolean)
  @Volatile private var lease: Lease? = null
  fun queue(context: Context): AndroidSmbQueue = synchronized(lock) {
    if (!supported()) throw FilesFailure("integration_unavailable")
    sender ?: create(context.applicationContext) { run ->
      if (run.automatic) lease?.let { it.run == run.id && it.valid() } == true else visible
    }.also { sender = it }
  }
  fun supported(): Boolean = BuildConfig.KLODA_SMB_NATIVE && android.os.Build.VERSION.SDK_INT >= 33
  private fun create(context: Context, admission: (SmbRun) -> Boolean): AndroidSmbQueue {
    System.loadLibrary("kloda_storage_native")
    val directory = java.io.File(context.noBackupFilesDir, "kloda-smb")
    if (!directory.isDirectory && !directory.mkdirs()) throw FilesFailure("storage_failure")
    android.system.Os.chmod(directory.path, 448)
    val path = java.io.File(directory, "journal.sqlite")
    val database = android.database.sqlite.SQLiteDatabase.openOrCreateDatabase(path, null)
    try {
      if (!database.enableWriteAheadLogging()) throw FilesFailure("storage_failure")
      database.execSQL("PRAGMA synchronous=FULL"); database.execSQL("PRAGMA foreign_keys=ON")
      android.system.Os.chmod(path.path, 384)
      return AndroidSmbQueue(context, AndroidSmbJournal(database), admission)
    } catch (error: Exception) { database.close(); throw error }
  }
  fun interactive(token: Any) = ui === token && visible
  fun attach(token: Any, active: Boolean) = synchronized(lock) {
    visible = false
    runCatching { sender?.foregroundLost() }
    ui = token; visible = active
  }
  fun foreground(token: Any, active: Boolean) {
    val stop = synchronized(lock) { if (ui !== token) false else { visible = active; !active } }
    if (stop) runCatching { sender?.foregroundLost() }
  }
  fun detach(token: Any) {
    val stop = synchronized(lock) { if (ui !== token) false else { ui = null; visible = false; true } }
    if (stop) runCatching { sender?.foregroundLost() }
  }
  fun hasAutomatic(run: String) = lease?.let { it.run == run && it.valid() } == true
  fun beginAutomatic(token: Any, run: String, valid: () -> Boolean): Boolean = synchronized(lock) {
    if (lease != null) false else { lease = Lease(token, run, valid); true }
  }
  fun endAutomatic(token: Any, interrupt: Boolean = false) {
    val ended = synchronized(lock) { if (lease?.token !== token) null else lease.also { lease = null } }
    if (interrupt && ended != null) runCatching { sender?.pauseRun(ended.run, "os_interrupted") }
  }
  fun settingsChanged() { sender?.pause("settings_changed") }
  fun pause() { sender?.pause() }
}
