package com.kloda.sync

import android.content.Context
import java.util.UUID

internal class AndroidWebDavPhotosRestore(private val context: Context, private val profile: AndroidWebDavProfile,
  private val binding: String, override val ticket: UUID, private val owner: () -> Unit) : AndroidWebDavRestoreTask {
  override val choosing = false
  private val commitLock = Any()
  @Volatile private var cancelled = false
  @Volatile private var download: AndroidWebDavDownload? = null
  override fun pause(includePicker: Boolean) { synchronized(commitLock) { cancelled = true }; download?.cancel() }
  private fun check() {
    if (cancelled) throw FilesFailure("cancelled")
    owner()
    synchronized(AndroidSyncJournal.sourceLock) {
      if (AndroidWebDavVault(context).read() != profile || FilesRunContext.webdav(context).binding != binding) throw FilesFailure("settings_changed")
    }
  }
  fun restore(id: String): Map<String, String> = AndroidSyncJournal.webdav(context).use { database ->
    check()
    val journal = AndroidWebDavJournal(database.writableDatabase)
    val snapshots = AndroidFilesSnapshots(context, true, checkPaused = ::check)
    val reader = AndroidWebDavDownload(context, profile, journal, snapshots, ::check)
    download = reader
    val staged = mutableMapOf<String, FilesSnapshot>()
    try {
      val receipt = reader.receipt(id)
      val manifest = reader.manifest(id)
      for (resource in manifest.resources) {
        check()
        val own = journal.photoReceipt(receipt.target, receipt.source, resource.relativePath,
          "photos:${manifest.sourceDeviceId}:${manifest.assetId}:${resource.role}", resource.sha256, resource.size) ?: throw FilesFailure("manifest_invalid")
        staged[resource.relativePath] = reader.stage(own.id)
      }
      val state = AndroidWebDavPhotosJournal(database.writableDatabase, receipt.target) { action ->
        synchronized(AndroidSyncJournal.sourceLock) { synchronized(commitLock) { check(); action() } }
      }
      WebDavPhotoManifestCodec.requireReceipts(manifest, receipt.target, journal)
      val result = AndroidWebDavPhotosImport(context, receipt.target, receipt.source, journal, state, staged, snapshots, ::check).restore(manifest)
      check()
      if (result["metadataCompleted"] != true || result["itemState"] != "completed") throw FilesFailure(if (result["itemState"] == "organization_review") "organization_review" else "review_required")
      mapOf("state" to "completed", "id" to id, "name" to manifest.filename)
    } finally { staged.values.forEach(snapshots::discard); reader.cancel(); download = null }
  }
}
