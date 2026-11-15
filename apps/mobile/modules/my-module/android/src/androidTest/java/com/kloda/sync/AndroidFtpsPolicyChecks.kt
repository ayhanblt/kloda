package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobInfo
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
    for (case in listOf("finalization", "report"))
      group("ftps-fs2-stop-held-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> stopHeld(i, app, queue, case) } }
    group("ftps-fs1-destroyed-watch") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> destroyedWatch(i, app, queue) } }
    for (case in listOf("failure", "old-throw", "new-throw", "null-throw"))
      group("ftps-fp2-watch-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> watchFault(i, app, queue, case) } }
  }

  /**
   * FS1/FS2 (R1): the exact current JOB A waits at the arbiter while a real OS stop (`timeout`) asks the retry for the same
   * token. finalization: A returned without admission (future P, open capture) and waits in its completion. report: A
   * threw and waits in its catch report while B's distinctive error is set on the same token. Released A: no OS call and
   * no write; the same token/JOB/P stay for the OS retry.
   */
  private fun stopHeld(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, case: String) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue)
      AndroidFtpsQueue.captureFault = if (case == "report") ({ throw SecurityException("fs2 A capture failure") }) else null
      synchronized(AndroidFtpsLifecycleChecks.monitor) {
        AndroidFtpsLifecycleChecks.held(i, AndroidFtpsScheduler.JOB)
        AndroidFtpsScheduler.os = recorder
        AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler timeout com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")
        val deadline = android.os.SystemClock.elapsedRealtime() + 15000
        fun active() = String(AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler get-job-state com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")).contains("active")
        while (active() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
        check(!active()) { "OS stop not delivered" }
        AndroidFtpsScheduler.report(app, "credential_locked") // B's distinctive state under the retried same token.
      }
      AndroidFtpsLifecycleChecks.quiet()
      check(recorder.finishes.isEmpty() && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) {
        "A after stop: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}"
      }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P changed: ${queue.schedule.read()}" }
      check(app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null) == armed.token &&
        pending(app)?.extras?.getString("token") == armed.token) { "stopped JOB not retried: ${pending(app)?.extras}" }
      check(AndroidFtpsScheduler.error(app) == "credential_locked") { "B error overwritten: ${AndroidFtpsScheduler.error(app)}" }
    } finally { AndroidFtpsLifecycleChecks.restore() }
  }

  /** FS1 (R1): WATCH A waits in `changed`; onDestroy retires it while its pending token stays. Released A writes/arms nothing. */
  private fun destroyedWatch(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue)
      // Open device for A's own capture (a live A would write the early occurrence); any later capture stays locked.
      val calls = AtomicInteger()
      AndroidFtpsQueue.captureFault = { if (calls.incrementAndGet() > 1) throw FtpsFailure("credential_locked") }
      synchronized(AndroidFtpsLifecycleChecks.monitor) {
        AndroidFtpsLifecycleChecks.held(i, AndroidFtpsScheduler.WATCH)
        AndroidFtpsLifecycleChecks.destroy()
        AndroidFtpsScheduler.os = recorder
      }
      AndroidFtpsLifecycleChecks.quiet()
      check(recorder.finishes.isEmpty() && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) {
        "destroyed WATCH: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}"
      }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P written: ${queue.schedule.read()}" }
      check(pending(app)?.extras?.getString("token") == armed.token &&
        app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token") == armed.watchToken) {
        "JOB/WATCH changed: ${pending(app)?.extras}"
      }
    } finally { AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * FP2/FW (R2) on the WATCH lane, locked device (P read-only): replacement FAILURE or throw with the exact old WATCH
   * pending → one own finish(true) backoff, no cancel, old WATCH kept; throw after acceptance (exact new) → installed,
   * no finish; throw with nothing pending → unknown: no finish/cancel/second schedule, admission closed and
   * outcome_unknown until the next ordinary reconcile re-observes. JOB/token/P untouched throughout.
   */
  private fun watchFault(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, case: String) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val recorder = object : AndroidFtpsAutomaticChecks.Recorder() {
      override fun schedule(scheduler: JobScheduler, job: JobInfo): Int {
        if (job.id != AndroidFtpsScheduler.WATCH) return super.schedule(scheduler, job)
        schedules += job.id
        if (case == "new-throw") scheduler.schedule(job)
        if (case == "null-throw") scheduler.cancel(job.id)
        if (case == "failure") return JobScheduler.RESULT_FAILURE
        throw IllegalStateException("fp2 watch $case")
      }
    }
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue) // captureFault stays locked.
      AndroidFtpsScheduler.os = recorder
      AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.WATCH}")
      val deadline = android.os.SystemClock.elapsedRealtime() + 30000
      while ((recorder.schedules.isEmpty() || AndroidFtpsAutomaticChecks.busy()) && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
      Thread.sleep(500)
      check(recorder.schedules.isNotEmpty() && !AndroidFtpsAutomaticChecks.busy()) { "WATCH replacement never attempted" }
      val watch = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token")
      val finishes = recorder.finishes.filter { it.first == AndroidFtpsScheduler.WATCH }
      val error = AndroidFtpsScheduler.error(app)
      val state = "finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules} watch=$watch error=$error admits=${AndroidFtpsScheduler.admits()}"
      check(recorder.cancels.isEmpty() && recorder.schedules == listOf(AndroidFtpsScheduler.WATCH)) { state }
      when (case) {
        "failure", "old-throw" -> check(finishes == listOf(AndroidFtpsScheduler.WATCH to true) && watch == armed.watchToken &&
          error == "automatic_unavailable" && AndroidFtpsScheduler.admits()) { state }
        "new-throw" -> check(finishes.isEmpty() && watch != null && watch != armed.watchToken && error == "credential_locked" &&
          AndroidFtpsScheduler.admits()) { state }
        else -> {
          check(finishes.isEmpty() && watch == null && !AndroidFtpsScheduler.admits() && error == "outcome_unknown") { state }
          AndroidFtpsLifecycleChecks.restore()
          AndroidFtpsScheduler.reconcile(app) // Next ordinary (open) reconcile: a fresh serial arbiter turn re-observes.
          check(AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) == null && scheduler.getPendingJob(AndroidFtpsScheduler.WATCH) != null) {
            "unknown WATCH not resolved: admits=${AndroidFtpsScheduler.admits()} error=${AndroidFtpsScheduler.error(app)}"
          }
        }
      }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P changed: ${queue.schedule.read()}" }
      check(app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null) == armed.token &&
        pending(app)?.extras?.getString("token") == armed.token) { "JOB/token changed: ${pending(app)?.extras}" }
    } finally { AndroidFtpsLifecycleChecks.restore() }
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
