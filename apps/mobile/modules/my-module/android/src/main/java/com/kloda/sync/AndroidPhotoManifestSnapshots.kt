package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor
import android.system.Os
import android.system.OsConstants
import java.io.File
import java.io.FileOutputStream

internal class AndroidPhotoManifestSnapshots(context: Context) {
  private val parent = context.noBackupFilesDir
  private val directory = File(parent, "kloda-photo-manifests")
  private val idPattern = Regex("[A-Za-z0-9_-]{22}")
  private fun sync(folder: File) {
    val descriptor = Os.open(folder.path, OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW, 0)
    try {
      if (!OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode)) throw FilesFailure("snapshot_unavailable")
      Os.fsync(descriptor)
    } finally { Os.close(descriptor) }
  }
  private fun path(id: String): File {
    if (!idPattern.matches(id)) throw FilesFailure("snapshot_unavailable")
    return File(directory, "$id.snapshot")
  }
  fun open(publication: PhotoPublication): ParcelFileDescriptor {
    val file = path(publication.job.id)
    if (!directory.isDirectory) { Os.mkdir(directory.path, 448); sync(parent) }
    Os.chmod(directory.path, 448)
    if (!file.exists()) {
      val temporary = File(directory, "${publication.job.id}.staging-${AndroidFilesSnapshots.randomId()}")
      try {
        val descriptor = Os.open(temporary.path, OsConstants.O_CREAT or OsConstants.O_EXCL or OsConstants.O_WRONLY or OsConstants.O_NOFOLLOW, 384)
        FileOutputStream(descriptor).use { output ->
          output.write(publication.bytes); Os.fchmod(output.fd, 256); output.fd.sync()
        }
        Os.rename(temporary.path, file.path); sync(directory)
      } finally { temporary.delete() }
    }
    val descriptor = Os.open(file.path, OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW, 0)
    try {
      val info = Os.fstat(descriptor)
      if (!OsConstants.S_ISREG(info.st_mode) || info.st_nlink != 1L || info.st_uid != android.os.Process.myUid() ||
        info.st_size != publication.job.size || info.st_mode and 146 != 0) throw FilesFailure("snapshot_unavailable")
      val retained = ParcelFileDescriptor.dup(descriptor)
      try {
        ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.dup(descriptor)).use {
          if (AndroidFilesSnapshots.digest(it) != FilesDigest(publication.job.sha256, publication.job.size)) throw FilesFailure("snapshot_unavailable")
        }
        Os.lseek(retained.fileDescriptor, 0, OsConstants.SEEK_SET)
        return retained
      } catch (error: Throwable) { retained.close(); throw error }
    } finally { Os.close(descriptor) }
  }
  fun discard(publication: PhotoPublication) {
    val file = path(publication.job.id)
    if (file.exists()) { if (!file.delete()) throw FilesFailure("storage_failure"); sync(directory) }
  }
  fun recover() {
    if (!directory.exists()) return
    val files = directory.listFiles() ?: throw FilesFailure("storage_failure")
    var removed = false
    for (file in files) if (file.name.contains(".staging-")) {
      if (!file.delete()) throw FilesFailure("storage_failure")
      removed = true
    }
    if (removed) sync(directory)
  }
}
