package com.kloda.sync

import android.content.Context
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONObject

// V1-3 (ADR0028 §5): Yandex Disk AppFolder under the DAV publication contract.
// Uses `Authorization: OAuth <token>`, create-only `overwrite=false` on upload & move, async operation polling (202),
// safe unauthenticated CDN redirect following on downloads, and Kloda's own SHA-256 verification.
internal class AndroidYandexTransport(private val context: Context, private val profile: AndroidOAuthProfile,
  private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) : AndroidBackupTransport {
  private val client = AndroidWebDavClient(context, null, check)
  private val ensuredFolders = mutableSetOf<String>()
  override fun cancel() { client.cancel() }

  override fun inspect(path: String, job: WebDavUpload): String {
    val target = appPath(parts(path))
    val meta = send(apiUrl("resources", mapOf("path" to target, "fields" to "type,size")), false, method = "GET")
    if (meta.status == 404) return "missing"
    require(meta, setOf(200))
    if (jsonObject(meta.body).optString("type") != "file") return "mismatch"
    val link = send(apiUrl("resources/download", mapOf("path" to target)), false, method = "GET")
    if (link.status == 404) return "missing"
    require(link, setOf(200))
    val href = requireHttpsUrl(jsonObject(link.body).optString("href"))
    val dl = downloadUrl(href, job.size, null)
    require(dl, setOf(200))
    return if (dl.sha256 == job.sha256 && dl.size == job.size) "match" else "mismatch"
  }

  override fun upload(path: String, job: WebDavUpload) {
    if (!snapshots.webdav) throw FilesFailure("snapshot_unavailable")
    val segs = parts(path)
    snapshots.open(job.snapshot, job.size).use { descriptor ->
      snapshots.validate(FilesDigest(job.sha256, job.size), descriptor)
      ensureFolder(segs.dropLast(1))
      val ticket = send(apiUrl("resources/upload", mapOf("path" to appPath(segs), "overwrite" to "false")), false, method = "GET")
      require(ticket, setOf(200))
      val href = requireHttpsUrl(jsonObject(ticket.body).optString("href"))
      val dup = android.os.ParcelFileDescriptor.dup(descriptor.fileDescriptor)
      android.system.Os.lseek(dup.fileDescriptor, 0, android.system.OsConstants.SEEK_SET)
      android.os.ParcelFileDescriptor.AutoCloseInputStream(dup).use { stream ->
        val reply = client.call(href.toHttpUrl(), null, true, emptyMap(), stream, job.size, collect = true, method = "PUT")
        require(reply, setOf(200, 201, 202))
      }
    }
  }

  override fun move(from: String, to: String) {
    val fromSegs = parts(from); val toSegs = parts(to)
    ensureFolder(toSegs.dropLast(1))
    val reply = send(apiUrl("resources/move", mapOf("from" to appPath(fromSegs), "path" to appPath(toSegs), "overwrite" to "false")),
      true, method = "POST")
    if (reply.status in setOf(200, 201)) return
    if (reply.status == 202) {
      val href = requireOperationUrl(jsonObject(reply.body).optString("href"))
      for (attempt in 0 until 30) {
        check()
        Thread.sleep(500)
        check()
        val poll = send(href.toHttpUrl(), false, method = "GET")
        require(poll, setOf(200))
        when (jsonObject(poll.body).optString("status")) {
          "success" -> return
          "in-progress" -> continue
          else -> throw FilesFailure("webdav_response")
        }
      }
      throw FilesFailure("connection_unavailable")
    }
    require(reply, setOf(200, 201))
  }

  override fun download(path: String, job: WebDavUpload, receive: (ByteArray, Int) -> Unit): WebDavReply {
    val target = appPath(parts(path))
    val link = send(apiUrl("resources/download", mapOf("path" to target)), false, method = "GET")
    require(link, setOf(200))
    val href = requireHttpsUrl(jsonObject(link.body).optString("href"))
    val dl = downloadUrl(href, job.size, receive)
    require(dl, setOf(200))
    return dl
  }

  override fun list(folder: String): List<RemoteChild> {
    val target = appPath(parts(folder))
    val result = mutableListOf<RemoteChild>()
    var offset = 0
    while (true) {
      val reply = send(apiUrl("resources", mapOf("path" to target,
        "fields" to "_embedded.items.name,_embedded.items.type,_embedded.total,_embedded.limit,_embedded.offset",
        "limit" to "100", "offset" to offset.toString())), false, method = "GET")
      if (offset == 0 && reply.status == 404) return emptyList()
      require(reply, setOf(200))
      val embedded = jsonObject(reply.body).optJSONObject("_embedded") ?: return result
      val items = embedded.optJSONArray("items") ?: throw FilesFailure("webdav_response")
      for (index in 0 until items.length()) {
        val entry = items.optJSONObject(index) ?: throw FilesFailure("webdav_response")
        val name = entry.opt("name") as? String ?: throw FilesFailure("webdav_response")
        val type = entry.opt("type") as? String ?: throw FilesFailure("webdav_response")
        result.add(RemoteChild(name, type == "dir"))
      }
      if (result.size > 100_000) throw FilesFailure("webdav_response")
      val total = embedded.optInt("total", offset + items.length())
      if (items.length() == 0) break
      offset += items.length()
      if (offset >= total) break
    }
    return result
  }

  fun fillLabel() {
    if (profile.accountLabel != null) return
    runCatching {
      val token = AndroidOAuthLogin(context, OAuthProvider.YANDEX).refresh(profile.refreshToken, profile.expiresAt)
      val reply = client.call("https://login.yandex.ru/info?format=json".toHttpUrl(), "OAuth $token", false,
        collect = true, method = "GET")
      if (reply.status == 200) AndroidOAuthProfile.label(String(reply.body, Charsets.UTF_8), "yandex")
        ?.let { AndroidOAuthVault(context, profile.targetId()).fill(it) }
    }
  }

  private fun ensureFolder(parentParts: List<String>) {
    if (parentParts.isEmpty()) throw FilesFailure("backup_path_rejected")
    val prefix = mutableListOf<String>()
    for (seg in parentParts) {
      prefix.add(seg)
      val remote = appPath(prefix)
      if (remote in ensuredFolders) continue
      val created = send(apiUrl("resources", mapOf("path" to remote)), true, method = "PUT")
      if (created.status == 201 || (created.status == 409 && errorKey(created) == "DiskPathPointsToExistentDirectoryError")) {
        ensuredFolders.add(remote)
        continue
      }
      require(created, setOf(201))
    }
  }

  private fun downloadUrl(initialUrl: String, maximum: Long, receive: ((ByteArray, Int) -> Unit)?): WebDavReply {
    var current = requireHttpsUrl(initialUrl)
    for (hop in 0..3) {
      check()
      val reply = client.call(current.toHttpUrl(), null, false, emptyMap(), null, 0, maximum, false, receive = receive, method = "GET")
      if (reply.status in REDIRECTS && reply.location != null) {
        if (hop == 3) throw FilesFailure("connection_unavailable")
        current = requireHttpsUrl(resolveRedirect(current, reply.location))
        continue
      }
      return reply
    }
    throw FilesFailure("connection_unavailable")
  }

  private fun send(url: HttpUrl, mutation: Boolean, method: String): WebDavReply {
    check()
    val token = AndroidOAuthLogin(context, OAuthProvider.YANDEX).refresh(profile.refreshToken, profile.expiresAt)
    val reply = client.call(url, "OAuth $token", mutation, emptyMap(), null, 0, 65536, true, method = method)
    if (reply.status == 401) throw FilesFailure("oauth_expired")
    return reply
  }

  private fun parts(relative: String): List<String> {
    val all = profile.targetPath.split('/').filter { it.isNotEmpty() } + relative.split('/').filter { it.isNotEmpty() }
    if (all.isEmpty() || relative.contains('\\') || all.any { it == "." || it == ".." || it.toByteArray().size > 255 || it.any(Char::isISOControl) }) {
      throw FilesFailure("backup_path_rejected")
    }
    return all
  }

  private fun jsonObject(bytes: ByteArray): JSONObject =
    runCatching { JSONObject(String(bytes, Charsets.UTF_8)) }.getOrNull() ?: throw FilesFailure("webdav_response")

  companion object {
    private const val API = "https://cloud-api.yandex.net/v1/disk"
    private val REDIRECTS = setOf(301, 302, 303, 307, 308)

    fun appPath(segs: List<String>): String = "app:/" + segs.joinToString("/")

    fun apiUrl(endpoint: String, params: Map<String, String>): HttpUrl {
      val builder = "$API/$endpoint".toHttpUrl().newBuilder()
      params.toSortedMap().forEach { (k, v) -> builder.addQueryParameter(k, v) }
      return builder.build()
    }

    fun requireHttpsUrl(raw: String): String {
      val parsed = raw.toHttpUrlOrNull() ?: throw FilesFailure("webdav_response")
      if (parsed.scheme != "https" || parsed.host.isEmpty() || parsed.username.isNotEmpty() || parsed.password.isNotEmpty()) {
        throw FilesFailure("webdav_response")
      }
      return raw
    }

    private fun requireOperationUrl(raw: String): String {
      requireHttpsUrl(raw)
      if (!raw.startsWith("$API/operations/")) throw FilesFailure("webdav_response")
      return raw
    }

    private fun resolveRedirect(base: String, location: String): String {
      val resolved = base.toHttpUrlOrNull()?.resolve(location) ?: throw FilesFailure("webdav_response")
      return resolved.toString()
    }

    fun errorKey(reply: WebDavReply): String =
      runCatching { JSONObject(String(reply.body, Charsets.UTF_8)).optString("error") }.getOrNull().orEmpty()

    fun require(reply: WebDavReply, allowed: Set<Int>) {
      if (reply.status in allowed) return
      val key = errorKey(reply)
      throw FilesFailure(when {
        reply.status == 401 -> "oauth_expired"
        reply.status in setOf(413, 507) || key == "DiskLimitExceededError" -> "disk_full"
        reply.status in setOf(409, 412) -> if (key == "DiskPathDoesntExistsError") "webdav_response" else "conflict"
        reply.status == 400 -> "backup_path_rejected"
        reply.status == 403 -> "webdav_auth"
        reply.status in setOf(429, 500, 502, 503, 504) -> "connection_unavailable"
        else -> "webdav_response"
      })
    }
  }
}
