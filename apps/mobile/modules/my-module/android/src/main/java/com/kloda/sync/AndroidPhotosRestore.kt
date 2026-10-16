package com.kloda.sync

import android.content.Context
import android.os.Build
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

internal class AndroidPhotosRestore(
  private val context: Context,
  private val check: () -> Unit,
  private val send: (String, Int) -> String
) {
  companion object {
    fun status(context: Context): Map<String, Any> = synchronized(AndroidPhotosImportJournal.lock) {
      AndroidPhotosImportJournal(context).use { it.status() }
    }
  }
  private val paused = AtomicBoolean(false)
  fun pause() { paused.set(true) }
  private fun guard() { if (paused.get()) throw FilesFailure("cancelled"); check() }
  private val media = AndroidPhotosMedia(context, ::guard)
  private fun remote(resource: PhotoResource): OwnBackup {
    guard()
    val backup = AndroidOwnBackups.status(send(JSONObject().put("kind", "status").put("id", resource.operationId).toString(), -1), resource.operationId)
    if (backup != OwnBackup(resource.operationId, resource.name, resource.sha256, resource.size)) throw FilesFailure("outcome_unknown")
    guard(); return backup
  }
  private fun result(journal: AndroidPhotosImportJournal, intent: PhotoImportIntent): Map<String, Any> = journal.status() + mapOf(
    "assetId" to intent.manifest.assetId, "targetAssetId" to (intent.uri ?: ""), "itemState" to intent.phase,
    "mediaCompleted" to (intent.uri != null && intent.phase in setOf("completed", "organization_review")),
    "metadataCompleted" to (intent.phase == "completed"), "reason" to intent.reason)
  private fun review(journal: AndroidPhotosImportJournal, intent: PhotoImportIntent, reason: String): Map<String, Any> {
    val next = intent.copy(phase = "review_required", reason = reason)
    journal.save(next); return result(journal, next)
  }
  private fun complete(journal: AndroidPhotosImportJournal, intent: PhotoImportIntent): Map<String, Any> {
    val current = if (intent.owned && AndroidPhotosImportJournal.folder(intent.manifest) != intent.folder)
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
    journal.save(next); return result(journal, next)
  }

  fun restore(manifest: PhotoManifest): Map<String, Any> = synchronized(AndroidPhotosImportJournal.lock) {
    // Revalidate even in-process values at the same trust boundary as decoded manifests.
    PhotoManifestCodec.decode(PhotoManifestCodec.encode(manifest))
    AndroidPhotosImportJournal(context).use { journal ->
      var intent = journal.get(AndroidPhotosImportJournal.identity(manifest.sourceDeviceId, manifest.assetId))
      var stage: File? = null
      try {
        guard(); media.permission()
        val library = media.library(intent?.uri?.let { android.net.Uri.parse(it) })
        manifest.resources.forEach(::remote)
        if (intent == null) intent = journal.prepare(manifest, library)
        var current = intent!!
        if (current.library != library) return@synchronized review(journal, current, "target_library_changed")
        val sameBytes = manifest.resources.size == current.manifest.resources.size && manifest.resources.indices.all { index ->
          val source = manifest.resources[index]; val saved = current.manifest.resources[index]
          source.role == saved.role && source.name == saved.name && source.mimeType == saved.mimeType &&
            source.sha256 == saved.sha256 && source.size == saved.size
        }
        if (manifest.revision < current.manifest.revision || !sameBytes ||
          manifest.revision == current.manifest.revision && manifest != current.manifest)
          return@synchronized review(journal, current, "source_revision_changed")
        if (manifest.resources.size != 1 || manifest.resources.single().role != "original" ||
          !manifest.resources.single().mimeType.let { it.startsWith("image/") || it.startsWith("video/") }) {
          current = current.copy(phase = "organization_review", reason = "unsupported_resource_role")
          journal.save(current); return@synchronized result(journal, current)
        }
        if (current.phase == "review_required" && !(current.uri != null && current.reason == "destination_permission_lost"))
          return@synchronized result(journal, current)
        if (manifest != current.manifest) {
          val metadataChanged = manifest.albums != current.manifest.albums || manifest.favorite != current.manifest.favorite
          current = current.copy(manifest = manifest,
            phase = if (metadataChanged && current.uri != null) "organizing" else current.phase,
            folder = if (current.uri == null && current.phase == "prepared") AndroidPhotosImportJournal.folder(manifest) else current.folder)
          journal.save(current); intent = current
        }
        if (current.uri != null) {
          val target = media.receipt(current)
          if (target == null) {
            // An unrecorded create or expired pending item is not evidence of a completed asset's deletion.
            if (current.phase !in setOf("completed", "organization_review"))
              return@synchronized review(journal, current, "missing_unfinished_target")
            if (media.markers(current).isNotEmpty()) return@synchronized review(journal, current, "target_identity_uncertain")
            guard(); media.permission()
            current = current.copy(token = java.util.UUID.randomUUID().toString().replace("-", ""), uri = null,
              phase = "prepared", owned = true, reason = "", library = media.library(), folder = AndroidPhotosImportJournal.folder(manifest))
            journal.save(current); intent = current
          } else {
            if (target.trashed || current.owned && !media.owned(current, target))
              return@synchronized review(journal, current, "target_identity_uncertain")
            val exact = try { media.verify(current.resource, target); true } catch (error: FilesFailure) {
              if (error.code != "hash_mismatch") throw error
              false
            }
            if (exact) {
              if (current.owned) media.publish(current)
              return@synchronized complete(journal, current)
            }
            if (!current.owned || Build.VERSION.SDK_INT < 29 || !target.pending)
              return@synchronized review(journal, current, "target_bytes_changed")
          }
        } else if (current.phase == "creating") {
          val candidates = media.markers(current)
          if (candidates.size != 1 || !media.owned(current, candidates.single()))
            return@synchronized review(journal, current, "create_receipt_missing")
          // Recover a lost receipt only after full metadata and original-byte verification.
          media.verify(current.resource, candidates.single())
          current = current.copy(uri = candidates.single().uri.toString(), phase = "written")
          journal.save(current); intent = current
          media.publish(current)
          return@synchronized complete(journal, current)
        } else if (current.phase != "prepared") {
          return@synchronized review(journal, current, "target_identity_uncertain")
        }
        if (current.uri == null) {
          val existing = mutableListOf<PhotoTarget>()
          for (candidate in media.existing(current.resource)) {
            try { media.verify(current.resource, candidate); existing += candidate }
            catch (error: FilesFailure) { if (error.code != "hash_mismatch") throw error }
          }
          if (existing.size > 1) return@synchronized review(journal, current, "multiple_existing_targets")
          if (existing.size == 1) {
            // Matching another app's accessible original is read-only, never a source-ID adoption.
            current = current.copy(uri = existing.single().uri.toString(), owned = false, phase = "written",
              library = media.library(existing.single().uri))
            journal.save(current); intent = current
            return@synchronized complete(journal, current)
          }
        }
        stage = AndroidBackupDownload(::guard, send).download(remote(current.resource), File(context.cacheDir, "kloda-photos-restore"))
        if (current.uri == null) {
          current = current.copy(phase = "creating")
          journal.save(current); intent = current
          guard(); media.permission()
          val uri = media.insert(current)
          // Do not run cancellation between insert and the durable URI receipt.
          current = current.copy(uri = uri.toString(), phase = "inserted")
          journal.save(current); intent = current
        }
        media.write(current, stage!!)
        current = current.copy(phase = "written")
        journal.save(current); intent = current
        remote(current.resource)
        media.publish(current)
        return@synchronized complete(journal, current)
      } catch (error: Exception) {
        if (error is FilesFailure && error.code in setOf("cancelled", "paused")) throw error
        val reason = if (error is FilesFailure) error.code else if (error is SecurityException) "destination_permission_lost" else "outcome_unknown"
        val recorded = intent
        if (recorded != null) return@synchronized review(journal, recorded, reason)
        throw FilesFailure(reason)
      } finally { stage?.delete() }
    }
  }
}
