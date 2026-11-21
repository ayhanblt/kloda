package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONArray
import org.json.JSONObject

// Automatic/manual queue authority component, not an OS delivery or network proof.
// Amazon isolated queue: automatic admission is only the exact-owner startAutomatic path.
internal object AndroidS3AutomaticChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext; val namespace = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getApplicationContext() = this
      override fun getPackageName() = base.packageName + ".owned.s3.automatic." + namespace
      override fun getNoBackupFilesDir() = File(root, "s3-automatic-$namespace").apply { mkdirs() }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".s3-auto." + namespace, mode)
    }
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; val alias = app.packageName + ".s3.amazon-s3.profile.v1"; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "amazon-s3")
    try {
      val profiles = AndroidS3Profiles(app, journal)
      profiles.save(S3Target("amazon-s3", "https://s3.us-east-1.amazonaws.com", "us-east-1", "owned-bucket", "owned", false, S3Target.hash("synthetic"), namespace, namespace), "synthetic", "synthetic-only", null) {}
      val rows = JSONArray().put(JSONObject().put("id", UUID.randomUUID().toString()).put("reference", "content://owned.invalid/tree/source"))
      check(FilesRunContext.stamp(app.getSharedPreferences("kloda-sync", 0).edit().putString("directorySources", rows.toString())).commit())
      val plan = AndroidS3AutomaticPlan(journal)
      for (automatic in listOf(true, false)) {
        journal.setEnabled(true)
        val foreground = AtomicBoolean(!automatic); val lease = AtomicReference<Any?>(); val armed = AtomicBoolean(false); val gated = AtomicBoolean(false)
        val entered = CountDownLatch(1); val release = CountDownLatch(1); val done = CountDownLatch(1); val callbacks = AtomicInteger(); val outcome = AtomicReference<S3Run?>()
        fun allowed(mode: Boolean, owner: Any?): Boolean {
          if (armed.get() && mode == automatic && Thread.currentThread().name == "kloda-amazon-s3-files" && gated.compareAndSet(false, true)) {
            entered.countDown(); check(release.await(15, TimeUnit.SECONDS))
          }
          return if (mode) owner != null && lease.get() === owner else foreground.get()
        }
        val queue = AndroidS3Queue(app, profiles, mayRunAutomatic = { allowed(true, it) }, mayRun = { allowed(false, null) })
        val owner = Any()
        if (automatic) {
          if (!plan.marked()) check(plan.migrate(app.getSharedPreferences(AndroidS3AutomaticPlan.LEGACY, 0), null, 0, { it }) == null)
          check(!journal.automatic()); check(queue.authority() == null)
          lease.set(owner)
          // Feature-off: no capture/admission even with a matching owner.
          check(plan.current() == null && plan.arm(queue.authority(), 0, { it + 1 }, false) == S3Refresh.Revoked)
          queue.setAutomatic(true)
          // A manual start never writes automatic plan/accept records; automatic pause never stops manual work.
          check(runCatching { queue.start() }.isFailure)
        }
        val expected = if (automatic) (plan.arm(queue.authority(), 0, { it + 1 }, false) as S3Refresh.Updated).plan else null
        armed.set(true)
        val starter = Thread {
          val finished: (S3Run) -> Unit = { outcome.set(it); callbacks.incrementAndGet(); done.countDown() }
          if (expected != null) check(queue.startAutomatic(expected, plan, owner, 1, finished) is S3Admission.Accepted) else queue.start(finished)
        }
        starter.start(); check(entered.await(10, TimeUnit.SECONDS))
        val pauser = if (automatic) {
          val before = android.os.SystemClock.elapsedRealtime(); queue.pauseForeground(); check(android.os.SystemClock.elapsedRealtime() - before < 1000)
          check(callbacks.get() == 0); lease.set(null); null
        } else {
          // The gated worker holds sourceLock: lock-taking calls run on the pauser thread only.
          // An automatic exact pause for another owner never matches the manual execution.
          foreground.set(false); Thread { queue.pauseAutomatic(owner, null); queue.pauseForeground() }.also { it.start() }
        }
        release.countDown(); check(done.await(10, TimeUnit.SECONDS)); starter.join(5000); pauser?.join(5000)
        check(!starter.isAlive && pauser?.isAlive != true && callbacks.get() == 1 && outcome.get()?.phase == "paused")
        if (automatic) check(outcome.get()?.error == "os_interrupted")
        check(journal.text("SELECT COUNT(*) FROM s3_job") == "0")
        queue.status().let { check(it["running"] == false && (it["run"] as Map<*, *>)["state"] == "paused") }
        queue.disable(); check(!journal.automatic())
      }
      // Exactly one acceptance overall: the manual iteration added none.
      check(journal.text("SELECT COUNT(*) FROM s3_auto_accept") == "1")
    } finally { journal.database.close(); if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias)) }
  }
}
