package com.kloda.sync

import android.content.Context
import android.net.Uri
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.system.Os
import java.io.Closeable
import java.io.File
import java.io.FilterInputStream
import java.io.FileInputStream
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject

internal class AndroidOwnRestore(
  private val context: Context,
  val backup: OwnBackup,
  private val checkOwner: () -> Unit,
  private val send: (String, Int) -> String
) {
  companion object {
    fun cleanup(context: Context) {
      File(context.cacheDir, "kloda-own-restore").listFiles()?.forEach {
        if (it.isFile && !it.delete()) throw FilesFailure("destination_unavailable")
      }
    }
  }
  @Volatile var choosing = true
  private val paused = AtomicBoolean(false)
  private val signal = AtomicReference<CancellationSignal?>()
  private val stream = AtomicReference<Closeable?>()

  fun pause(includePicker: Boolean = true) {
    if (!includePicker && choosing) return
    paused.set(true)
    signal.get()?.cancel()
    runCatching { stream.get()?.close() }
  }
  fun check() {
    if (paused.get()) throw FilesFailure("cancelled")
    checkOwner()
  }
  fun discardEmpty(uri: Uri) {
    try {
      if (uri.scheme != "content" || !DocumentsContract.isDocumentUri(context, uri)) return
      val empty = context.contentResolver.openInputStream(uri)?.use { it.read() == -1 } ?: return
      if (empty && !DocumentsContract.deleteDocument(context.contentResolver, uri)) throw FilesFailure("restore_cleanup_failed")
    } catch (_: Exception) { throw FilesFailure("restore_cleanup_failed") }
  }
  fun restore(uri: Uri): Map<String, String> {
    var removable = false
    var complete = false
    var stage: File? = null
    try {
      check()
      if (uri.scheme != "content" || !DocumentsContract.isDocumentUri(context, uri)) throw FilesFailure("destination_unavailable")
      read(uri) { input -> if (input.read() != -1) throw FilesFailure("destination_not_empty") }
      removable = true
      check()
      val current = AndroidOwnBackups.status(send(JSONObject().put("kind", "status").put("id", backup.id).toString(), -1), backup.id)
      if (current != backup) throw FilesFailure("outcome_unknown")
      // Native accepts private regular FDs only; never pass a provider FD to JNI.
      val directory = File(context.cacheDir, "kloda-own-restore")
      if (!directory.isDirectory && !directory.mkdirs()) throw FilesFailure("local_storage_full")
      cleanup(context)
      val staged = File.createTempFile("restore-", ".part", directory)
      stage = staged
      Os.chmod(staged.path, 384)
      ParcelFileDescriptor.open(staged, ParcelFileDescriptor.MODE_READ_WRITE).use { descriptor ->
        var offset = 0L
        while (offset < backup.size) {
          check()
          val command = JSONObject().put("kind", "restore").put("id", backup.id).put("offset", offset)
          offset += AndroidOwnBackups.chunk(send(command.toString(), descriptor.fd), offset, backup.size)
        }
        check()
      }
      FileInputStream(staged).use { verify(it) }
      write(uri) { output ->
        FileInputStream(staged).use { input ->
          val buffer = ByteArray(65536)
          while (true) {
            check()
            val count = input.read(buffer)
            if (count < 0) break
            output.write(buffer, 0, count)
          }
          output.flush()
        }
      }
      read(uri) { verify(it) }
      check()
      complete = true
      return backup.publicValue() + mapOf("state" to "completed")
    } catch (error: Exception) {
      if (error is FilesFailure && error.code == "destination_not_empty") removable = false
      if (!removable && error is FilesFailure && error.code in setOf("cancelled", "paused")) discardEmpty(uri)
      if (removable && !complete && !runCatching { DocumentsContract.deleteDocument(context.contentResolver, uri) }.getOrDefault(false)) {
        throw FilesFailure("restore_cleanup_failed")
      }
      if (error is FilesFailure) throw error
      if (error is SecurityException) throw FilesFailure("destination_permission_lost")
      throw FilesFailure("destination_unavailable")
    } finally { stage?.delete() }
  }
  internal fun verify(input: InputStream) {
    var count = 0L
    val bounded = object : FilterInputStream(input) {
      override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        val remaining = backup.size - count
        val read = super.read(buffer, offset, if (remaining >= length) length else remaining.toInt() + 1)
        if (read > 0) {
          if (read.toLong() > remaining) throw FilesFailure("hash_mismatch")
          count += read
        }
        return read
      }
    }
    if (AndroidFilesSnapshots.digest(bounded, ::check) != FilesDigest(backup.sha256, backup.size)) throw FilesFailure("hash_mismatch")
  }
  private fun <T> read(uri: Uri, action: (InputStream) -> T): T = provider(uri, "r") { descriptor ->
    ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { input ->
      stream.set(input)
      try { check(); action(input).also { descriptor.checkError() } } finally { stream.compareAndSet(input, null) }
    }
  }
  private fun write(uri: Uri, action: (OutputStream) -> Unit) = provider(uri, "wa") { descriptor ->
    if (descriptor.statSize > 0) throw FilesFailure("destination_not_empty")
    ParcelFileDescriptor.AutoCloseOutputStream(descriptor).use { output ->
      stream.set(output)
      try { check(); action(output); descriptor.checkError() } finally { stream.compareAndSet(output, null) }
    }
  }
  private fun <T> provider(uri: Uri, mode: String, action: (ParcelFileDescriptor) -> T): T {
    val cancellation = CancellationSignal()
    signal.set(cancellation)
    try {
      check()
      return (context.contentResolver.openFileDescriptor(uri, mode, cancellation) ?: throw FilesFailure("destination_unavailable"))
        .use { descriptor -> action(descriptor) }
    } finally { signal.compareAndSet(cancellation, null) }
  }
}
