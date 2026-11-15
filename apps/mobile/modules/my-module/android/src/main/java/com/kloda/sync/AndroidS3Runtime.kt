package com.kloda.sync

import android.content.Context

internal object AndroidS3Runtime {
  private val ui = java.util.concurrent.ConcurrentHashMap.newKeySet<Any>()
  private val leaseLock = Any()
  // Exact automatic execution identity; never a shared token or a global stop.
  private var lease: Any? = null
  @Volatile private var instance: AndroidS3Queue? = null
  internal fun unlocked(app: Context) = app.getSystemService(android.app.KeyguardManager::class.java)?.isDeviceLocked == false
  fun queue(context: Context): AndroidS3Queue = synchronized(AndroidSyncJournal.sourceLock) {
    if (!BuildConfig.KLODA_S3_NATIVE) throw S3Failure("native_unavailable")
    instance ?: run {
      val app = context.applicationContext
      AndroidS3Queue(app, AndroidS3Profiles(app, AndroidS3Journal(app, "amazon-s3")),
        mayRunAutomatic = { owner -> unlocked(app) && !AndroidBackupScheduler.paused(app) && leased(owner) },
        mayRun = { ui.isNotEmpty() && unlocked(app) }).also { instance = it }
    }
  }
  fun foreground(owner: Any, active: Boolean) { if (active) ui.add(owner) else { ui.remove(owner); instance?.pauseForeground() } }
  fun begin(owner: Any): Boolean = synchronized(leaseLock) { if (lease != null) false else { lease = owner; true } }
  fun end(owner: Any) = synchronized(leaseLock) { if (lease === owner) lease = null }
  fun leased(owner: Any): Boolean = synchronized(leaseLock) { lease === owner }
}
