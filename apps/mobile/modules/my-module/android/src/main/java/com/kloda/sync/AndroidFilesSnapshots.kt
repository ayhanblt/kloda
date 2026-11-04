package com.kloda.sync

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.system.Os
import android.system.OsConstants
import android.util.Base64
import java.io.File
import java.io.FileNotFoundException
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.atomic.AtomicReference

internal class FilesFailure(val code: String) : Exception(code)
internal data class FilesDigest(val sha256: String, val size: Long)
internal data class FilesSnapshot(val id: String, val digest: FilesDigest)

internal class AndroidFilesSnapshots(private val context: Context, val webdav: Boolean = false, val smb: Boolean = false, val sftp: Boolean = false, val ftps: Boolean = false, val s3: String? = null, private val checkPaused: () -> Unit) {
  private val scanner = AndroidSafSourceScanner(context.contentResolver)
  private val photos = AndroidPhotosSources(context)
  private val signal = AtomicReference<CancellationSignal?>()
  private val input = AtomicReference<InputStream?>()
  private val directory = File(context.noBackupFilesDir, if (s3 != null) "kloda-$s3-snapshots" else if (ftps) "kloda-ftps-snapshots" else if (sftp) "kloda-sftp-snapshots" else if (smb) "kloda-smb-snapshots" else if (webdav) "kloda-webdav-snapshots" else "kloda-files")

  init { require((s3 == null || s3 in setOf("amazon-s3", "s3-compatible")) && listOf(webdav, smb, sftp, ftps, s3 != null).count { it } <= 1) { "invalid_snapshot_namespace" } }
  private fun snapshotId() = if (smb || sftp || ftps || s3 != null) java.util.UUID.randomUUID().toString() else randomId()

  companion object {
    private val random = SecureRandom()
    fun randomId(): String = encode(ByteArray(16).also { random.nextBytes(it) })
    private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    fun digest(stream: InputStream, check: () -> Unit = {}, output: FileOutputStream? = null): FilesDigest {
      val hash = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(65536)
      var size = 0L
      while (true) {
        check()
        val read = stream.read(buffer)
        if (read < 0) break
        if (read == 0) continue
        if (size > Long.MAX_VALUE - read) throw FilesFailure("invalid_request")
        hash.update(buffer, 0, read); output?.write(buffer, 0, read); size += read
      }
      check()
      return FilesDigest(encode(hash.digest()), size)
    }
  }

  fun cancelRead() { signal.get()?.cancel(); runCatching { input.get()?.close() } }

  private fun checkedSource(tree: String, reference: String, cancellation: CancellationSignal? = null) =
    if (AndroidPhotosSources.isPhotos(tree)) photos.checkedMedia(tree, reference) else scanner.checkedDocument(tree, reference, cancellation, checkPaused)

  fun checkAccess(tree: String, reference: String) { checkedSource(tree, reference); checkPaused() }

  private fun <T> readSource(tree: String, reference: String, action: (InputStream) -> T): T {
    checkPaused()
    val cancellation = CancellationSignal()
    signal.set(cancellation)
    try {
      val document = checkedSource(tree, reference, cancellation)
      checkPaused()
      val descriptor = if (AndroidPhotosSources.isPhotos(tree) && Build.VERSION.SDK_INT >= 31) {
        context.contentResolver.openTypedAssetFileDescriptor(document, "*/*",
          Bundle().apply { putBoolean(MediaStore.EXTRA_ACCEPT_ORIGINAL_MEDIA_FORMAT, true) }, cancellation)
      } else context.contentResolver.openAssetFileDescriptor(document, "r", cancellation)
      if (descriptor == null) throw FilesFailure("source_changed")
      descriptor.use {
        val stream = it.createInputStream()
        input.set(stream)
        try { return stream.use { source -> checkPaused(); action(source) } }
        finally { input.compareAndSet(stream, null) }
      }
    } catch (_: SecurityException) { throw FilesFailure("source_permission_lost") }
    catch (_: FileNotFoundException) { throw FilesFailure("source_changed") }
    catch (error: UnsupportedOperationException) {
      if (AndroidPhotosSources.isPhotos(tree)) throw FilesFailure("source_permission_lost")
      throw error
    }
    finally { signal.compareAndSet(cancellation, null) }
  }

  fun currentDigest(tree: String, reference: String): FilesDigest = readSource(tree, reference) { digest(it, checkPaused) }

