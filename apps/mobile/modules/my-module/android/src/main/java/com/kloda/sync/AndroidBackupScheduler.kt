package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.PersistableBundle
import android.provider.DocumentsContract
import android.provider.MediaStore
import java.util.Calendar

/** OS dispatch only; transfer receipts and attempt budgets stay in the existing journal. */
internal object AndroidBackupScheduler {
  const val JOB = 2702
  const val WATCH = 2703
  private val lock = Any()
  @Volatile private var pauseBarrier = false
  @Volatile private var runtimeError: String? = null
  private fun prefs(context: Context) = context.getSharedPreferences("kloda-sync", 0)
  fun isCurrent(context: Context, token: String?) = token != null && prefs(context).getString("automaticDispatchToken", null) == token
  fun paused(context: Context) = pauseBarrier || prefs(context).getBoolean("automaticPaused", false)
  fun error(context: Context): String? = runtimeError ?: prefs(context).let {
    it.getString("automaticError", null) ?: if (it.getString("automaticExecutionBinding", null) == it.getString("automaticBinding", null))
      it.getString("automaticExecutionError", null) else null
  }
  fun report(context: Context, code: String, binding: String? = null) {
    val editor = prefs(context).edit()
    if (binding == null) editor.putString("automaticError", code)
    else editor.putString("automaticExecutionError", code).putString("automaticExecutionBinding", binding)
    if (!editor.commit()) runtimeError = "storage_failure"
  }
  fun clearExecutionError(context: Context) {
    AndroidBackupNotifications.clearFailure(context)
    if (!prefs(context).edit().remove("automaticExecutionError").remove("automaticExecutionBinding").commit()) runtimeError = "storage_failure"
  }
  fun mode(context: Context): String = prefs(context).let {
    it.getString("backupMode", null) ?: if (it.contains("intervalHours")) "scheduled" else "live"
  }
  fun view(context: Context, value: Map<String, Any>): Map<String, Any> {
    val binding = FilesRunContext.capture(context).binding
    val current = AndroidSyncJournal(context).use { db ->
      val id = db.readableDatabase.rawQuery("SELECT id FROM scheduled_occurrence WHERE context_binding=? ORDER BY occurrence_ms DESC LIMIT 1", arrayOf(binding))
        .use { if (it.moveToFirst()) it.getString(0) else null }
      id?.let { AndroidScheduleJournal(db).find(it) }
    }
    val observed = current?.let { row -> mapOf("automaticRun" to buildMap<String, Any> {
      put("attempts", row.osAttempts); put("updated", row.updated)
      val state = if ((paused(context) && row.phase in setOf("running", "waiting")) ||
        (row.phase == "running" && !AndroidPairingRuntime.hasScheduledLease())) "paused" else row.phase
      put("state", state)
      if (state == "waiting") retryTime(context, row)?.let { put("retryAt", it.toString()) }
      row.error?.let { put("errorCode", it) }
    }) } ?: emptyMap()
    return value + observed + mapOf("automaticPaused" to paused(context), "notificationsEnabled" to AndroidBackupNotifications.enabled(context)) +
      (error(context)?.let { mapOf("automaticError" to it) } ?: emptyMap())
  }

  fun pause(context: Context) {
    pauseBarrier = true
    AndroidPairingRuntime.files?.requestPause()
    val saved = prefs(context).edit().putBoolean("automaticPaused", true).commit()
    try { AndroidWebDavRuntime.pause() }
    finally { context.getSystemService(JobScheduler::class.java).apply { cancel(JOB); cancel(WATCH) }; AndroidWebDavScheduler.cancel(context) }
    if (!saved) throw FilesFailure("automatic_pause_not_saved")
  }
  fun resume(context: Context) {
    pauseBarrier = true
    if (!prefs(context).edit().putBoolean("automaticPaused", false).commit()) throw FilesFailure("storage_failure")
    pauseBarrier = false
    reconcile(context); AndroidWebDavScheduler.reconcile(context)
  }
  fun reconcileAsync(context: Context) { Thread({ reconcile(context.applicationContext) }, "kloda-backup-reconcile").start() }

