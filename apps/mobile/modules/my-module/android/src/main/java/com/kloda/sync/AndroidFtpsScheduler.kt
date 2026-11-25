package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.PersistableBundle
import android.provider.DocumentsContract
import android.provider.MediaStore
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
  /** Under the arbiter at onStart: a delivery of the proposed unknown WATCH is its installation proof (§3). */
  fun started(lane: Int, token: String?): Long {
    if (lane == WATCH && token != null && watchUnknown?.next?.token == token) watchUnknown = null
    return epochs.merge(lane, 1L) { a, b -> a + b }!!
  }
  private fun epoch(lane: Int) = epochs[lane] ?: 0L
  /** §OS protocol: `rejected` = explicit FAILURE with the previous token restored; otherwise acceptance is unknown. */
  private class Unaccepted(val rejected: Boolean) : Exception(if (rejected) "automatic_unavailable" else "outcome_unknown")
  /** JOB replacement (new to previous token) whose schedule threw without provable pending; admission closed until resolved. */
  private val unresolved = java.util.concurrent.ConcurrentHashMap<Int, Pair<String, String?>>()
  /** WATCH proof (§3): service + token + trigger URIs/flags; a token alone never proves an installation. */
  private class Proof(val token: String, val uris: Set<JobInfo.TriggerContentUri>)
  /** R2 §3: one WATCH attempt recorded before its install; `origin` = the E whose callback owns the result, null = ordinary. */
  private class Attempt(val next: Proof, val previous: Proof?, val origin: FtpsSlot?) {
    fun owner() = origin?.phase == FtpsSlot.Phase.RUNNING
  }
  @Volatile private var watchUnknown: Attempt? = null
  fun admits() = unresolved.isEmpty() && watchUnknown == null
  /**
   * Explicit revoke (pause/disable/unsupported/no profile) retires unresolved attempts; every revoke voids retained
   * retry/recovery epochs. `keep` = generic fail-closed: lanes cancelled, but UNKNOWN fences are not cleared by it.
   */
  fun cancel(context: Context, keep: Boolean = false) {
    os.cancel(context, JOB); os.cancel(context, WATCH)
    if (!keep) { unresolved.clear(); watchUnknown = null }
    epochs.merge(JOB, 1L) { a, b -> a + b }; epochs.merge(WATCH, 1L) { a, b -> a + b }
  }
  /** WATCH replacement outcome (§4.8 + §OS protocol); NONE = no exact consumed WATCH to replace (paused/mode/retired). */
  enum class Rewatch { NONE, INSTALLED, REJECTED, UNKNOWN }
  /**
   * R1 §2 stop answer of the exact slot (caller removed it under this monitor). RUNNING: pre-admission current JOB is
   * retried, a claimed run records one recovery ticket; a WATCH holding a published REJECTED fallback keeps its backoff.
   * COMPLETING/RETAINED: only the published RETRY of the same epoch and still-current D; installed successor/revoke/HOLD
   * answer false. finish is never repeated here.
   */
  fun stopped(context: Context, slot: FtpsSlot, token: String?, claimed: Boolean): Boolean = synchronized(lock) {
    val phase = slot.phase
    slot.phase = FtpsSlot.Phase.STOPPED
    when (phase) {
      FtpsSlot.Phase.RUNNING -> {
        if (claimed) slot.ticket = true
        if (slot.lane == JOB) !claimed && current(context, token) else slot.verdict == Rewatch.REJECTED && watching(context, token)
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
   * §4.5–4.8 + R1 §2 single completion decision of one exact E under the arbiter. RUNNING → COMPLETING closes worker
   * authority; the stop disposition is published before the own finish goes to the OS, and the slot stays RETAINED so a
   * late OS stop still finds it (no terminal-ack assumption). A stopped/destroyed E only consumes its recovery ticket.
   */
  fun complete(service: JobService, params: JobParameters, slot: FtpsSlot, locked: Boolean, watch: Rewatch?) = synchronized(lock) {
    val context = service.applicationContext
    val token = params.extras.getString("token")
    if (slot.phase != FtpsSlot.Phase.RUNNING) return@synchronized recover(context, slot, token)
    slot.phase = FtpsSlot.Phase.COMPLETING
    fun settle(stop: FtpsSlot.Stop, finish: Boolean? = null) {
      slot.stop = stop
      try { finish?.let { os.finish(service, params, it) } } finally { slot.phase = FtpsSlot.Phase.RETAINED }
    }
    // Installed or unknown WATCH replacement: no finish/cancel (unknown stays HOLD). Rejected: one own backoff retry.
    val outcome = slot.verdict ?: watch
    if (params.jobId == WATCH) return@synchronized when {
      outcome == Rewatch.UNKNOWN -> settle(FtpsSlot.Stop.HOLD)
      outcome == Rewatch.INSTALLED || !watching(context, token) -> settle(FtpsSlot.Stop.NO_RETRY)
      outcome == Rewatch.REJECTED -> settle(FtpsSlot.Stop.RETRY, true)
      // No replacement attempted (paused/scheduled mode, or the WATCH's own failure): ordinary revoke and reconcile.
      else -> { settle(FtpsSlot.Stop.NO_RETRY, false); os.cancel(context, WATCH); reconcile(context) }
    }
    if (!current(context, token)) return@synchronized settle(FtpsSlot.Stop.NO_RETRY)
    if (locked) return@synchronized settle(FtpsSlot.Stop.RETRY, true)
    try { reconcile(context, self = token) } catch (failure: Unaccepted) { return@synchronized settle(FtpsSlot.Stop.RETRY, true) }
    // Nothing replaced or cancelled the own JOB (e.g. a foreign lease holds P.run): complete it once explicitly.
    val own = context.getSystemService(JobScheduler::class.java).getPendingJob(JOB)?.extras?.getString("token") == token
    if (unresolved.containsKey(JOB)) settle(FtpsSlot.Stop.HOLD) else settle(FtpsSlot.Stop.NO_RETRY, if (own) false else null)
  }
  /**
   * R1 §2 recovery ticket of a claimed E stopped while RUNNING: one asynchronous decision after its Runtime cleanup,
   * for the same D and epoch only; a newer delivery, revoke or installed B voids it. Never revives the old worker.
   */
  private fun recover(context: Context, slot: FtpsSlot, token: String?) {
    if (!slot.ticket) return
    slot.ticket = false
    Thread({ synchronized(lock) { if (epoch(slot.lane) == slot.epoch && current(context, token)) reconcile(context) } }, "kloda-ftps-reconcile").start()
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
        val plan = synchronized(AndroidSyncJournal.sourceLock) source@{
          // FP2: a fresh-capture storage failure with an open UNKNOWN (ordinary live reconcile) is neither absence nor revoke: original error, no cancel.
          val header = try { queue.destination() } catch (f: Exception) { if (self == null && watchUnknown != null && AndroidBackupScheduler.mode(context) == "live" && AndroidFtpsQueue.code(f) == "storage_failure") { runCatching { report(context, "storage_failure") }; return@run }; throw f } ?: run { cancel(context); return@source null }
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
        // R2: the FTPS WATCH never goes through the shared helper; rejected/unknown/blocked never report success.
        if (AndroidBackupScheduler.mode(context) == "live") { if (!watch(context, scheduler)) return@run }
        else { os.cancel(context, WATCH); watchUnknown = null }
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
      cancel(context, keep = true)
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
  /** §4.8 WATCH completion: replace the consumed exact WATCH (same trigger URIs/flags) through the §3 protocol. */
  fun rewatch(context: Context, token: String?, origin: FtpsSlot, live: () -> Boolean): Rewatch = synchronized(lock) {
    if (!live() || token == null || AndroidBackupScheduler.paused(context) || AndroidBackupScheduler.mode(context) != "live") return@synchronized Rewatch.NONE
    val scheduler = context.getSystemService(JobScheduler::class.java)
    val consumed = scheduler.getPendingJob(WATCH)?.takeIf { it.extras.getString("token") == token } ?: return@synchronized Rewatch.NONE
    val uris = consumed.triggerContentUris.orEmpty().toSet()
    install(context, scheduler, origin, Proof(token, uris), uris)
  }
  /**
   * R2 §3 single WATCH install (initial / replace / recovery). The attempt is recorded before the OS call. SUCCESS or
   * throw with the exact proposed pending = INSTALLED; FAILURE or throw with the exact previous = REJECTED (previous
   * kept); throw with null/foreign/unreadable = UNKNOWN, kept with admission closed. No finish, cancel or second schedule.
   */
  private fun install(context: Context, scheduler: JobScheduler, origin: FtpsSlot?, previous: Proof?, uris: Set<JobInfo.TriggerContentUri>): Rewatch {
    if (uris.isEmpty()) return Rewatch.NONE
    val next = Proof(UUID.randomUUID().toString(), uris)
    val job = JobInfo.Builder(WATCH, ComponentName(context, AndroidFtpsJob::class.java))
      .setExtras(PersistableBundle().apply { putString("token", next.token) })
    uris.forEach { job.addTriggerContentUri(it) }
    val built = job.build()
    val attempt = Attempt(next, previous, origin).also { watchUnknown = it }
    val outcome = try {
      if (os.schedule(scheduler, built) == JobScheduler.RESULT_SUCCESS) Rewatch.INSTALLED else Rewatch.REJECTED
    } catch (failure: Exception) {
      // An unreadable pending proves nothing: it is classified like null (UNKNOWN), never as absence or rejection.
      val pending = runCatching { os.pending(scheduler, WATCH) }.getOrNull()
      if (proves(pending, next)) Rewatch.INSTALLED else if (proves(pending, previous)) Rewatch.REJECTED else Rewatch.UNKNOWN
    }
    if (outcome != Rewatch.UNKNOWN && watchUnknown === attempt) watchUnknown = null
    if (outcome != Rewatch.INSTALLED) runCatching { report(context, if (outcome == Rewatch.REJECTED) "automatic_unavailable" else "outcome_unknown") }
    return outcome
  }
  private fun proves(job: JobInfo?, proof: Proof?) = proof != null && job != null && job.extras.getString("token") == proof.token &&
    job.service.className == AndroidFtpsJob::class.java.name && job.triggerContentUris.orEmpty().toSet() == proof.uris
  /** Same trigger URIs/flags the shared helper derives from the profile sources (meaning preserved, helper not used). */
  private fun triggers(context: Context): Set<JobInfo.TriggerContentUri> = FilesRunContext.webdav(context).sources.values.toSet().flatMap { source ->
    if (AndroidPhotosSources.isPhotos(source)) listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
    else Uri.parse(source).let { listOf(DocumentsContract.buildChildDocumentsUriUsingTree(it, DocumentsContract.getTreeDocumentId(it))) }
  }.map { JobInfo.TriggerContentUri(it, JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS) }.toSet()
  /**
   * R2 §3 ordinary WATCH reconcile: an open attempt is resolved by proof before anything is installed. true = settled
   * (installed or kept); false = rejected/unknown/blocked, error already recorded, no success report and no cleanup.
   */
  private fun watch(context: Context, scheduler: JobScheduler): Boolean {
    // Trigger derivation fails before any WATCH decision: original error, no install, no cancel (no independent revoke authority).
    val uris = try { triggers(context) } catch (failure: Exception) { runCatching { report(context, AndroidFtpsQueue.code(failure)) }; return false }
    val attempt = watchUnknown
    val read = runCatching { os.pending(scheduler, WATCH) }
    // No open attempt: an existing WATCH is kept (helper meaning); an unreadable one is a fail-closed read error.
    if (attempt == null) {
      // An unreadable WATCH is neither absence nor revoke authority: original error, no install, no cancel.
      read.exceptionOrNull()?.let { if (it !is Exception) throw it; runCatching { report(context, AndroidFtpsQueue.code(it)) }; return false }
      return read.getOrNull() != null || settled(install(context, scheduler, null, null, uris)) }
    val pending = read.getOrElse { return blocked(context) }
    return when {
      proves(pending, attempt.next) -> { watchUnknown = null; true }
      proves(pending, attempt.previous) && attempt.owner() -> {
        // The origin callback still owns its completion: it consumes the one REJECTED fallback; no install here.
        attempt.origin!!.verdict = Rewatch.REJECTED; watchUnknown = null
        runCatching { report(context, "automatic_unavailable") }; false
      }
      // Worker-closed origin with the exact previous: one replacement, the previous is replaced, never blindly cancelled.
      proves(pending, attempt.previous) -> settled(install(context, scheduler, null, attempt.previous, uris))
      // Proven absence with no owning callback: the old attempt is handed over to exactly one new attempt.
      pending == null && !attempt.owner() -> settled(install(context, scheduler, null, null, uris))
      else -> blocked(context)
    }
  }
  private fun settled(outcome: Rewatch) = outcome == Rewatch.INSTALLED || outcome == Rewatch.NONE
  private fun blocked(context: Context): Boolean { runCatching { report(context, "outcome_unknown") }; return false }
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
