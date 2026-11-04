package com.kloda.sync

import android.content.Context
import android.os.Build

internal class AndroidS3PhotosImport(
  private val context: Context, private val target: S3Target,
  private val journal: AndroidS3Journal, private val state: AndroidS3PhotosJournal,
  private val stages: Map<String, FilesSnapshot>, private val snapshots: AndroidFilesSnapshots,
  private val check: () -> Unit
) {
  companion object {
    private val active = mutableSetOf<String>()
    private fun <T> withJob(id: String, action: () -> T): T {
      if (!synchronized(active) { active.add(id) }) throw FilesFailure("backup_busy")
      try { return action() } finally { synchronized(active) { active.remove(id) } }
    }
  }
  private fun guard() = check()
  private val media = AndroidPhotosMedia(context, ::guard)
  private lateinit var currentManifest: S3PhotoManifest
  private fun remote(resource: S3PhotoResource): AndroidS3Job {
    guard()
    return S3PhotoManifestCodec.resourceReceipt(resource, currentManifest, target, journal) ?: throw FilesFailure("manifest_invalid")
  }
  private fun result(intent: S3PhotoImportIntent): Map<String, Any> = mapOf(
    "assetId" to intent.manifest.assetId, "targetAssetId" to (intent.uri ?: ""), "itemState" to intent.phase,
    "mediaCompleted" to (intent.uri != null && intent.phase in setOf("completed", "organization_review")),
    "metadataCompleted" to (intent.phase == "completed"), "reason" to intent.reason)
  private fun review(journal: AndroidS3PhotosJournal, intent: S3PhotoImportIntent, reason: String): Map<String, Any> {
    val next = intent.copy(phase = "review_required", reason = reason)
    journal.save(next); return result(next)
  }
  private fun complete(journal: AndroidS3PhotosJournal, intent: S3PhotoImportIntent): Map<String, Any> {
    val current = if (intent.owned && AndroidS3PhotosJournal.folder(target.archiveId(), intent.manifest) != intent.folder)
      intent.copy(phase = "organizing").also(journal::save) else intent
    val metadata = try { media.metadata(current) } catch (error: FilesFailure) {
      if (error.code == "cancelled" || error.code == "paused" || error.code == "destination_permission_lost") throw error
      false
    } catch (_: SecurityException) { false }
    guard()
    val actualFolder = if (current.owned && Build.VERSION.SDK_INT >= 29)
      media.receipt(current)?.folder ?: throw FilesFailure("outcome_unknown") else current.folder
    val next = current.copy(phase = if (metadata) "completed" else "organization_review", folder = actualFolder,
      reason = if (metadata) "" else "unsupported_organization")
    journal.save(next); return result(next)
  }

  fun restore(manifest: S3PhotoManifest): Map<String, Any> = withJob("photo-import:$target:${manifest.sourceDeviceId}:${manifest.assetId}") {
    currentManifest = manifest
    // Revalidate even in-process values at the same trust boundary as decoded manifests.
    S3PhotoManifestCodec.decode(S3PhotoManifestCodec.encode(manifest))
    val journal = state
    run {
      var intent = journal.get(AndroidS3PhotosJournal.identity(target.archiveId(), manifest.sourceDeviceId, manifest.assetId))
      try {
        guard(); media.permission()
        val library = media.library(intent?.uri?.let { android.net.Uri.parse(it) })
        manifest.resources.forEach(::remote)
        if (intent == null) intent = journal.prepare(manifest, library)
        var current = intent!!
        if (current.library != library) return@withJob review(journal, current, "target_library_changed")
        val sameBytes = manifest.resources.size == current.manifest.resources.size && manifest.resources.indices.all { index ->
          val source = manifest.resources[index]; val saved = current.manifest.resources[index]
          source.role == saved.role && source.name == saved.name && source.mimeType == saved.mimeType &&
            source.sha256 == saved.sha256 && source.size == saved.size
        }
        if (manifest.revision < current.manifest.revision || !sameBytes ||
          manifest.revision == current.manifest.revision && manifest != current.manifest)
          return@withJob review(journal, current, "source_revision_changed")
        if (manifest.resources.size != 1 || manifest.resources.single().role != "original" ||
          !manifest.resources.single().mimeType.let { it.startsWith("image/") || it.startsWith("video/") }) {
          current = current.copy(phase = "organization_review", reason = "unsupported_resource_role")
          journal.save(current); return@withJob result(current)
        }
        if (current.phase == "review_required" && !(current.uri != null && current.reason == "destination_permission_lost"))
          return@withJob result(current)
        if (manifest != current.manifest) {
          val metadataChanged = manifest.albums != current.manifest.albums || manifest.favorite != current.manifest.favorite
          current = current.copy(manifest = manifest,
            phase = if (metadataChanged && current.uri != null) "organizing" else current.phase,
            folder = if (current.uri == null && current.phase == "prepared") AndroidS3PhotosJournal.folder(this.target.archiveId(), manifest) else current.folder)
          journal.save(current); intent = current
        }
        if (current.uri != null) {
          val target = media.receipt(current)
          if (target == null) {
            // An unrecorded create or expired pending item is not evidence of a completed asset's deletion.
            if (current.phase !in setOf("completed", "organization_review"))
              return@withJob review(journal, current, "missing_unfinished_target")
            if (media.markers(current).isNotEmpty()) return@withJob review(journal, current, "target_identity_uncertain")
            guard(); media.permission()
            current = current.copy(token = java.util.UUID.randomUUID().toString().replace("-", ""), uri = null,
              phase = "prepared", owned = true, reason = "", library = media.library(), folder = AndroidS3PhotosJournal.folder(this.target.archiveId(), manifest))
            journal.save(current); intent = current
          } else {
            if (target.trashed || current.owned && !media.owned(current, target))
              return@withJob review(journal, current, "target_identity_uncertain")
            val exact = try { media.verify(current.resource, target); true } catch (error: FilesFailure) {
              if (error.code != "hash_mismatch") throw error
              false
            }
            if (exact) {
              if (current.owned) media.publish(current)
              return@withJob complete(journal, current)
            }
            if (!current.owned || Build.VERSION.SDK_INT < 29 || !target.pending)
              return@withJob review(journal, current, "target_bytes_changed")
          }
        } else if (current.phase == "creating") {
          val candidates = media.markers(current)
          if (candidates.size != 1 || !media.owned(current, candidates.single()))
            return@withJob review(journal, current, "create_receipt_missing")
          // Recover a lost receipt only after full metadata and original-byte verification.
          media.verify(current.resource, candidates.single())
          current = current.copy(uri = candidates.single().uri.toString(), phase = "written")
          journal.save(current); intent = current
          media.publish(current)
          return@withJob complete(journal, current)
        } else if (current.phase != "prepared") {
          return@withJob review(journal, current, "target_identity_uncertain")
        }
        val staged = stages[current.resource.relativePath] ?: throw FilesFailure("manifest_invalid")
        val stage = snapshots.verifiedFile(staged)
        if (current.uri == null) {
          current = current.copy(phase = "creating")
          journal.save(current); intent = current
          guard(); media.permission()
          val uri = media.insert(current)
          // Do not run cancellation between insert and the durable URI receipt.
          current = current.copy(uri = uri.toString(), phase = "inserted")
          journal.save(current); intent = current
        }
        media.write(current, stage)
        current = current.copy(phase = "written")
        journal.save(current); intent = current
        remote(current.resource)
        media.publish(current)
        return@withJob complete(journal, current)
      } catch (error: Exception) {
        if (error is FilesFailure && error.code in setOf("cancelled", "paused")) throw error
        val reason = if (error is FilesFailure) error.code else if (error is SecurityException) "destination_permission_lost" else if (isLocalStorageFull(error)) "local_storage_full" else "outcome_unknown"
        val recorded = intent
        if (recorded != null) return@withJob review(journal, recorded, reason)
        throw FilesFailure(reason)
      }
    }
  }
}