  fun reconcile(context: Context, clockChanged: Boolean = false) = synchronized(lock) {
    try {
      val scheduler = context.getSystemService(JobScheduler::class.java)
      val binding = FilesRunContext.capture(context)
      if (paused(context) || binding.sources.isEmpty() || !AndroidBackupDestinations.hasEnabledPc(context)) {
        scheduler.cancel(JOB); scheduler.cancel(WATCH)
        return@synchronized
      }
      val preferences = prefs(context)
      val now = System.currentTimeMillis()
      val retained = preferences.getString("automaticBinding", null) == binding.binding
      var due = if (retained && preferences.contains("automaticDue")) preferences.getLong("automaticDue", now)
        else if (mode(context) == "live") now else nextScheduled(context, now)
      var occurrence = if (retained) preferences.getLong("automaticOccurrence", due) else due
      val boot = runCatching { android.provider.Settings.Global.getInt(context.contentResolver, android.provider.Settings.Global.BOOT_COUNT) }.getOrDefault(-1)
      val elapsed = android.os.SystemClock.elapsedRealtime()
      val oldElapsed = preferences.getLong("automaticDueElapsed", -1)
      val missed = retained && (due <= now || (oldElapsed >= 0 && oldElapsed <= elapsed && preferences.getInt("automaticDueBoot", -2) == boot))
      if (retained && preferences.getBoolean("automaticRetry", false) && !AndroidPairingRuntime.hasScheduledLease()) {
        AndroidSyncJournal(context).use { db ->
          AndroidScheduleJournal(db).get(binding.binding, occurrence)?.let { retryTime(context, it) }?.let { due = it }
        }
      }
      if (clockChanged && !AndroidPairingRuntime.hasScheduledLease()) {
        due = if (retained && preferences.getBoolean("automaticRetry", false)) {
          AndroidSyncJournal(context).use { db ->
            AndroidScheduleJournal(db).get(binding.binding, preferences.getLong("automaticOccurrence", due))?.let { retryTime(context, it) } ?: System.currentTimeMillis()
          } ?: System.currentTimeMillis()
        } else if (missed) now else if (mode(context) == "scheduled") nextScheduled(context, now) else now
        if (!preferences.getBoolean("automaticRetry", false) && !missed) occurrence = due
      }
      if (!retained) scheduler.cancel(WATCH)
      val dueElapsed = if (retained && !clockChanged && preferences.getLong("automaticDue", -1) == due && preferences.getInt("automaticDueBoot", -2) == boot)
        preferences.getLong("automaticDueElapsed", elapsed) else Math.addExact(elapsed, (due - now).coerceAtLeast(0))
      val editor = preferences.edit().putString("automaticBinding", binding.binding).putLong("automaticDue", due)
        .putLong("automaticOccurrence", occurrence).putLong("automaticDueElapsed", dueElapsed).putInt("automaticDueBoot", boot)
      if (!retained) editor.putBoolean("automaticRetry", false)
      if (!editor.commit())
        throw FilesFailure("storage_failure")
      val extras = PersistableBundle().apply { putString("binding", binding.binding); putLong("occurrence", occurrence); putLong("dispatch", due); putString("token", java.util.UUID.randomUUID().toString()); putLong("dueElapsed", dueElapsed); putInt("dueBoot", boot) }
      // INTERNET/VALIDATED constraints would reject offline LAN; native route admission decides.
      val job = JobInfo.Builder(JOB, ComponentName(context, AndroidBackupJob::class.java))
        .setExtras(extras).setMinimumLatency((due - now).coerceAtLeast(0))
        .setPersisted(true).build()
      // Replacing an identical active OS job would stop its native worker.
      val pending = scheduler.getPendingJob(JOB)
      if (pending?.extras?.getString("binding") != binding.binding || pending.extras.getLong("dispatch") != due ||
        pending.extras.getString("token") != preferences.getString("automaticDispatchToken", null)) {
        if (!preferences.edit().putString("automaticDispatchToken", extras.getString("token")).commit()) throw FilesFailure("storage_failure")
        if (scheduler.schedule(job) != JobScheduler.RESULT_SUCCESS) throw FilesFailure("automatic_unavailable")
      }
      if (mode(context) == "live") watch(context, binding.sources.values.toSet(), scheduler)
      else scheduler.cancel(WATCH)
      runtimeError = null
      if (!preferences.edit().remove("automaticError").commit()) runtimeError = "storage_failure"
    } catch (_: Exception) {
      report(context, "automatic_unavailable")
    }
  }

  fun retryTime(context: Context, item: ScheduledOccurrence): Long? {
    if (item.phase != "waiting") return null
    val boot = runCatching { android.provider.Settings.Global.getInt(context.contentResolver, android.provider.Settings.Global.BOOT_COUNT) }.getOrNull()
    val elapsed = android.os.SystemClock.elapsedRealtime()
    val deadline = item.retryElapsed ?: return System.currentTimeMillis()
    return if (boot == item.retryBoot && elapsed >= deadline - ScheduledOccurrence.RETRY_MS)
      Math.addExact(System.currentTimeMillis(), (deadline - elapsed).coerceAtLeast(0)) else System.currentTimeMillis()
  }

