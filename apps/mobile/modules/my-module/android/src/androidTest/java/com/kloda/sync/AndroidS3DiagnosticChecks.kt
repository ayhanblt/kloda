package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal object AndroidS3DiagnosticChecks {
  private fun rejected(block: () -> Unit) { check(runCatching(block).isFailure) }
  fun run(instrumentation: Instrumentation, scratch: File) {
    val base = instrumentation.targetContext; check(base.packageName == "com.kloda.sync.test")
    val token = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.diagnostic." + token
      override fun getNoBackupFilesDir() = File(scratch, "s3-diagnostic-$token").apply { check(mkdirs() || isDirectory) }
      override fun getSharedPreferences(name: String, mode: Int) = base.getSharedPreferences(name + ".s3-diagnostic." + token, mode)
    }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "s3-compatible")
    try {
      val profiles = AndroidS3Profiles(app, journal)
      val target = S3Target("s3-compatible", "https://localhost:52408", "us-east-1", "kloda17-native", "android-diagnostic-$token", true,
        S3Target.hash("kloda17fixture"), token, token)
      profiles.save(target, "kloda17fixture", "synthetic-only-kloda17-fixture", null) {}
      val captured = profiles.capture()!!; val before = journal.context()
      val poison = JSONArray().put(JSONObject().put("id", token).put("reference", "invalid-owned-source")).toString()
      check(app.getSharedPreferences("kloda-sync", 0).edit().putString("directorySources", poison).commit())
      val grant = AndroidS3TestGrant(); val old = UUID.randomUUID()
      rejected { grant.start(old) }; grant.activate(false); rejected { grant.start(old) }
      grant.activate(true); grant.cancel(old); rejected { grant.start(old) }
      val interrupted = UUID.randomUUID(); grant.start(interrupted); grant.deactivate(); grant.activate(true)
      check(!grant.current(interrupted)); grant.finish(interrupted)
      val request = UUID.randomUUID(); grant.start(request); rejected { grant.start(UUID.randomUUID()) }
      val result = try { AndroidS3Diagnostic.run(app, profiles, captured, request) { grant.current(request) } }
      catch (error: Exception) {
        val failed = AndroidS3Journal(app, "s3-compatible", diagnostic = true)
        try {
          val metadata = failed.database.rawQuery("SELECT payload FROM s3_event WHERE kind='review' ORDER BY sequence DESC LIMIT 1", null).use {
            if (it.moveToFirst()) JSONObject(it.getString(0)) else JSONObject()
          }
          throw IllegalStateException("Owned diagnostic status=${metadata.optInt("status")} stage=${metadata.optString("stage")}", error)
        } finally { failed.database.close() }
      }
      grant.finish(request); check(!grant.current(request)); rejected { grant.start(request) }
      check(result["state"] == "completed" && result["size"] == 4097)
      check(!journal.enabled() && journal.context() == before && journal.text("SELECT COUNT(*) FROM s3_job") == "0")
      val test = AndroidS3Journal(app, "s3-compatible", diagnostic = true)
      val id = result["id"] as String
      try {
        val job = test.receipt(id, captured.profile.target)
        check(!test.enabled() && test.state(job) == "completed" && test.events(job, "complete-ack").size == 1)
        rejected { journal.receipt(id, captured.profile.target) }
        rejected { AndroidS3Diagnostic.run(app, profiles, captured, request) { true } }
        check(!test.enabled() && test.text("SELECT COUNT(*) FROM s3_job") == "1")
      } finally { test.database.close() }
      val reopened = AndroidS3Journal(app, "s3-compatible", diagnostic = true)
      try { check(!reopened.enabled() && reopened.state(reopened.receipt(id, captured.profile.target)) == "completed") }
      finally { reopened.database.close() }
      check(profiles.capture() == captured)
      println("Owned Android synthetic diagnostic job=$id; generated4097bytes; normal backup remained disabled")
    } finally {
      journal.database.close()
      if (store.containsAlias(alias)) store.deleteEntry(alias)
      check(!store.containsAlias(alias)); base.deleteSharedPreferences("kloda-sync.s3-diagnostic." + token)
    }
  }
}
