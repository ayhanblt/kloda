package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor
import android.system.Os
import android.system.OsConstants
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.security.MessageDigest

// Read bounded parts directly from the sealed native snapshot; no second on-disk media copy.
internal class AndroidS3Publisher(private val app: Context, private val profiles: AndroidS3Profiles, private val check: () -> Unit) {
  fun publish(job: AndroidS3Job, snapshot: ParcelFileDescriptor, currentSource: () -> Boolean, completedSource: () -> Unit) {
    val journal = profiles.journal
    val captured = profiles.capture() ?: throw S3Failure("profile_missing")
    if (journal.state(job) != "prepared" || captured.context != job.context || captured.profile.target != job.target ||
      job.size > 5L * 1024 * 1024 * 1024 * 10000) throw S3Failure("context_changed")
    val witness = Os.fstat(snapshot.fileDescriptor)
    if (!OsConstants.S_ISREG(witness.st_mode) || witness.st_size != job.size) throw S3Failure("source_changed")
    fun current(): Boolean {
      check()
      val stat = Os.fstat(snapshot.fileDescriptor)
      return profiles.current(captured) && journal.enabled() && currentSource() && stat.st_dev == witness.st_dev &&
        stat.st_ino == witness.st_ino && stat.st_size == witness.st_size && stat.st_mtime == witness.st_mtime && stat.st_ctime == witness.st_ctime
    }
    fun requireCurrent() { if (!current()) throw S3Failure("context_changed") }
    fun range(offset: Long, length: Long): InputStream = object : InputStream() {
      var consumed = 0L
      override fun read(): Int { val one = ByteArray(1); return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 255 }
      override fun read(buffer: ByteArray, start: Int, count: Int): Int {
        if (start < 0 || count < 0 || start > buffer.size - count) throw IndexOutOfBoundsException()
        if (count == 0) return 0
        if (consumed == length) return -1
        requireCurrent()
        val size = Os.pread(snapshot.fileDescriptor, buffer, start, minOf(count.toLong(), length - consumed).toInt(), offset + consumed)
        if (size <= 0) throw S3Failure("source_changed")
        consumed += size; return size
      }
    }
    fun digest(offset: Long, length: Long): String {
      val hash = MessageDigest.getInstance("SHA-256"); val buffer = ByteArray(65536)
      range(offset, length).use { input ->
        while (true) { val count = input.read(buffer); if (count < 0) break; hash.update(buffer, 0, count) }
      }
      return android.util.Base64.encodeToString(hash.digest(), android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
    }
    fun failure(status: Int) = S3Failure(when (status) { 401, 403 -> "s3_auth"; 404 -> "target_missing"; 412 -> "conflict"; 409 -> "multipart_restart_required"; else -> "review_required" })
    val client = AndroidS3Client(app, captured.profile, ::requireCurrent)
    var stage = "source"; var status = 0
    try {
      requireCurrent()
      if (digest(0, job.size) != job.sha256) throw S3Failure("source_changed")
      journal.record(job, "prepared", "creating", current = ::current)
      stage = "create"
      val created = client.send(job.key, JSONObject().put("kind", "create").put("job", job.id.replace("-", "")))
      status = created.status
      val reply = S3NativeEngine.reply(1, status, created.body, job.target, job.key)
      if (reply.optString("kind") != "created") throw failure(status)
      val upload = reply.getString("upload")
      journal.record(job, "creating", "created", JSONObject().put("upload", upload), ::current)
      val unit = 1024L * 1024
      val partSize = maxOf(5 * unit, ((job.size + 9999) / 10000 + unit - 1) / unit * unit)
      val count = maxOf(1L, (job.size + partSize - 1) / partSize).toInt()
      val etags = JSONArray(); var offset = 0L
      for (number in 1..count) {
        val length = minOf(partSize, job.size - offset)
        val partHash = digest(offset, length)
        journal.record(job, if (number == 1) "created" else "part-ack", "part-intent",
          JSONObject().put("number", number).put("size", length.toString()).put("sha256", partHash), ::current)
        stage = "part"; status = 0
        val part = range(offset, length).use { client.send(job.key, JSONObject().put("kind", "part").put("upload", upload).put("number", number), it, length) }
        status = part.status
        val etag = part.headers["etag"]
        if (status != 200 || part.body.isNotEmpty() || etag.isNullOrEmpty() || etag.toByteArray().size > 1024 || etag.any(Char::isISOControl)) throw failure(status)
        journal.record(job, "part-intent", "part-ack", JSONObject().put("number", number).put("etag", etag), ::current)
        etags.put(etag); offset += length
      }
      journal.record(job, "part-ack", "completing", JSONObject().put("count", count).put("partsDigest", S3Target.hash(etags.toString())), ::current)
      stage = "complete"; status = 0
      val complete = client.send(job.key, JSONObject().put("kind", "complete").put("upload", upload).put("etags", etags))
      status = complete.status
      val ack = S3NativeEngine.reply(2, status, complete.body, job.target, job.key)
      if (ack.optString("kind") != "completion_ack") throw failure(status)
      val proof = JSONObject().put("etag", ack.getString("etag"))
      complete.headers["x-amz-version-id"]?.let { proof.put("version", it) }
      journal.record(job, "completing", "complete-ack", proof, ::current)
      requireCurrent(); stage = "verify"; status = 0
      val verification = client.send(job.key, JSONObject().put("kind", "get").put("version", proof.opt("version") ?: JSONObject.NULL),
        maximum = job.size, receive = { _, _ -> requireCurrent() })
      status = verification.status
      if (status != 200 || verification.size != job.size || verification.sha256 != job.sha256) throw S3Failure("verification_failed")
      if (digest(0, job.size) != job.sha256) throw S3Failure("source_changed")
      completedSource()
      journal.record(job, "complete-ack", "completed", JSONObject().put("size", job.size.toString()).put("sha256", job.sha256), ::current)
    } catch (error: Exception) {
      val phase = journal.state(job)
      if (phase !in listOf("completed", "aborted", "review")) journal.record(job, phase, "review",
        JSONObject().put("code", (error as? S3Failure)?.code ?: "outcome_unknown").put("stage", stage).put("status", status)) { false }
      throw error
    }
  }
}
