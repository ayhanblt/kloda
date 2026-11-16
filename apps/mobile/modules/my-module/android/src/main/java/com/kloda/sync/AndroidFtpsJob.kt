package com.kloda.sync

import android.app.job.JobParameters
import android.app.job.JobService
import java.util.UUID
import java.util.concurrent.CountDownLatch

/**
 * R1 contract §2: RAM lifecycle of one exact E (service + lane + saved params). Worker authority (RUNNING) and the
 * retained answer to a late OS stop (COMPLETING/RETAINED + `stop`) are separate; phase/stop/ticket/verdict change only
 * under the Scheduler arbiter. No persistence, timer or terminal-ack assumption.
 */
internal open class FtpsSlot(val lane: Int) {
  enum class Phase { RUNNING, COMPLETING, RETAINED, STOPPED }
  enum class Stop { RETRY, NO_RETRY, HOLD }
  @Volatile var phase = Phase.RUNNING
  @Volatile var stop = Stop.NO_RETRY
  /** Lane generation at delivery: a newer delivery or an explicit revoke voids this E's retry/recovery. */
  @Volatile var epoch = 0L
  /** Claimed run stopped while RUNNING: one recovery decision for the same D/epoch, consumed by its completion. */
  @Volatile var ticket = false
  /** WATCH fallback published by an ordinary recovery while this E still owned its unknown replacement. */
  @Volatile var verdict: AndroidFtpsScheduler.Rewatch? = null
}

