package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import android.os.ParcelFileDescriptor
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal object AndroidS3DropChecks {
  fun run(instrumentation: Instrumentation, token: String, read: Boolean) {
    val base = instrumentation.targetContext; check(base.packageName == "com.kloda.sync.test")
    check(Regex("[0-9a-f]{32}").matches(token))
    val root = File(base.noBackupFilesDir, "s3-owned-drop-$token")
    if (read) check(root.isDirectory) else check(!root.exists() && root.mkdir())
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.drop." + token
      override fun getNoBackupFilesDir() = root
    }
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"
    val journal = AndroidS3Journal(app, "s3-compatible")
    val bytes = "owned Android completion ACK drop".toByteArray()
    try {
      val profiles = AndroidS3Profiles(app, journal)
      if (read) {
        val job = AndroidS3Job.decode(File(root, "job.json").readText())
        val before = journal.context(); journal.recoverInterrupted()
        check(journal.context() != before && journal.state(job) == "review")
        check(journal.events(job, "completing").size == 1 && journal.events(job, "complete-ack").isEmpty())
        check(profiles.capture()!!.profile.target == job.target)
        check(runCatching { journal.receipt(job.id, job.target) }.isFailure)
        println("Owned separate-process reopen preserved Review; no new request")
      } else {
        check(!store.containsAlias(alias))
        val generation = UUID.randomUUID().toString()
        val target = S3Target("s3-compatible", "https://localhost:52409", "us-east-1", "kloda17-native", "android-drop-$token", true,
          S3Target.hash("kloda17fixture"), generation, generation)
        profiles.save(target, "kloda17fixture", "synthetic-only-kloda17-fixture", null) {}; journal.setEnabled(true)
        val captured = profiles.capture()!!
        val file = File(root, "owned.snapshot").apply { writeBytes(bytes); check(setReadOnly()) }
        val digest = file.inputStream().use { AndroidFilesSnapshots.digest(it) }
        val id = UUID.randomUUID().toString()
        val job = AndroidS3Job(id, journal.installation(), captured.context, captured.profile.target, UUID.randomUUID().toString(),
          "owned", "revision", "generation", "$id.snapshot", "objects/${journal.installation()}/$id", digest.sha256, digest.size)
        File(root, "job.json").writeText(job.payload()); journal.insert(job)
        val failed = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use {
          runCatching { AndroidS3Publisher(app, profiles) {}.publish(job, it, { true }) { error("must not complete") } }.exceptionOrNull()
        }
        check(failed is S3Failure && failed.code == "connection_unavailable")
        check(journal.state(job) == "review" && journal.events(job, "completing").size == 1 && journal.events(job, "complete-ack").isEmpty())
        var offset = 0
        val get = AndroidS3Client(app, captured.profile) {}.send(job.key, JSONObject().put("kind", "get").put("version", JSONObject.NULL), maximum = job.size,
          receive = { data, size -> check(bytes.copyOfRange(offset, offset + size).contentEquals(data.copyOf(size))); offset += size })
        check(get.status == 200 && get.sha256 == job.sha256 && get.size == job.size && journal.state(job) == "review")
        println("Owned real dropped ACK job=$id; equal GET stayed Review")
      }
    } finally {
      journal.database.close()
      if (read) { if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias)) }
    }
  }
}
