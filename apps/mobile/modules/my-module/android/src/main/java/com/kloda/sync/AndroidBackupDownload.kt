package com.kloda.sync

import android.os.ParcelFileDescriptor
import android.system.Os
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

internal class AndroidBackupDownload(private val check: () -> Unit, private val send: (String, Int) -> String) {
  fun download(backup: OwnBackup, directory: File): File {
    check()
    val current = AndroidOwnBackups.status(send(JSONObject().put("kind", "status").put("id", backup.id).toString(), -1), backup.id)
    if (current != backup) throw FilesFailure("conflict")
    if (!directory.isDirectory && !directory.mkdirs()) throw FilesFailure("local_storage_full")
    val file = File.createTempFile("download-", ".part", directory)
    try {
      Os.chmod(file.path, 384)
      ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_WRITE).use { descriptor ->
        var offset = 0L
        while (offset < backup.size) {
          check()
          val command = JSONObject().put("kind", "restore").put("id", backup.id).put("offset", offset)
          offset += AndroidOwnBackups.chunk(send(command.toString(), descriptor.fd), offset, backup.size)
        }
        descriptor.fileDescriptor.sync()
        if (descriptor.statSize != backup.size) throw FilesFailure("hash_mismatch")
      }
      FileInputStream(file).use { input ->
        if (AndroidFilesSnapshots.digest(input, check) != FilesDigest(backup.sha256, backup.size)) throw FilesFailure("hash_mismatch")
      }
      if (file.length() != backup.size) throw FilesFailure("hash_mismatch")
      check()
      return file
    } catch (error: Throwable) {
      file.delete()
      throw error
    }
  }
}
