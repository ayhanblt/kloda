package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.content.ComponentName
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import java.io.File
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

// Test-only service in the disposable test manifest; every lifecycle decision goes through the
// same coordinator/OS adapter as production. It never touches the production singleton or vault.
class AndroidS3HarnessJobService : AndroidS3JobService() {
  internal override fun coordinator(): AndroidS3AutomaticCoordinator = installed ?: throw IllegalStateException("harness not installed")
  override fun onStartJob(params: JobParameters): Boolean = super.onStartJob(params).also { events.add("start:$it") }
  override fun onStopJob(params: JobParameters): Boolean = super.onStopJob(params).also { events.add("stop:$it") }
  companion object {
    @Volatile internal var installed: AndroidS3AutomaticCoordinator? = null
    internal val events = LinkedBlockingQueue<String>()
  }
}

// Recording decorator over the real OS adapter: barriers only, never a different decision.
private class S3RecordingOs(private val real: AndroidS3JobOs) : S3AutoOs {
  val events = LinkedBlockingQueue<String>()
  override fun schedule(wake: String, nonce: String, latency: Long, protocol: Int) = real.schedule(wake, nonce, latency, protocol).also { events.add("schedule:$it:$latency") }
  override fun cancel() { real.cancel(); events.add("cancel") }
  override fun pending() = real.pending()
}

internal object AndroidS3AutomaticOsChecks {
  private fun take(queue: LinkedBlockingQueue<String>, expected: String) {
    val value = queue.poll(30, TimeUnit.SECONDS) ?: error("timeout waiting for $expected")
    check(value == expected) { "expected $expected, got $value" }
  }
  fun run(instrumentation: Instrumentation, root: File) {
    val installed = instrumentation.targetContext.applicationContext
    check(installed.packageName == "com.kloda.sync.test" && android.os.Build.HARDWARE in setOf("ranchu", "goldfish"))
    val scheduler = installed.getSystemService(JobScheduler::class.java)
    check(scheduler.getPendingJob(AndroidS3Automatic.JOB) == null)
    val component = ComponentName(installed, AndroidS3HarnessJobService::class.java)
    // Production wiring stays the real service; the harness only swaps the ComponentName.
    check(ComponentName(installed, AndroidS3JobService::class.java).className == "com.kloda.sync.AndroidS3JobService")
    val os = S3RecordingOs(AndroidS3JobOs(installed, component)); val main = Handler(Looper.getMainLooper())
    val events = AndroidS3HarnessJobService.events; events.clear()
    fun force() = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(
      "cmd jobscheduler run -f com.kloda.sync.test ${AndroidS3Automatic.JOB}")).use { it.readBytes() }
    fun pending() = scheduler.getPendingJob(AndroidS3Automatic.JOB)!!.also { check(it.service == component && it.isPersisted) }
    S3AutoFixture(instrumentation, root, "os").use { f ->
      try {
        f.authorize()
        val c = AndroidS3AutomaticCoordinator(os, { main.post(it) }, { Thread(it, "kloda-s3-harness").start() }, f.now::get, f.deny::get,
          S3AutoLease({ owner -> f.lease.compareAndSet(null, owner) }, { owner -> f.lease.compareAndSet(owner, null) }),
          f.queue, f.plan, f.legacy, f.paused::get) { it + S3_HOUR }
        AndroidS3HarnessJobService.installed = c
        c.reconcile(); take(os.events, "schedule:1:$S3_HOUR"); instrumentation.waitForIdleSync()
        val p0 = f.plan.current()!!
        pending().let { check(it.extras.getInt("protocol") == 1 && it.extras.getString("wake") == p0.wake && it.minLatencyMillis == S3_HOUR) }
        // Locked delivery: deferred replacement, same occurrence/due, run/accept=0, no jobFinished.
        f.now.set(p0.due); f.deny.set(true); val nonce0 = pending().extras.getString("nonce")
        force(); take(events, "start:true"); take(os.events, "schedule:1:$S3_DEFER")
        take(events, "stop:false")
        val deferred = pending(); instrumentation.waitForIdleSync()
        check(deferred.extras.getString("wake") == p0.wake && deferred.extras.getString("nonce") != nonce0 && deferred.minLatencyMillis == S3_DEFER)
        check(f.plan.current() == p0.copy(retry = p0.due + S3_DEFER) && f.count("s3_run") == 0 && f.count("s3_auto_accept") == 0)
        // Old onStop did not erase the new projection; early delivery after unlock-deny removal is rejected.
        f.deny.set(false)
        force(); take(events, "start:true"); take(os.events, "schedule:1:$S3_DEFER"); take(events, "stop:false")
        check(f.count("s3_run") == 0 && f.lease.get() == null && f.held.isEmpty())
        // Synthetic instance clock at eligibleAt: one acceptance, held worker, then exact pause -> next projection.
        f.now.set(p0.due + S3_DEFER); force(); take(events, "start:true")
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
        while (f.held.isEmpty()) { check(System.nanoTime() < deadline) { "no admission" }; Thread.yield() }
        check(f.count("s3_auto_accept") == 1 && os.events.isEmpty())
        f.queue.pauseAutomatic(f.lease.get()!!, null); take(os.events, "schedule:1:$S3_HOUR"); take(events, "stop:false")
        instrumentation.waitForIdleSync()
        check(f.latest().error == "os_interrupted" && f.count("s3_auto_accept") == 1 && pending().minLatencyMillis == S3_HOUR)
        check(f.plan.current()!!.let { it.occurrence != p0.occurrence && it.wake == p0.wake && it.retry == null })
        // Explicit clock under OSOwned: one replacement JOB, same wake, new nonce/occurrence/due; then a current
        // early delivery captures nothing and the replaced execution's stop is a no-op.
        val q = f.plan.current()!!; val nonce1 = pending().extras.getString("nonce"); f.now.addAndGet(60_000)
        c.reconcile(true); take(os.events, "schedule:1:$S3_HOUR"); instrumentation.waitForIdleSync(); val q2 = f.plan.current()!!
        check(q2.wake == q.wake && q2.occurrence != q.occurrence && q2.due == f.now.get() + S3_HOUR && q2.retry == null && !c.clockPending)
        pending().let { check(it.extras.getString("wake") == q.wake && it.extras.getString("nonce") != nonce1 && it.minLatencyMillis == S3_HOUR) }
        f.reads.set(0); force(); take(events, "start:true"); take(os.events, "schedule:1:$S3_HOUR"); take(events, "stop:false")
        check(f.reads.get() == 0 && f.plan.current() == q2 && f.count("s3_auto_accept") == 1 && f.lease.get() == null && os.events.isEmpty())
        // Exact revocation: wake disarmed and JOB cancelled; a later forced delivery is impossible.
        c.revoke(); take(os.events, "cancel"); instrumentation.waitForIdleSync()
        check(scheduler.getPendingJob(AndroidS3Automatic.JOB) == null && f.plan.current()!!.wake == null && events.isEmpty())
      } finally {
        AndroidS3HarnessJobService.installed = null
        if (scheduler.getPendingJob(AndroidS3Automatic.JOB)?.service == component) scheduler.cancel(AndroidS3Automatic.JOB)
      }
    }
  }
}
