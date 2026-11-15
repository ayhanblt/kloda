package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobScheduler
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
  fun reportCurrent(context: Context, token: String?, code: String?) = synchronized(lock) {
    if (current(context, token)) report(context, code)
  }
  fun cancel(context: Context) { context.getSystemService(JobScheduler::class.java).apply { cancel(JOB); cancel(WATCH) } }
  fun reconcileAsync(context: Context, clockChanged: Boolean = false) {
    Thread({ reconcile(context.applicationContext, clockChanged) }, "kloda-ftps-reconcile").start()
  }
  private fun next(context: Context, now: Long, previous: Long? = null): Long =
    if (AndroidBackupScheduler.mode(context) == "live") {
      if (previous == null) now else Math.addExact(maxOf(now, previous), JobInfo.getMinPeriodMillis())
    } else AndroidBackupScheduler.nextScheduled(context, maxOf(now, previous ?: now))
  fun reconcile(context: Context, clockChanged: Boolean = false) = synchronized(lock) {
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
        val pending = scheduler.getPendingJob(JOB)
        if (pending?.extras?.getString("binding") != plan.binding || pending.extras.getLong("dispatch") != plan.due ||
          pending.extras.getString("token") != prefs(context).getString("ftpsDispatchToken", null)) {
          val token = UUID.randomUUID().toString()
          val extras = PersistableBundle().apply {
            putString("binding", plan.binding); putString("target", plan.target); putLong("occurrence", plan.occurrence)
            putLong("dispatch", plan.due); putString("token", token)
          }
          if (!prefs(context).edit().putString("ftpsDispatchToken", token).commit()) throw FilesFailure("storage_failure")
          val job = JobInfo.Builder(JOB, ComponentName(context, AndroidFtpsJob::class.java)).setExtras(extras)
            .setMinimumLatency(maxOf(0, plan.due - System.currentTimeMillis())).setPersisted(true).build()
          if (scheduler.schedule(job) != JobScheduler.RESULT_SUCCESS) throw FilesFailure("automatic_unavailable")
        }
        if (AndroidBackupScheduler.mode(context) == "live") AndroidBackupScheduler.watch(context, FilesRunContext.webdav(context).sources.values.toSet(), scheduler, WATCH, AndroidFtpsJob::class.java)
        else scheduler.cancel(WATCH)
        report(context, null)
      }
    } catch (failure: Exception) {
      cancel(context)
      runCatching { report(context, AndroidFtpsQueue.code(failure)) }
    }
  }
  fun changed(context: Context) = synchronized(lock) {
    if (!AndroidFtpsRuntime.supported()) return@synchronized
    if (AndroidBackupScheduler.paused(context) || AndroidBackupScheduler.mode(context) != "live") return@synchronized
    run {
      val queue = AndroidFtpsRuntime.queue(context)
      val journal = queue.journal
      queue.schedule.read()?.takeIf { it.run == null }?.let {
        val now = System.currentTimeMillis(); queue.schedule.save(it.copy(occurrence = now, due = now), it)
      }
    }
    reconcile(context)
  }
  fun defer(context: Context, expected: FtpsPlan) = synchronized(lock) {
    run {
      val schedule = AndroidFtpsRuntime.queue(context).schedule
      schedule.save(expected.copy(due = Math.addExact(System.currentTimeMillis(), 300000L)), expected)
    }
  }
  fun finished(context: Context, expected: FtpsPlan, result: FtpsRun, token: String?) = synchronized(lock) {
    if (!current(context, token)) return@synchronized
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
