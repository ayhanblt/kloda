package com.kloda.sync

import android.content.Context
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

internal class AndroidPhotosSession(
  private val context: Context,
  private val checkOwner: () -> Unit,
  private val send: (String, Int) -> String
) {
  private val stopped = AtomicBoolean(false)
  fun pause() { stopped.set(true) }
  fun check() {
    if (stopped.get()) throw FilesFailure("cancelled")
    checkOwner()
  }
  fun restore(operation: String, sha256: String, size: String, name: String): Map<String, Any> {
    check()
    val backup = AndroidOwnBackups.status(send(JSONObject().put("kind", "status").put("id", operation).toString(), -1), operation)
    if (backup.sha256 != sha256 || backup.size.toString() != size || backup.name != name) throw FilesFailure("conflict")
    return restore(backup)
  }
  fun restoreAll(): Map<String, Any> = AndroidPhotosCatalog(context, ::check, send, ::manifest).restoreAll()
  fun restore(backup: OwnBackup): Map<String, Any> = AndroidPhotosRestore(context, ::check, send).restore(manifest(backup))
  private fun manifest(backup: OwnBackup): PhotoManifest {
    check()
    if (!backup.name.startsWith(PhotoManifestCodec.prefix) || !backup.name.endsWith(".json") || backup.size !in 1..65536) {
      throw FilesFailure("manifest_invalid")
    }
    val directory = File(context.cacheDir, "kloda-photos-restore")
    val file = AndroidBackupDownload(::check, send).download(backup, directory)
    try {
      check()
      return PhotoManifestCodec.decode(file.readBytes()).also { check() }
    } finally { file.delete() }
  }
}
