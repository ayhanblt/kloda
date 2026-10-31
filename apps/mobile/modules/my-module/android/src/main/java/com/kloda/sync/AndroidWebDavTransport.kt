package com.kloda.sync

import android.os.ParcelFileDescriptor
import android.content.Context

internal class AndroidWebDavTransport(private val context: Context, private val profile: AndroidWebDavProfile,
  private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) {
  private val client = AndroidWebDavClient(context, profile, check)
  private val directories = mutableSetOf<String>()
  fun cancel() = client.cancel()
  fun inspect(path: String, job: WebDavUpload): String {
    val reply = client.request(path, "GET", maximum = job.size)
    if (reply.status == 404) return "missing"
    AndroidWebDavClient.require(reply, 200)
    return if (reply.sha256 == job.sha256 && reply.size == job.size) "match" else "mismatch"
  }
  fun upload(path: String, job: WebDavUpload) {
    if (!snapshots.webdav) throw FilesFailure("snapshot_unavailable")
    snapshots.open(job.snapshot, job.size).use { descriptor ->
      snapshots.validate(FilesDigest(job.sha256, job.size), descriptor)
      prepareParents(path)
      val own = ParcelFileDescriptor.dup(descriptor.fileDescriptor)
      android.system.Os.lseek(own.fileDescriptor, 0, android.system.OsConstants.SEEK_SET)
      ParcelFileDescriptor.AutoCloseInputStream(own).use { stream ->
        val reply = client.request(path, "PUT", mapOf("If-None-Match" to "*"), stream, job.size)
        AndroidWebDavClient.require(reply, 201)
      }
    }
  }
  fun move(from: String, to: String) {
    val reply = client.request(from, "MOVE", mapOf("Destination" to profile.url(to).toString(), "Overwrite" to "F"))
    AndroidWebDavClient.require(reply, 201)
  }
  private fun prepareParents(path: String) {
    val parts = profile.targetPath.split('/').filter { it.isNotEmpty() } + path.split('/').dropLast(1)
    for (index in 1..parts.size) {
      check()
      val prefix = parts.take(index).joinToString("/")
      if (prefix in directories) continue
      val reply = client.collection(prefix)
      AndroidWebDavClient.require(reply, 201, 405); directories.add(prefix)
    }
  }
}
