package com.kloda.sync

import android.content.Context
import java.util.UUID

// 18B/5r: any destination with a transport (DAV GET, Dropbox files/download); bytes are checked by Kloda's SHA-256.
internal class AndroidWebDavDownload(context: Context, private val destination: AndroidCloudTarget,
  private val journal: AndroidWebDavJournal, private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  private val transport = destination.transport(context, snapshots, check)
  fun cancel() { transport.cancel(); snapshots.cancelRead() }
  fun receipt(id: String): WebDavUpload {
    check()
    if (runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false).not()) throw FilesFailure("invalid_request")
    val value = journal.find(id) ?: throw FilesFailure("review_required")
    if (value.target != destination.targetId() || value.phase != "completed" || value.skipped || value.issue != null || value.sourceIdentity == null ||
      value.kind !in setOf("file", "photo_resource", "photo_manifest")) throw FilesFailure("review_required")
    return value
  }
  fun stage(id: String): FilesSnapshot {
    val value = receipt(id)
    return snapshots.stageDownload(FilesDigest(value.sha256, value.size)) { output ->
      val reply = transport.download(journal.publications.read(value), value) { bytes, size -> check(); output.write(bytes, 0, size) }
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