  fun next(context: Context, binding: String, occurrence: Long, retry: Long?, expectedToken: String?) = synchronized(lock) {
    val preferences = prefs(context)
    if (expectedToken == null || preferences.getString("automaticDispatchToken", null) != expectedToken ||
      preferences.getString("automaticBinding", null) != binding ||
      preferences.getLong("automaticOccurrence", preferences.getLong("automaticDue", -1)) != occurrence) return@synchronized
    val now = System.currentTimeMillis()
    val due = retry ?: if (mode(context) == "live") Math.addExact(now, JobInfo.getMinPeriodMillis()) else nextScheduled(context, now)
    if (!preferences.edit().putLong("automaticDue", due).putLong("automaticOccurrence", if (retry == null) due else occurrence)
        .putBoolean("automaticRetry", retry != null).remove("automaticDueElapsed").remove("automaticDueBoot").commit()) throw FilesFailure("storage_failure")
    // The completed dispatch is no longer active when this is called.
    context.getSystemService(JobScheduler::class.java).cancel(JOB)
    reconcile(context)
  }

  fun changed(context: Context) = synchronized(lock) {
    val preferences = prefs(context)
    if (!paused(context) && mode(context) == "live" && !preferences.getBoolean("automaticRetry", false)
      && AndroidPairingRuntime.files?.running() != true) {
      val now = System.currentTimeMillis()
      if (!preferences.edit().putLong("automaticDue", now).putLong("automaticOccurrence", now).remove("automaticDueElapsed").remove("automaticDueBoot").commit()) throw FilesFailure("storage_failure")
    }
    context.getSystemService(JobScheduler::class.java).cancel(WATCH)
    reconcile(context)
  }

  internal fun watch(context: Context, sources: Set<String>, scheduler: JobScheduler, jobId: Int = WATCH,
    service: Class<out android.app.job.JobService> = AndroidBackupJob::class.java) {
    if (scheduler.getPendingJob(jobId) != null) return
    val job = JobInfo.Builder(jobId, ComponentName(context, service))
      .setExtras(PersistableBundle().apply { putString("token", java.util.UUID.randomUUID().toString()) })
    val uris = sources.flatMap { source ->
      if (AndroidPhotosSources.isPhotos(source)) listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
      else listOf(DocumentsContract.buildChildDocumentsUriUsingTree(Uri.parse(source), DocumentsContract.getTreeDocumentId(Uri.parse(source))))
    }.distinct()
    uris.forEach { job.addTriggerContentUri(JobInfo.TriggerContentUri(it, JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS)) }
    if (uris.isNotEmpty() && scheduler.schedule(job.build()) != JobScheduler.RESULT_SUCCESS) throw FilesFailure("automatic_unavailable")
  }

  internal fun nextScheduled(context: Context, now: Long): Long {
    val preferences = prefs(context)
    val interval = preferences.getInt("intervalHours", 12)
    val time = preferences.getString("localTime", "12:00") ?: throw FilesFailure("queue_unavailable")
    if (interval !in listOf(12, 24) || !Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(time)) throw FilesFailure("queue_unavailable")
    val hour = time.substring(0, 2).toInt() % interval
    val minute = time.substring(3).toInt()
    for (day in 0..1) for (candidate in hour until 24 step interval) {
      val date = Calendar.getInstance().apply {
        timeInMillis = now; add(Calendar.DATE, day); set(Calendar.HOUR_OF_DAY, candidate)
        set(Calendar.MINUTE, minute); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      }
      // Calendar normalizes DST gaps forward; walk to the first valid instant.
      if (date.get(Calendar.HOUR_OF_DAY) != candidate || date.get(Calendar.MINUTE) != minute) {
        val offset = date.get(Calendar.ZONE_OFFSET) + date.get(Calendar.DST_OFFSET)
        while (true) {
          val previous = date.clone() as Calendar; previous.add(Calendar.MINUTE, -1)
          if (previous.get(Calendar.ZONE_OFFSET) + previous.get(Calendar.DST_OFFSET) != offset) break
          date.timeInMillis = previous.timeInMillis
        }
      }
      val zone = date.timeZone
      val delta = kotlin.math.abs(zone.getOffset(date.timeInMillis - 86_400_000L) - zone.getOffset(date.timeInMillis + 86_400_000L))
      if (delta > 0) {
        val earlier = (date.clone() as Calendar).apply { timeInMillis -= delta }
        if (earlier.get(Calendar.DATE) == date.get(Calendar.DATE) && earlier.get(Calendar.HOUR_OF_DAY) == date.get(Calendar.HOUR_OF_DAY)
          && earlier.get(Calendar.MINUTE) == date.get(Calendar.MINUTE)) date.timeInMillis = earlier.timeInMillis
      }
      if (date.timeInMillis > now) return date.timeInMillis
    }
    throw FilesFailure("queue_unavailable")
  }
}
