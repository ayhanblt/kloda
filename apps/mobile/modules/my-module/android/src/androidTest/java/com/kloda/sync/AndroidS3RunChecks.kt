package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

// Fake ACKs prove local run bookkeeping only; this scope never opens a network connection.
internal object AndroidS3RunChecks {
  private fun rejected(block: () -> Unit) { check(runCatching(block).isFailure) }
  fun run(instrumentation: Instrumentation, root: File, pauseOnly: Boolean = false, globalPause: Boolean = false) {
    val base = instrumentation.targetContext; check(base.packageName == "com.kloda.sync.test")
    val token = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.runs." + token
      override fun getNoBackupFilesDir() = File(root, "s3-runs").apply { check(mkdirs() || isDirectory) }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".s3-runs." + token, mode)
    }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "s3-compatible")
    try {
      val profiles = AndroidS3Profiles(app, journal)
      profiles.save(S3Target("s3-compatible", "https://owned.example.test", "us-east-1", "owned-bucket", "owned", true,
        S3Target.hash("synthetic"), token, token), "synthetic", "synthetic-only", null) {}
      journal.setEnabled(true)
      val target = profiles.capture()!!.profile.target
      if (!pauseOnly) {
      val runs = AndroidS3Runs(journal)
      val run = S3Run(UUID.randomUUID().toString(), target.archiveId(), journal.context()); runs.start(run)
      val id = UUID.randomUUID().toString()
      val job = AndroidS3Job(id, journal.installation(), journal.context(), target, UUID.randomUUID().toString(), "owned", "revision", "generation",
        "$id.snapshot", "objects/${journal.installation()}/$id", S3Target.hash("owned"), 5)
      journal.insert(job); rejected { runs.track(run, job) }
      val phases = listOf("prepared", "creating", "created", "part-intent", "part-ack", "completing", "complete-ack")
      for ((from, to) in phases.zipWithNext()) journal.record(job, from, to) { true }
      journal.record(job, "complete-ack", "completed", JSONObject().put("sha256", job.sha256).put("size", "5")) { true }
      runs.track(run, job); runs.track(run, job)
      check(runs.counts(run.id) == mapOf("verifiedFiles" to "1", "verifiedBytes" to "5"))
      runs.finish(run.copy(phase = "finished"))
      rejected { journal.database.execSQL("UPDATE s3_run SET phase='running' WHERE id=?", arrayOf(run.id)) }
      rejected { journal.database.execSQL("DELETE FROM s3_run_job WHERE run=?", arrayOf(run.id)) }
      rejected { journal.database.execSQL("DELETE FROM s3_run WHERE id=?", arrayOf(run.id)) }
      val empty = AndroidS3Queue(app, profiles) { true }; rejected { empty.start() }; check(empty.available())
      }
      val prefs = app.getSharedPreferences("kloda-sync", 0)
      val sources = JSONArray().put(JSONObject().put("id", UUID.randomUUID().toString()).put("reference", "content://owned.invalid/tree/source")).toString()
      check(FilesRunContext.stamp(prefs.edit().putString("directorySources", sources)).commit())
      fun exercise(failStore: Boolean) {
        journal.setEnabled(true)
        val blocked = CountDownLatch(1); val release = CountDownLatch(1); val gated = AtomicBoolean(false)
        val queue = AndroidS3Queue(app, profiles) {
          if (Thread.currentThread().name == "kloda-s3-compatible-files" && gated.compareAndSet(false, true)) {
            blocked.countDown(); check(release.await(15, TimeUnit.SECONDS))
          }; true
        }
        if (failStore) journal.database.execSQL("CREATE TRIGGER owned_fail_s3_finish BEFORE UPDATE ON s3_run WHEN NEW.phase!='running' BEGIN SELECT RAISE(ABORT,'owned-failure'); END")
        val callbacks = AtomicInteger(); val outcome = AtomicReference<S3Run?>(); val done = CountDownLatch(1)
        val starter = Thread { queue.start { outcome.set(it); callbacks.incrementAndGet(); done.countDown() } }
        starter.start(); check(blocked.await(10, TimeUnit.SECONDS))
        val pauser = Thread { runCatching { if (globalPause) AndroidS3Queue.pauseAll() else queue.pause() } }; pauser.start()
        val deadline = android.os.SystemClock.elapsedRealtime() + 5000
        while (pauser.state != Thread.State.BLOCKED) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(5) }
        release.countDown(); check(done.await(10, TimeUnit.SECONDS)); starter.join(5000); pauser.join(5000)
        check(!starter.isAlive && !pauser.isAlive && callbacks.get() == 1 && queue.available())
        if (failStore) {
          check(outcome.get()?.error == "storage_failure" && queue.status()["canRun"] == false); rejected { queue.start() }
          journal.database.execSQL("DROP TRIGGER owned_fail_s3_finish")
        } else {
          check(outcome.get()?.phase == "paused" && outcome.get()?.error != "storage_failure")
          check(queue.runs.read(target.archiveId())?.phase == "paused")
        }
        check(journal.text("SELECT COUNT(*) FROM s3_job") == if (pauseOnly) "0" else "1")
        queue.disable(); check(!journal.enabled() && queue.status()["enabled"] == false)
      }
      if (pauseOnly) exercise(false)
      exercise(true)
    } finally {
      journal.database.close(); if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias))
      base.deleteSharedPreferences("kloda-sync.s3-runs." + token)
    }
  }
}
