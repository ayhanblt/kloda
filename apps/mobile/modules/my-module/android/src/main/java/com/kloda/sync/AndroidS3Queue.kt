package com.kloda.sync

import android.content.Context
import java.util.UUID

// An interrupted multipart job never becomes an automatic retry. Automatic admission is the
// three-outcome startAutomatic; manual start never writes automatic plan/accept records.
internal class AndroidS3Queue(private val app: Context, val profiles: AndroidS3Profiles, private val mayRunAutomatic: (Any) -> Boolean = { false },
  private val executor: (String, Runnable) -> Unit = { name, body -> Thread(body, name).start() }, private val mayRun: () -> Boolean) {
  val journal = profiles.journal
  val runs = AndroidS3Runs(journal)
  private class Execution(val capture: S3Capture, val sources: AndroidS3Sources, var run: S3Run, val finished: ((S3Run) -> Unit)?, val owner: Any?) {
    val token = UUID.randomUUID(); @Volatile var cancelled = false
  }
  private var active: Execution? = null
    set(value) { field = value; interruptible = value }
  @Volatile private var interruptible: Execution? = null
  @Volatile private var pauseFailed = false
  // Unresolved automatic commit outcome: blocks manual and automatic starts; toggles never clear it.
  @Volatile private var uncertain: S3Attempt? = null
  // R10: the attached plan's unresolved migration proof is the same storage gate (manual included).
  @Volatile private var plan: AndroidS3AutomaticPlan? = null
  fun attach(value: AndroidS3AutomaticPlan) { if (value.journal !== journal) throw S3Failure("invalid_request"); plan = value }
  private fun blocked() = pauseFailed || uncertain != null || plan?.fenced == true
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
  fun pause(code: String = "user_pause") = pauseWhere(code) { true }
  private fun pauseWhere(code: String, match: (Execution) -> Boolean) {
    interruptible?.let { if (match(it)) it.cancelled = true }
    var failure: Exception? = null
    val ended = locked {
      val value = active?.takeIf(match) ?: return@locked null
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
    if (prior.owner != null) return
    pauseWhere("os_interrupted") { it === prior }
  }
  // Exact automatic pause: only this owner's execution (and run, once known); never manual or newer work.
  fun pauseAutomatic(owner: Any, runId: String?) = pauseWhere("os_interrupted") { it.owner === owner && (runId == null || it.run.id == runId) }
  fun setAutomatic(value: Boolean) { pause("settings_changed"); locked { journal.setAutomatic(value) } }
  fun start(finished: ((S3Run) -> Unit)? = null): Map<String, Any> {
    val value = locked {
      if (active != null) throw S3Failure("backup_busy")
      if (blocked()) throw S3Failure("storage_failure")
      if (!mayRun()) throw S3Failure("candidate_stale")
      val sources = AndroidS3Sources.capture(app, journal)
      if (sources.sources.sources.isEmpty()) throw S3Failure("source_unavailable")
      val capture = profiles.capture() ?: throw S3Failure("profile_missing")
      if (!journal.enabled()) throw S3Failure("target_pause")
      val run = S3Run(UUID.randomUUID().toString(), capture.profile.target.archiveId(), capture.context)
      journal.transaction { runs.start(run) }
      Execution(capture, sources, run, finished, null).also { active = it }
    }
    launch(value)
    return status()
  }
  // Fresh authority for the shared Amazon plan; capture runs bindSources before the context is read.
  fun authority(): S3AutoAuthority? = locked {
    val sources = AndroidS3Sources.capture(app, journal)
    val capture = profiles.capture()
    if (capture == null || sources.sources.sources.isEmpty() || !journal.enabled() || !journal.automatic()) null else S3AutoAuthority.of(sources, capture)
  }
  fun startAutomatic(expected: S3AutoPlan, plan: AndroidS3AutomaticPlan, owner: Any, nextDue: Long, finished: (S3Run) -> Unit): S3Admission {
    if (plan.journal !== journal) throw S3Failure("invalid_request")
    val prepared: Any = locked {
      if (active != null) return@locked S3Admission.NotAccepted("backup_busy")
      if (blocked()) return@locked S3Admission.NotAccepted("storage_failure")
      if (!mayRunAutomatic(owner) || !journal.automatic()) return@locked S3Admission.NotAccepted("candidate_stale")
      val sources: AndroidS3Sources; val capture: S3Capture
      try {
        sources = AndroidS3Sources.capture(app, journal)
        if (sources.sources.sources.isEmpty()) return@locked S3Admission.NotAccepted("source_unavailable")
        capture = profiles.capture() ?: return@locked S3Admission.NotAccepted("profile_missing")
        if (!journal.enabled()) return@locked S3Admission.NotAccepted("target_pause")
        if (!plan.matches(expected, S3AutoAuthority.of(sources, capture))) return@locked S3Admission.NotAccepted("plan_stale")
      } catch (error: Exception) { return@locked S3Admission.NotAccepted(code(error)) }
      val run = S3Run(UUID.randomUUID().toString(), expected.target, capture.context)
      try { plan.admit(expected, run, nextDue, runs) } catch (_: Exception) {
        // The commit/rollback acknowledgment is unknown: no worker, fence until resolved.
        return@locked S3Admission.OutcomeUnknown(S3Attempt(owner, expected, run.id, nextDue).also { uncertain = it })
      }
      Execution(capture, sources, run, finished, owner).also { active = it }
    }
    if (prepared is S3Admission) return prepared
    val value = prepared as Execution
    launch(value)
    return S3Admission.Accepted(value.run.id)
  }
  fun resolveAutomatic(attempt: S3Attempt, plan: AndroidS3AutomaticPlan): S3Resolution = locked {
    if (uncertain !== attempt) return@locked S3Resolution.Unresolved
    when (val result = plan.resolve(attempt)) {
      is S3Resolution.ResolvedAccepted -> try {
        // Recovery path never starts the worker; the accepted run is closed as interrupted.
        val run = S3Run(result.runId, attempt.expected.target, attempt.expected.context)
        journal.transaction {
          if (journal.text("SELECT phase FROM s3_run WHERE id=?", arrayOf(run.id)) == "running") runs.finish(run.copy(phase = "paused", error = "os_interrupted"))
        }
        uncertain = null; result
      } catch (_: Exception) { S3Resolution.Unresolved }
      S3Resolution.ResolvedNotAccepted -> { uncertain = null; result }
      S3Resolution.Unresolved -> result
    }
  }
  private fun launch(value: Execution) {
    val body = Runnable {
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
    }
    // A rejected worker launch closes the accepted run once; the occurrence is never rolled back.
    try { executor("kloda-${journal.provider}-files", body) } catch (_: Exception) { finish(value, "os_interrupted") }
  }
  private fun allowed(value: Execution): Boolean = value.owner?.let { mayRunAutomatic(it) && journal.automatic() } ?: mayRun()
  private fun check(value: Execution) = locked {
    if (value.cancelled || active?.token != value.token) throw S3Failure("cancelled")
    if (!allowed(value)) throw S3Failure("os_interrupted")
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
    val capture = profiles.capture(); val enabled = capture != null && journal.enabled(); val blocked = blocked()
    buildMap {
      put("automaticEnabled", enabled && journal.automatic()); put("enabled", enabled); put("running", active != null)
      put("canRun", enabled && active == null && !blocked && mayRun())
      if (capture != null) runs.read(capture.profile.target.archiveId())?.let { value ->
        put("run", buildMap<String, Any> {
          put("id", value.id); put("state", if (blocked) "needs_attention" else if (active?.run?.id != value.id && value.phase == "running") "paused" else value.phase)
          put("counts", runs.counts(value.id)); if (blocked) put("errorCode", "storage_failure") else value.error?.let { put("errorCode", it) }
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
