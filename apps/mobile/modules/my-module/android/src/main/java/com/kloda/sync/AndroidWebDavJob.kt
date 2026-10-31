package com.kloda.sync

import android.app.job.JobParameters
import android.app.job.JobService
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean

/** The lease exists only for this native JobService callback and exact run. */
class AndroidWebDavJob : JobService() {
  private class Execution(val parameters: JobParameters) {
    val stopped = AtomicBoolean(false)
    val done = CountDownLatch(1)
    @Volatile var result: WebDavRun? = null
    var plan: WebDavPlan? = null
  }
  private val executions = java.util.concurrent.ConcurrentHashMap<Int, Execution>()
  override fun onStartJob(params: JobParameters): Boolean {
    if (params.jobId !in setOf(AndroidWebDavScheduler.JOB, AndroidWebDavScheduler.WATCH)) return false
    val execution = Execution(params)
    if (executions.putIfAbsent(params.jobId, execution) != null) return false
    Thread({
      try {
        if (params.jobId == AndroidWebDavScheduler.WATCH) AndroidWebDavScheduler.changed(applicationContext)
        else execute(execution)
      } catch (failure: Exception) {
        runCatching { AndroidWebDavScheduler.reportCurrent(applicationContext, params.extras.getString("token"), (failure as? FilesFailure)?.code ?: "automatic_unavailable") }
      } finally {
        executions.remove(params.jobId, execution)
        AndroidWebDavRuntime.endAutomatic(execution, interrupt = true)
        if (!execution.stopped.get()) jobFinished(params, false)
        if (params.jobId == AndroidWebDavScheduler.WATCH) getSystemService(android.app.job.JobScheduler::class.java).cancel(AndroidWebDavScheduler.WATCH)
        AndroidWebDavScheduler.reconcile(applicationContext)
      }
    }, "kloda-webdav-job").start()
    return true
  }
  override fun onStopJob(params: JobParameters): Boolean {
    executions[params.jobId]?.takeIf { it.parameters.extras.getString("token") == params.extras.getString("token") }?.let {
      executions.remove(params.jobId, it); it.stopped.set(true)
      AndroidWebDavRuntime.endAutomatic(it, interrupt = true)
      it.done.countDown()
    }
    return false
  }
  override fun onDestroy() {
    executions.values.forEach { it.stopped.set(true); AndroidWebDavRuntime.endAutomatic(it, interrupt = true); it.done.countDown() }
    executions.clear(); super.onDestroy()
  }
  private fun current(execution: Execution): Boolean = !execution.stopped.get() && !AndroidBackupScheduler.paused(applicationContext) &&
    AndroidWebDavScheduler.current(applicationContext, execution.parameters.extras.getString("token"))
  private fun matches(journal: AndroidWebDavJournal, plan: WebDavPlan): Boolean {
    val header = journal.destination() ?: return false
    return header.target == plan.target && AndroidWebDavContext.binding(header.target, header.revision, FilesRunContext.webdav(applicationContext).binding) == plan.binding
  }
  private fun execute(execution: Execution) {
    val context = applicationContext
    AndroidSyncJournal.webdav(context).use { owner ->
      val journal = AndroidWebDavJournal(owner.writableDatabase)
      val prepared = synchronized(AndroidSyncJournal.sourceLock) {
        val plan = journal.schedule.read() ?: return
        val extras = execution.parameters.extras
        if (!current(execution) || plan.binding != extras.getString("binding") || plan.target != extras.getString("target") ||
          plan.occurrence != extras.getLong("occurrence", -1) || plan.due != extras.getLong("dispatch", -1) || !matches(journal, plan)) return
        val clock = WebDavRun.clock(context)
        if (clock.now < plan.due) return
        var run = plan.run?.let { journal.runs.read(id = it) }
        if (run != null) {
          if (run.target != plan.target || run.binding != plan.binding || !run.automatic || run.occurrence != plan.occurrence) throw FilesFailure("outcome_unknown")
          if (run.phase == "running") {
            journal.runs.save(run.failed("os_interrupted", clock)); return
          }
          if (run.phase == "waiting") {
            val candidate = run.retried(clock)
            if (candidate == null || candidate.phase != "running") {
              if (candidate != null) journal.runs.save(candidate)
              return
            }
            run = candidate
          } else if (run.phase == "paused" && run.error == "user_pause") run = run.copy(phase = "running", error = null)
          else return
        } else run = WebDavRun(plan.run ?: UUID.randomUUID().toString(), plan.target, plan.binding, true, plan.occurrence)
        plan to run
      }
      val (expected, candidate) = prepared
      val queue = AndroidWebDavRuntime.queue(context)
      if (!queue.available() || !AndroidWebDavRuntime.beginAutomatic(execution, candidate.id) { current(execution) }) {
        AndroidWebDavScheduler.defer(context, expected); return
      }
      try {
        synchronized(AndroidSyncJournal.sourceLock) {
          if (!current(execution) || journal.schedule.read() != expected || !matches(journal, expected)) throw FilesFailure("settings_changed")
          val claimed = expected.copy(run = candidate.id)
          journal.schedule.save(claimed, expected); execution.plan = claimed
          journal.runs.save(candidate)
        }
        if (!current(execution)) throw FilesFailure("os_interrupted")
        queue.start(automatic = true, prior = candidate) { result -> execution.result = result; execution.done.countDown() }
        execution.done.await()
      } catch (failure: Exception) {
        AndroidWebDavRuntime.endAutomatic(execution, interrupt = true)
        val claimed = execution.plan
        if (claimed != null) {
          val stored = journal.runs.read(id = candidate.id) ?: candidate
          execution.result = if (stored.phase == "running") {
            val code = if (execution.stopped.get() || failure is InterruptedException) "os_interrupted" else (failure as? FilesFailure)?.code ?: "automatic_unavailable"
            stored.failed(code, WebDavRun.clock(context)).also { journal.runs.save(it) }
          } else stored
        }
      } finally { AndroidWebDavRuntime.endAutomatic(execution, interrupt = true) }
      val result = execution.result ?: return
      val claimed = execution.plan ?: return
      AndroidWebDavScheduler.finished(context, claimed, result, execution.parameters.extras.getString("token"))
    }
  }
}
