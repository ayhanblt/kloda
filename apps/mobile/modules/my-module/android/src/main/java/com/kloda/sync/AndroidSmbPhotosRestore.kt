package com.kloda.sync

import android.content.Context
import java.util.UUID

internal class AndroidSmbPhotosRestore(private val context: Context, private val journal: AndroidSmbJournal,
  private val profiles: AndroidSmbProfiles, private val captured: SmbProfileCapture, private val lan: AndroidSmbLan,
  private val binding: String, override val ticket: UUID, private val owner: () -> Unit) : AndroidSmbRestoreTask {
  override val choosing = false
  private val commitLock = Any()
  @Volatile private var cancelled = false
  @Volatile private var download: AndroidSmbDownload? = null
  override fun pause(includePicker: Boolean) { synchronized(commitLock) { cancelled = true }; download?.cancel() }
  private fun check() {
    if (cancelled) throw FilesFailure("cancelled")
    owner()
    synchronized(AndroidSyncJournal.sourceLock) {
      if (!profiles.current(captured) || FilesRunContext.webdav(context).binding != binding) throw FilesFailure("settings_changed")
    }
  }
  fun restore(id: String): Map<String, String> {
    check()
    val snapshots = AndroidFilesSnapshots(context, smb = true, checkPaused = ::check)
    val reader = AndroidSmbDownload(context, journal, profiles, lan, snapshots, ::check)
    download = reader
    val staged = mutableMapOf<String, FilesSnapshot>()
    try {
      val manifest = reader.manifest(id)
      for (resource in manifest.resources) {
        check()
        val own = SmbPhotoManifestCodec.resourceReceipt(resource, manifest, captured.profile.target, journal) ?: throw FilesFailure("manifest_invalid")
        staged[resource.relativePath] = reader.stage(own.id)
      }
      val state = AndroidSmbPhotosJournal(journal.database, captured.profile.target.archiveId()) { action ->
        synchronized(AndroidSyncJournal.sourceLock) { synchronized(commitLock) { check(); action() } }
      }
      SmbPhotoManifestCodec.requireReceipts(manifest, captured.profile.target, journal)
      val result = AndroidSmbPhotosImport(context, captured.profile.target, journal, state, staged, snapshots, ::check).restore(manifest)
      check()
      if (result["metadataCompleted"] != true || result["itemState"] != "completed") throw FilesFailure(if (result["itemState"] == "organization_review") "organization_review" else "review_required")
      return mapOf("state" to "completed", "id" to id, "name" to manifest.filename)
    } finally { staged.values.forEach(snapshots::discard); reader.cancel(); download = null }
  }
}
