package com.kloda.sync

import android.content.Context

internal object AndroidS3Runtime {
  private val ui = java.util.concurrent.ConcurrentHashMap.newKeySet<Any>()
  private val leaseLock = Any()
  private var lease: String? = null
  @Volatile private var instance: AndroidS3Queue? = null
  private fun unlocked(app: Context) = app.getSystemService(android.app.KeyguardManager::class.java)?.isDeviceLocked == false
  fun queue(context: Context): AndroidS3Queue = synchronized(AndroidSyncJournal.sourceLock) {
    if (!BuildConfig.KLODA_S3_NATIVE) throw S3Failure("native_unavailable")
    instance ?: run {
      val app = context.applicationContext
      AndroidS3Queue(app, AndroidS3Profiles(app, AndroidS3Journal(app, "amazon-s3")),
        mayRunAutomatic = { unlocked(app) && !AndroidBackupScheduler.paused(app) && (ui.isNotEmpty() || synchronized(leaseLock) { lease != null }) },
        mayRun = { ui.isNotEmpty() && unlocked(app) }).also { instance = it }
    }
  }
  fun foreground(owner: Any, active: Boolean) { if (active) ui.add(owner) else { ui.remove(owner); instance?.pauseForeground() } }
  fun begin(token: String): Boolean = synchronized(leaseLock) { if (lease != null) false else { lease = token; true } }
  fun end(token: String) = synchronized(leaseLock) { if (lease == token) lease = null }
  fun stop() { instance?.cancelInMemory(); instance?.pause("os_interrupted") }
}
