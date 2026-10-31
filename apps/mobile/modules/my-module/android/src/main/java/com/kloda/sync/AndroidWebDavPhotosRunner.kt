package com.kloda.sync

import android.content.Context
import java.io.ByteArrayInputStream

internal class AndroidWebDavPhotosRunner(private val context: Context, private val publisher: AndroidWebDavPublisher) {
  private val photos = AndroidPhotosSources(context)
  var errorCode: String? = null
    private set
  fun run(sources: Map<String, String>) {
    AndroidPhotoManifestJournal(context).use { identities ->
      val seen = mutableSetOf<String>()
      for ((source, tree) in sources.filterValues { AndroidPhotosSources.isPhotos(it) }) {
        publisher.check()
        try {
          for (file in photos.scan(tree)) {
            publisher.check()
            if (!seen.add(file.reference)) continue
            try { publish(source, tree, file, identities) }
            catch (error: FilesFailure) {
              if (error.code in setOf("cancelled", "settings_changed", "connection_unavailable", "storage_failure", "local_storage_full")) throw error
              errorCode = error.code
            }
          }
        } catch (error: FilesFailure) {
          if (error.code in setOf("cancelled", "settings_changed", "connection_unavailable", "storage_failure", "local_storage_full")) throw error
          errorCode = error.code
        }
      }
    }
  }
  private fun publish(source: String, tree: String, file: QueuedSourceFile, identities: AndroidPhotoManifestJournal) {
    val metadata = photos.metadata(tree, file.reference, identities)
    val digest = publisher.snapshots.currentDigest(tree, file.reference)
    if (metadata.name != file.relativePath || digest.size != file.size) throw FilesFailure("source_changed")
    val path = "$source/${metadata.assetId}/original/${digest.sha256}/${metadata.name}"
    val validate = {
      publisher.check()
      if (photos.metadata(tree, file.reference, identities) != metadata || publisher.snapshots.currentDigest(tree, file.reference) != digest) throw FilesFailure("source_changed")
      publisher.check()
    }
    val published = publisher.publish(source, path, path, file.revision, digest, "photos:${metadata.sourceDeviceId}:${metadata.assetId}:original",
      { publisher.snapshots.stage(tree, file.reference) }, validate, kind = "photo_resource")
    val resource = WebDavPhotoResource(publisher.journal.publications.read(published), "original", metadata.name, metadata.mimeType, digest.sha256, digest.size)
    val draft = WebDavPhotoManifest(metadata.sourceDeviceId, metadata.assetId, 1, listOf(resource), metadata.albums, metadata.favorite)
    val target = publisher.profile.targetId()
    val signature = AndroidFilesSnapshots.digest(ByteArrayInputStream(WebDavPhotoManifestCodec.encode(draft))).sha256
    val revision = publisher.journal.photoRevision("$target:${metadata.assetId}", signature)
    val manifest = draft.copy(revision = revision)
    WebDavPhotoManifestCodec.requireReceipts(manifest, target, publisher.journal)
    val bytes = WebDavPhotoManifestCodec.encode(manifest)
    val hash = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
    val manifestPath = "$source/${manifest.filename}"
    publisher.publish(source, manifestPath, manifestPath, revision.toString(), hash, "photos:${metadata.sourceDeviceId}:${metadata.assetId}:manifest",
      { publisher.snapshots.stageMetadata(bytes) }, {
        validate()
        WebDavPhotoManifestCodec.requireReceipts(manifest, target, publisher.journal)
        val completed = publisher.journal.photoReceipt(target, source, resource.relativePath,
          "photos:${metadata.sourceDeviceId}:${metadata.assetId}:${resource.role}", resource.sha256, resource.size) ?: throw FilesFailure("manifest_invalid")
        if (publisher.transport.inspect(resource.relativePath, completed) != "match") throw FilesFailure("review_required")
      }, kind = "photo_manifest")
  }
}
