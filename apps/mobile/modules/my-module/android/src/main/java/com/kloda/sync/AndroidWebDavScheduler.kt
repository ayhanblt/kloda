package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle
import java.util.UUID

internal object AndroidWebDavScheduler {
  const val JOB = 2704
  const val WATCH = 2705
  private val lock = Any()
  private fun prefs(context: Context) = context.getSharedPreferences("kloda-sync", 0)
  fun current(context: Context, token: String?) = token != null && token == prefs(context).getString("webdavDispatchToken", null)
  fun error(context: Context): String? = prefs(context).getString("webdavAutomaticError", null)
  fun report(context: Context, code: String?) {
    val edit = prefs(context).edit()
    if (code == null) edit.remove("webdavAutomaticError") else edit.putString("webdavAutomaticError", code)
    if (!edit.commit()) throw FilesFailure("storage_failure")
  }
  fun reportCurrent(context: Context, token: String?, code: String?) = synchronized(lock) {
    if (current(context, token)) report(context, code)
  }
  fun cancel(context: Context) { context.getSystemService(JobScheduler::class.java).apply { cancel(JOB); cancel(WATCH) } }
  fun reconcileAsync(context: Context, clockChanged: Boolean = false) {
    Thread({ reconcile(context.applicationContext, clockChanged) }, "kloda-webdav-reconcile").start()
  }
  private fun next(context: Context, now: Long, previous: Long? = null): Long =
    if (AndroidBackupScheduler.mode(context) == "live") {
      if (previous == null) now else Math.addExact(maxOf(now, previous), JobInfo.getMinPeriodMillis())
    } else AndroidBackupScheduler.nextScheduled(context, maxOf(now, previous ?: now))
  fun reconcile(context: Context, clockChanged: Boolean = false) = synchronized(lock) {
    try {
      if (AndroidBackupScheduler.paused(context)) { cancel(context); return@synchronized }
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        val plan = synchronized(AndroidSyncJournal.sourceLock) source@{
          val header = journal.destination() ?: run { cancel(context); return@source null }
          val sources = FilesRunContext.webdav(context)
          if (sources.sources.isEmpty()) { cancel(context); return@source null }
          val binding = AndroidWebDavContext.binding(header.target, header.revision, sources.binding)
          val clock = WebDavRun.clock(context)
          var plan = journal.schedule.read()?.takeIf { it.target == header.target && it.binding == binding }
          if (plan == null) {
            val due = next(context, clock.now); plan = WebDavPlan(header.target, binding, due, due)
            journal.schedule.save(plan)
          }
          val id = plan.run
          if (id != null) {
            var run = journal.runs.read(id = id)
            if (run != null) {
              if (run.target != plan.target || run.binding != plan.binding || !run.automatic || run.occurrence != plan.occurrence) throw FilesFailure("outcome_unknown")
              if (AndroidWebDavRuntime.hasAutomatic(id)) return@source null
              if (run.phase == "running") { run = run.failed("os_interrupted", clock); journal.runs.save(run) }
              if (run.phase == "waiting") {
                val transition = run.retried(clock)
                if (transition != null && transition.phase != "running") { run = transition; journal.runs.save(run) }
                if (run.phase == "waiting") {
                  val revised = plan.copy(due = Math.addExact(clock.now, maxOf(0, run.retryElapsed!! - clock.elapsed)))
                  journal.schedule.save(revised, plan); plan = revised
                }
              }
              if (run.phase in setOf("finished", "needs_attention", "exhausted") || (run.phase == "paused" && run.error != "user_pause")) {
                val due = next(context, clock.now, plan.occurrence)
                val revised = WebDavPlan(plan.target, plan.binding, due, due)
                journal.schedule.save(revised, plan); plan = revised
              }
            }
          } else if (clockChanged && plan.due > clock.now) {
            val due = next(context, clock.now); val revised = plan.copy(occurrence = due, due = due)
            journal.schedule.save(revised, plan); plan = revised
          }
          plan
        } ?: return@use
        val scheduler = context.getSystemService(JobScheduler::class.java)
        val pending = scheduler.getPendingJob(JOB)
        if (pending?.extras?.getString("binding") != plan.binding || pending.extras.getLong("dispatch") != plan.due ||
          pending.extras.getString("token") != prefs(context).getString("webdavDispatchToken", null)) {
          val token = UUID.randomUUID().toString()
          val extras = PersistableBundle().apply {
            putString("binding", plan.binding); putString("target", plan.target); putLong("occurrence", plan.occurrence)
            putLong("dispatch", plan.due); putString("token", token)
          }
          if (!prefs(context).edit().putString("webdavDispatchToken", token).commit()) throw FilesFailure("storage_failure")
          val job = JobInfo.Builder(JOB, ComponentName(context, AndroidWebDavJob::class.java)).setExtras(extras)
            .setMinimumLatency(maxOf(0, plan.due - System.currentTimeMillis())).setPersisted(true).build()
          if (scheduler.schedule(job) != JobScheduler.RESULT_SUCCESS) throw FilesFailure("automatic_unavailable")
        }
        if (AndroidBackupScheduler.mode(context) == "live") AndroidBackupScheduler.watch(context, FilesRunContext.webdav(context).sources.values.toSet(), scheduler, WATCH, AndroidWebDavJob::class.java)
        else scheduler.cancel(WATCH)
        report(context, null)
      }
    } catch (failure: Exception) {
      cancel(context)
      runCatching { report(context, (failure as? FilesFailure)?.code ?: "automatic_unavailable") }
    }
  }
  fun changed(context: Context) = synchronized(lock) {
    if (AndroidBackupScheduler.paused(context) || AndroidBackupScheduler.mode(context) != "live") return@synchronized
    AndroidSyncJournal.webdav(context).use { owner ->
      val journal = AndroidWebDavJournal(owner.writableDatabase)
      journal.schedule.read()?.takeIf { it.run == null }?.let {
        val now = System.currentTimeMillis(); journal.schedule.save(it.copy(occurrence = now, due = now), it)
      }
    }
    reconcile(context)
  }
  fun defer(context: Context, expected: WebDavPlan) = synchronized(lock) {
    AndroidSyncJournal.webdav(context).use { owner ->
      val schedule = AndroidWebDavJournal(owner.writableDatabase).schedule
      schedule.save(expected.copy(due = Math.addExact(System.currentTimeMillis(), 300000L)), expected)
    }
  }
  fun finished(context: Context, expected: WebDavPlan, result: WebDavRun, token: String?) = synchronized(lock) {
    if (!current(context, token)) return@synchronized
    AndroidSyncJournal.webdav(context).use { owner ->
      val journal = AndroidWebDavJournal(owner.writableDatabase)
      if (journal.runs.read(id = result.id) != result) throw FilesFailure("storage_failure")
      val header = journal.destination() ?: return@use
      if (header.target != expected.target || AndroidWebDavContext.binding(header.target, header.revision, FilesRunContext.webdav(context).binding) != expected.binding) return@use
      val clock = WebDavRun.clock(context)
      val plan = when (result.phase) {
        "waiting" -> expected.copy(due = Math.addExact(clock.now, maxOf(0, result.retryElapsed!! - clock.elapsed)))
        "paused" -> expected
        else -> { val due = next(context, clock.now, expected.occurrence); WebDavPlan(expected.target, expected.binding, due, due) }
      }
      journal.schedule.save(plan, expected)
      report(context, result.error)
    }
  }
}
