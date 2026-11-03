package com.kloda.sync

import android.content.Context
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject
import java.io.ByteArrayInputStream

// Step18B/5 (ADR0028 §5): Dropbox under the DAV publication contract. Writes are create-only (`mode=add`,
// `autorename=false`, `strict_conflict=true`) and `move_v2` never renames; `inspect` downloads and hashes the bytes,
// so Dropbox's own content hash never stands in for Kloda's SHA-256. Files over 150 MiB use an upload session that
// lives only inside this transport (one run); resuming a session across runs needs its own migration.
internal class AndroidDropboxTransport(private val context: Context, private val profile: AndroidOAuthProfile,
  private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) : AndroidBackupTransport {
  private val client = AndroidWebDavClient(context, null, check)
  @Volatile private var login: AndroidOAuthLogin? = null
  private var access: String? = null
  override fun cancel() { client.cancel(); login?.cancel() }

  override fun inspect(path: String, job: WebDavUpload): String {
    val reply = send("${CONTENT}download", false, mapOf("Dropbox-API-Arg" to arg(JSONObject().put("path", full(path)))), maximum = job.size)
    if (reply.status == 409) {
      val summary = summary(reply)
      if (summary.startsWith("path/not_found")) return "missing"
      if (summary.startsWith("path/not_file")) return "mismatch"
    }
    require(reply)
    return if (reply.sha256 == job.sha256 && reply.size == job.size) "match" else "mismatch"
  }
  override fun upload(path: String, job: WebDavUpload) {
    if (!snapshots.webdav) throw FilesFailure("snapshot_unavailable")
    val commit = JSONObject().put("path", full(path)).put("mode", "add").put("autorename", false).put("mute", true).put("strict_conflict", true)
    snapshots.open(job.snapshot, job.size).use { descriptor ->
      snapshots.validate(FilesDigest(job.sha256, job.size), descriptor)
      // Every exchange reads its own duplicate from offset 0, so a resend after a token refresh sends the same bytes.
      val reopen = {
        val own = android.os.ParcelFileDescriptor.dup(descriptor.fileDescriptor)
        android.system.Os.lseek(own.fileDescriptor, 0, android.system.OsConstants.SEEK_SET)
        android.os.ParcelFileDescriptor.AutoCloseInputStream(own)
      }
      if (job.size <= SINGLE) {
        require(send("${CONTENT}upload", true, mapOf("Dropbox-API-Arg" to arg(commit)), reopen, job.size))
        return
      }
      reopen().use { stream ->
        var offset = 0L; var session: String? = null
        val chunk = ByteArray(CHUNK)
        while (offset < job.size) {
          check()
          val wanted = minOf(CHUNK.toLong(), job.size - offset).toInt()
          var filled = 0
          while (filled < wanted) {
            val read = stream.read(chunk, filled, wanted - filled)
            if (read < 0) throw FilesFailure("source_changed")
            filled += read
          }
          val data = { ByteArrayInputStream(chunk, 0, filled) }
          val id = session
          if (id != null) {
            val cursor = JSONObject().put("session_id", id).put("offset", offset)
            require(send("${CONTENT}upload_session/append_v2", true,
              mapOf("Dropbox-API-Arg" to arg(JSONObject().put("cursor", cursor).put("close", false))), data, filled.toLong()))
          } else {
            val reply = send("${CONTENT}upload_session/start", true, mapOf("Dropbox-API-Arg" to arg(JSONObject().put("close", false))),
              data, filled.toLong(), collect = true)
            require(reply)
            session = runCatching { JSONObject(String(reply.body, Charsets.UTF_8)).getString("session_id") }.getOrNull()
              ?.takeIf { it.isNotEmpty() && it.length <= 1024 } ?: throw FilesFailure("webdav_response")
          }
          offset += filled
        }
        if (stream.read() >= 0) throw FilesFailure("source_changed")
        val cursor = JSONObject().put("session_id", session ?: throw FilesFailure("source_changed")).put("offset", offset)
        require(send("${CONTENT}upload_session/finish", true,
          mapOf("Dropbox-API-Arg" to arg(JSONObject().put("cursor", cursor).put("commit", commit))), { ByteArrayInputStream(ByteArray(0)) }, 0))
      }
    }
  }
  override fun move(from: String, to: String) {
    val body = JSONObject().put("from_path", full(from)).put("to_path", full(to)).put("autorename", false)
      .put("allow_ownership_transfer", false).toString().toByteArray(Charsets.UTF_8)
    require(send("${API}move_v2", true, emptyMap(), { ByteArrayInputStream(body) }, body.size.toLong(), contentType = "application/json"))
  }
  override fun download(path: String, job: WebDavUpload, receive: (ByteArray, Int) -> Unit): WebDavReply =
    send("${CONTENT}download", false, mapOf("Dropbox-API-Arg" to arg(JSONObject().put("path", full(path)))), maximum = job.size,
      receive = receive).also(::require)

  // The app folder is Dropbox's root for this token; the destination root sits inside it.
  private fun full(relative: String): String {
    val parts = profile.targetPath.split('/').filter { it.isNotEmpty() } + relative.split('/').filter { it.isNotEmpty() }
    if (parts.isEmpty() || relative.contains('\\') || parts.any { it == "." || it == ".." || it.toByteArray().size > 255 || it.any(Char::isISOControl) })
      throw FilesFailure("backup_path_rejected")
    return "/" + parts.joinToString("/")
  }
  // A 401 on any call means the request was not applied, so one refresh and resend (with a fresh body stream) is
  // safe for writes too. A non-200 reply never reaches `receive`, so a resent download starts from an empty sink.
  private fun send(url: String, mutation: Boolean, headers: Map<String, String>, body: (() -> java.io.InputStream)? = null,
    size: Long = 0, maximum: Long = 65536, collect: Boolean = false, contentType: String = "application/octet-stream",
    receive: ((ByteArray, Int) -> Unit)? = null): WebDavReply {
    var fresh = false
    if (access == null) { access = token(); fresh = true }
    while (true) {
      val stream = body?.invoke()
      val reply = try { client.call(url.toHttpUrl(), "Bearer $access", mutation, headers, stream, size, maximum, collect, contentType, receive) }
        finally { stream?.close() }
      if (reply.status != 401) return reply
      if (fresh) throw FilesFailure("oauth_expired")
      access = token(); fresh = true
    }
  }
  // Access tokens stay in memory (ADR0028 §2). A refused refresh means the grant is gone: sign in again.
  private fun token(): String {
    check()
    val current = AndroidOAuthLogin(context, OAuthProvider.DROPBOX).also { login = it }
    try { return current.refresh(profile.refreshToken) }
    catch (error: FilesFailure) { throw if (error.code == "oauth_login") FilesFailure("oauth_expired") else error }
    finally { login = null }
  }

  companion object {
    const val SINGLE = 150L * 1024 * 1024
    const val CHUNK = 8 * 1024 * 1024
    private const val CONTENT = "https://content.dropboxapi.com/2/files/"
    private const val API = "https://api.dropboxapi.com/2/files/"
    // Dropbox-API-Arg must be HTTP header safe: 0x7F and every non-ASCII character as a JSON \uXXXX escape.
    fun arg(value: JSONObject): String = buildString {
      for (char in value.toString()) if (char.code < 0x7F) append(char) else append("\\u%04x".format(char.code))
    }
    fun summary(reply: WebDavReply): String =
      runCatching { JSONObject(String(reply.body, Charsets.UTF_8)).optString("error_summary") }.getOrDefault("")
    fun require(reply: WebDavReply) {
      if (reply.status == 200) return
      val summary = if (reply.status == 409) summary(reply) else ""
      throw FilesFailure(when {
        reply.status == 409 && "insufficient_space" in summary -> "disk_full"
        reply.status == 409 && "conflict" in summary -> "conflict"
        reply.status == 409 && listOf("malformed_path", "disallowed_name", "too_long").any { it in summary } -> "backup_path_rejected"
        reply.status == 403 -> "webdav_auth"
        reply.status in setOf(429, 500, 502, 503, 504) -> "connection_unavailable"
        else -> "webdav_response"
      })
    }
  }
}
