package com.kloda.sync

import android.content.Context

// Native source identity and bytes are re-read before a review can settle an old upload.
internal class AndroidWebDavSourceValidation(private val context: Context, private val captured: AndroidWebDavContext,
  private val journal: AndroidWebDavJournal, private val snapshots: AndroidFilesSnapshots,
  private val transport: AndroidWebDavTransport, private val check: () -> Unit) {
  fun validate(value: WebDavUpload) {
    check()
    val source = captured.sources.sources[value.source] ?: throw FilesFailure("source_changed")
    if (value.kind == "file") {
      if (AndroidPhotosSources.isPhotos(source)) throw FilesFailure("source_identity_unknown")
      val file = AndroidSafSourceScanner(context.contentResolver).scan(source).firstOrNull { it.reference == value.reference } ?: throw FilesFailure("source_changed")
      val identity = "files:" + AndroidWebDavProfile.encode(java.security.MessageDigest.getInstance("SHA-256").digest(org.json.JSONArray().put(source).put(file.reference).toString().toByteArray(Charsets.UTF_8)))
      if (identity != value.sourceIdentity || value.relativePath != "${value.source}/${file.relativePath}" ||
        snapshots.currentDigest(source, file.reference) != FilesDigest(value.sha256, value.size)) throw FilesFailure("source_changed")
      check(); return
    }
    val parts = value.sourceIdentity?.split(':') ?: throw FilesFailure("source_identity_unknown")
    if (value.kind !in setOf("photo_resource", "photo_manifest") || parts.size != 4 || parts[0] != "photos" || !AndroidPhotosSources.isPhotos(source)) throw FilesFailure("source_identity_unknown")
    val photos = AndroidPhotosSources(context)
    AndroidPhotoManifestJournal(context).use { identities ->
      if (identities.sourceDeviceId() != parts[1]) throw FilesFailure("source_changed")
      var selected: Pair<QueuedSourceFile, PhotoSourceMetadata>? = null
      for (file in photos.scan(source)) {
        check()
        val metadata = photos.metadata(source, file.reference, identities)
        if (metadata.assetId == parts[2]) { selected = file to metadata; break }
      }
      val (file, metadata) = selected ?: throw FilesFailure("source_changed")
      val digest = snapshots.currentDigest(source, file.reference)
      if (value.kind == "photo_resource") {
        if (parts[3] != "original" || digest != FilesDigest(value.sha256, value.size) || metadata.name != value.relativePath.substringAfterLast('/')) throw FilesFailure("source_changed")
      } else {
        if (parts[3] != "manifest" || value.size > 65536) throw FilesFailure("manifest_invalid")
        val manifest = snapshots.open(value.snapshot, value.size).use { descriptor ->
          snapshots.validate(FilesDigest(value.sha256, value.size), descriptor)
          android.system.Os.lseek(descriptor.fileDescriptor, 0, android.system.OsConstants.SEEK_SET)
          android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { WebDavPhotoManifestCodec.decode(it.readBytes()) }
        }
        val resource = manifest.resources.singleOrNull() ?: throw FilesFailure("source_changed")
        if (manifest.sourceDeviceId != metadata.sourceDeviceId || manifest.assetId != metadata.assetId || manifest.albums != metadata.albums || manifest.favorite != metadata.favorite ||
          resource.role != "original" || resource.name != metadata.name || resource.mimeType != metadata.mimeType || resource.sha256 != digest.sha256 || resource.size != digest.size) throw FilesFailure("source_changed")
        WebDavPhotoManifestCodec.requireReceipts(manifest, value.target, journal)
        val receipt = journal.photoReceipt(value.target, value.source, resource.relativePath, "photos:${parts[1]}:${parts[2]}:original", resource.sha256, resource.size) ?: throw FilesFailure("manifest_invalid")
        if (transport.inspect(resource.relativePath, receipt) != "match") throw FilesFailure("review_required")
      }
      if (photos.metadata(source, file.reference, identities) != metadata || snapshots.currentDigest(source, file.reference) != digest) throw FilesFailure("source_changed")
      check()
    }
  }
}
