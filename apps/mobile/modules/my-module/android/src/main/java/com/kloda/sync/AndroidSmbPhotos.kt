package com.kloda.sync

import android.content.Context
import android.os.Looper
import java.io.ByteArrayInputStream

internal class AndroidSmbPhotos(private val app: Context, private val journal: AndroidSmbJournal,
  private val profiles: AndroidSmbProfiles, private val lan: AndroidSmbLan, private val track: (SmbUpload) -> Unit = {}) {
  fun run(cancelled: () -> Boolean) {
    if (Looper.myLooper() == Looper.getMainLooper()) throw SmbFailure("worker_required")
    val sources = AndroidSmbSources.capture(app, journal)
    val captured = profiles.capture() ?: throw SmbFailure("profile_missing")
    val check = {
      if (cancelled() || !profiles.current(captured)) throw SmbFailure("context_changed")
      sources.check(app, journal)
    }
    val photos = AndroidPhotosSources(app)
    val state = AndroidSmbPhotosState(journal)
    val snapshots = AndroidFilesSnapshots(app, smb = true, checkPaused = check)
    val publisher = AndroidSmbPublisher(app, journal, profiles, lan, snapshots, check)
    val device = journal.installation()
    val seen = mutableSetOf<String>()
    for ((source, tree) in sources.sources.sources.filterValues { AndroidPhotosSources.isPhotos(it) }) {
      check()
      for (file in photos.scan(tree)) {
        check()
        if (!seen.add(file.reference)) continue
        val metadata = photos.metadata(tree, file.reference, device, state::identity)
        val staged = snapshots.stage(tree, file.reference)
        if (metadata.name != file.relativePath || staged.digest.size != file.size) throw SmbFailure("source_changed")
        val current = {
          check()
          if (photos.metadata(tree, file.reference, device, state::identity) != metadata) throw SmbFailure("source_changed")
          check(); true
        }
        val validate = {
          current()
          if (snapshots.currentDigest(tree, file.reference) != staged.digest) throw SmbFailure("source_changed")
          current()
        }
        val path = "$source/media/${metadata.assetId}/original/${staged.digest.sha256}.bin"
        val job = SmbUpload(staged.id, device, captured.profile.target, captured.context, source, "${metadata.assetId}:original",
          staged.digest.sha256, path, staged.id + ".snapshot", staged.digest.sha256, staged.digest.size, "photo_resource",
          metadata.assetId, metadata.name, "${metadata.assetId}/original", metadata.mimeType)
        val completed = snapshots.open(staged.id, staged.digest.size).use { descriptor ->
          snapshots.validate(staged.digest, descriptor)
          publisher.publish(job, descriptor, completedSource = validate, currentSource = current)
        }
        track(completed)
        snapshots.discard(staged)
        val resource = SmbPhotoResource(completed.relativePath, "original", metadata.name, metadata.mimeType, staged.digest.sha256, staged.digest.size)
        val draft = SmbPhotoManifest(device, metadata.assetId, 1, listOf(resource), metadata.albums, metadata.favorite)
        val signature = AndroidFilesSnapshots.digest(ByteArrayInputStream(SmbPhotoManifestCodec.encode(draft))).sha256
        val revision = state.revision("${captured.profile.target.archiveId()}:${metadata.assetId}", signature)
        val manifest = draft.copy(revision = revision)
        SmbPhotoManifestCodec.requireReceipts(manifest, captured.profile.target, journal)
        val bytes = SmbPhotoManifestCodec.encode(manifest)
        val snapshot = snapshots.stageMetadata(bytes)
        val manifestJob = SmbUpload(snapshot.id, device, captured.profile.target, captured.context, source, "${metadata.assetId}:manifest",
          revision.toString(), "$source/${manifest.filename}", snapshot.id + ".snapshot", snapshot.digest.sha256, snapshot.digest.size,
          "photo_manifest", metadata.assetId)
        snapshots.open(snapshot.id, snapshot.digest.size).use { descriptor ->
          val manifestReceipt = publisher.publish(manifestJob, descriptor, completedSource = {
            validate()
            SmbPhotoManifestCodec.requireReceipts(manifest, captured.profile.target, journal)
            val receipt = SmbPhotoManifestCodec.resourceReceipt(resource, manifest, captured.profile.target, journal) ?: throw SmbFailure("manifest_invalid")
            val download = AndroidSmbDownload(app, journal, profiles, lan, snapshots) { current() }
            snapshots.discard(download.stage(receipt.id))
            validate()
          }, currentSource = current)
          track(manifestReceipt)
        }
        snapshots.discard(snapshot)
      }
    }
  }
}
