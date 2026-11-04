package com.kloda.sync

import android.os.Looper
import android.os.ParcelFileDescriptor
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

internal object FtpsNativeEngine {
  @JvmStatic external fun readBound(json: String, output: Int, socket: Int, receipt: FtpsNativeReceipt): Int
  @JvmStatic external fun publishBound(json: String, snapshot: Int, socket: Int, receipt: FtpsNativeReceipt): Int
}
internal interface FtpsNativeReceipt { fun onEvent(event: Int, bytes: Long): Int; fun connect(address: String, port: Int): Int }
internal object AndroidFtpsPublication {
  fun request(job: FtpsUpload, password: String): String {
    job.validate()
    if (password.toByteArray().size > 4096 || password.contains('\u0000')) throw FtpsFailure("invalid_request")
    val hash = Base64.decode(job.sha256, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    if (hash.size != 32) throw FtpsFailure("invalid_request")
    return JSONObject().put("address", job.target.address).put("port", job.target.port).put("hostname", job.target.hostname)
      .put("root", job.target.root).put("username", job.target.username).put("password", password)
      .put("operationId", job.id).put("finalPath", job.relativePath).put("size", job.size.toString())
      .put("sha256", JSONArray(hash.map { it.toInt() and 255 })).put("responseTimeoutMs", 5000).toString()
  }
  fun runBound(journal: AndroidFtpsJournal, job: FtpsUpload, snapshot: ParcelFileDescriptor, password: String,
    socket: ParcelFileDescriptor, openData: (String, Int) -> Int, current: () -> Boolean, completed: () -> Boolean = current) = socket.use {
    if (Looper.myLooper() == Looper.getMainLooper()) throw FtpsFailure("worker_required")
    val json = request(job, password)
    journal.insert(job)
    val file = try { ParcelFileDescriptor.dup(snapshot.fileDescriptor).detachFd() }
      catch (_: Exception) { runCatching { journal.markIssue(job, 2) }; throw FtpsFailure("snapshot_io_failed") }
    val wire = try { it.detachFd() } catch (_: Exception) {
      ParcelFileDescriptor.adoptFd(file).close(); runCatching { journal.markIssue(job, 2) }; throw FtpsFailure("snapshot_io_failed")
    }
    var callbackFailure: Exception? = null
    val receipt = object : FtpsNativeReceipt {
      override fun connect(address: String, port: Int): Int = try {
        if (journal.context() != job.context || !current()) -1 else openData(address, port)
      } catch (error: Exception) { callbackFailure = error; -1 }
      override fun onEvent(event: Int, bytes: Long): Int = try {
        if (event == 0) { if (journal.context() != job.context || !current()) { callbackFailure = FtpsFailure("admission_rejected"); 1 } else 0 }
        else { journal.record(job, event, bytes); 0 }
      } catch (error: Exception) { callbackFailure = error; 1 }
    }
    val result = try { FtpsNativeEngine.publishBound(json, file, wire, receipt) }
      catch (_: UnsatisfiedLinkError) {
        ParcelFileDescriptor.adoptFd(file).close(); ParcelFileDescriptor.adoptFd(wire).close()
        runCatching { journal.markIssue(job, 8) }; throw FtpsFailure("engine_unavailable")
      }
    if (result != 0) { runCatching { journal.markIssue(job, result) }; throw FtpsFailure("native_$result").also { failure -> callbackFailure?.let(failure::initCause) } }
    try { journal.complete(job, completed) }
    catch (error: Exception) { runCatching { journal.markIssue(job, 4) }; throw error }
  }
}
