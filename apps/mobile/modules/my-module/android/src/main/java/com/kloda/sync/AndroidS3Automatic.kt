package com.kloda.sync

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle

// Facade only: plan authority lives in SQLite (AndroidS3AutomaticPlan); OS projection has one
// owner (AndroidS3AutomaticCoordinator). A new occurrence never resumes unknown multipart work.
internal object AndroidS3Automatic {
  const val JOB = 2712
  // Android 7.0/7.1 (API 24/25): the S3 job requires BatteryNotLow (API 26) and the constraint is never relaxed,
  // so automatic S3 is unsupported there. Manual S3, stored settings and restore are unaffected.
  internal fun automaticSupported(sdk: Int = Build.VERSION.SDK_INT): Boolean = sdk >= Build.VERSION_CODES.O
  @Volatile private var instance: AndroidS3AutomaticCoordinator? = null
  internal fun next(app: Context, now: Long): Long =
    if (AndroidBackupScheduler.mode(app) == "live") Math.addExact(now, JobInfo.getMinPeriodMillis()) else AndroidBackupScheduler.nextScheduled(app, now)
  fun coordinator(context: Context): AndroidS3AutomaticCoordinator = synchronized(AndroidSyncJournal.sourceLock) {
    instance ?: run {
      val app = context.applicationContext; val queue = AndroidS3Runtime.queue(app); val main = Handler(Looper.getMainLooper())
      AndroidS3AutomaticCoordinator(AndroidS3JobOs(app, ComponentName(app, AndroidS3JobService::class.java)), { main.post(it) },
        { Thread(it, "kloda-s3-schedule").start() }, System::currentTimeMillis, { !AndroidS3Runtime.unlocked(app) },
        S3AutoLease(AndroidS3Runtime::begin, AndroidS3Runtime::end), queue, AndroidS3AutomaticPlan(queue.journal),
        app.getSharedPreferences(AndroidS3AutomaticPlan.LEGACY, 0), { AndroidBackupScheduler.paused(app) }, { next(app, it) }).also { instance = it }
    }
  }
  // Pause/disable revocation: epoch++, wake disarm, exact execution stop, JOB cancel.
  fun cancel(app: Context) {
    if (BuildConfig.KLODA_S3_NATIVE && runCatching { coordinator(app).revoke() }.isSuccess) return
    app.getSystemService(JobScheduler::class.java).cancel(JOB)
  }
  fun reconcileAsync(app: Context, changed: Boolean = false) { Thread({ reconcile(app.applicationContext, changed) }, "kloda-s3-schedule").start() }
  fun reconcile(app: Context, changed: Boolean = false) {
    if (!BuildConfig.KLODA_S3_NATIVE || !automaticSupported()) return
    // An unavailable runtime is not a revocation: no cancel of an already-projected plan.
    runCatching { coordinator(app) }.getOrNull()?.reconcile(changed)
  }
}

// Shared real OS adapter: production uses AndroidS3JobService, the harness only its test service.
internal class AndroidS3JobOs(private val context: Context, private val component: ComponentName) : S3AutoOs {
  private val scheduler get() = context.getSystemService(JobScheduler::class.java)
  override fun schedule(wake: String, nonce: String, latency: Long, protocol: Int): Int {
    // Boundary guard for the API 26 setter below; the coordinator gates API 24/25 earlier, this keeps the constraint unrelaxed.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) throw IllegalStateException("s3_automatic_unsupported")
    return scheduler.schedule(
      JobInfo.Builder(AndroidS3Automatic.JOB, component).setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED).setRequiresBatteryNotLow(true)
        .setPersisted(true).setMinimumLatency(latency).setExtras(PersistableBundle().apply {
          putInt("protocol", protocol); putString("provider", "amazon-s3"); putString("wake", wake); putString("nonce", nonce)
        }).build())
  }
  override fun cancel() = scheduler.cancel(AndroidS3Automatic.JOB)
  override fun pending(): Map<String, Any?>? = scheduler.getPendingJob(AndroidS3Automatic.JOB)?.let { job ->
    if (job.service != component) mapOf("foreign" to job.service.className) else extras(job.extras)
  }
  companion object {
    @Suppress("DEPRECATION")
    fun extras(bundle: PersistableBundle): Map<String, Any?> = bundle.keySet().associateWith { bundle.get(it) }
  }
}

// Thin lifecycle adapter: every decision belongs to the coordinator's exact Execution.
open class AndroidS3JobService : JobService() {
  internal open fun coordinator(): AndroidS3AutomaticCoordinator = AndroidS3Automatic.coordinator(this)
  override fun onStartJob(params: JobParameters): Boolean {
    if (!AndroidS3Automatic.automaticSupported()) return false
    val owner = try { coordinator() } catch (_: Exception) { return false }
    return owner.onStart(params, this, AndroidS3JobOs.extras(params.extras)) { retry -> jobFinished(params, retry) }
  }
  override fun onStopJob(params: JobParameters): Boolean = runCatching { coordinator().onStop(params) }.getOrDefault(false)
  override fun onDestroy() { runCatching { coordinator().onDestroy(this) }; super.onDestroy() }
}
