package com.kloda.sync

import android.content.Context
import java.util.UUID

// 18B/5r: any destination with a transport (DAV GET, Dropbox files/download); bytes are checked by Kloda's SHA-256.
// 29/4 (ADR0029 §5): an imported receipt of this destination restores through the same download and checks; the
// download alone never makes a remote file restorable.
internal class AndroidWebDavDownload(private val target: String, private val transport: AndroidBackupTransport,
  private val journal: AndroidWebDavJournal, private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  constructor(context: Context, destination: AndroidCloudTarget, journal: AndroidWebDavJournal, snapshots: AndroidFilesSnapshots, check: () -> Unit) :
    this(destination.targetId(), destination.transport(context, snapshots, check), journal, snapshots, check)
  fun cancel() { transport.cancel(); snapshots.cancelRead() }
  fun receipt(id: String): WebDavUpload {
    check()
    if (runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false).not()) throw FilesFailure("invalid_request")
    val value = journal.find(id) ?: journal.imports.imported(id, target) ?: throw FilesFailure("review_required")
    if (value.target != target || value.phase != "completed" || value.skipped || value.issue != null || value.sourceIdentity == null ||
      value.kind !in setOf("file", "photo_resource", "photo_manifest")) throw FilesFailure("review_required")
    return value
  }
  fun stage(id: String): FilesSnapshot {
    val value = receipt(id)
    val path = if (value.binding == AndroidRecoveryImportJournal.BINDING) value.relativePath else journal.publications.read(value)
    return snapshots.stageDownload(FilesDigest(value.sha256, value.size)) { output ->
      val reply = transport.download(path, value) { bytes, size -> check(); output.write(bytes, 0, size) }
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
      requireResources(result, value)
      if (result.filename != value.relativePath.substringAfterLast('/') || value.sourceIdentity != "photos:${result.sourceDeviceId}:${result.assetId}:manifest") throw FilesFailure("manifest_invalid")
      check(); return result
    } finally { snapshots.discard(staged) }
  }
  // A manifest's resources resolve through the manifest's own authority: this device's Completed receipts, or imported
  // receipts of the manifest's catalog origin; never one for the other.
  fun resource(manifest: WebDavPhotoManifest, resource: WebDavPhotoResource, receipt: WebDavUpload): WebDavUpload? {
    val identity = "photos:${manifest.sourceDeviceId}:${manifest.assetId}:${resource.role}"
    if (receipt.binding != AndroidRecoveryImportJournal.BINDING) {
      return journal.photoReceipt(receipt.target, receipt.source, resource.relativePath, identity, resource.sha256, resource.size)
    }
    return journal.imports.resource(receipt.id, target, resource.relativePath, identity, resource.sha256, resource.size)
  }
  fun requireResources(manifest: WebDavPhotoManifest, receipt: WebDavUpload) {
    if (receipt.binding != AndroidRecoveryImportJournal.BINDING) return WebDavPhotoManifestCodec.requireReceipts(manifest, receipt.target, journal)
    WebDavPhotoManifestCodec.validate(manifest)
    if (manifest.resources.any { resource(manifest, it, receipt) == null }) throw FilesFailure("manifest_invalid")
  }
}
