package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal object AndroidS3AbortChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext; check(base.packageName == "com.kloda.sync.test")
    val generation = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.abort." + generation
      override fun getNoBackupFilesDir() = File(root, "s3-abort").apply { check(mkdirs() || isDirectory) }
    }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "s3-compatible")
    try {
      val profiles = AndroidS3Profiles(app, journal)
      profiles.save(S3Target("s3-compatible", "https://localhost:52408", "us-east-1", "kloda17-native", "android-abort-$generation", true,
        S3Target.hash("kloda17fixture"), generation, generation), "kloda17fixture", "synthetic-only-kloda17-fixture", null) {}
      journal.setEnabled(true); val capture = profiles.capture()!!; val id = UUID.randomUUID().toString()
      val job = AndroidS3Job(id, journal.installation(), capture.context, capture.profile.target, UUID.randomUUID().toString(),
        "owned-abort", "revision", "generation", "$id.snapshot", "objects/${journal.installation()}/$id", S3Target.hash(""), 0)
      journal.insert(job); journal.record(job, "prepared", "creating") { true }
      val client = AndroidS3Client(app, capture.profile) {}
      val created = client.send(job.key, JSONObject().put("kind", "create").put("job", id.replace("-", "")))
      val ack = S3NativeEngine.reply(1, created.status, created.body, job.target, job.key)
      check(ack.getString("kind") == "created")
      journal.record(job, "creating", "created", JSONObject().put("upload", ack.getString("upload"))) { true }
      check(runCatching { AndroidS3Abort.run(app, profiles, job) { false } }.isFailure)
      check(journal.state(job) == "created" && journal.events(job, "aborting").isEmpty())
      val parts = JSONObject().put("kind", "parts").put("upload", ack.getString("upload")).put("marker", 0)
      check(client.send(job.key, parts).status == 200)
      AndroidS3Abort.run(app, profiles, job) { true }
      check(journal.state(job) == "aborted" && journal.events(job, "aborted").single().getInt("status") == 204)
      check(client.send(job.key, parts).status == 404)
      check(runCatching { AndroidS3Abort.run(app, profiles, job) { true } }.isFailure)
      check(journal.events(job, "aborting").size == 1 && journal.events(job, "complete-ack").isEmpty())
      println("Owned native abort job=$id; fresh authority only, one abort ACK, ListParts404")
    } finally {
      journal.database.close(); if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias))
    }
  }
}
