package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle
import java.util.UUID

internal object AndroidFtpsScheduler {
  const val JOB = 2710
  const val WATCH = 2711
  private val lock = Any()
  private fun prefs(context: Context) = context.getSharedPreferences("kloda-sync", 0)
  fun current(context: Context, token: String?) = token != null && token == prefs(context).getString("ftpsDispatchToken", null)
  fun error(context: Context): String? = prefs(context).getString("ftpsAutomaticError", null)
  fun report(context: Context, code: String?) {
    val edit = prefs(context).edit()
    if (code == null) edit.remove("ftpsAutomaticError") else edit.putString("ftpsAutomaticError", code)
    if (!edit.commit()) throw FilesFailure("storage_failure")
  }
  /**
   * Exact-E fence (§4.5–4.6): `live` reads the callback's own lifecycle entry under this monitor; a token alone never
   * authorizes a retired E (OS-stopped, destroyed or completed), even when its retry carries the same token.
   */
  fun reportCurrent(context: Context, token: String?, code: String?, live: () -> Boolean, lane: Int = JOB) = synchronized(lock) {
    if (live() && (if (lane == WATCH) watching(context, token) else current(context, token))) report(context, code)
  }
  /** OS boundary; production delegates directly, instrumentation may only record around it. */
  internal open class Os {
    open fun finish(service: JobService, params: JobParameters, retry: Boolean) = service.jobFinished(params, retry)
    open fun cancel(context: Context, id: Int) = context.getSystemService(JobScheduler::class.java).cancel(id)
    open fun schedule(scheduler: JobScheduler, job: JobInfo): Int = scheduler.schedule(job)
    /** R2 proof read of the WATCH lane (contract §3); production reads the OS directly. */
    open fun pending(scheduler: JobScheduler, id: Int): JobInfo? = scheduler.getPendingJob(id)
  }
  @Volatile internal var os = Os()
  /**
   * R1 §2 lifecycle arbiter: onStart/onStop/onDestroy, the claim commit and completion decide E phase, slot and stop
   * answer here. Lock order monitor→sourceLock; no Runtime begin/end/pause and no wait on a worker or main callback inside.
   */
  fun <T> arbiter(block: () -> T): T = synchronized(lock) { block() }
  /** Per lane delivery/revoke generation; a retained stop answer or recovery ticket is valid only for its own epoch. */
  private val epochs = java.util.concurrent.ConcurrentHashMap<Int, Long>()
  fun started(lane: Int): Long = epochs.merge(lane, 1L) { a, b -> a + b }!!
  private fun epoch(lane: Int) = epochs[lane] ?: 0L
  /** §OS protocol: `rejected` = explicit FAILURE with the previous token restored; otherwise acceptance is unknown. */
  private class Unaccepted(val rejected: Boolean) : Exception(if (rejected) "automatic_unavailable" else "outcome_unknown")
  /** JOB replacement (new to previous token) whose schedule threw without provable pending; admission closed until resolved. */
  private val unresolved = java.util.concurrent.ConcurrentHashMap<Int, Pair<String, String?>>()
  /** R2 §3: one WATCH attempt recorded before its install; `origin` = the E whose callback owns the result, null = ordinary. */
  private class Attempt(val next: String, val previous: String?, val origin: FtpsSlot?, val uris: Set<JobInfo.TriggerContentUri>) {
    fun owner() = origin?.phase == FtpsSlot.Phase.RUNNING || origin?.phase == FtpsSlot.Phase.COMPLETING
  }
  @Volatile private var watchUnknown: Attempt? = null
  fun admits() = unresolved.isEmpty() && watchUnknown == null
  /** Explicit revoke (pause/disable/fail-closed): retires unresolved attempts and every retained retry/recovery epoch. */
  fun cancel(context: Context) {
    os.cancel(context, JOB); os.cancel(context, WATCH); unresolved.clear(); watchUnknown = null
    epochs.merge(JOB, 1L) { a, b -> a + b }; epochs.merge(WATCH, 1L) { a, b -> a + b }
  }
  /** WATCH replacement outcome (§4.8 + §OS protocol); NONE = no exact consumed WATCH to replace (paused/mode/retired). */
  enum class Rewatch { NONE, INSTALLED, REJECTED, UNKNOWN }
  /** The own finish was handed to the OS: COMPLETING → RETAINED; a consumed (STOPPED) answer is never reopened. */
  fun retain(slot: FtpsSlot) = synchronized(lock) { if (slot.phase == FtpsSlot.Phase.COMPLETING) slot.phase = FtpsSlot.Phase.RETAINED }
  /**
   * R1 §2 stop answer of the exact slot (caller removed it under this monitor). RUNNING: pre-admission current JOB is
   * retried, a claimed run records one recovery ticket. COMPLETING/RETAINED: only the published RETRY of the same epoch
   * and still-current D; installed successor/revoke/HOLD answer false. finish is never repeated here.
   */
  fun stopped(context: Context, slot: FtpsSlot, token: String?, claimed: Boolean): Boolean = synchronized(lock) {
    val phase = slot.phase
    slot.phase = FtpsSlot.Phase.STOPPED
    when (phase) {
      FtpsSlot.Phase.RUNNING -> {
        if (claimed) slot.ticket = true
        slot.lane == JOB && !claimed && current(context, token)
      }
      FtpsSlot.Phase.COMPLETING, FtpsSlot.Phase.RETAINED -> slot.stop == FtpsSlot.Stop.RETRY && slot.epoch == epoch(slot.lane) &&
        (if (slot.lane == JOB) current(context, token) else watching(context, token))
      FtpsSlot.Phase.STOPPED -> false
    }
  }
  /** Exact WATCH owner: the pending (also while running) WATCH still carries this callback's own token. */
  private fun watching(context: Context, token: String?) =
    token != null && context.getSystemService(JobScheduler::class.java).getPendingJob(WATCH)?.extras?.getString("token") == token
  /** All P fields + current token (§4.4); the completing callback's own JOB is never a reusable projection. */
  private fun projects(context: Context, pending: JobInfo?, plan: FtpsPlan, self: String?): Boolean {
    val extras = pending?.extras ?: return false
    val token = prefs(context).getString("ftpsDispatchToken", null)
    return token != null && token != self && extras.getString("token") == token && extras.getString("binding") == plan.binding &&
      extras.getString("target") == plan.target && extras.getLong("occurrence", -1) == plan.occurrence && extras.getLong("dispatch", -1) == plan.due
  }
  /**
   * §4.5–4.8 single completion decision of one exact callback under the arbiter. `retire` is the atomic removal of the
   * callback's own lifecycle entry: losing it to onStop/onDestroy means stopped (that decision already went to the OS).
   * A retired origin (B installed) or an OS-stopped one does only its own cleanup; an ordinary JOB completes by its next
   * replacement (no extra finish).
   */
  fun complete(service: JobService, params: JobParameters, retire: () -> Boolean, locked: Boolean, claimed: Boolean, watch: Rewatch?) = synchronized(lock) {
    val stopped = !retire()
    val context = service.applicationContext
    val token = params.extras.getString("token")
    if (params.jobId == WATCH) {
      // Installed or unknown replacement: no finish/cancel (unknown stays unresolved). Rejected: one own backoff retry.
      if (stopped || watch == Rewatch.INSTALLED || watch == Rewatch.UNKNOWN || !watching(context, token)) return@synchronized
      if (watch == Rewatch.REJECTED) { os.finish(service, params, true); return@synchronized }
      // No replacement attempted (paused/scheduled mode, or the WATCH's own failure): ordinary revoke and reconcile.
      os.finish(service, params, false); os.cancel(context, WATCH); reconcile(context)
      return@synchronized
    }
    if (!current(context, token)) return@synchronized
    // Stopped before admission: onStopJob already asked the OS for the retry; a claimed run re-projects its recorded result.
    if (stopped) { if (claimed) reconcile(context); return@synchronized }
    if (locked) { os.finish(service, params, true); return@synchronized }
    try { reconcile(context, self = token) } catch (failure: Unaccepted) { os.finish(service, params, true); return@synchronized }
    // Nothing replaced or cancelled the own JOB (e.g. a foreign lease holds P.run): complete it once explicitly.
    if (!unresolved.containsKey(JOB) && context.getSystemService(JobScheduler::class.java).getPendingJob(JOB)?.extras?.getString("token") == token)
      os.finish(service, params, false)
  }
  fun reconcileAsync(context: Context, clockChanged: Boolean = false) {
    Thread({ reconcile(context.applicationContext, clockChanged) }, "kloda-ftps-reconcile").start()
  }
  private fun next(context: Context, now: Long, previous: Long? = null): Long =
    if (AndroidBackupScheduler.mode(context) == "live") {
      if (previous == null) now else Math.addExact(maxOf(now, previous), JobInfo.getMinPeriodMillis())
    } else AndroidBackupScheduler.nextScheduled(context, maxOf(now, previous ?: now))
  fun reconcile(context: Context, clockChanged: Boolean = false, self: String? = null): Unit = synchronized(lock) {
    try {
      if (!AndroidFtpsRuntime.supported()) { cancel(context); return@synchronized }
      if (AndroidBackupScheduler.paused(context)) { cancel(context); return@synchronized }
      run {
        val queue = AndroidFtpsRuntime.queue(context)
        val journal = queue.journal
        val plan = synchronized(AndroidSyncJournal.sourceLock) source@{
          val header = queue.destination() ?: run { cancel(context); return@source null }
          val sources = FilesRunContext.webdav(context)
          if (sources.sources.isEmpty()) { cancel(context); return@source null }
          val binding = header.revision
          val clock = FtpsRun.clock(context)
          var plan = queue.schedule.read()?.takeIf { it.target == header.target && it.binding == binding }
          if (plan == null) {
            val due = next(context, clock.now); plan = FtpsPlan(header.target, binding, due, due)
            queue.schedule.save(plan)
          }
          val id = plan.run
          if (id != null) {
            var run = queue.runs.read(id = id)
            if (run != null) {
              if (run.target != plan.target || run.binding != plan.binding || !run.automatic || run.occurrence != plan.occurrence) throw FilesFailure("outcome_unknown")
              if (AndroidFtpsRuntime.hasAutomatic(id)) return@source null
              if (run.phase == "running") { run = run.failed("os_interrupted", clock); queue.runs.save(run) }
              if (run.phase == "waiting") {
                val transition = run.retried(clock)
                if (transition != null && transition.phase != "running") { run = transition; queue.runs.save(run) }
                if (run.phase == "waiting") {
                  val revised = plan.copy(due = Math.addExact(clock.now, maxOf(0, run.retryElapsed!! - clock.elapsed)))
                  queue.schedule.save(revised, plan); plan = revised
                }
              }
              if (run.phase in setOf("finished", "needs_attention", "exhausted") || (run.phase == "paused" && run.error != "user_pause")) {
                val due = next(context, clock.now, plan.occurrence)
                val revised = FtpsPlan(plan.target, plan.binding, due, due)
                queue.schedule.save(revised, plan); plan = revised
              }
            }
          } else if (clockChanged && plan.due > clock.now) {
            val due = next(context, clock.now); val revised = plan.copy(occurrence = due, due = due)
            queue.schedule.save(revised, plan); plan = revised
          }
          plan
        } ?: return@run
        val scheduler = context.getSystemService(JobScheduler::class.java)
        if (!projects(context, resolve(context, scheduler), plan, self)) dispatch(context, scheduler, plan, maxOf(0, plan.due - System.currentTimeMillis()))
        if (AndroidBackupScheduler.mode(context) == "live") {
          // Unresolved WATCH: exact new kept; exact old (its worker no longer completes it) or null → one fresh projection.
          if (resolve(context, scheduler, WATCH) == null && scheduler.getPendingJob(WATCH) != null) os.cancel(context, WATCH)
          AndroidBackupScheduler.watch(context, FilesRunContext.webdav(context).sources.values.toSet(), scheduler, WATCH, AndroidFtpsJob::class.java)
        } else { os.cancel(context, WATCH); unresolved.remove(WATCH) }
        report(context, null)
      }
    } catch (caught: Exception) {
      val wake = if (AndroidFtpsQueue.code(caught) == "credential_locked") runCatching { lockedWake(context, self) } else null
      if (wake?.getOrNull() == true) return@synchronized
      val failure = wake?.exceptionOrNull() as? Exception ?: caught
      val code = if (failure is Unaccepted) failure.message!! else AndroidFtpsQueue.code(failure)
      // Unknown acceptance: no second schedule/cancel/finish. Rejected inside a completion: that callback owns the one fallback.
      if (failure is Unaccepted && (!failure.rejected || self != null)) {
        runCatching { report(context, code) }
        if (failure.rejected) throw failure else return@synchronized
      }
      cancel(context)
      runCatching { report(context, code) }
    }
  }
  /** Resolves an unresolved projection first: exact new = installed; null/exact old = retire and reproject; foreign/unreadable = blocked. */
  private fun resolve(context: Context, scheduler: JobScheduler, id: Int = JOB): JobInfo? {
    val (next, previous) = unresolved[id] ?: return scheduler.getPendingJob(id)
    val pending = runCatching { scheduler.getPendingJob(id) }.getOrElse { throw Unaccepted(false) }
    val seen = pending?.extras?.getString("token")
    if (pending != null && seen != next && seen != previous) throw Unaccepted(false)
    unresolved.remove(id)
    return pending.takeIf { seen == next }
  }
  /** §OS result protocol for one JOB replacement; the arbiter monitor is held, sourceLock is not. */
  private fun dispatch(context: Context, scheduler: JobScheduler, plan: FtpsPlan, latency: Long) {
    val previous = prefs(context).getString("ftpsDispatchToken", null)
    val token = UUID.randomUUID().toString()
    val extras = PersistableBundle().apply {
      putString("binding", plan.binding); putString("target", plan.target); putLong("occurrence", plan.occurrence)
      putLong("dispatch", plan.due); putString("token", token)
    }
    if (!prefs(context).edit().putString("ftpsDispatchToken", token).commit()) throw FilesFailure("storage_failure")
    val job = JobInfo.Builder(JOB, ComponentName(context, AndroidFtpsJob::class.java)).setExtras(extras)
      .setMinimumLatency(latency).setPersisted(true).build()
    val accepted = try { os.schedule(scheduler, job) == JobScheduler.RESULT_SUCCESS } catch (failure: Exception) {
      val pending = runCatching { scheduler.getPendingJob(JOB) }.getOrNull()
      val seen = pending?.extras?.getString("token")
      if (seen == token && projects(context, pending, plan, null)) return
      // Exact old envelope: the replacement was not taken → same path as FAILURE. Null/foreign/unreadable: unknown.
      if (previous == null || seen != previous) { unresolved[JOB] = token to previous; throw Unaccepted(false) }
      false
    }
    if (accepted) return
    val restore = prefs(context).edit().apply { if (previous == null) remove("ftpsDispatchToken") else putString("ftpsDispatchToken", previous) }
    if (!restore.commit()) throw FilesFailure("storage_failure")
    throw Unaccepted(true)
  }
  /**
   * Locked reconcile: P is read-only. Keep the exact current JOB (all P fields + token) or arm a metadata-only
   * delayed wake carrying the same P; latency never changes P.due. No P/disabled/mismatch → caller fails closed.
   * WATCH is left untouched. Unlock still requires fresh capture/admission in the callback.
   */
  private fun lockedWake(context: Context, self: String?): Boolean {
    val plan = AndroidFtpsRuntime.queue(context).retainedPlanForWake() ?: return false
    val scheduler = context.getSystemService(JobScheduler::class.java)
    if (!projects(context, resolve(context, scheduler), plan, self)) dispatch(context, scheduler, plan, maxOf(300000L, plan.due - System.currentTimeMillis()))
    report(context, "credential_locked")
    return true
  }
  /** WATCH: fresh capture BEFORE any P write, then guard + expected-P CAS; locked → P read-only, no stored early request. */
  fun changed(context: Context, token: String?, live: () -> Boolean) = synchronized(lock) {
    // FS1: a retired (stopped/destroyed/replaced) WATCH writes nothing, even while its pending token is unchanged.
    if (!AndroidFtpsRuntime.supported() || !live() || !watching(context, token)) return@synchronized
    if (AndroidBackupScheduler.paused(context) || AndroidBackupScheduler.mode(context) != "live") return@synchronized
    try {
      val queue = AndroidFtpsRuntime.queue(context)
      synchronized(AndroidSyncJournal.sourceLock) {
        val header = queue.destination()
        queue.schedule.read()?.takeIf { header != null && it.run == null && it.target == header.target && it.binding == header.revision }?.let {
          val now = System.currentTimeMillis(); queue.schedule.save(it.copy(occurrence = now, due = now), it)
        }
      }
    } catch (failure: Exception) { if (AndroidFtpsQueue.code(failure) != "credential_locked") throw failure }
    reconcile(context)
  }
  /**
   * §4.8 WATCH completion: replace the consumed exact WATCH with the same trigger URIs; success needs no finish/cancel.
   * §OS protocol: FAILURE or throw with the exact old pending = rejected; throw with the exact new = installed; null/
   * foreign/unreadable = unknown → unresolved (admission closed) until the next ordinary reconcile, no second OS call.
   */
  fun rewatch(context: Context, token: String?, live: () -> Boolean): Rewatch = synchronized(lock) {
    if (!live() || token == null || AndroidBackupScheduler.paused(context) || AndroidBackupScheduler.mode(context) != "live") return@synchronized Rewatch.NONE
    val scheduler = context.getSystemService(JobScheduler::class.java)
    val uris = scheduler.getPendingJob(WATCH)?.takeIf { it.extras.getString("token") == token }?.triggerContentUris ?: return@synchronized Rewatch.NONE
    val next = UUID.randomUUID().toString()
    val job = JobInfo.Builder(WATCH, ComponentName(context, AndroidFtpsJob::class.java))
      .setExtras(PersistableBundle().apply { putString("token", next) })
    uris.forEach { job.addTriggerContentUri(it) }
    val outcome = try {
      if (os.schedule(scheduler, job.build()) == JobScheduler.RESULT_SUCCESS) Rewatch.INSTALLED else Rewatch.REJECTED
    } catch (failure: Exception) {
      when (runCatching { scheduler.getPendingJob(WATCH)?.extras?.getString("token") }.getOrNull()) {
        next -> Rewatch.INSTALLED
        token -> Rewatch.REJECTED
        else -> Rewatch.UNKNOWN
      }
    }
    if (outcome == Rewatch.UNKNOWN) unresolved[WATCH] = next to token
    if (outcome == Rewatch.REJECTED || outcome == Rewatch.UNKNOWN)
      runCatching { report(context, if (outcome == Rewatch.REJECTED) "automatic_unavailable" else "outcome_unknown") }
    outcome
  }
  fun defer(context: Context, expected: FtpsPlan, token: String?, live: () -> Boolean) = synchronized(lock) {
    if (live() && current(context, token)) run {
      val schedule = AndroidFtpsRuntime.queue(context).schedule
      schedule.save(expected.copy(due = Math.addExact(System.currentTimeMillis(), 300000L)), expected)
    }
  }
  fun finished(context: Context, expected: FtpsPlan, result: FtpsRun, token: String?, live: () -> Boolean) = synchronized(lock) {
    if (!live() || !current(context, token)) return@synchronized
    run {
      val queue = AndroidFtpsRuntime.queue(context)
      val journal = queue.journal
      if (queue.runs.read(id = result.id) != result) throw FilesFailure("storage_failure")
      val header = queue.destination() ?: return@run
      if (header.target != expected.target || header.revision != expected.binding) return@run
      val clock = FtpsRun.clock(context)
      val plan = when (result.phase) {
        "waiting" -> expected.copy(due = Math.addExact(clock.now, maxOf(0, result.retryElapsed!! - clock.elapsed)))
        "paused" -> expected
        else -> { val due = next(context, clock.now, expected.occurrence); FtpsPlan(expected.target, expected.binding, due, due) }
      }
      queue.schedule.save(plan, expected)
      report(context, result.error)
    }
  }
}
