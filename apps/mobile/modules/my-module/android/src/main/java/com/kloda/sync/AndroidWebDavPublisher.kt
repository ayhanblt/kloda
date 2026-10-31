package com.kloda.sync

import android.content.Context
import java.util.UUID

internal class AndroidWebDavPublisher(context: Context, val profile: AndroidWebDavProfile, val binding: String,
  val journal: AndroidWebDavJournal, val snapshots: AndroidFilesSnapshots, val check: () -> Unit,
  private val settle: (WebDavUpload) -> Unit, private val track: (WebDavUpload) -> Unit) {
  val transport = AndroidWebDavTransport(context, profile, snapshots, check)
  fun cancel() { transport.cancel(); snapshots.cancelRead() }
  fun publish(source: String, reference: String, path: String, revision: String, digest: FilesDigest, sourceIdentity: String,
    prepare: () -> FilesSnapshot, validate: () -> Unit, kind: String = "file"): WebDavUpload {
    check()
    val target = profile.targetId()
    val rows = journal.candidates(target, source, reference)
    val pending = rows.filter { it.phase != "completed" && !it.skipped }
    if (pending.size > 1) throw FilesFailure("review_required")
    val job: WebDavUpload
    if (pending.isNotEmpty()) {
      val old = pending.single()
      if (old.binding != binding || old.sourceIdentity != sourceIdentity || old.relativePath != path || old.sha256 != digest.sha256 || old.size != digest.size) {
        if (old.issue == null) journal.issue(old, "settings_changed")
        throw FilesFailure("review_required")
      }
      job = old
    } else {
      val same = rows.firstOrNull { it.relativePath == path && it.sha256 == digest.sha256 && it.size == digest.size }
      if (same != null) {
        if (same.sourceIdentity != sourceIdentity) throw FilesFailure("source_identity_unknown")
        if (same.skipped || same.phase != "completed") throw FilesFailure("review_required")
        job = same
      } else {
        val prepared = prepare()
        if (prepared.digest != digest) { snapshots.discard(prepared); throw FilesFailure("source_changed") }
        try { check() } catch (error: Exception) { snapshots.discard(prepared); throw error }
        job = WebDavUpload(UUID.randomUUID().toString(), target, binding, source, reference, path,
          revision, prepared.id, digest.sha256, digest.size, kind = kind, sourceIdentity = sourceIdentity)
        // Insertion uncertainty must retain bytes for a possibly durable intent.
        journal.insert(job)
      }
    }
    track(job)
    try {
      validate(); check()
      val sender = AndroidWebDavPublication(journal, transport::inspect, transport::upload, transport::move, check,
        { value -> validate(); settle(value) })
      if (!sender.execute(job.id)) throw FilesFailure("review_required")
      val completed = journal.find(job.id) ?: throw FilesFailure("outcome_unknown")
      if (completed.phase != "completed") throw FilesFailure("outcome_unknown")
      validate(); check()
      if (job.phase != "completed") snapshots.discard(FilesSnapshot(job.snapshot, digest))
      return completed
    } catch (error: FilesFailure) {
      if (error.code !in setOf("connection_unavailable", "cancelled", "settings_changed", "storage_failure")) {
        val current = journal.find(job.id)
        if (current != null && current.phase != "completed" && current.issue == null) journal.issue(current, error.code)
      }
      throw error
    }
  }
}
