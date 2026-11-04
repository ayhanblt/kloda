package com.kloda.sync

import android.content.Context
import android.os.Looper
import java.io.ByteArrayInputStream

internal class AndroidS3Photos(private val app: Context, private val profiles: AndroidS3Profiles, private val track: (AndroidS3Job) -> Unit) {
  fun run(cancelled: () -> Boolean) {
    if (Looper.myLooper() == Looper.getMainLooper()) throw S3Failure("worker_required")
    val journal = profiles.journal; val sources = AndroidS3Sources.capture(app, journal)
    val captured = profiles.capture() ?: throw S3Failure("profile_missing")
    val check = { if (cancelled() || !profiles.current(captured)) throw S3Failure("context_changed"); sources.check(app, journal) }
    val photos = AndroidPhotosSources(app); val state = AndroidS3PhotosState(journal)
    val snapshots = AndroidFilesSnapshots(app, s3 = journal.provider, checkPaused = check)
    val device = journal.installation(); val seen = mutableSetOf<String>()
    fun publish(job: AndroidS3Job, snapshot: FilesSnapshot, current: () -> Boolean, validate: () -> Unit): AndroidS3Job {
      val known = journal.known(job)
      if (known != null) {
        val reader = AndroidS3Download(app, profiles, snapshots, check)
        snapshots.discard(reader.stage(known.id)); validate(); track(known); return known
      }
      if (journal.unresolved(job)) throw S3Failure("review_required")
      snapshots.open(snapshot.id, snapshot.digest.size).use { descriptor ->
        snapshots.validate(snapshot.digest, descriptor); journal.insert(job)
        AndroidS3Publisher(app, profiles, check).publish(job, descriptor, current, validate)
      }
      track(job); return job
    }
    for ((source, tree) in sources.sources.sources.filterValues { AndroidPhotosSources.isPhotos(it) }) {
      check()
      for (file in photos.scan(tree)) {
        check(); if (!seen.add(file.reference)) continue
        val metadata = photos.metadata(tree, file.reference, device, state::identity)
        val staged = snapshots.stage(tree, file.reference)
        if (metadata.name != file.relativePath || staged.digest.size != file.size) throw S3Failure("source_changed")
        val current = { check(); if (photos.metadata(tree, file.reference, device, state::identity) != metadata) throw S3Failure("source_changed"); check(); true }
        val validate = { current(); if (snapshots.currentDigest(tree, file.reference) != staged.digest) throw S3Failure("source_changed"); current(); Unit }
        val job = AndroidS3Job(staged.id, device, captured.context, captured.profile.target, source, "${metadata.assetId}:original", staged.digest.sha256,
          sources.context, staged.id + ".snapshot", "objects/$device/${staged.id}", staged.digest.sha256, staged.digest.size,
          metadata.name, "${metadata.assetId}/original", "photo_resource", metadata.assetId, metadata.mimeType)
        val completed = publish(job, staged, current, validate); snapshots.discard(staged)
        val resource = S3PhotoResource(completed.key, "original", metadata.name, metadata.mimeType, completed.sha256, completed.size)
        val draft = S3PhotoManifest(device, metadata.assetId, 1, listOf(resource), metadata.albums, metadata.favorite)
        val signature = AndroidFilesSnapshots.digest(ByteArrayInputStream(S3PhotoManifestCodec.encode(draft))).sha256
        val revision = state.revision("${captured.profile.target.archiveId()}:${metadata.assetId}", signature)
        val manifest = draft.copy(revision = revision); S3PhotoManifestCodec.requireReceipts(manifest, captured.profile.target, journal)
        val snapshot = snapshots.stageMetadata(S3PhotoManifestCodec.encode(manifest))
        val header = AndroidS3Job(snapshot.id, device, captured.context, captured.profile.target, source, "${metadata.assetId}:manifest", revision.toString(),
          sources.context, snapshot.id + ".snapshot", "objects/$device/${snapshot.id}", snapshot.digest.sha256, snapshot.digest.size,
          manifest.filename, "${metadata.assetId}/${manifest.filename}", "photo_manifest", metadata.assetId, "application/json")
        publish(header, snapshot, current, {
          validate(); S3PhotoManifestCodec.requireReceipts(manifest, captured.profile.target, journal)
          val own = S3PhotoManifestCodec.resourceReceipt(resource, manifest, captured.profile.target, journal) ?: throw S3Failure("manifest_invalid")
          snapshots.discard(AndroidS3Download(app, profiles, snapshots, check).stage(own.id)); validate()
        })
        snapshots.discard(snapshot)
      }
    }
  }
}
