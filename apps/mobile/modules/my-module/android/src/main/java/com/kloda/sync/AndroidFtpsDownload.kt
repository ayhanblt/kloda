package com.kloda.sync

import android.content.Context
import android.os.Looper
import android.os.ParcelFileDescriptor

// Only this installation's Completed receipt can select remote bytes for a read.
internal class AndroidFtpsDownload(private val app: Context, private val journal: AndroidFtpsJournal,
  private val profiles: AndroidFtpsProfiles, private val lan: AndroidFtpsLan,
  val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  @Volatile private var cancelled = false
  fun cancel() { cancelled = true; snapshots.cancelRead() }
  private fun admit() { if (cancelled) throw FtpsFailure("cancelled"); check() }
  init { require(snapshots.ftps) { "invalid_snapshot_namespace" } }
  fun receipt(id: String): FtpsUpload {
    admit()
    val captured = profiles.capture() ?: throw FtpsFailure("profile_missing")
    return journal.ownReceipt(id, captured.profile.target)
  }
  fun stage(id: String): FilesSnapshot {
    if (Looper.myLooper() == Looper.getMainLooper()) throw FtpsFailure("worker_required")
    admit()
    val captured = profiles.capture() ?: throw FtpsFailure("profile_missing")
    val settings = FilesRunContext.webdav(app).binding
    val value = journal.ownReceipt(id, captured.profile.target)
    val current = {
      admit()
      if (!profiles.current(captured) || FilesRunContext.webdav(app).binding != settings) throw FtpsFailure("context_changed")
    }
    val json = AndroidFtpsPublication.request(value, captured.profile.password)
    return snapshots.stageDownload(FilesDigest(value.sha256, value.size)) { output ->
      lan.withSocket(captured.profile.target, current) { socket, route ->
        val transferred = ParcelFileDescriptor.dup(output.fd).detachFd()
        val connected = try { socket.detachFd() } catch (error: Exception) {
          ParcelFileDescriptor.adoptFd(transferred).close(); throw error
        }
        var callbackFailure: Exception? = null
        val callback = object : FtpsNativeReceipt {
          override fun connect(address: String, port: Int): Int = try { lan.connectData(captured.profile.target, address, port) { current(); route() } } catch (error: Exception) { callbackFailure = error; -1 }
          override fun onEvent(event: Int, bytes: Long): Int = try {
            current(); if (event == 0 && bytes == 0L && route()) 0 else 1
          } catch (error: Exception) { callbackFailure = error; 1 }
        }
        val result = try { FtpsNativeEngine.readBound(json, transferred, connected, callback) }
        catch (_: UnsatisfiedLinkError) {
          ParcelFileDescriptor.adoptFd(transferred).close(); ParcelFileDescriptor.adoptFd(connected).close()
          throw FtpsFailure("engine_unavailable")
        }
        if (result != 0) throw FtpsFailure("native_$result").also { failure -> callbackFailure?.let(failure::initCause) }
        current()
      }
      current()
    }
  }
  fun manifest(id: String): FtpsPhotoManifest {
    val value = receipt(id)
    if (value.kind != "photo_manifest" || value.size > 65536) throw FtpsFailure("manifest_invalid")
    val staged = stage(id)
    try {
      val result = snapshots.open(staged.id, value.size).use { descriptor ->
        ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { FtpsPhotoManifestCodec.decode(it.readBytes()) }
      }
      FtpsPhotoManifestCodec.requireReceipts(result, value.target, journal)
      if (result.filename != value.relativePath.substringAfterLast('/') || value.asset != result.assetId ||
        value.reference != "${result.assetId}:manifest" || value.revision != result.revision.toString() ||
        result.resources.any { !it.relativePath.startsWith(value.source + "/") }) throw FtpsFailure("manifest_invalid")
      check(); return result
    } finally { snapshots.discard(staged) }
  }

}
