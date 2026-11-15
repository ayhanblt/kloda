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
internal object AndroidS3AutomaticChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext; val namespace = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.automatic." + namespace
      override fun getNoBackupFilesDir() = File(root, "s3-automatic").apply { mkdirs() }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".s3-auto." + namespace, mode)
    }
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; val alias = app.packageName + ".s3.s3-compatible.profile.v1"; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "s3-compatible")
    try {
      val profiles = AndroidS3Profiles(app, journal)
      profiles.save(S3Target("s3-compatible", "https://owned.example.test", "us-east-1", "owned-bucket", "owned", true, S3Target.hash("synthetic"), namespace, namespace), "synthetic", "synthetic-only", null) {}
      val rows = JSONArray().put(JSONObject().put("id", UUID.randomUUID().toString()).put("reference", "content://owned.invalid/tree/source"))
      check(FilesRunContext.stamp(app.getSharedPreferences("kloda-sync", 0).edit().putString("directorySources", rows.toString())).commit())
      for (automatic in listOf(true, false)) {
        journal.setEnabled(true)
        val foreground = AtomicBoolean(!automatic); val lease = AtomicBoolean(true); val armed = AtomicBoolean(false); val gated = AtomicBoolean(false)
        val entered = CountDownLatch(1); val release = CountDownLatch(1); val done = CountDownLatch(1); val callbacks = AtomicInteger(); val outcome = AtomicReference<S3Run?>()
        fun allowed(mode: Boolean): Boolean {
          if (armed.get() && mode == automatic && Thread.currentThread().name == "kloda-s3-compatible-files" && gated.compareAndSet(false, true)) {
            entered.countDown(); check(release.await(15, TimeUnit.SECONDS))
          }
          return if (mode) lease.get() else foreground.get()
        }
        val queue = AndroidS3Queue(app, profiles, mayRunAutomatic = { allowed(true) }, mayRun = { allowed(false) })
        if (automatic) {
          check(!journal.automatic()); check(runCatching { queue.start(automatic = true) }.isFailure); queue.setAutomatic(true)
        }
        armed.set(true)
        val starter = Thread { queue.start(automatic = automatic) { outcome.set(it); callbacks.incrementAndGet(); done.countDown() } }
        starter.start(); check(entered.await(10, TimeUnit.SECONDS))
        val pauser = if (automatic) {
          val before = android.os.SystemClock.elapsedRealtime(); queue.pauseForeground(); check(android.os.SystemClock.elapsedRealtime() - before < 1000)
          check(callbacks.get() == 0); lease.set(false); null
        } else { foreground.set(false); Thread { queue.pauseForeground() }.also { it.start() } }
        release.countDown(); check(done.await(10, TimeUnit.SECONDS)); starter.join(5000); pauser?.join(5000)
        check(!starter.isAlive && pauser?.isAlive != true && callbacks.get() == 1 && outcome.get()?.phase == "paused")
        if (automatic) check(outcome.get()?.error == "os_interrupted")
        check(journal.text("SELECT COUNT(*) FROM s3_job") == "0")
        queue.disable(); check(!journal.automatic())
      }
    } finally { journal.database.close(); if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias)) }
  }
}
