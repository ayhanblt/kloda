package com.kloda.sync

import android.app.Instrumentation
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.Context
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

// F1-FTPS FW/FS/FP lifecycle rows (next-plan §3) on the owned disposable test package; synthetic denial, not real Keyguard.
internal object AndroidFtpsLifecycleChecks {
  fun run(i: Instrumentation, group: (String, () -> Unit) -> Unit) {
    group("ftps-fw1-locked-watch-keeps-plan") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> lockedWatch(i, app, queue) } }
    group("ftps-fw2-open-watch-valid-early") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> validWatch(i, app, queue) } }
    group("ftps-fw2-open-watch-capture-fail") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> failedCapture(i, app, queue) } }
    group("ftps-fw2-open-watch-cas-mismatch") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> casMismatch(i, app, queue) } }
    group("ftps-fw2-open-watch-claimed-run") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> claimedWatch(i, app, queue) } }
    for (branch in listOf("finally", "throw", "locked", "defer", "watch", "result", "destroy"))
      group("ftps-fs1-stale-$branch-keeps-b") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> staleOrigin(i, app, queue, branch) } }
    group("ftps-fs2-os-stop-locked-retry") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> osStop(i, app, queue) } }
    for (case in listOf("failure", "old-throw", "new-throw", "null-throw", "null-pause", "storage"))
      group("ftps-fp2-$case") { AndroidFtpsAutomaticChecks.owned(i) { app, queue -> osFault(app, queue, case) } }
  }

  /**
   * FP2/§OS on a visible reconcile that must replace the armed JOB (P moved +10 min): FAILURE / exact-old throw → previous
   * token restored, fail-closed error, no success; exact-new throw → installed; null throw → unresolved, no second OS
   * call, admission closed until the next reconcile reprojects or pause (FP1) revokes it; plan storage fail → fail-closed.
   */
  private fun osFault(app: Context, queue: AndroidFtpsQueue, case: String) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val prefs = app.getSharedPreferences("kloda-sync", 0)
    val calls = CopyOnWriteArrayList<String>()
    try {
      val armed = future(app, queue)
      AndroidFtpsQueue.captureFault = null
      val moved = armed.plan.copy(occurrence = armed.plan.due + 600000L, due = armed.plan.due + 600000L)
      synchronized(AndroidSyncJournal.sourceLock) { queue.schedule.save(moved, armed.plan) }
      if (case == "storage") queue.journal.database.execSQL("CREATE TEMP TRIGGER fp2_storage BEFORE UPDATE ON main.ftps_plan BEGIN SELECT RAISE(ABORT, 'fp2'); END")
      AndroidFtpsScheduler.os = object : AndroidFtpsScheduler.Os() {
        override fun cancel(context: Context, id: Int) { calls += "cancel$id"; super.cancel(context, id) }
        override fun schedule(scheduler: JobScheduler, job: JobInfo): Int {
          calls += "schedule${job.id}"
          if (job.id != AndroidFtpsScheduler.JOB) return super.schedule(scheduler, job)
          if (case == "new-throw") super.schedule(scheduler, job)
          if (case.startsWith("null")) scheduler.cancel(job.id)
          if (case == "failure") return JobScheduler.RESULT_FAILURE
          throw IllegalStateException("fp2 $case")
        }
      }
      AndroidFtpsScheduler.reconcile(app, clockChanged = case == "storage")
      val pending = scheduler.getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getString("token")
      val token = prefs.getString("ftpsDispatchToken", null)
      when (case) {
        "failure", "old-throw" -> check(token == armed.token && (pending == null || pending == armed.token) &&
          calls.count { it == "schedule${AndroidFtpsScheduler.JOB}" } == 1 && AndroidFtpsScheduler.error(app) == "automatic_unavailable") {
          "token=$token pending=$pending calls=$calls error=${AndroidFtpsScheduler.error(app)}" }
        "new-throw" -> { check(token != armed.token && pending == token && AndroidFtpsScheduler.admits() && AndroidFtpsScheduler.error(app) == null) {
          "token=$token pending=$pending error=${AndroidFtpsScheduler.error(app)}" }; pendingFor(app, moved) }
        "storage" -> check(queue.schedule.read() == moved && pending == null && token == armed.token && calls.none { it.startsWith("schedule") } &&
          AndroidFtpsScheduler.error(app) == "storage_failure") { "P=${queue.schedule.read()} pending=$pending calls=$calls error=${AndroidFtpsScheduler.error(app)}" }
        else -> {
          check(calls == listOf("schedule${AndroidFtpsScheduler.JOB}") && !AndroidFtpsScheduler.admits() &&
            AndroidFtpsScheduler.error(app) == "outcome_unknown") { "calls=$calls admits=${AndroidFtpsScheduler.admits()} error=${AndroidFtpsScheduler.error(app)}" }
          AndroidFtpsScheduler.os = AndroidFtpsScheduler.Os()
          if (case == "null-pause") prefs.edit().putBoolean("automaticPaused", true).commit()
          AndroidFtpsScheduler.reconcile(app)
          check(AndroidFtpsScheduler.admits()) { "unresolved not retired" }
          if (case == "null-pause") check(scheduler.getPendingJob(AndroidFtpsScheduler.JOB) == null && scheduler.getPendingJob(AndroidFtpsScheduler.WATCH) == null) { "pause kept wake" }
          else { check(AndroidFtpsScheduler.error(app) == null) { "error=${AndroidFtpsScheduler.error(app)}" }; pendingFor(app, moved) }
        }
      }
      check(AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "runs=${AndroidFtpsAutomaticChecks.runs(queue)}" }
    } finally {
      queue.journal.database.execSQL("DROP TRIGGER IF EXISTS temp.fp2_storage")
      prefs.edit().remove("automaticPaused").commit()
      restore()
    }
  }

  /** Test-only barrier: holding the Scheduler arbiter monitor stops a callback at its first arbitrated decision. */
  internal val monitor: Any = AndroidFtpsScheduler::class.java.getDeclaredField("lock").apply { isAccessible = true }.get(null)!!

  /** FS1 destroy: production onDestroy of the live JobService instance (ActivityThread.mServices lookup); synthetic call, not an OS kill. */
  internal fun destroy() {
    val thread = Class.forName("android.app.ActivityThread").getMethod("currentActivityThread").invoke(null)
    val services = thread.javaClass.getDeclaredField("mServices").apply { isAccessible = true }.get(thread) as Map<*, *>
    services.values.filterIsInstance<AndroidFtpsJob>().single().onDestroy()
  }

  internal fun held(i: Instrumentation, lane: Int) {
    AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test $lane")
    val deadline = android.os.SystemClock.elapsedRealtime() + 30000
    fun blocked() = Thread.getAllStackTraces().keys.any { it.name == "kloda-ftps-job" && it.state == Thread.State.BLOCKED }
    while (!blocked() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(20)
    check(blocked()) { "callback never reached the arbiter" }
  }

  internal fun quiet() {
    val deadline = android.os.SystemClock.elapsedRealtime() + 30000
    Thread.sleep(500)
    while (AndroidFtpsAutomaticChecks.busy() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
    Thread.sleep(500)
    check(!AndroidFtpsAutomaticChecks.busy()) { "callback still running" }
  }

  /**
   * FS1: A = own JOB (finally/throw/locked/defer/result=claimed-run completion/destroy) or WATCH callback held at its
   * first arbitrated decision; B = newer
   * projection (P, JOB token, WATCH, distinctive error) installed meanwhile, which also OS-stops A. Released A may do only
   * its own cleanup: B's P/token/error/JOB/WATCH and a foreign lease unchanged; A makes no finish/cancel/schedule.
   */
  private fun staleOrigin(i: Instrumentation, app: Context, queue: AndroidFtpsQueue, branch: String) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val prefs = app.getSharedPreferences("kloda-sync", 0)
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    val foreign = Any()
    try {
      val armed = future(app, queue)
      var start = armed.plan
      val due = branch == "defer" || branch == "result"
      if (due) { // Due P re-armed by a locked reconcile (5 min wake); defer: A's admission meets a foreign lease.
        val now = System.currentTimeMillis(); start = armed.plan.copy(occurrence = now, due = now)
        synchronized(AndroidSyncJournal.sourceLock) { queue.schedule.save(start, armed.plan) }
        AndroidFtpsScheduler.reconcile(app)
        if (branch == "defer") check(AndroidFtpsRuntime.beginAutomatic(foreign, "fs1-foreign") { true })
      }
      AndroidFtpsQueue.captureFault = when (branch) {
        "throw", "destroy" -> { { throw SecurityException("fs1 A capture failure") } }
        "locked" -> { { throw FtpsFailure("credential_locked") } }
        else -> null // result: A claims P and completes its run with a recorded result (no fixture server) → finished().
      }
      var bRun: FtpsRun? = null
      val (b, bToken, bWatch) = synchronized(monitor) {
        held(i, if (branch == "watch") AndroidFtpsScheduler.WATCH else AndroidFtpsScheduler.JOB)
        if (branch == "destroy") destroy() // A held in its catch report, still a registered Execution.
        val next = if (due) start else armed.plan.copy(occurrence = armed.plan.due + 600000L, due = armed.plan.due + 600000L)
        if (next != start) synchronized(AndroidSyncJournal.sourceLock) { queue.schedule.save(next, start) }
        // B: the WATCH lane gets a fresh WATCH (open reconcile); JOB lanes a locked metadata wake. Both OS-stop A.
        AndroidFtpsScheduler.os.cancel(app, if (branch == "watch") AndroidFtpsScheduler.WATCH else AndroidFtpsScheduler.JOB)
        AndroidFtpsQueue.captureFault = if (branch == "watch") null else ({ throw FtpsFailure("credential_locked") })
        AndroidFtpsScheduler.reconcile(app)
        AndroidFtpsScheduler.report(app, "credential_locked")
        val bToken = prefs.getString("ftpsDispatchToken", null)
        val b = checkNotNull(queue.schedule.read()); bRun = b.run?.let { queue.runs.read(id = it) }
        check((branch == "result" || b == next) && bToken != armed.token && scheduler.getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getString("token") == bToken) { "B not installed" }
        check(branch != "result" || bRun != null) { "A never claimed: P=$b" }
        val bWatch = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token")
        check(branch != "watch" || (bWatch != null && bWatch != armed.watchToken)) { "B WATCH not installed" }
        AndroidFtpsQueue.captureFault = { throw SecurityException("fs1 visible reconcile") } // Any A reconcile would fail closed.
        AndroidFtpsScheduler.os = recorder
        Triple(b, bToken, bWatch)
      }
      quiet()
      check(recorder.finishes.isEmpty() && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) {
        "A late OS calls: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}"
      }
      check(queue.schedule.read() == b && AndroidFtpsAutomaticChecks.runs(queue) == (if (bRun == null) 0L else 1L) &&
        b.run?.let { queue.runs.read(id = it) } == bRun) { "B P/run changed: $b/$bRun → ${queue.schedule.read()}" }
      check(prefs.getString("ftpsDispatchToken", null) == bToken &&
        scheduler.getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getString("token") == bToken) { "B JOB/token changed" }
      check(AndroidFtpsScheduler.error(app) == "credential_locked") { "B error overwritten: ${AndroidFtpsScheduler.error(app)}" }
      check(scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token") == bWatch) { "B WATCH changed" }
      check(branch != "defer" || AndroidFtpsRuntime.hasAutomatic("fs1-foreign")) { "foreign lease released by A" }
    } finally { AndroidFtpsRuntime.endAutomatic(foreign); restore() }
  }

  /**
   * FS2: a real OS stop (`cmd jobscheduler timeout`, platform-parceled params) of the exact current JOB held before
   * admission is matched by envelope and returns the OS retry: same token/JOB/P kept, no finish/cancel/schedule after it.
   */
  private fun osStop(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = future(app, queue) // captureFault = locked: A blocks in its locked report.
      synchronized(monitor) {
        held(i, AndroidFtpsScheduler.JOB)
        AndroidFtpsScheduler.os = recorder
        AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler timeout com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")
        val deadline = android.os.SystemClock.elapsedRealtime() + 15000
        fun active() = String(AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler get-job-state com.kloda.sync.test ${AndroidFtpsScheduler.JOB}")).contains("active")
        while (active() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
        check(!active()) { "OS stop not delivered" }
      }
      quiet()
      check(recorder.finishes.isEmpty() && recorder.cancels.isEmpty() && recorder.schedules.isEmpty()) {
        "after stop: finish=${recorder.finishes} cancel=${recorder.cancels} schedule=${recorder.schedules}"
      }
      check(queue.schedule.read() == armed.plan && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "P changed: ${queue.schedule.read()}" }
      check(app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null) == armed.token &&
        scheduler.getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getString("token") == armed.token) { "stopped JOB not retried: ${scheduler.getPendingJob(AndroidFtpsScheduler.JOB)?.extras}" }
    } finally { restore() }
  }

  internal class Armed(val plan: FtpsPlan, val token: String?, val watchToken: String?, val uris: Set<Pair<android.net.Uri, Int>>)

  private fun uris(job: android.app.job.JobInfo) = job.triggerContentUris.orEmpty().map { it.uri to it.flags }.toSet()

  /** Live future P (run=null) with its JOB (1h) and WATCH armed; leaves captureFault = locked for the caller to replace. */
  internal fun future(app: Context, queue: AndroidFtpsQueue): Armed {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    AndroidFtpsScheduler.reconcile(app)
    AndroidFtpsQueue.captureFault = { throw FtpsFailure("credential_locked") } // A natural latency-0 run stays on the locked path.
    val created = checkNotNull(queue.schedule.read()) { "no P: ${AndroidFtpsScheduler.error(app)}" }
    check(created.run == null && AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "precondition P=$created" }
    val later = System.currentTimeMillis() + 3600000L
    synchronized(AndroidSyncJournal.sourceLock) { queue.schedule.save(created.copy(occurrence = later, due = later), created) }
    AndroidFtpsScheduler.reconcile(app) // Locked reconcile arms the same future P (FL2).
    val deadline = android.os.SystemClock.elapsedRealtime() + 30000
    while (AndroidFtpsAutomaticChecks.busy() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
    val before = checkNotNull(queue.schedule.read())
    check(before.due == later && before.run == null && !AndroidFtpsAutomaticChecks.busy()) { "future P=$before" }
    val job = checkNotNull(scheduler.getPendingJob(AndroidFtpsScheduler.JOB)) { "no JOB" }
    check(job.extras.getLong("dispatch", -1) == later) { "JOB not armed for future P" }
    val watch = checkNotNull(scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)) { "no WATCH in live mode" }
    return Armed(before, job.extras.getString("token"), watch.extras.getString("token"), uris(watch).also { check(it.isNotEmpty()) { "WATCH without trigger URIs" } })
  }

  /** Forces the current WATCH through the production Job path and waits for its completion (replacement or finish). */
  private fun fire(i: Instrumentation, app: Context, armed: Armed, recorder: AndroidFtpsAutomaticChecks.Recorder) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    AndroidFtpsScheduler.os = recorder
    AndroidFtpsAutomaticChecks.shell(i, "cmd jobscheduler run -f com.kloda.sync.test ${AndroidFtpsScheduler.WATCH}")
    val deadline = android.os.SystemClock.elapsedRealtime() + 30000
    fun replaced() = scheduler.getPendingJob(AndroidFtpsScheduler.WATCH)?.extras?.getString("token").let { it != null && it != armed.watchToken }
    while (android.os.SystemClock.elapsedRealtime() < deadline &&
      (AndroidFtpsAutomaticChecks.busy() || (recorder.finishes.none { it.first == AndroidFtpsScheduler.WATCH } && !replaced()))) Thread.sleep(50)
    Thread.sleep(500)
    check(!AndroidFtpsAutomaticChecks.busy()) { "callback still running; finishes=${recorder.finishes} cancels=${recorder.cancels}" }
  }

  /** The consumed WATCH is re-observed: new token, same trigger URIs/flags. */
  private fun reobserved(app: Context, armed: Armed, recorder: AndroidFtpsAutomaticChecks.Recorder) {
    val next = checkNotNull(app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.WATCH)) {
      "WATCH not re-observed: finishes=${recorder.finishes} cancels=${recorder.cancels}"
    }
    check(next.extras.getString("token") != armed.watchToken && uris(next) == armed.uris) { "WATCH URIs changed" }
  }

  /** §4.8 replacement completion: no WATCH finish, no cancel; any natural JOB stays on FL1's own retry. */
  private fun replacedOnly(recorder: AndroidFtpsAutomaticChecks.Recorder) =
    check(recorder.cancels.isEmpty() && recorder.finishes.none { it.first == AndroidFtpsScheduler.WATCH } &&
      recorder.finishes.all { it == (AndroidFtpsScheduler.JOB to true) }) { "cancel=${recorder.cancels} finish=${recorder.finishes}" }

  internal fun pendingFor(app: Context, plan: FtpsPlan) {
    val job = checkNotNull(app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.JOB)) { "no JOB for P=$plan" }
    check(job.extras.getString("token") == app.getSharedPreferences("kloda-sync", 0).getString("ftpsDispatchToken", null) &&
      job.extras.getLong("occurrence", -1) == plan.occurrence && job.extras.getLong("dispatch", -1) == plan.due) { "JOB extras != P=$plan" }
  }

  internal fun restore() { AndroidFtpsQueue.captureFault = null; AndroidFtpsScheduler.os = AndroidFtpsScheduler.Os() }

  /** FW1: live future P, run=null, locked; current WATCH → P equal, no early request, JOB kept, WATCH re-observed. */
  private fun lockedWatch(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val scheduler = app.getSystemService(JobScheduler::class.java)
    val prefs = app.getSharedPreferences("kloda-sync", 0)
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = future(app, queue)
      val keys = prefs.all.keys.toSet()
      fire(i, app, armed, recorder)
      check(queue.schedule.read() == armed.plan) { "P changed: before=${armed.plan} after=${queue.schedule.read()}" }
      check(AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "runs=${AndroidFtpsAutomaticChecks.runs(queue)}" }
      check(prefs.all.keys.toSet() == keys) { "stored request keys: before=$keys after=${prefs.all.keys}" }
      check(prefs.getString("ftpsDispatchToken", null) == armed.token &&
        scheduler.getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getString("token") == armed.token) { "JOB not kept" }
      reobserved(app, armed, recorder)
      replacedOnly(recorder)
      check(AndroidFtpsScheduler.error(app) == "credential_locked") { "error=${AndroidFtpsScheduler.error(app)}" }
    } finally { restore() }
  }

  /** FW2 valid: open device, same target/binding, run=null → expected-P CAS writes the early occurrence; WATCH re-observed. */
  private fun validWatch(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = future(app, queue)
      // WATCH capture and its reconcile capture succeed; a later natural JOB on the early P stays on FL1's locked path (no transfer).
      val calls = AtomicInteger()
      AndroidFtpsQueue.captureFault = { if (calls.incrementAndGet() > 2) throw FtpsFailure("credential_locked") }
      val start = System.currentTimeMillis()
      fire(i, app, armed, recorder)
      val after = checkNotNull(queue.schedule.read())
      check(after.target == armed.plan.target && after.binding == armed.plan.binding && after.run == null &&
        after.occurrence == after.due && after.due in start..System.currentTimeMillis()) { "no early occurrence: before=${armed.plan} after=$after" }
      check(AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "runs=${AndroidFtpsAutomaticChecks.runs(queue)}" }
      pendingFor(app, after)
      reobserved(app, armed, recorder)
      replacedOnly(recorder)
    } finally { restore() }
  }

  /** FW2 capture fail: open device, non-lock capture failure → P never written (no early occurrence/JOB); fail-closed code. */
  private fun failedCapture(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = future(app, queue)
      AndroidFtpsQueue.captureFault = { throw SecurityException("fw2 synthetic capture failure") }
      fire(i, app, armed, recorder)
      check(queue.schedule.read() == armed.plan) { "P changed: before=${armed.plan} after=${queue.schedule.read()}" }
      check(AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "runs=${AndroidFtpsAutomaticChecks.runs(queue)}" }
      val dispatch = app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getLong("dispatch", -1)
      check(dispatch == null || dispatch == armed.plan.due) { "early JOB dispatch=$dispatch" }
      check(AndroidFtpsScheduler.error(app) == "source_permission_lost") { "error=${AndroidFtpsScheduler.error(app)}" }
    } finally { restore() }
  }

  /**
   * FW2 CAS mismatch: a concurrent writer commits P2 between the WATCH read and its expected-P CAS (test-only TEMP trigger
   * on the fixture connection, dropped in finally) → the early write loses, P2 is kept and re-armed, WATCH re-observed.
   */
  private fun casMismatch(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    val database = queue.journal.database
    try {
      val armed = future(app, queue)
      AndroidFtpsQueue.captureFault = null
      database.execSQL("CREATE TEMP TRIGGER fw2_concurrent BEFORE UPDATE ON main.ftps_plan " +
        "WHEN OLD.run IS NULL AND NEW.run IS NULL AND NEW.occurrence <> OLD.occurrence " +
        "BEGIN UPDATE ftps_plan SET due = OLD.due + 60000 WHERE id = 1; SELECT RAISE(IGNORE); END")
      fire(i, app, armed, recorder)
      val concurrent = armed.plan.copy(due = armed.plan.due + 60000)
      check(queue.schedule.read() == concurrent) { "CAS loser overwrote P2: expected=$concurrent after=${queue.schedule.read()}" }
      check(AndroidFtpsAutomaticChecks.runs(queue) == 0L) { "runs=${AndroidFtpsAutomaticChecks.runs(queue)}" }
      pendingFor(app, concurrent)
      reobserved(app, armed, recorder)
      check(recorder.cancels.none { it == AndroidFtpsScheduler.JOB }) { "cancel=${recorder.cancels} finish=${recorder.finishes}" }
    } finally {
      database.execSQL("DROP TRIGGER IF EXISTS temp.fw2_concurrent")
      restore()
    }
  }

  /** FW2 run!=null: open device, P already claimed (paused user run) → WATCH never writes the claimed P; WATCH re-observed. */
  private fun claimedWatch(i: Instrumentation, app: Context, queue: AndroidFtpsQueue) {
    val recorder = AndroidFtpsAutomaticChecks.Recorder()
    try {
      val armed = future(app, queue)
      AndroidFtpsQueue.captureFault = null
      val run = FtpsRun(UUID.randomUUID().toString(), armed.plan.target, armed.plan.binding, true, armed.plan.occurrence, phase = "paused", error = "user_pause")
      val claimed = armed.plan.copy(run = run.id)
      synchronized(AndroidSyncJournal.sourceLock) { queue.runs.save(run); queue.schedule.save(claimed, armed.plan) }
      fire(i, app, armed, recorder)
      check(queue.schedule.read() == claimed) { "claimed P written: before=$claimed after=${queue.schedule.read()}" }
      check(AndroidFtpsAutomaticChecks.runs(queue) == 1L && queue.runs.read(id = run.id) == run) { "run changed: ${queue.runs.read(id = run.id)}" }
      check(app.getSystemService(JobScheduler::class.java).getPendingJob(AndroidFtpsScheduler.JOB)?.extras?.getString("token") == armed.token) { "JOB not kept" }
      reobserved(app, armed, recorder)
      replacedOnly(recorder)
    } finally { restore() }
  }
}
