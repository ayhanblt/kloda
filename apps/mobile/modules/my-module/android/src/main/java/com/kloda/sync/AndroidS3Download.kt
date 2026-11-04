package com.kloda.sync

import android.content.Context
import org.json.JSONObject

internal class AndroidS3Download(private val app: Context, private val profiles: AndroidS3Profiles,
  private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  init { if (snapshots.s3 != profiles.journal.provider) throw S3Failure("invalid_request") }
  @Volatile private var active: AndroidS3Client? = null
  fun cancel() { active?.cancel() }
  fun receipt(id: String): AndroidS3Job {
    check()
    val captured = profiles.capture() ?: throw S3Failure("profile_missing")
    return profiles.journal.receipt(id, captured.profile.target)
  }
  fun manifest(id: String): S3PhotoManifest {
    val job = receipt(id)
    if (job.kind != "photo_manifest" || job.size > 65536) throw S3Failure("manifest_invalid")
    val staged = stage(id)
    try {
      val bytes = android.os.ParcelFileDescriptor.AutoCloseInputStream(snapshots.open(staged.id, staged.digest.size)).use { it.readBytes() }
      val manifest = S3PhotoManifestCodec.decode(bytes)
      if (manifest.assetId != job.asset || manifest.sourceDeviceId != job.installation || manifest.revision.toString() != job.revision) throw S3Failure("manifest_invalid")
      S3PhotoManifestCodec.requireReceipts(manifest, job.target, profiles.journal); return manifest
    } finally { snapshots.discard(staged) }
  }
  fun stage(id: String): FilesSnapshot {
    check()
    val captured = profiles.capture() ?: throw S3Failure("profile_missing")
    val job = profiles.journal.receipt(id, captured.profile.target)
    val ack = profiles.journal.events(job, "complete-ack").single()
    val operation = JSONObject().put("kind", "get").put("version", ack.opt("version") ?: JSONObject.NULL)
    fun current() { check(); if (!profiles.current(captured)) throw S3Failure("context_changed") }
    val client = AndroidS3Client(app, captured.profile, ::current)
    active = client
    try { return snapshots.stageDownload(FilesDigest(job.sha256, job.size)) { output ->
      val reply = client.send(job.key, operation, maximum = job.size, receive = { data, size -> current(); output.write(data, 0, size) })
      if (reply.status != 200 || reply.size != job.size || reply.sha256 != job.sha256) throw S3Failure("verification_failed")
      current()
    } } finally { if (active === client) active = null }
  }
}
