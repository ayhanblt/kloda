package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle
import java.util.UUID

// A new scheduled occurrence never resumes an unknown multipart operation.
internal object AndroidS3Automatic {
  const val JOB = 2712
  private val lock = Any()
  private fun prefs(app: Context) = app.getSharedPreferences("kloda-s3-automatic", 0)
  fun current(app: Context, token: String) = prefs(app).getString("dispatch", null) == token
  fun cancel(app: Context) { app.getSystemService(JobScheduler::class.java).cancel(JOB) }
  fun reconcileAsync(app: Context, changed: Boolean = false) { Thread({ reconcile(app.applicationContext, changed) }, "kloda-s3-schedule").start() }
  private fun next(app: Context, now: Long): Long = if (AndroidBackupScheduler.mode(app) == "live") Math.addExact(now, JobInfo.getMinPeriodMillis()) else AndroidBackupScheduler.nextScheduled(app, now)
  fun reconcile(app: Context, changed: Boolean = false) = synchronized(lock) {
    if (!BuildConfig.KLODA_S3_NATIVE) return@synchronized
    try {
      if (AndroidBackupScheduler.paused(app)) { cancel(app); return@synchronized }
      val queue = AndroidS3Runtime.queue(app)
      val binding = synchronized(AndroidSyncJournal.sourceLock) {
        val capture = queue.profiles.capture()
        if (capture == null || !queue.journal.enabled() || !queue.journal.automatic() || FilesRunContext.webdav(app).sources.isEmpty()) null
        else S3Target.hash(capture.profile.target.profileGeneration + FilesRunContext.webdav(app).binding)
      } ?: run { cancel(app); return@synchronized }
      val store = prefs(app); val now = System.currentTimeMillis(); val old = store.getLong("due", -1)
      val due = if (changed || old < 0 || store.getString("binding", null) != binding) next(app, now) else old
      val token = UUID.randomUUID().toString()
      if (!store.edit().putLong("due", due).putString("binding", binding).putString("dispatch", token).commit()) throw S3Failure("storage_failure")
      val info = JobInfo.Builder(JOB, ComponentName(app, AndroidS3JobService::class.java))
        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED).setRequiresBatteryNotLow(true).setPersisted(true)
        .setMinimumLatency(maxOf(0, due - now)).setExtras(PersistableBundle().apply { putString("token", token) }).build()
      if (app.getSystemService(JobScheduler::class.java).schedule(info) != JobScheduler.RESULT_SUCCESS) throw S3Failure("automatic_unavailable")
    } catch (_: Exception) { cancel(app) }
  }
  fun consume(app: Context, token: String): Boolean = synchronized(lock) {
    if (!current(app, token) || System.currentTimeMillis() < prefs(app).getLong("due", Long.MAX_VALUE)) return@synchronized false
    if (!prefs(app).edit().putLong("due", next(app, System.currentTimeMillis())).remove("dispatch").commit()) throw S3Failure("storage_failure")
    true
  }
}

class AndroidS3JobService : JobService() {
  private val alive = java.util.concurrent.atomic.AtomicBoolean(false)
  private var token: String? = null
  override fun onStartJob(params: JobParameters): Boolean {
    val request = params.extras.getString("token") ?: return false
    if (!AndroidS3Automatic.current(this, request) || !AndroidS3Runtime.begin(request)) return false
    token = request; alive.set(true)
    Thread({
      try {
        if (!alive.get() || !AndroidS3Automatic.consume(this, request)) { finish(params, request); return@Thread }
        val queue = AndroidS3Runtime.queue(this)
        if (!alive.get()) { finish(params, request); return@Thread }
        queue.start(automatic = true) { finish(params, request) }
      } catch (_: Exception) { finish(params, request) }
    }, "kloda-s3-os-job").start()
    return true
  }
  private fun finish(params: JobParameters, request: String) {
    AndroidS3Runtime.end(request)
    if (alive.compareAndSet(true, false)) { AndroidS3Automatic.reconcileAsync(this); jobFinished(params, false) }
  }
  override fun onStopJob(params: JobParameters): Boolean {
    alive.set(false); token?.let(AndroidS3Runtime::end); AndroidS3Runtime.stop(); AndroidS3Automatic.reconcileAsync(this); return false
  }
}
