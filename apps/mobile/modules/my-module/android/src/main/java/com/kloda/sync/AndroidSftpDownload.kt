package com.kloda.sync

import android.content.Context
import android.os.Looper
import android.os.ParcelFileDescriptor

// Only this installation's Completed receipt can select remote bytes for a read.
internal class AndroidSftpDownload(private val app: Context, private val journal: AndroidSftpJournal,
  private val profiles: AndroidSftpProfiles, private val lan: AndroidSftpLan,
  val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  @Volatile private var cancelled = false
  fun cancel() { cancelled = true; snapshots.cancelRead() }
  private fun admit() { if (cancelled) throw SftpFailure("cancelled"); check() }
  init { require(snapshots.sftp) { "invalid_snapshot_namespace" } }
  fun receipt(id: String): SftpUpload {
    admit()
    val captured = profiles.capture() ?: throw SftpFailure("profile_missing")
    return journal.ownReceipt(id, captured.profile.target)
  }
  fun stage(id: String): FilesSnapshot {
    if (Looper.myLooper() == Looper.getMainLooper()) throw SftpFailure("worker_required")
    admit()
    val captured = profiles.capture() ?: throw SftpFailure("profile_missing")
    val settings = FilesRunContext.webdav(app).binding
    val value = journal.ownReceipt(id, captured.profile.target)
    val current = {
      admit()
      if (!profiles.current(captured) || FilesRunContext.webdav(app).binding != settings) throw SftpFailure("context_changed")
    }
    val json = AndroidSftpPublication.request(value, captured.profile.password)
    return snapshots.stageDownload(FilesDigest(value.sha256, value.size)) { output ->
      lan.withSocket(captured.profile.target, current) { socket, route ->
        val transferred = ParcelFileDescriptor.dup(output.fd).detachFd()
        val connected = try { socket.detachFd() } catch (error: Exception) {
          ParcelFileDescriptor.adoptFd(transferred).close(); throw error
        }
        val callback = object : SftpNativeReceipt {
          override fun onEvent(event: Int, bytes: Long): Int = try {
            current(); if (event == 0 && bytes == 0L && route()) 0 else 1
          } catch (_: Exception) { 1 }
        }
        val result = try { SftpNativeEngine.readBound(json, transferred, connected, callback) }
        catch (_: UnsatisfiedLinkError) {
          ParcelFileDescriptor.adoptFd(transferred).close(); ParcelFileDescriptor.adoptFd(connected).close()
          throw SftpFailure("engine_unavailable")
        }
        if (result != 0) throw SftpFailure("native_$result")
        current()
      }
      current()
    }
  }
  fun manifest(id: String): SftpPhotoManifest {
    val value = receipt(id)
    if (value.kind != "photo_manifest" || value.size > 65536) throw SftpFailure("manifest_invalid")
    val staged = stage(id)
    try {
      val result = snapshots.open(staged.id, value.size).use { descriptor ->
        ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { SftpPhotoManifestCodec.decode(it.readBytes()) }
      }
      SftpPhotoManifestCodec.requireReceipts(result, value.target, journal)
      if (result.filename != value.relativePath.substringAfterLast('/') || value.asset != result.assetId ||
        value.reference != "${result.assetId}:manifest" || value.revision != result.revision.toString() ||
        result.resources.any { !it.relativePath.startsWith(value.source + "/") }) throw SftpFailure("manifest_invalid")
      check(); return result
    } finally { snapshots.discard(staged) }
  }

}