  private fun syncDirectory(folder: File) {
    val descriptor = Os.open(folder.path, OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW, 0)
    try {
      if (!OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode)) throw FilesFailure("queue_unavailable")
      Os.fsync(descriptor)
    } finally { Os.close(descriptor) }
  }

  fun stage(tree: String, reference: String): FilesSnapshot {
    checkPaused()
    ensureDirectory()
    val id = snapshotId()
    val file = path(id)
    val descriptor = Os.open(file.path, OsConstants.O_CREAT or OsConstants.O_EXCL or OsConstants.O_WRONLY or OsConstants.O_NOFOLLOW, 384)
    try {
      val result = FileOutputStream(descriptor).use { output ->
        val value = readSource(tree, reference) { digest(it, checkPaused, output) }
        Os.fchmod(output.fd, 256)
        output.fd.sync()
        value
      }
      syncDirectory(directory)
      checkAccess(tree, reference)
      if (currentDigest(tree, reference) != result) throw FilesFailure("source_changed")
      return FilesSnapshot(id, result)
    } catch (error: Throwable) { file.delete(); throw error }
  }

  private fun ensureDirectory() {
    if (!directory.isDirectory) {
      Os.mkdir(directory.path, 448)
      syncDirectory(context.noBackupFilesDir)
    }
    Os.chmod(directory.path, 448)
  }

  fun stageMetadata(bytes: ByteArray): FilesSnapshot {
    checkPaused()
    if ((!webdav && !smb && !sftp && !ftps && s3 == null) || bytes.size > 65536) throw FilesFailure("invalid_request")
    ensureDirectory()
    val id = snapshotId(); val file = path(id)
    val descriptor = Os.open(file.path, OsConstants.O_CREAT or OsConstants.O_EXCL or OsConstants.O_WRONLY or OsConstants.O_NOFOLLOW, 384)
    try {
      FileOutputStream(descriptor).use { output -> output.write(bytes); Os.fchmod(output.fd, 256); output.fd.sync() }
      syncDirectory(directory); checkPaused()
      return FilesSnapshot(id, digest(java.io.ByteArrayInputStream(bytes), checkPaused))
    } catch (error: Throwable) { file.delete(); throw error }
  }

  fun stageDownload(expected: FilesDigest, receive: (FileOutputStream) -> Unit): FilesSnapshot {
    checkPaused()
    if ((!webdav && !smb && !sftp && !ftps && s3 == null) || expected.size < 0 || !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(expected.sha256)) throw FilesFailure("invalid_request")
    ensureDirectory()
    val id = snapshotId(); val file = path(id)
    val descriptor = Os.open(file.path, OsConstants.O_CREAT or OsConstants.O_EXCL or OsConstants.O_WRONLY or OsConstants.O_NOFOLLOW, 384)
    try {
      FileOutputStream(descriptor).use { output -> receive(output); checkPaused(); output.flush(); output.fd.sync(); Os.fchmod(output.fd, 256) }
      syncDirectory(directory); checkPaused()
      open(id, expected.size).use { validate(expected, it) }
      checkPaused(); return FilesSnapshot(id, expected)
    } catch (error: Throwable) { file.delete(); throw error }
  }

  fun verifiedFile(snapshot: FilesSnapshot): File {
    open(snapshot.id, snapshot.digest.size).use { validate(snapshot.digest, it) }
    checkPaused(); return path(snapshot.id)
  }

  fun discard(snapshot: FilesSnapshot) { path(snapshot.id).delete() }

  fun recover(journal: AndroidSyncJournal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (smb || sftp || ftps || s3 != null) throw FilesFailure("invalid_request")
    if (directory.exists()) {
      val files = directory.listFiles() ?: throw FilesFailure("queue_unavailable")
      for (file in files) {
        checkPaused()
        val id = file.name.removeSuffix(".snapshot")
        if (file.name == "$id.snapshot" && id.length == 22 &&
          id.all { it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it == '-' || it == '_' } &&
          (!journal.retainsSnapshot(id) || journal.snapshotCompleted(id)) && !file.delete()) throw FilesFailure("queue_unavailable")
      }
    }
  }

  fun open(job: FilesJob): ParcelFileDescriptor = open(job.id, job.size)

  fun open(snapshot: String, size: Long): ParcelFileDescriptor {
    try {
      val descriptor = Os.open(path(snapshot).path, OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW, 0)
      try {
        val info = Os.fstat(descriptor)
        if (!OsConstants.S_ISREG(info.st_mode) || info.st_nlink != 1L || info.st_uid != android.os.Process.myUid() ||
          info.st_size != size || info.st_mode and 146 != 0) throw FilesFailure("snapshot_unavailable")
        return ParcelFileDescriptor.dup(descriptor)
      } finally { Os.close(descriptor) }
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("snapshot_unavailable") }
  }

  fun validate(job: FilesJob, descriptor: ParcelFileDescriptor) {
    validate(FilesDigest(job.sha256, job.size), descriptor)
    validateSource(job)
  }

  fun validate(expected: FilesDigest, descriptor: ParcelFileDescriptor) {
    val own = ParcelFileDescriptor.dup(descriptor.fileDescriptor)
    Os.lseek(own.fileDescriptor, 0, OsConstants.SEEK_SET)
    val retained = ParcelFileDescriptor.AutoCloseInputStream(own).use { digest(it, checkPaused) }
    if (retained != expected) throw FilesFailure("snapshot_unavailable")
  }

  fun validateSource(job: FilesJob) {
    if (currentDigest(job.treeReference, job.reference) != FilesDigest(job.sha256, job.size)) throw FilesFailure("source_changed")
  }

  private fun path(id: String): File {
    if ((smb || sftp || ftps || s3 != null) && runCatching { java.util.UUID.fromString(id).toString() == id }.getOrDefault(false).not() ||
      !(smb || sftp || ftps || s3 != null) && (id.length != 22 || id.any { !(it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it == '-' || it == '_') })) {
      throw FilesFailure("snapshot_unavailable")
    }
    return File(directory, "$id.snapshot")
  }
}
