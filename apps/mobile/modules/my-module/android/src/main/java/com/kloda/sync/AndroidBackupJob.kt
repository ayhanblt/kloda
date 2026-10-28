package com.kloda.sync

import android.app.job.JobParameters
import android.app.job.JobService
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/** JobScheduler owns this execution opportunity; it never launches a background FGS. */
class AndroidBackupJob : JobService() {
  private class Execution(val parameters: JobParameters) {
    val stopped = AtomicBoolean(false)
    var binding: String? = null
    var occurrence = -1L
    var retry: Long? = null
  }
  private val executions = java.util.concurrent.ConcurrentHashMap<Int, Execution>()

  override fun onStartJob(params: JobParameters): Boolean {
    val execution = Execution(params)
    if (executions.putIfAbsent(params.jobId, execution) != null) return false
    Thread({
      try {
        if (params.jobId == AndroidBackupScheduler.WATCH) AndroidBackupScheduler.changed(applicationContext)
        else execute(execution)
      } catch (_: Throwable) {
        AndroidBackupScheduler.report(applicationContext, "automatic_unavailable", execution.binding)
      } finally {
        executions.remove(params.jobId, execution)
        if (!execution.stopped.get()) jobFinished(params, false)
        execution.binding?.let { binding ->
          if (!AndroidBackupScheduler.paused(applicationContext)) runCatching { AndroidBackupScheduler.next(applicationContext, binding, execution.occurrence, execution.retry, params.extras.getString("token")) }
            .onFailure { AndroidBackupScheduler.report(applicationContext, "automatic_unavailable", binding) }
        }
      }
    }, "kloda-scheduled-backup").start()
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    executions[params.jobId]?.takeIf { it.parameters.extras.getString("token") == params.extras.getString("token") }?.let {
      executions.remove(params.jobId, it)
      it.stopped.set(true)
      AndroidPairingRuntime.endScheduled(it, interrupt = true)
    }
    return false
  }

  override fun onDestroy() {
    executions.values.forEach { it.stopped.set(true); AndroidPairingRuntime.endScheduled(it, interrupt = true) }
    executions.clear()
    super.onDestroy()
  }

  private fun execute(execution: Execution) {
    val context = applicationContext
    val binding = execution.parameters.extras.getString("binding") ?: return
    val occurrence = execution.parameters.extras.getLong("occurrence", -1)
    if (occurrence < 0) return
    execution.binding = binding; execution.occurrence = occurrence
    var retained: ScheduledOccurrence? = null
    val database = AndroidSyncJournal(context)
    val schedules = AndroidScheduleJournal(database)
    val boot = runCatching { Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT) }.getOrNull()
    try {
      val queue = synchronized(AndroidPairingRuntime.lock) {
        if (execution.stopped.get() || AndroidBackupScheduler.paused(context) ||
          !AndroidBackupScheduler.isCurrent(context, execution.parameters.extras.getString("token")) || FilesRunContext.capture(context).binding != binding) return
        val queue = AndroidPairingRuntime.queue(context)
        if (queue.running() || AndroidPairingRuntime.hasScheduledLease()) {
          execution.retry = System.currentTimeMillis() + 300_000L
          return
        }
        val owner = AndroidPairingRuntime.currentOwner(context)
        val peer = JSONObject(KlodaPairingJni.status(owner))
        if (peer.optString("phase") != "complete" || peer.optBoolean("repairRequired", true)) throw FilesFailure("pairing_required")
        if (!AndroidBackupScheduler.isCurrent(context, execution.parameters.extras.getString("token"))) return
        val record = peer.getString("recordId")
        var old = schedules.get(binding, occurrence)
        if (old != null && old.record != record) throw FilesFailure("settings_changed")
        if (old != null && schedules.reconcileLinked(old.id, old.osAttempts)) return
        if (old?.phase == "running") {
          schedules.recoverStopped(old.id, true, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot, old.osAttempts)
          old = schedules.find(old.id)
        }
        retained = if (old?.phase == "paused") schedules.resumePaused(old.id, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot)
          else schedules.claim(binding, record, occurrence, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot,
            dueByElapsed = boot != null && execution.parameters.extras.getInt("dueBoot", -1) == boot &&
              execution.parameters.extras.getLong("dueElapsed", Long.MAX_VALUE) <= SystemClock.elapsedRealtime())
        val claim = retained ?: run {
          val observed = schedules.get(binding, occurrence)
          execution.retry = observed?.let { AndroidBackupScheduler.retryTime(context, it) }
          return
        }
        if (!AndroidPairingRuntime.beginScheduled(execution)) throw FilesFailure("backup_busy")
        if (execution.stopped.get() || AndroidBackupScheduler.paused(context)) throw FilesFailure("paused")
        val started = queue.start(record, owner, expectedBinding = binding)
        @Suppress("UNCHECKED_CAST") val run = started["run"] as? Map<String, Any> ?: throw FilesFailure("outcome_unknown")
        schedules.attachRun(claim.id, run["id"] as String, claim.osAttempts)
        queue
      }
      AndroidBackupNotifications.progress(context)
      try { queue.awaitStopped() } finally { AndroidBackupNotifications.clear(context) }
      val claim = retained ?: return
      if (execution.stopped.get() || AndroidBackupScheduler.paused(context)) {
        schedules.stop(claim.id, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot, claim.osAttempts,
          userPause = AndroidBackupScheduler.paused(context), error = if (AndroidBackupScheduler.paused(context)) "paused" else "os_interrupted")
      } else {
        if (schedules.reconcileLinked(claim.id, claim.osAttempts)) {
          val result = schedules.find(claim.id)
          if (result != null && result.error == null) AndroidBackupScheduler.clearExecutionError(context)
          else result?.error?.let { AndroidBackupScheduler.report(context, it, binding); AndroidBackupNotifications.failure(context) }
        } else schedules.finish(claim.id, false, claim.osAttempts, "outcome_unknown")
      }
    } catch (error: Exception) {
      val code = (error as? FilesFailure)?.code ?: "automatic_unavailable"
      retained?.let {
        if (execution.stopped.get() || AndroidBackupScheduler.paused(context)) schedules.stop(it.id, System.currentTimeMillis(),
          SystemClock.elapsedRealtime(), boot, it.osAttempts, userPause = AndroidBackupScheduler.paused(context), error = code)
        else schedules.finish(it.id, false, it.osAttempts, code)
      }
      AndroidBackupScheduler.report(context, code, binding)
      if (code !in setOf("pairing_required", "paused", "backup_busy", "candidate_stale")) AndroidBackupNotifications.failure(context)
    } finally {
      AndroidPairingRuntime.endScheduled(execution)
      retained?.let {
        val result = schedules.find(it.id)
        execution.retry = result?.let { AndroidBackupScheduler.retryTime(context, it) }
      }
      database.close()
    }
  }
}
