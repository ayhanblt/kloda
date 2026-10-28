package com.kloda.sync

import android.content.Context

/** One process owner, independent of Expo module/screen lifetime. */
internal object AndroidPairingRuntime {
  val lock = Any()
  private val uiLock = Any()
  data class OwnedPlatform(val id: Long, val platform: KlodaPairingPlatform)
  @Volatile var owner: OwnedPlatform? = null
    private set
  @Volatile var files: AndroidFilesQueue? = null
    private set
  private val jobLock = Any()
  @Volatile private var job: Any? = null
  fun hasScheduledLease() = job != null
  fun beginScheduled(token: Any): Boolean = synchronized(jobLock) {
    if (job != null) false else { job = token; true }
  }
  fun endScheduled(token: Any, interrupt: Boolean = false) = synchronized(jobLock) {
    if (job === token) { job = null; if (interrupt) files?.requestPause() }
  }
  private var ui: Any? = null
  private var active = false

  fun attach(token: Any, visible: Boolean) = synchronized(uiLock) {
    owner?.let { KlodaPairingJni.setForeground(it.id, false) }
    ui = token
    active = visible
    owner?.let { KlodaPairingJni.setForeground(it.id, visible) }
  }

  fun foreground(token: Any, visible: Boolean) = synchronized(uiLock) {
    if (ui === token) {
      active = visible
      owner?.let { KlodaPairingJni.setForeground(it.id, visible) }
    }
  }

  fun checkUi(token: Any) = synchronized(uiLock) {
    if (ui !== token || !active) throw FilesFailure("paused")
  }

  fun authorizeUi(token: Any) = synchronized(uiLock) {
    if (ui !== token || !active) throw FilesFailure("paused")
    owner?.let { KlodaPairingJni.setForeground(it.id, true) }
  }

  fun suspendPairing(token: Any) = synchronized(uiLock) {
    if (ui === token) owner?.let { KlodaPairingJni.setForeground(it.id, false) }
  }

  fun detach(token: Any) = synchronized(uiLock) {
    if (ui === token) {
      active = false
      ui = null
      owner?.let { KlodaPairingJni.setForeground(it.id, false) }
    }
  }

  fun currentOwner(context: Context): Long = synchronized(lock) {
    owner?.id ?: run {
      val platform = KlodaPairingPlatform(context.applicationContext)
      val id = try { KlodaPairingJni.open(platform) }
      catch (error: Throwable) { platform.nativeClose(""); throw error }
      synchronized(uiLock) {
        owner = OwnedPlatform(id, platform)
        KlodaPairingJni.setForeground(id, active)
      }
      id
    }
  }

  fun queue(context: Context): AndroidFilesQueue = synchronized(lock) {
    files ?: AndroidFilesQueue(context.applicationContext, onStopped = { thread ->
      Thread({
        thread.join()
        synchronized(lock) { if (files?.running() != true) AndroidFilesService.stop() }
      }, "kloda-files-release").start()
    }) { AndroidFilesService.running() || hasScheduledLease() }.also { files = it }
  }
}
