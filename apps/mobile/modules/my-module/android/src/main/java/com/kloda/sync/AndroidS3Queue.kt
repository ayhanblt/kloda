package com.kloda.sync

import android.content.Context
import java.util.UUID

// Manual Files work only; an interrupted multipart job never becomes an automatic retry.
internal class AndroidS3Queue(private val app: Context, val profiles: AndroidS3Profiles, private val mayRunAutomatic: () -> Boolean = { false }, private val mayRun: () -> Boolean) {
  val journal = profiles.journal
  val runs = AndroidS3Runs(journal)
  private class Execution(val capture: S3Capture, val sources: AndroidS3Sources, var run: S3Run, val finished: ((S3Run) -> Unit)?, val automatic: Boolean) {
    val token = UUID.randomUUID(); @Volatile var cancelled = false
  }
  private var active: Execution? = null
    set(value) { field = value; interruptible = value }
  @Volatile private var interruptible: Execution? = null
  @Volatile private var pauseFailed = false
  init {
    journal.transaction { journal.recoverInterrupted(); runs.recover() }
    synchronized(instances) { instances[this] = Unit }
  }
  private fun <T> locked(block: () -> T): T = synchronized(AndroidSyncJournal.sourceLock, block)
  fun available(): Boolean = locked { active == null }
  fun cancelInMemory() { interruptible?.cancelled = true }
  fun enable() {
    pause("settings_changed")
    locked { journal.setEnabled(true); pauseFailed = false }
  }
  fun disable() {
    pause("settings_changed")
    locked { journal.setAutomatic(false); journal.setEnabled(false); pauseFailed = false }
  }
  fun pause(code: String = "user_pause") {
    cancelInMemory()
    var failure: Exception? = null
    val ended = locked {
      val value = active ?: return@locked null
      active = null
      try {
        journal.transaction {
          journal.invalidate(); value.run = value.run.copy(phase = "paused", error = code); runs.finish(value.run)
        }
      } catch (error: Exception) {
        pauseFailed = true; failure = error; value.run = value.run.copy(phase = "needs_attention", error = "storage_failure")
      }
      value
    }
    ended?.finished?.invoke(ended.run)
    if (failure != null) throw S3Failure("storage_failure")
  }
  fun pauseForeground() {
    val prior = interruptible ?: return
    if (prior.automatic) return
    prior.cancelled = true
    locked { if (active?.token == prior.token) pause("os_interrupted") }
  }
  fun setAutomatic(value: Boolean) { pause("settings_changed"); locked { journal.setAutomatic(value) } }
  fun start(automatic: Boolean = false, finished: ((S3Run) -> Unit)? = null): Map<String, Any> {
    val value = locked {
      if (active != null) throw S3Failure("backup_busy")
      if (pauseFailed) throw S3Failure("storage_failure")
      if (!(if (automatic) mayRunAutomatic() && journal.automatic() else mayRun())) throw S3Failure("candidate_stale")
      val sources = AndroidS3Sources.capture(app, journal)
      if (sources.sources.sources.isEmpty()) throw S3Failure("source_unavailable")
      val capture = profiles.capture() ?: throw S3Failure("profile_missing")
      if (!journal.enabled()) throw S3Failure("target_pause")
      val run = S3Run(UUID.randomUUID().toString(), capture.profile.target.archiveId(), capture.context)
      journal.transaction { runs.start(run) }
      Execution(capture, sources, run, finished, automatic).also { active = it }
    }
    Thread({
      var error: String? = null
      try {
        check(value)
        AndroidS3Files(app, profiles).run({ runCatching { check(value) }.isFailure }) { job ->
          locked { check(value); runs.track(value.run, job) }
        }
        AndroidS3Photos(app, profiles) { job -> locked { check(value); runs.track(value.run, job) } }.run { runCatching { check(value) }.isFailure }
        check(value)
      } catch (failure: Exception) { error = code(failure) }
      finish(value, error)
    }, "kloda-${journal.provider}-files").start()
    return status()
  }
  private fun check(value: Execution) = locked {
    if (value.cancelled || active?.token != value.token) throw S3Failure("cancelled")
    if (!(if (value.automatic) mayRunAutomatic() && journal.automatic() else mayRun())) throw S3Failure("os_interrupted")
    if (!journal.enabled() || !profiles.current(value.capture)) throw S3Failure("settings_changed")
    value.sources.check(app, journal)
    if (value.cancelled || active?.token != value.token) throw S3Failure("cancelled")
  }
  private fun finish(value: Execution, error: String?) {
    var deliver = false
    locked {
      if (active?.token != value.token) return@locked
      var outcome = error
      if (outcome == null) try { check(value) } catch (failure: Exception) { outcome = code(failure) }
      val phase = if (value.cancelled || outcome in listOf("cancelled", "os_interrupted", "settings_changed", "context_changed", "user_pause", "target_pause")) "paused"
        else if (outcome == null) "finished" else "needs_attention"
      value.run = value.run.copy(phase = phase, error = outcome)
      try {
        runs.finish(value.run)
      } catch (_: Exception) {
        pauseFailed = true; value.run = value.run.copy(phase = "needs_attention", error = "storage_failure")
      }
      active = null; deliver = true
    }
    if (deliver) value.finished?.invoke(value.run)
  }
  fun status(): Map<String, Any> = locked {
    val capture = profiles.capture(); val enabled = capture != null && journal.enabled()
    buildMap {
      put("automaticEnabled", enabled && journal.automatic()); put("enabled", enabled); put("running", active != null)
      put("canRun", enabled && active == null && !pauseFailed && mayRun())
      if (capture != null) runs.read(capture.profile.target.archiveId())?.let { value ->
        put("run", buildMap<String, Any> {
          put("id", value.id); put("state", if (pauseFailed) "needs_attention" else if (active?.run?.id != value.id && value.phase == "running") "paused" else value.phase)
          put("counts", runs.counts(value.id)); if (pauseFailed) put("errorCode", "storage_failure") else value.error?.let { put("errorCode", it) }
        })
      }
    }
  }
  companion object {
    private val instances = java.util.WeakHashMap<AndroidS3Queue, Unit>()
    private fun snapshot(): List<AndroidS3Queue> = synchronized(instances) { instances.keys.toList() }
    fun cancelAllInMemory() { snapshot().forEach { it.cancelInMemory() } }
    fun pauseAll() {
      val queues = snapshot(); queues.forEach { it.cancelInMemory() }
      var failed = false
      queues.forEach { try { it.pause() } catch (_: Exception) { failed = true } }
      if (failed) throw S3Failure("storage_failure")
    }
    fun code(error: Exception): String = when (error) {
      is S3Failure -> error.code
      is FilesFailure -> error.code
      is SecurityException -> "source_permission_lost"
      else -> if (isLocalStorageFull(error)) "local_storage_full" else "storage_failure"
    }
  }
}
