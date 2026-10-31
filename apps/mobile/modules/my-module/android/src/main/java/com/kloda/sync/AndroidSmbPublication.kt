package com.kloda.sync

import android.os.Looper
import android.os.ParcelFileDescriptor
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

// Loaded only by its native owner from the bundled pinned library; no JS entry point.
internal object SmbNativeEngine {
  @JvmStatic external fun publishBound(json: String, snapshot: Int, socket: Int, receipt: SmbNativeReceipt): Int
  @JvmStatic external fun publish(json: String, snapshot: Int, receipt: SmbNativeReceipt): Int
}
internal interface SmbNativeReceipt { fun onEvent(event: Int, bytes: Long): Int }
internal object AndroidSmbPublication {
  fun run(journal: AndroidSmbJournal, job: SmbUpload, snapshot: ParcelFileDescriptor, password: String, current: () -> Boolean) {
    execute(journal, job, snapshot, password, current, null)
  }
  // Consumes the route owner's exclusive connected socket even on early rejection.
  fun runBound(journal: AndroidSmbJournal, job: SmbUpload, snapshot: ParcelFileDescriptor, password: String,
    socket: ParcelFileDescriptor, current: () -> Boolean) = socket.use {
    execute(journal, job, snapshot, password, current, it)
  }
  private fun execute(journal: AndroidSmbJournal, job: SmbUpload, snapshot: ParcelFileDescriptor, password: String,
    current: () -> Boolean, socket: ParcelFileDescriptor?) {
    if (Looper.myLooper() == Looper.getMainLooper()) throw SmbFailure("worker_required")
    job.validate()
    if (password.toByteArray().size > 4096 || password.contains('\u0000')) throw SmbFailure("invalid_request")
    val hash = Base64.decode(job.sha256, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    if (hash.size != 32) throw SmbFailure("invalid_request")
    val path = if (job.target.root.isEmpty()) job.relativePath else job.target.root + "/" + job.relativePath
    val json = JSONObject().put("address", job.target.address).put("port", job.target.port).put("share", job.target.share)
      .put("username", job.target.username).put("password", password).put("domain", job.target.domain)
      .put("operationId", job.id).put("finalPath", path).put("size", job.size.toString())
      .put("sha256", JSONArray(hash.map { it.toInt() and 255 })).put("responseTimeoutMs", 5000).toString()
    journal.insert(job)
    val transferred = try { ParcelFileDescriptor.dup(snapshot.fileDescriptor).detachFd() }
      catch (error: Exception) { runCatching { journal.markIssue(job, 2) }; throw SmbFailure("snapshot_io_failed") }
    val connected = try { socket?.detachFd() }
      catch (error: Exception) {
        ParcelFileDescriptor.adoptFd(transferred).close()
        runCatching { journal.markIssue(job, 2) }; throw SmbFailure("snapshot_io_failed")
      }
    val receipt = object : SmbNativeReceipt {
      override fun onEvent(event: Int, bytes: Long): Int = try {
        if (event == 0) { if (journal.context() != job.context || !current()) 1 else 0 }
        else { journal.record(job, event, bytes); 0 }
      } catch (error: Exception) { 1 }
    }
    val result = try {
      if (connected != null) SmbNativeEngine.publishBound(json, transferred, connected, receipt)
      else SmbNativeEngine.publish(json, transferred, receipt)
    } catch (error: UnsatisfiedLinkError) {
      // Lookup failure happens before JNI consumes the transferred descriptor.
      ParcelFileDescriptor.adoptFd(transferred).close()
      if (connected != null) ParcelFileDescriptor.adoptFd(connected).close()
      runCatching { journal.markIssue(job, 8) }
      throw SmbFailure("engine_unavailable")
    }
    if (result != 0) { runCatching { journal.markIssue(job, result) }; throw SmbFailure("native_$result") }
    try { journal.complete(job, current) }
    catch (error: Exception) { runCatching { journal.markIssue(job, 4) }; throw error }
  }
}
