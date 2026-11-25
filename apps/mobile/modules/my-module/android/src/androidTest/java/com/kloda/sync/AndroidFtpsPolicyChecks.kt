package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.Context
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger

// F1-FTPS FP1 policy rows (next-plan §3; file added by the 16.11 user decision) on the owned disposable test package;
// synthetic denial, not real Keyguard. Reuses LifecycleChecks' owned future-P arming; no new fixture infrastructure.
internal object AndroidFtpsPolicyChecks {
  fun run(i: Instrumentation, group: (String, () -> Unit) -> Unit) {
    group("ftps-fp1-busy-run-kept") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> busyRun(i, app, queue) } }
    group("ftps-fp1-retry-elapsed-budget") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> retry(i, app, queue) } }
    for (case in listOf("busy-defer", "pause", "disable", "revision"))
      group("ftps-fp1-old-wake-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> wake(i, app, queue, case) } }
    group("ftps-fl1-stop-after-decision") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> stopAfterDecision(i, app, queue) } }
    for (case in listOf("finalization", "report", "same-token-b"))
      group("ftps-fs2-stop-held-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> stopHeld(i, app, queue, case) } }
    group("ftps-fs1-destroyed-watch") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> destroyedWatch(i, app, queue) } }
    for (case in listOf("failure", "old-throw", "new-throw"))
      group("ftps-fp2-watch-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> watchFault(i, app, queue, case, null) } }
    // Contract §3 rows 107/108/110 on one genuine WATCH delivery; pending observation is a Recorder double.
    for (owner in listOf("fallback", "closed", "running-null")) group("ftps-fp2-watch-owner-$owner") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> watchFault(i, app, queue, "owner-throw", owner) } }
    for (stage in listOf("read-fail", "trigger-fail")) group("ftps-fp2-watch-$stage") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> readFail(i, app, queue, stage) } }; group("ftps-fp2-watch-unread-throw-storage") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> watchFault(i, app, queue, "unread-throw", "storage") } }
    for (recovery in listOf("clean", "accepted", "unknown", "rejected", "unreadable", "foreign", "delivery", "storage"))
      group("ftps-fp2-watch-null-throw-$recovery") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> watchFault(i, app, queue, "null-throw", recovery) } }
  }

  /**
   * R1 barrier off the arbiter: the callback's first capture waits on [gate], then runs [after]. A real OS stop can make
   * its arbitrated main-thread decision meanwhile; the test never holds the monitor while awaiting the platform.
   */
  internal fun gated(i: Instrumentation, lane: Int, gate: CountDownLatch, after: () -> Unit) {
    AndroidFtpsQueue.captureFault = { gate.await(); after() }; AndroidFtpsLifecycleChecks.held(i, lane, Thread.State.WAITING)
  }

  /**
   * P3-04 worker test point: only the exact A (stage + own [token]) parks, bounded, off arbiter/sourceLock; later callbacks
   * pass. Returns the latch that proves A reached the stage; the closure is reset by `restore()` in each test's finally.
   */
  internal fun worker(stage: String, token: String?, release: CountDownLatch) = CountDownLatch(1).also { reached ->
    AndroidFtpsJob.workerGate = { s, t -> if (s == stage && t == token && reached.count > 0) { reached.countDown(); release.await(30, java.util.concurrent.TimeUnit.SECONDS) } }
  }

  /** Waits until the platform no longer reports [lane] active (after a real `cmd jobscheduler timeout`). */
  internal fun inactive(i: Instrumentation, lane: Int) {
    val deadline = android.os.SystemClock.elapsedRealtime() + 15000
    fun active() = String(AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler get-job-state com.kloda.sync.test $lane")).contains("active")
    while (active() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
    check(!active()) { "OS stop not delivered" }
  }

  /**
   * FL1/FS2 (R1 representative): locked due A has made its completion decision (RETRY) and is held inside its own
   * finish, before that finish reaches the OS, when a real OS stop arrives. The stop must still answer the retry: same
   * P/token JOB pending, no run/attempt; the late finish is no substitute. A next same-token delivery replaces the
   * RETAINED slot instead of being refused as an active duplicate.
   */
  private fun stopAfterDecision(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val entered = CountDownLatch(1); val release = CountDownLatch(1)
    val recorder = object : AndroidFtpsAutomaticChecks.Recorder() {
      override fun finish(service: JobService, params: JobParameters, retry: Boolean) {
        entered.countDown(); release.await(); super.finish(service, params, retry)
      }
    }
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue) // captureFault stays locked.
      val due = System.currentTimeMillis().let { armed.plan.copy(occurrence = it, due = it) }; synchronized(AndroidSyncJournal.sourceLock) { queue.schedule.save(due, armed.plan) }
      AndroidFtpsScheduler.reconcile(app) // Locked: metadata wake carrying the due P (FL1).
      val token = app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null); AndroidFtpsScheduler.os = recorder
      AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")
      check(entered.await(30, java.util.concurrent.TimeUnit.SECONDS)) { "A never reached its own finish" }
      AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler timeout com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")
      // Asynchronous barrier: the platform main stop waits at the arbiter while A's finish is held; then A is released.
      val deadline = android.os.SystemClock.elapsedRealtime() + 5000
      while (android.os.Looper.getMainLooper().thread.state != Thread.State.BLOCKED && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(20)
      release.countDown(); inactive(i, AndroidFtpsScheduler.JOB); AndroidFtpsLifecycleChecks.quiet()
      val state = "finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules} JOB=${pending(app)?.extras}"
      check(recorder.finishes == listOf(AndroidFtpsScheduler.JOB to true) && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) { state }
      check(queue.schedule.read() == due && AndroidFtpsAutomaticChecks.runs(queue) == 0L && AndroidFtpsScheduler.admits()) { "P/run: ${queue.schedule.read()}" }
      check(pending(app)?.extras?.getString("token") == token) { "stop after the decision lost the retry: $state" }
      force(i) { recorder.finishes.size == 2 }
      check(recorder.callbacks.distinct().size == 2 && pending(app)?.extras?.getString("token") == token) { "next delivery: $state" }
    } finally { release.countDown(); AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * FS1/FS2 (R1): the exact current JOB A is gated in its first capture while a real OS stop (`timeout`) asks the retry for
   * the same token. finalization: released A returns without admission (future P) into its completion. report: released
   * A throws into its catch report while B's distinctive error is set. same-token-b: a real B Execution of the retried
   * same token runs (locked) while A is released; every error write is observed. A: no OS call and no write.
   */
  private fun stopHeld(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, case: String) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder(); val gate = CountDownLatch(1); val prefs = app.getSharedPreferences("kloda-sync", 0)
    val written = java.util.concurrent.CopyOnWriteArrayList<String?>()
    val listener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { p, key -> if (key == "ftpsAutomaticError") written += p.getString(key, null) }
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue); val calls = AtomicInteger()
      // A's own capture: open (finalization) or a non-lock failure; any later capture (B) is locked.
      AndroidFtpsScheduler.os = recorder
      gated(i, AndroidFtpsScheduler.JOB, gate) {
        if (calls.incrementAndGet() > 1) throw FtpsFailure("credential_locked")
        if (case != "finalization") throw SecurityException("fs2 A capture failure")
      }
      AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler timeout com.kloda.sync.test ${AndroidFtpsScheduler.JOB}"); inactive(i, AndroidFtpsScheduler.JOB)
      if (case == "same-token-b") {
        prefs.registerOnSharedPreferenceChangeListener(listener); AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")
      } else AndroidFtpsScheduler.report(app, "credential_locked") // B's distinctive state under the retried same token.
      gate.countDown(); val deadline = android.os.SystemClock.elapsedRealtime() + 30000
      while (case == "same-token-b" && recorder.finishes.isEmpty() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
      AndroidFtpsLifecycleChecks.quiet(); i.waitForIdleSync(); val b = if (case == "same-token-b") listOf(AndroidFtpsScheduler.JOB to true) else emptyList()
      check(recorder.finishes == b && recorder.callbacks.size == b.size && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) { "A after stop: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}" }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P changed: ${queue.schedule.read()}" }
      check(prefs.getString("ftpsDispatchToken", null) == armed.token && pending(app)?.extras?.getString("token") == armed.token) { "stopped JOB not retried: ${pending(app)?.extras}" }
      check(AndroidFtpsScheduler.error(app) == "credential_locked" && "automatic_unavailable" !in written) { "B error overwritten: ${AndroidFtpsScheduler.error(app)} writes=$written" }
    } finally { gate.countDown(); prefs.unregisterOnSharedPreferenceChangeListener(listener); AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * FS1 (R1): WATCH A waits before `changed` (P3-04 worker test point, off the arbiter, real JobScheduler delivery); onDestroy
   * retires it while its pending token stays. Released A writes/arms nothing.
   */
  private fun destroyedWatch(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder(); val release = CountDownLatch(1)
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue)
      // Open device for A's own capture (a live A would write the early occurrence); any later capture stays locked.
      val calls = AtomicInteger(); AndroidFtpsQueue.captureFault = { if (calls.incrementAndGet() > 1) throw FtpsFailure("credential_locked") }
      val reached = worker("watch", armed.watchToken, release); AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.WATCH}")
      check(reached.await(30, java.util.concurrent.TimeUnit.SECONDS)) { "WATCH A never reached its test point" }; AndroidFtpsLifecycleChecks.destroy(); AndroidFtpsScheduler.os = recorder
      release.countDown(); AndroidFtpsLifecycleChecks.quiet()
      check(recorder.finishes.isEmpty() && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) { "destroyed WATCH: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}" }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P written: ${queue.schedule.read()}" }
      check(pending(app)?.extras?.getString("token") == armed.token && app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token") == armed.watchToken) { "JOB/WATCH changed: ${pending(app)?.extras}" }
    } finally { release.countDown(); AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * FP2/FW (R2) on the WATCH lane, locked device (P read-only): replacement FAILURE or throw with the exact old WATCH
   * pending → one own finish(true) backoff, no cancel, old WATCH kept; throw after acceptance (exact new) → installed,
   * no finish; throw with nothing pending → unknown: no finish/cancel/second schedule, admission closed and
   * outcome_unknown until the next ordinary reconcile re-observes. JOB/token/P untouched throughout.
   * R2 recovery (fault port kept installed): that ordinary reconcile goes through the same classified OS path:
   * clean/accepted-then-throw → installed; null-throw again → still unknown; FAILURE → rejected; unreadable or foreign
   * pending → blocked, nothing installed. No recovery result finishes, cancels or reports success unless installed.
   */
  private fun watchFault(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, case: String, recovery: String?) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val recorder = object : AndroidFtpsAutomaticChecks.Recorder() {
      @Volatile var recovering = false
      @Volatile var proposed: JobInfo? = null
      @Volatile var previous: JobInfo? = null
      override fun schedule(scheduler: JobScheduler, job: JobInfo): Int {
        if (job.id != AndroidFtpsScheduler.WATCH) return super.schedule(scheduler, job)
        schedules += job.id
        if (!recovering) proposed = job
        when (if (recovering) recovery else case) {
          "clean", "delivery", "closed", "storage" -> return scheduler.schedule(job)
          "failure", "rejected" -> return JobScheduler.RESULT_FAILURE
          "new-throw", "accepted", "unread-throw" -> scheduler.schedule(job)
          "null-throw", "unknown" -> scheduler.cancel(job.id)
        }
        throw IllegalStateException("fp2 watch $case/$recovery")
      }
      override fun pending(scheduler: JobScheduler, id: Int): JobInfo? {
        if ((recovering && recovery == "unreadable") || (case == "unread-throw" && !recovering && proposed != null)) throw IllegalStateException("fp2 unreadable WATCH")
        if (case == "owner-throw") return if (recovering && recovery != "running-null") previous else null // Test double only: the real pending stays A's.
        return super.pending(scheduler, id)
      }
    }
    val release = CountDownLatch(1)
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue) // captureFault stays locked.
      AndroidFtpsScheduler.os = recorder; recorder.previous = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)
      val reached = if (case == "owner-throw") worker("rewatch", armed.watchToken, release) else null
      AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.WATCH}")
      if (case == "owner-throw") { // R2 owner fallback: A parked RUNNING after its rewatch returned UNKNOWN; recovery gives A the REJECTED verdict.
        check(reached!!.await(30, java.util.concurrent.TimeUnit.SECONDS)) { "owner A never returned from rewatch" }
        check(recorder.schedules.size == 1 && !AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) == "outcome_unknown") { "UNKNOWN not reached: schedule=${recorder.schedules} error=${AndroidFtpsScheduler.error(app)}" }
        if (recovery == "closed") { release.countDown(); AndroidFtpsLifecycleChecks.quiet() } // A completes (HOLD, worker-closed) before the recovery.
        recorder.recovering = true; AndroidFtpsQueue.captureFault = null; AndroidFtpsScheduler.reconcile(app) // fallback/running-null: A still RUNNING, no projection/finish/cancel; closed: one replacement.
        check(recorder.schedules.size == (if (recovery == "closed") 2 else 1) && recorder.cancels.isEmpty() && recorder.finishes.isEmpty() && AndroidFtpsScheduler.admits() == (recovery != "running-null") && AndroidFtpsScheduler.error(app) == mapOf("fallback" to "automatic_unavailable", "running-null" to "outcome_unknown")[recovery]) { "recovery: schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes} error=${AndroidFtpsScheduler.error(app)}" }
        release.countDown(); AndroidFtpsLifecycleChecks.quiet(); check(recorder.finishes == (if (recovery == "fallback") listOf(AndroidFtpsScheduler.WATCH to true) else emptyList()) && recorder.cancels.isEmpty() && recorder.schedules.size == (if (recovery == "closed") 2 else 1) && (scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token") == armed.watchToken) == (recovery != "closed")) { "completion: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}" }
        check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P changed" }
        return
      }
      val deadline = android.os.SystemClock.elapsedRealtime() + 30000
      while ((recorder.schedules.isEmpty() || AndroidFtpsAutomaticChecks.busy()) && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
      Thread.sleep(500)
      check(recorder.schedules.isNotEmpty() && !AndroidFtpsAutomaticChecks.busy()) { "WATCH replacement never attempted" }
      val watch = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token"); val finishes = recorder.finishes.filter { it.first == AndroidFtpsScheduler.WATCH }; val error = AndroidFtpsScheduler.error(app)
      val state = "finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules} watch=$watch error=$error admits=${AndroidFtpsScheduler.admits()}"
      check(recorder.cancels.isEmpty() && recorder.schedules == listOf(AndroidFtpsScheduler.WATCH)) { state }
      when (case) {
        "failure", "old-throw" -> check(finishes == listOf(AndroidFtpsScheduler.WATCH to true) && watch == armed.watchToken && error == "automatic_unavailable" && AndroidFtpsScheduler.admits()) { state }
        "new-throw" -> check(finishes.isEmpty() && watch != null && watch != armed.watchToken && error == "credential_locked" && AndroidFtpsScheduler.admits()) { state }
        else -> {
          check(finishes.isEmpty() && (watch == null) == (case != "unread-throw") && !AndroidFtpsScheduler.admits() && error == "outcome_unknown") { state }
          if (recovery == "delivery") {
            // R2 native delivery: the recorded proposed WATCH goes back to the real JobScheduler and is delivered by it; started() is its proof.
            val proposed = checkNotNull(recorder.proposed)
            val reached = worker("watch", proposed.extras.getString("token"), release); recorder.recovering = true // The completion's own rewatch install is a clean one.
              check(scheduler.schedule(proposed) == JobScheduler.RESULT_SUCCESS) { "proposed WATCH not re-installed" }; AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.WATCH}")
              check(reached.await(30, java.util.concurrent.TimeUnit.SECONDS)) { "proposed WATCH never delivered" }
              check(AndroidFtpsScheduler.admits() && recorder.schedules.size == 1 && recorder.cancels.isEmpty() && recorder.finishes.isEmpty()) { "started() did not close the attempt: admits=${AndroidFtpsScheduler.admits()} schedule=${recorder.schedules}" }
            release.countDown(); val end = android.os.SystemClock.elapsedRealtime() + 30000
            while ((recorder.schedules.size < 2 || AndroidFtpsAutomaticChecks.busy()) && android.os.SystemClock.elapsedRealtime() < end) Thread.sleep(50)
            Thread.sleep(500); val next = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token")
            check(!AndroidFtpsAutomaticChecks.busy() && recorder.schedules.size == 2 && recorder.cancels.isEmpty() && recorder.finishes.none { it.first == AndroidFtpsScheduler.WATCH } &&
              next != null && next != armed.watchToken && next != proposed.extras.getString("token") && AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) != "outcome_unknown") { "completion: schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes} next=$next error=${AndroidFtpsScheduler.error(app)}" }
          } else {
          if (recovery == "foreign") scheduler.schedule(JobInfo.Builder(AndroidFtpsScheduler.WATCH, android.content.ComponentName(app, AndroidFtpsJob::class.java))
            .setExtras(android.os.PersistableBundle().apply { putString("token", "fp2-foreign") })
            .apply { armed.uris.forEach { addTriggerContentUri(JobInfo.TriggerContentUri(it.first, it.second)) } }.build())
          // FP2 storage: fresh capture fails (test-only hook, no real vault change) with UNKNOWN open: original code, zero OS calls, owners/P/prefs/UNKNOWN kept.
          recorder.recovering = true; if (recovery == "storage") { AndroidFtpsQueue.captureFault = { throw FilesFailure("storage_failure") }; AndroidFtpsScheduler.reconcile(app); check(recorder.schedules.size == 1 && recorder.cancels.isEmpty() && recorder.finishes.isEmpty() && !AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) == "storage_failure" && scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token") == (if (case == "unread-throw") recorder.proposed?.extras?.getString("token") else null) && pending(app)?.extras?.getString("token") == armed.token && app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null) == armed.token && queue.schedule.read() == armed.plan) { "storage held: schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes} error=${AndroidFtpsScheduler.error(app)} admits=${AndroidFtpsScheduler.admits()}" } }
          AndroidFtpsQueue.captureFault = null // Next ordinary (open) reconcile: a fresh serial arbiter turn re-observes.
          AndroidFtpsScheduler.reconcile(app)
          val next = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH); val admits = AndroidFtpsScheduler.admits()
          val after = "schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes} watch=${next?.extras} error=${AndroidFtpsScheduler.error(app)} admits=$admits"
          check(recorder.cancels.isEmpty() && recorder.finishes.none { it.first == AndroidFtpsScheduler.WATCH } && recorder.schedules.size == (if (recovery == "unreadable" || recovery == "foreign" || case == "unread-throw") 1 else 2)) { after }
          when (recovery) {
            "clean", "accepted", "storage" -> check(admits && AndroidFtpsScheduler.error(app) == null && (case != "unread-throw" || next?.extras?.getString("token") == recorder.proposed?.extras?.getString("token")) && next != null && next.extras.getString("token") != armed.watchToken && next.triggerContentUris.orEmpty().map { it.uri to it.flags }.toSet() == armed.uris) { after }
            "rejected" -> check(admits && AndroidFtpsScheduler.error(app) == "automatic_unavailable" && next == null) { after }
            "foreign" -> check(!admits && AndroidFtpsScheduler.error(app) == "outcome_unknown" && next?.extras?.getString("token") == "fp2-foreign") { after }
            else -> check(!admits && AndroidFtpsScheduler.error(app) == "outcome_unknown" && next == null) { after }
          }
          }
        }
      }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P changed: ${queue.schedule.read()}" }
      check(app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null) == armed.token && pending(app)?.extras?.getString("token") == armed.token) { "JOB/token changed: ${pending(app)?.extras}" }
    } finally { release.countDown(); AndroidFtpsLifecycleChecks.restore() }
  }

  /**
   * R2 §3 no-attempt WATCH read failure (ordinary reconcile, admission open, real JOB+WATCH pending): the unreadable WATCH is neither
   * absence nor revoke authority → original `queue_unavailable`, one read, no install/schedule/finish/cancel, pending/prefs/P/run kept;
   * after the injection ends a clean reconcile keeps the WATCH and clears the error. `read` is a Recorder test double, not an OS fault.
   */
  private fun readFail(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, stage: String) {
    val scheduler = app.getSystemService(JobScheduler::class.java); val prefs = app.getSharedPreferences("kloda-sync", 0)
    val reads = AtomicInteger(); val trigger = stage == "trigger-fail"; var good = ""
    val recorder = object : AndroidFtpsAutomaticChecks.Recorder() {
      @Volatile var failing = false
      override fun pending(scheduler: JobScheduler, id: Int): JobInfo? { if (id == AndroidFtpsScheduler.WATCH) reads.incrementAndGet(); if (failing && id == AndroidFtpsScheduler.WATCH) throw IllegalStateException("fp2 unreadable WATCH"); return super.pending(scheduler, id) }
    }
    try {
      val armed = AndroidFtpsLifecycleChecks.future(app, queue); AndroidFtpsScheduler.os = recorder; AndroidFtpsQueue.captureFault = null
      fun tokens() = listOf(pending(app)?.extras?.getString("token"), scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token"), prefs.getString("ftpsDispatchToken", null))
      val before = tokens(); check(before == listOf(armed.token, armed.watchToken, armed.token) && AndroidFtpsScheduler.admits()) { "precondition $before" }
      // trigger-fail: after the source guard has captured (context/P/JOB unchanged) the one-shot capture hook stores a UUID row with a non-tree reference; only triggers() throws, before any WATCH read.
      good = prefs.getString("directorySources", null)!!; if (trigger) AndroidFtpsQueue.captureFault = { AndroidFtpsQueue.captureFault = null; check(prefs.edit().putString("directorySources", org.json.JSONArray(good).put(org.json.JSONObject().put("id", UUID.randomUUID().toString()).put("reference", "content://fp2/not-a-tree")).toString()).commit()) } else recorder.failing = true; AndroidFtpsScheduler.reconcile(app)
      val state = "reads=${reads.get()} schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes} tokens=${tokens()} error=${AndroidFtpsScheduler.error(app)}"
      check(reads.get() == (if (trigger) 0 else 1) && recorder.schedules.isEmpty() && recorder.cancels.isEmpty() && recorder.finishes.isEmpty() && tokens() == before && AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) == "queue_unavailable") { state }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P/run changed: ${queue.schedule.read()}" }
      recorder.failing = false; if (trigger) check(prefs.edit().putString("directorySources", good).commit()); AndroidFtpsScheduler.reconcile(app)
      check(tokens() == before && recorder.schedules.isEmpty() && recorder.cancels.isEmpty() && AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) == null) { "clean reconcile: schedule=${recorder.schedules} cancel=${recorder.cancels} tokens=${tokens()} error=${AndroidFtpsScheduler.error(app)}" }
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
      check(queue.schedule.read() == claimed && queue.runs.read(id = run.id) == run && AndroidFtpsAutomaticChecks.runs(queue) == 1L) { "busy P/run changed: ${queue.schedule.read()} ${queue.runs.read(id = run.id)}" }
      check(recorder.schedules.isEmpty() && recorder.cancels.isEmpty() && recorder.finishes.all { it == (AndroidFtpsScheduler.JOB to true) }) { "schedule=${recorder.schedules} cancel=${recorder.cancels} finish=${recorder.finishes}" }
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
      val run = FtpsRun(UUID.randomUUID().toString(), armed.plan.target, armed.plan.binding, true, armed.plan.occurrence, phase = "waiting", attempts = 2, error = "lan_unavailable", retryAt = clock.now + 36000000L,
        retryElapsed = clock.elapsed + 60000L, boot = clock.boot)
      synchronized(AndroidSyncJournal.sourceLock) { queue.runs.save(run); queue.schedule.save(armed.plan.copy(run = run.id), armed.plan) }
      AndroidFtpsScheduler.os = recorder
      val locked = AndroidFtpsQueue.captureFault
      AndroidFtpsQueue.captureFault = null // Clock-change reconcile on an open device; a locked one keeps P (FL2).
      AndroidFtpsScheduler.reconcile(app, clockChanged = true)
      AndroidFtpsQueue.captureFault = locked
      val after = checkNotNull(queue.schedule.read())
      check(after.run == run.id && after.occurrence == armed.plan.occurrence && Math.abs(after.due - (clock.now + 60000L)) < 5000L) { "retry P not elapsed-derived: $after (wall retryAt=${run.retryAt})" }
      AndroidFtpsLifecycleChecks.pendingFor(app, after)
      force(i) { recorder.finishes.isNotEmpty() }
      check(queue.schedule.read() == after && queue.runs.read(id = run.id) == run && AndroidFtpsAutomaticChecks.runs(queue) == 1L) { "retry budget/P changed: ${queue.schedule.read()} ${queue.runs.read(id = run.id)}" }
      check(recorder.cancels.isEmpty() && recorder.finishes.all { it == (AndroidFtpsScheduler.JOB to true) }) { "cancel=${recorder.cancels} finish=${recorder.finishes}" }
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
          check(after != null && after.occurrence == now && after.run == null && after.due >= forced + 300000L && recorder.finishes.isEmpty()) { "defer P=$after finish=${recorder.finishes}" }
          AndroidFtpsLifecycleChecks.pendingFor(app, after!!)
        }
        "revision" -> {
          check(after != null && after.binding != due.binding && after.run == null && prefs.getString("ftpsDispatchToken", null) != token) { "revision P=$after" }
          AndroidFtpsLifecycleChecks.pendingFor(app, after!!)
        }
        else -> check(after == due && pending(app) == null && app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.WATCH) == null) { "revoked wake kept: P=$after JOB=${pending(app)?.extras} cancel=${recorder.cancels}" }
      }
    } finally {
      AndroidFtpsRuntime.endAutomatic(foreign)
      prefs.edit().remove("automaticPaused").commit()
      AndroidFtpsLifecycleChecks.restore()
    }
  }
}