/** The lease exists only for this native JobService callback and exact run. */
class AndroidFtpsJob : JobService() {
  private class Execution(val parameters: JobParameters) : FtpsSlot(parameters.jobId) {
    val done = CountDownLatch(1)
    @Volatile var result: FtpsRun? = null
    /** Claimed P; published together with P.run in the monitor→sourceLock commit, read by stop only under the arbiter. */
    @Volatile var plan: FtpsPlan? = null
    /** Pre-admission credential wait: P/run untouched; only this JOB is retried by OS backoff. */
    @Volatile var locked = false
    /** WATCH same-URI replacement outcome (§4.8); null = not attempted. Decided by `complete`, never in finally. */
    @Volatile var watch: AndroidFtpsScheduler.Rewatch? = null
  }
  /** Lane → at most one slot of this service: a live worker E or a worker-closed E retaining its stop answer. */
  private val executions = java.util.concurrent.ConcurrentHashMap<Int, Execution>()
  /** Worker side-effect authority: own slot AND RUNNING (volatile snapshot; read lock-free, also under sourceLock). */
  private fun live(execution: Execution) = executions[execution.lane] === execution && execution.phase == FtpsSlot.Phase.RUNNING
  override fun onStartJob(params: JobParameters): Boolean {
    if (!AndroidFtpsRuntime.supported()) return false
    if (params.jobId !in setOf(AndroidFtpsScheduler.JOB, AndroidFtpsScheduler.WATCH)) return false
    val execution = Execution(params)
    // A new delivery retires a worker-closed (RETAINED) slot; an active RUNNING/COMPLETING E is never overwritten.
    val accepted = AndroidFtpsScheduler.arbiter {
      val prior = executions[params.jobId]?.phase
      if (prior == FtpsSlot.Phase.RUNNING || prior == FtpsSlot.Phase.COMPLETING) false
      else { execution.epoch = AndroidFtpsScheduler.started(params.jobId, params.extras.getString("token")); executions[params.jobId] = execution; true }
    }
    if (!accepted) return false
    Thread({
      val token = params.extras.getString("token")
      try {
        if (params.jobId == AndroidFtpsScheduler.WATCH) {
          AndroidFtpsScheduler.changed(applicationContext, token) { live(execution) }
          execution.watch = AndroidFtpsScheduler.rewatch(applicationContext, token, execution) { live(execution) }
        } else execute(execution)
      } catch (failure: Exception) {
        execution.locked = params.jobId == AndroidFtpsScheduler.JOB && execution.plan == null && AndroidFtpsQueue.code(failure) == "credential_locked"
        val code = if (execution.locked) "credential_locked" else (failure as? FilesFailure)?.code ?: "automatic_unavailable"
        runCatching { AndroidFtpsScheduler.reportCurrent(applicationContext, token, code, { live(execution) }, params.jobId) }
      } finally {
        AndroidFtpsRuntime.endAutomatic(execution, interrupt = true)
        // One completion decision; the slot stays RETAINED with its published stop answer across the own finish.
        runCatching { AndroidFtpsScheduler.complete(this, params, execution, execution.locked, execution.watch) }
      }
    }, "kloda-ftps-job").start()
    return true
  }
  /** Platform stop params are matched to the lane's active local E by envelope, never by object identity (§4.6). */
  private fun envelope(params: JobParameters) = params.extras.let {
    listOf(it.getString("token"), it.getString("binding"), it.getString("target"), it.getLong("occurrence", -1), it.getLong("dispatch", -1))
  }
  /** Decided under the arbiter (§2 table); this E's slot is consumed by its stop answer. Runtime cleanup outside. */
  override fun onStopJob(params: JobParameters): Boolean {
    var stopped: Execution? = null
    val retry = AndroidFtpsScheduler.arbiter {
      val execution = executions[params.jobId]?.takeIf { envelope(it.parameters) == envelope(params) } ?: return@arbiter false
      executions.remove(params.jobId, execution); stopped = execution
      AndroidFtpsScheduler.stopped(applicationContext, execution, params.extras.getString("token"), execution.plan != null)
    }
    stopped?.let { AndroidFtpsRuntime.endAutomatic(it, interrupt = true); it.done.countDown() }
    return retry
  }
  override fun onDestroy() {
    val closed = AndroidFtpsScheduler.arbiter {
      executions.values.toList().onEach {
        if (it.phase == FtpsSlot.Phase.RUNNING && it.plan != null) it.ticket = true
        it.phase = FtpsSlot.Phase.STOPPED
      }.also { executions.clear() }
    }
    closed.forEach { AndroidFtpsRuntime.endAutomatic(it, interrupt = true); it.done.countDown() }
    super.onDestroy()
  }
  private fun current(execution: Execution): Boolean = live(execution) && !AndroidBackupScheduler.paused(applicationContext) &&
    AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.current(applicationContext, execution.parameters.extras.getString("token"))
  private fun matches(plan: FtpsPlan): Boolean {
    val header = AndroidFtpsRuntime.queue(applicationContext).destination() ?: return false
    return header.target == plan.target && header.revision == plan.binding
  }
  private fun execute(execution: Execution) {
    val context = applicationContext
    run {
      val queue = AndroidFtpsRuntime.queue(context)
      val journal = queue.journal
      val prepared = synchronized(AndroidSyncJournal.sourceLock) {
        val plan = queue.schedule.read() ?: return
        val extras = execution.parameters.extras
        if (!current(execution) || plan.binding != extras.getString("binding") || plan.target != extras.getString("target") ||
          plan.occurrence != extras.getLong("occurrence", -1) || plan.due != extras.getLong("dispatch", -1) || !matches(plan)) return
        val clock = FtpsRun.clock(context)
        if (clock.now < plan.due) return
        var run = plan.run?.let { queue.runs.read(id = it) }
        if (run != null) {
          if (run.target != plan.target || run.binding != plan.binding || !run.automatic || run.occurrence != plan.occurrence) throw FilesFailure("outcome_unknown")
          if (run.phase == "running") {
            queue.runs.save(run.failed("os_interrupted", clock)); return
          }
          if (run.phase == "waiting") {
            val candidate = run.retried(clock)
            if (candidate == null || candidate.phase != "running") {
              if (candidate != null) queue.runs.save(candidate)
              return
            }
            run = candidate
          } else if (run.phase == "paused" && run.error == "user_pause") run = run.copy(phase = "running", error = null)
          else return
        } else run = FtpsRun(plan.run ?: UUID.randomUUID().toString(), plan.target, plan.binding, true, plan.occurrence)
        plan to run
      }
      val (expected, candidate) = prepared
      if (!queue.available() || !AndroidFtpsRuntime.beginAutomatic(execution, candidate.id) { current(execution) }) {
        AndroidFtpsScheduler.defer(context, expected, execution.parameters.extras.getString("token")) { live(execution) }; return
      }
      try {
        // §2 claim commit: monitor→sourceLock, so a stop decides on E.plan and P.run from the same critical section.
        AndroidFtpsScheduler.arbiter {
          synchronized(AndroidSyncJournal.sourceLock) {
            if (!current(execution) || queue.schedule.read() != expected || !matches(expected)) throw FilesFailure("settings_changed")
            val claimed = expected.copy(run = candidate.id)
            queue.schedule.save(claimed, expected); execution.plan = claimed
            queue.runs.save(candidate)
          }
        }
        if (!current(execution)) throw FilesFailure("os_interrupted")
        queue.start(automatic = true, prior = candidate) { result -> execution.result = result; execution.done.countDown() }
        execution.done.await()
      } catch (failure: Exception) {
        AndroidFtpsRuntime.endAutomatic(execution, interrupt = true)
        val claimed = execution.plan
        if (claimed == null && AndroidFtpsQueue.code(failure) == "credential_locked") throw failure
        if (claimed != null) {
          val stored = queue.runs.read(id = candidate.id) ?: candidate
          execution.result = if (stored.phase == "running") {
            val code = if (execution.phase == FtpsSlot.Phase.STOPPED || failure is InterruptedException) "os_interrupted" else (failure as? FilesFailure)?.code ?: "automatic_unavailable"
            stored.failed(code, FtpsRun.clock(context)).also { queue.runs.save(it) }
          } else stored
        }
      } finally { AndroidFtpsRuntime.endAutomatic(execution, interrupt = true) }
      val result = execution.result ?: return
      val claimed = execution.plan ?: return
      AndroidFtpsScheduler.finished(context, claimed, result, execution.parameters.extras.getString("token")) { live(execution) }
    }
  }
}
