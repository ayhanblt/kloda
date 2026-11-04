package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.UUID

internal object AndroidS3WireChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val custody = object : ContextWrapper(instrumentation.targetContext) {
      override fun getNoBackupFilesDir() = File(root, "s3-wire").apply { check(mkdirs() || isDirectory) }
    }
    val journal = AndroidS3Journal(custody, "s3-compatible")
    val id = UUID.randomUUID().toString(); val generation = UUID.randomUUID().toString()
    val target = S3Target("s3-compatible", "https://localhost:52408", "us-east-1", "kloda17-native", "android-$id", true,
      S3Target.hash("kloda17fixture"), generation, generation)
    val profile = AndroidS3Profile(target, "kloda17fixture", "synthetic-only-kloda17-fixture", null)
    val bytes = ByteArray(4097) { (it % 251).toByte() }
    val hash = android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(bytes),
      android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
    try {
      journal.prepareProfile(target); journal.confirmProfile(target); journal.setEnabled(true)
      val job = AndroidS3Job(id, journal.installation(), journal.context(), target, UUID.randomUUID().toString(),
        "owned-synthetic", "revision", "generation", "$id.snapshot", "objects/${journal.installation()}/$id", hash, bytes.size.toLong())
      journal.insert(job)
      val current = { journal.context() == job.context && journal.profileCurrent(target) && journal.enabled() }
      val client = AndroidS3Client(custody, profile) { check(current()) }
      journal.record(job, "prepared", "creating", current = current)
      val create = client.send(job.key, JSONObject().put("kind", "create").put("job", id.replace("-", "")))
      val ack = S3NativeEngine.reply(1, create.status, create.body, target, job.key)
      check(ack.getString("kind") == "created")
      val upload = ack.getString("upload")
      journal.record(job, "creating", "created", JSONObject().put("upload", upload), current)
      journal.record(job, "created", "part-intent", JSONObject().put("number", 1), current)
      val part = client.send(job.key, JSONObject().put("kind", "part").put("upload", upload).put("number", 1), ByteArrayInputStream(bytes), bytes.size.toLong())
      check(part.status == 200)
      val etag = part.headers["etag"] ?: error("missing owned part ACK")
      journal.record(job, "part-intent", "part-ack", JSONObject().put("number", 1).put("etag", etag), current)
      journal.record(job, "part-ack", "completing", current = current)
      val complete = client.send(job.key, JSONObject().put("kind", "complete").put("upload", upload).put("etags", JSONArray().put(etag)))
      val receipt = S3NativeEngine.reply(2, complete.status, complete.body, target, job.key)
      check(receipt.getString("kind") == "completion_ack")
      journal.record(job, "completing", "complete-ack", receipt, current)
      var received = 0
      val get = client.send(job.key, JSONObject().put("kind", "get").put("version", JSONObject.NULL), maximum = bytes.size.toLong(), receive = { data, size ->
        check(bytes.copyOfRange(received, received + size).contentEquals(data.copyOf(size))); received += size
      })
      check(get.status == 200 && get.size == job.size && get.sha256 == hash && received == bytes.size)
      journal.record(job, "complete-ack", "completed", JSONObject().put("sha256", hash).put("size", job.size.toString()), current)
      check(journal.state(job) == "completed")
      val bounded = runCatching { client.send(job.key, JSONObject().put("kind", "get").put("version", JSONObject.NULL), maximum = 100, receive = { _, _ -> }) }.exceptionOrNull()
      check(bounded is S3Failure && bounded.code == "review_required")
      println("Owned S3 wire job=$id bytes=${bytes.size}; one completion, no cloud cleanup")
    } finally { journal.database.close() }
  }
}
