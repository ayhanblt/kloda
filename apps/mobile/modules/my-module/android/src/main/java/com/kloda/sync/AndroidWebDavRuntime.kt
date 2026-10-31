package com.kloda.sync

import android.content.Context

internal object AndroidWebDavRuntime {
  private val lock = Any()
  @Volatile private var ui: Any? = null
  @Volatile private var visible = false
  private var sender: AndroidWebDavQueue? = null
  private data class Lease(val token: Any, val run: String, val valid: () -> Boolean)
  @Volatile private var lease: Lease? = null
  fun queue(context: Context): AndroidWebDavQueue = synchronized(lock) {
    sender ?: AndroidWebDavQueue(context.applicationContext) { run ->
      if (run.automatic) lease?.let { it.run == run.id && it.valid() } == true else visible
    }.also { sender = it }
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
