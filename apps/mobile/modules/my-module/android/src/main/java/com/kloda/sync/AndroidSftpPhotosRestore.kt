package com.kloda.sync

import android.content.Context
import java.util.UUID

internal class AndroidSftpPhotosRestore(private val context: Context, private val journal: AndroidSftpJournal,
  private val profiles: AndroidSftpProfiles, private val captured: SftpProfileCapture, private val lan: AndroidSftpLan,
  private val binding: String, override val ticket: UUID, private val owner: () -> Unit) : AndroidSftpRestoreTask {
  override val choosing = false
  private val commitLock = Any()
  @Volatile private var cancelled = false
  @Volatile private var download: AndroidSftpDownload? = null
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
    val snapshots = AndroidFilesSnapshots(context, sftp = true, checkPaused = ::check)
    val reader = AndroidSftpDownload(context, journal, profiles, lan, snapshots, ::check)
    download = reader
    val staged = mutableMapOf<String, FilesSnapshot>()
    try {
      val manifest = reader.manifest(id)
      for (resource in manifest.resources) {
        check()
        val own = SftpPhotoManifestCodec.resourceReceipt(resource, manifest, captured.profile.target, journal) ?: throw FilesFailure("manifest_invalid")
        staged[resource.relativePath] = reader.stage(own.id)
      }
      val state = AndroidSftpPhotosJournal(journal.database, captured.profile.target.archiveId()) { action ->
        synchronized(AndroidSyncJournal.sourceLock) { synchronized(commitLock) { check(); action() } }
      }
      SftpPhotoManifestCodec.requireReceipts(manifest, captured.profile.target, journal)
      val result = AndroidSftpPhotosImport(context, captured.profile.target, journal, state, staged, snapshots, ::check).restore(manifest)
      check()
      if (result["metadataCompleted"] != true || result["itemState"] != "completed") throw FilesFailure(if (result["itemState"] == "organization_review") "organization_review" else "review_required")
      return mapOf("state" to "completed", "id" to id, "name" to manifest.filename)
    } finally { staged.values.forEach(snapshots::discard); reader.cancel(); download = null }
  }
}
