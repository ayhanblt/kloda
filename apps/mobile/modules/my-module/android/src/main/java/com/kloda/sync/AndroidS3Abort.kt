package com.kloda.sync

import android.content.Context
import org.json.JSONObject

// Only a still-current owned upload with a durable create ACK; unknown completion is never aborted here.
internal object AndroidS3Abort {
  fun run(app: Context, profiles: AndroidS3Profiles, job: AndroidS3Job, current: () -> Boolean) {
    val journal = profiles.journal
    val captured = profiles.capture() ?: throw S3Failure("profile_missing")
    val phase = journal.state(job)
    if (phase !in listOf("created", "part-ack") || captured.context != job.context || captured.profile.target != job.target) throw S3Failure("binding_changed")
    val created = journal.events(job, "created")
    if (created.size != 1 || created[0].opt("upload") !is String) throw S3Failure("outcome_unknown")
    val upload = created[0].getString("upload")
    fun authorized(): Boolean = profiles.current(captured) && journal.enabled() && current()
    fun check() { if (!authorized()) throw S3Failure("context_changed") }
    check()
    journal.record(job, phase, "aborting", JSONObject().put("upload", upload), ::authorized)
    var status = 0
    try {
      val reply = AndroidS3Client(app, captured.profile, ::check).send(job.key, JSONObject().put("kind", "abort").put("upload", upload))
      status = reply.status
      if (status != 204 || reply.body.isNotEmpty()) throw S3Failure("review_required")
      journal.record(job, "aborting", "aborted", JSONObject().put("status", status)) { false }
    } catch (error: Exception) {
      if (journal.state(job) == "aborting") journal.record(job, "aborting", "review",
        JSONObject().put("code", (error as? S3Failure)?.code ?: "outcome_unknown").put("stage", "abort").put("status", status)) { false }
      throw error
    }
  }
}
