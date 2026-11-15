package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobScheduler
import android.content.Context
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

// F1-FTPS FP1 policy rows (next-plan §3; file added by the 16.11 user decision) on the owned disposable test package;
// synthetic denial, not real Keyguard. Reuses LifecycleChecks' owned future-P arming; no new fixture infrastructure.
internal object AndroidFtpsPolicyChecks {
  fun run(i: Instrumentation, group: (String, () -> Unit) -> Unit) {
    group("ftps-fp1-busy-run-kept") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> busyRun(i, app, queue) } }
    group("ftps-fp1-retry-elapsed-budget") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> retry(i, app, queue) } }
    for (case in listOf("busy-defer", "pause", "disable", "revision"))
      group("ftps-fp1-old-wake-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> wake(i, app, queue, case) } }
  }

  /** Forces the current JOB through the production Job path; waits until [done] holds and no callback is running. */
  private fun force(i: Instrumentation, done: () -> Boolean) {
    AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")
    val deadline = android.os.SystemClock.elapsedRealtime() + 30000
    while ((!done() || AndroidFtpsAutomaticChecks.busy()) && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
    Thread.sleep(500)
    check(done() && !AndroidFtpsAutomaticChecks.busy()) { "forced JOB did not complete" }
  }

  private fun pending(app: Context) = app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.JOB)

  /**
   * FP1 busy: P.run is a running run held by a live lease → a visible reconcile neither interrupts the run nor touches
   * P/JOB, and a locked JOB callback (pre-admission) produces no run change: only its own OS backoff.
   */
  private fun busyRun(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    val owner = Any()
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue) // captureFault stays locked.
      val run = FtpsRun(UUID.randomUUID().toString(), armed.plan.target, armed.plan.binding, true, armed.plan.occurrence)
      val claimed = armed.plan.copy(run = run.id)
      synchronized(AndroidSyncJournal.sourceLock) { queue.runs.save(run); queue.schedule.save(claimed, armed.plan) }
      check(AndroidFtpsRuntime.beginAutomatic(owner, run.id) { true })
      AndroidFtpsScheduler.os = recorder
      AndroidFtpsScheduler.reconcile(app)
      force(i) { recorder.finishes.isNotEmpty() }
      check(queue.schedule.read() == claimed && queue.runs.read(id = run.id) == run && AndroidFtpsAutomaticChecks.runs(queue) == 1L) {
        "busy P/run changed: ${queue.schedule.read()} ${queue.runs.read(id = run.id)}"
      }
      check(recorder.schedules.isEmpty() && recorder.cancels.isEmpty() && recorder.finishes.all { it == (AndroidFtpsScheduler.JOB to true) }) {
        "schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes}"
      }
      check(pending(app)?.extras?.getString("token") == armed.token) { "busy JOB not kept" }
    } finally { AndroidFtpsRuntime.endAutomatic(owner); AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * FP1 retry + clock: a waiting run keeps occurrence/attempts; an open-device clock-change reconcile derives P.due from
   * the elapsed/boot retry point (wall retryAt deliberately far off), and a locked JOB callback spends no retry budget.
   */
  private fun retry(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue) // captureFault stays locked.
      val clock = FtpsRun.clock(app)
      check(clock.boot != null) { "no boot count" }
      val run = FtpsRun(UUID.randomUUID().toString(), armed.plan.target, armed.plan.binding, true, armed.plan.occurrence,
        phase = "waiting", attempts = 2, error = "lan_unavailable", retryAt = clock.now + 36000000L,
        retryElapsed = clock.elapsed + 60000L, boot = clock.boot)
      synchronized(AndroidSyncJournal.sourceLock) { queue.runs.save(run); queue.schedule.save(armed.plan.copy(run = run.id), armed.plan) }
      AndroidFtpsScheduler.os = recorder
      val locked = AndroidFtpsQueue.captureFault
      AndroidFtpsQueue.captureFault = null // Clock-change reconcile on an open device; a locked one keeps P (FL2).
      AndroidFtpsScheduler.reconcile(app, clockChanged = true)
      AndroidFtpsQueue.captureFault = locked
      val after = checkNotNull(queue.schedule.read())
      check(after.run == run.id && after.occurrence == armed.plan.occurrence && Math.abs(after.due - (clock.now + 60000L)) < 5000L) {
        "retry P not elapsed-derived: $after (wall retryAt=${run.retryAt})"
      }
      AndroidFtpsLifecycleChecks.pendingFor(app, after)
      force(i) { recorder.finishes.isNotEmpty() }
      check(queue.schedule.read() == after && queue.runs.read(id = run.id) == run && AndroidFtpsAutomaticChecks.runs(queue) == 1L) {
        "retry budget/P changed: ${queue.schedule.read()} ${queue.runs.read(id = run.id)}"
      }
      check(recorder.cancels.isEmpty() && recorder.finishes.all { it == (AndroidFtpsScheduler.JOB to true) }) {
        "cancel=${recorder.cancels} finish=${recorder.finishes}"
      }
    } finally { AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * FP1 old wake: due P armed by a locked reconcile (5 min metadata wake, not yet delivered); then busy (foreign lease) /
   * pause / disable / profile revision; the same JOB is forced on an open device. busy → defer (+5 min, occurrence kept)
   * completed by its replacement; pause/disable → no admission, both lanes revoked; revision → no admission on the old
   * binding, fresh P on the new one. No case creates a run.
   */
  private fun wake(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, case: String) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    val prefs = app.getSharedPreferences("kloda-sync", 0)
    val foreign = Any()
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue)
      val now = System.currentTimeMillis()
      val due = armed.plan.copy(occurrence = now, due = now)
      synchronized(AndroidSyncJournal.sourceLock) { queue.schedule.save(due, armed.plan) }
      AndroidFtpsScheduler.reconcile(app) // Locked: metadata wake ≥5 min carrying the due P.
      val token = prefs.getString("ftpsDispatchToken", null)
      check(pending(app)?.extras?.getLong("dispatch", -1) == now && token != armed.token) { "due wake not armed" }
      when (case) {
        "busy-defer" -> check(AndroidFtpsRuntime.beginAutomatic(foreign, "fp1-foreign") { true })
        "pause" -> check(prefs.edit().putBoolean("automaticPaused", true).commit())
        "disable" -> queue.disable()
        else -> {
          val hostname = i.context.assets.open("kloda-ftps16/hostname.txt").bufferedReader().use { it.readText().trim() }
          queue.configure(FtpsTarget("10.0.2.2", 27449, hostname, "/", "probe", "native", "native"), "unused")
        }
      }
      // Open device for the old wake and its completion reconcile; any later natural JOB stays on the locked path.
      val calls = AtomicInteger()
      AndroidFtpsQueue.captureFault = { if (calls.incrementAndGet() > 2) throw FtpsFailure("credential_locked") }
      AndroidFtpsScheduler.os = recorder
      val forced = System.currentTimeMillis()
      force(i) { recorder.cancels.isNotEmpty() || recorder.schedules.isNotEmpty() }
      val after = queue.schedule.read()
      check(AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "old wake admitted a run: P=$after" }
      when (case) {
        "busy-defer" -> {
          check(after != null && after.occurrence == now && after.run == null && after.due >= forced + 300000L && recorder.finishes.isEmpty()) {
            "defer P=$after finish=${recorder.finishes}"
          }
          AndroidFtpsLifecycleChecks.pendingFor(app, after!!)
        }
        "revision" -> {
          check(after != null && after.binding != due.binding && after.run == null && prefs.getString("ftpsDispatchToken", null) != token) { "revision P=$after" }
          AndroidFtpsLifecycleChecks.pendingFor(app, after!!)
        }
        else -> check(after == due && pending(app) == null &&
          app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.WATCH) == null) {
          "revoked wake kept: P=$after JOB=${pending(app)?.extras} cancel=${recorder.cancels}"
        }
      }
    } finally {
      AndroidFtpsRuntime.endAutomatic(foreign)
      prefs.edit().remove("automaticPaused").commit()
      AndroidFtpsLifecycleChecks.restore()
    }
  }
}
