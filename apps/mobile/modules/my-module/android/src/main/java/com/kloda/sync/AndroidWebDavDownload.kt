package com.kloda.sync

import android.content.Context
import java.util.UUID

internal class AndroidWebDavDownload(context: Context, private val profile: AndroidWebDavProfile,
  private val journal: AndroidWebDavJournal, private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  private val client = AndroidWebDavClient(context, profile, check)
  fun cancel() { client.cancel(); snapshots.cancelRead() }
  fun receipt(id: String): WebDavUpload {
    check()
    if (runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false).not()) throw FilesFailure("invalid_request")
    val value = journal.find(id) ?: throw FilesFailure("review_required")
    if (value.target != profile.targetId() || value.phase != "completed" || value.skipped || value.issue != null || value.sourceIdentity == null ||
      value.kind !in setOf("file", "photo_resource", "photo_manifest")) throw FilesFailure("review_required")
    return value
  }
  fun stage(id: String): FilesSnapshot {
    val value = receipt(id)
    return snapshots.stageDownload(FilesDigest(value.sha256, value.size)) { output ->
      val reply = client.request(journal.publications.read(value), "GET", maximum = value.size, receive = { bytes, size -> check(); output.write(bytes, 0, size) })
      AndroidWebDavClient.require(reply, 200)
      if (reply.sha256 != value.sha256 || reply.size != value.size) throw FilesFailure("hash_mismatch")
      check()
    }
  }
  fun manifest(id: String): WebDavPhotoManifest {
    val value = receipt(id)
    if (value.kind != "photo_manifest" || value.size > 65536) throw FilesFailure("manifest_invalid")
    val staged = stage(id)
    try {
      val result = snapshots.open(staged.id, value.size).use { descriptor ->
        android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { WebDavPhotoManifestCodec.decode(it.readBytes()) }
      }
      WebDavPhotoManifestCodec.requireReceipts(result, value.target, journal)
      if (result.filename != value.relativePath.substringAfterLast('/') || value.sourceIdentity != "photos:${result.sourceDeviceId}:${result.assetId}:manifest") throw FilesFailure("manifest_invalid")
      check(); return result
    } finally { snapshots.discard(staged) }
  }
}
