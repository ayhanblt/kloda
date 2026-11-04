package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal object AndroidS3JobChecks {
  private fun rejected(block: () -> Unit) { check(runCatching(block).isFailure) }
  fun run(instrumentation: Instrumentation, root: File) {
    val custody = object : ContextWrapper(instrumentation.targetContext) {
      override fun getNoBackupFilesDir() = File(root, "s3-jobs").apply { check(mkdirs() || isDirectory) }
    }
    var journal = AndroidS3Journal(custody, "amazon-s3")
    val generation = UUID.randomUUID().toString()
    val target = S3Target("amazon-s3", "https://s3.us-east-1.amazonaws.com", "us-east-1", "owned-bucket", "owned", false,
      S3Target.hash("synthetic"), generation, generation)
    try {
      rejected { journal.setEnabled(true) }
      journal.prepareProfile(target); journal.confirmProfile(target); journal.setEnabled(true)
      val binding = S3Target.hash("source-binding")
      val context = journal.bindSources(binding)
      check(journal.bindSources(binding) == context)
      fun job(): AndroidS3Job {
        val id = UUID.randomUUID().toString()
        return AndroidS3Job(id, journal.installation(), journal.context(), target, UUID.randomUUID().toString(),
          "reference", "revision", "source-generation", "$id.snapshot", "objects/${journal.installation()}/$id", S3Target.hash("bytes"), 5)
      }
      val first = job(); journal.insert(first)
      rejected { journal.insert(first) }; rejected { journal.insert(first.copy(installation = UUID.randomUUID().toString())) }
      rejected { journal.state(first.copy(reference = "other")) }
      rejected { journal.record(first, "prepared", "completed") { true } }
      rejected { journal.record(first, "prepared", "creating") { false } }
      check(journal.state(first) == "prepared" && journal.events(first, "creating").isEmpty())
      journal.record(first, "prepared", "creating") { true }
      journal.record(first, "creating", "created", JSONObject().put("upload", "owned-upload")) { true }
      journal.record(first, "created", "part-intent") { true }
      journal.record(first, "part-intent", "part-ack", JSONObject().put("etag", "part")) { true }
      journal.record(first, "part-ack", "completing") { true }
      journal.invalidate()
      journal.record(first, "completing", "complete-ack", JSONObject().put("etag", "complete")) { false }
      rejected { journal.record(first, "complete-ack", "completed", JSONObject().put("sha256", first.sha256).put("size", "5")) { true } }
      journal.record(first, "complete-ack", "review") { false }
      rejected { journal.record(first, "review", "creating") { true } }
      val second = job(); journal.insert(second)
      journal.record(second, "prepared", "creating") { true }
      val identity = journal.installation()
      journal.database.close(); journal = AndroidS3Journal(custody, "amazon-s3")
      check(journal.installation() == identity && journal.state(first) == "review")
      check(journal.events(first, "complete-ack").single().getString("etag") == "complete")
      journal.recoverInterrupted(); check(journal.state(second) == "review")
      rejected { journal.database.execSQL("DELETE FROM s3_job WHERE id=?", arrayOf(first.id)) }
      rejected { journal.database.execSQL("UPDATE s3_event SET payload='{}' WHERE job=?", arrayOf(first.id)) }
      rejected { journal.database.execSQL("UPDATE s3_job SET header='{}' WHERE id=?", arrayOf(first.id)) }
      check(journal.bindSources(S3Target.hash("changed-source")) != context)
      val third = job(); journal.insert(third)
      val phases = listOf("prepared", "creating", "created", "part-intent", "part-ack", "completing", "complete-ack")
      for ((from, to) in phases.zipWithNext()) journal.record(third, from, to) { true }
      rejected { journal.record(third, "complete-ack", "completed", JSONObject().put("sha256", third.sha256).put("size", "6")) { true } }
      journal.record(third, "complete-ack", "completed", JSONObject().put("sha256", third.sha256).put("size", "5")) { true }
      journal.recoverInterrupted(); check(journal.state(third) == "completed")
      journal.setEnabled(false); rejected { journal.insert(job()) }
      val p5 = AndroidS3Journal(custody, "s3-compatible")
      try { rejected { p5.insert(first) }; check(!p5.enabled() && p5.installation() != identity) } finally { p5.database.close() }
    } finally { journal.database.close() }
  }
}
