package com.kloda.sync

import android.content.Context
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.security.MessageDigest

// V1-3 (ADR0028 §5): Microsoft OneDrive AppFolder under the DAV publication contract.
// All writes use `@microsoft.graph.conflictBehavior=fail`; `inspect` downloads via `@microsoft.graph.downloadUrl`
// and verifies Kloda's own SHA-256. Rotated Microsoft refresh tokens are persisted atomically via AndroidOAuthVault.
internal class AndroidOneDriveTransport(private val context: Context, private val profile: AndroidOAuthProfile,
  private val snapshots: AndroidFilesSnapshots, private val check: () -> Unit) : AndroidBackupTransport {
  private val client = AndroidWebDavClient(context, null, check)
  @Volatile private var login: AndroidOAuthLogin? = null
  private var access: String? = null
  private var currentRefresh: String = profile.refreshToken
  private val folderIds = mutableMapOf<String, String>()
  override fun cancel() { client.cancel(); login?.cancel() }

  override fun inspect(path: String, job: WebDavUpload): String {
    val segs = parts(path)
    val reply = send(itemUrl(segs, "?\$select=id,name,size,folder,@microsoft.graph.downloadUrl"), false, collect = true, method = "GET")
    if (reply.status == 404) return "missing"
    require(reply, setOf(200))
    val json = jsonObject(reply.body)
    if (!json.isNull("folder") && json.opt("folder") != null) return "mismatch"
    val href = json.optString("@microsoft.graph.downloadUrl").takeIf { it.isNotEmpty() }
    if (href != null) {
      val dl = downloadUrl(href, job.size, null)
      require(dl, setOf(200))
      return if (dl.sha256 == job.sha256 && dl.size == job.size) "match" else "mismatch"
    }
    if (json.optLong("size", -1L) == 0L) {
      return if (job.size == 0L && job.sha256 == EMPTY_SHA256) "match" else "mismatch"
    }
    val contentReply = send(itemActionUrl(segs, "/content"), false, maximum = job.size, method = "GET")
    if (contentReply.status == 404) return "missing"
    val finalReply = if (contentReply.status in REDIRECTS && contentReply.location != null) {
      downloadUrl(contentReply.location, job.size, null).also { require(it, setOf(200)) }
    } else contentReply.also { require(it, setOf(200)) }
    return if (finalReply.sha256 == job.sha256 && finalReply.size == job.size) "match" else "mismatch"
  }

  override fun upload(path: String, job: WebDavUpload) {
    if (!snapshots.webdav) throw FilesFailure("snapshot_unavailable")
    val segs = parts(path)
    snapshots.open(job.snapshot, job.size).use { descriptor ->
      snapshots.validate(FilesDigest(job.sha256, job.size), descriptor)
      if (job.size == 0L) {
        val parentId = ensureFolder(segs.dropLast(1))
        val payload = JSONObject().put("name", segs.last()).put("file", JSONObject())
          .put("@microsoft.graph.conflictBehavior", "fail").toString().toByteArray(Charsets.UTF_8)
        val reply = send("$GRAPH/v1.0/me/drive/items/$parentId/children", true, emptyMap(),
          { ByteArrayInputStream(payload) }, payload.size.toLong(), collect = true, contentType = "application/json", method = "POST")
        require(reply, setOf(200, 201))
        return
      }
      val sessionBody = JSONObject().put("item", JSONObject().put("@microsoft.graph.conflictBehavior", "fail"))
        .toString().toByteArray(Charsets.UTF_8)
      val created = send(itemActionUrl(segs, "/createUploadSession"), true, emptyMap(),
        { ByteArrayInputStream(sessionBody) }, sessionBody.size.toLong(), collect = true, contentType = "application/json", method = "POST")
      require(created, setOf(200))
      val uploadUrl = requireHttpsUrl(jsonObject(created.body).optString("uploadUrl"))
      val dup = android.os.ParcelFileDescriptor.dup(descriptor.fileDescriptor)
      android.system.Os.lseek(dup.fileDescriptor, 0, android.system.OsConstants.SEEK_SET)
      android.os.ParcelFileDescriptor.AutoCloseInputStream(dup).use { stream ->
        var offset = 0L
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
          val range = "bytes $offset-${offset + filled - 1}/${job.size}"
          val reply = client.call(uploadUrl.toHttpUrl(), null, true, mapOf("Content-Range" to range),
            ByteArrayInputStream(chunk, 0, filled), filled.toLong(), collect = true, method = "PUT")
          val isLast = offset + filled == job.size
          require(reply, if (isLast) setOf(200, 201) else setOf(202, 200, 201))
          offset += filled
        }
        if (stream.read() >= 0) throw FilesFailure("source_changed")
      }
    }
  }

  override fun move(from: String, to: String) {
    val fromSegs = parts(from); val toSegs = parts(to)
    val meta = send(itemUrl(fromSegs, "?\$select=id,parentReference"), false, collect = true, method = "GET")
    require(meta, setOf(200))
    val json = jsonObject(meta.body)
    val itemId = json.optString("id").takeIf { validId(it) } ?: throw FilesFailure("webdav_response")
    val fromParentId = json.optJSONObject("parentReference")?.optString("id")?.takeIf { validId(it) }
    val fromParents = fromSegs.dropLast(1); val toParents = toSegs.dropLast(1)
    val patch = JSONObject().put("name", toSegs.last()).put("@microsoft.graph.conflictBehavior", "fail")
    if (fromParents != toParents || fromParentId == null) {
      val destParentId = ensureFolder(toParents)
      patch.put("parentReference", JSONObject().put("id", destParentId))
    }
    val body = patch.toString().toByteArray(Charsets.UTF_8)
    val reply = send("$GRAPH/v1.0/me/drive/items/$itemId", true, emptyMap(),
      { ByteArrayInputStream(body) }, body.size.toLong(), collect = true, contentType = "application/json", method = "PATCH")
    require(reply, setOf(200))
  }

  override fun download(path: String, job: WebDavUpload, receive: (ByteArray, Int) -> Unit): WebDavReply {
    val segs = parts(path)
    val reply = send(itemUrl(segs, "?\$select=id,size,folder,@microsoft.graph.downloadUrl"), false, collect = true, method = "GET")
    require(reply, setOf(200))
    val json = jsonObject(reply.body)
    if (!json.isNull("folder") && json.opt("folder") != null) throw FilesFailure("review_required")
    val href = json.optString("@microsoft.graph.downloadUrl").takeIf { it.isNotEmpty() }
    if (href != null) {
      return downloadUrl(href, job.size, receive).also { require(it, setOf(200)) }
    }
    if (json.optLong("size", -1L) == 0L) {
      return WebDavReply(200, 0, EMPTY_SHA256)
    }
    val contentReply = send(itemActionUrl(segs, "/content"), false, maximum = job.size, receive = receive, method = "GET")
    if (contentReply.status in REDIRECTS && contentReply.location != null) {
      return downloadUrl(contentReply.location, job.size, receive).also { require(it, setOf(200)) }
    }
    require(contentReply, setOf(200))
    return contentReply
  }

  override fun list(folder: String): List<RemoteChild> {
    val segs = parts(folder)
    val result = mutableListOf<RemoteChild>()
    var nextUrl: String? = itemActionUrl(segs, "/children?\$select=name,folder&\$top=100")
    var first = true
    while (nextUrl != null) {
      val reply = send(nextUrl, false, collect = true, method = "GET")
      if (first && reply.status == 404) return emptyList()
      first = false
      require(reply, setOf(200))
      val json = jsonObject(reply.body)
      val entries = json.optJSONArray("value") ?: throw FilesFailure("webdav_response")
      for (index in 0 until entries.length()) {
        val entry = entries.optJSONObject(index) ?: throw FilesFailure("webdav_response")
        val name = entry.opt("name") as? String ?: throw FilesFailure("webdav_response")
        val hasFolder = !entry.isNull("folder") && entry.opt("folder") != null
        result.add(RemoteChild(name, hasFolder))
      }
      if (result.size > 100_000) throw FilesFailure("webdav_response")
      val candidate = json.opt("@odata.nextLink") as? String
      nextUrl = if (candidate != null) {
        if (!candidate.startsWith("$GRAPH/")) throw FilesFailure("webdav_response")
        candidate
      } else null
    }
    return result
  }

  fun fillLabel() {
    if (profile.accountLabel != null) return
    runCatching {
      val reply = send("$GRAPH/v1.0/me?\$select=mail,userPrincipalName,displayName", false, collect = true, method = "GET")
      if (reply.status == 200) AndroidOAuthProfile.label(String(reply.body, Charsets.UTF_8), "onedrive")
        ?.let { AndroidOAuthVault(context, profile.targetId()).fill(it) }
    }
  }

  private fun ensureFolder(parentParts: List<String>): String {
    if (parentParts.isEmpty()) throw FilesFailure("backup_path_rejected")
    var parentId: String? = null
    val prefix = mutableListOf<String>()
    for (seg in parentParts) {
      prefix.add(seg)
      val key = prefix.joinToString("/")
      val cached = folderIds[key]
      if (cached != null) { parentId = cached; continue }
      val createUrl = if (parentId == null) "$GRAPH/v1.0/me/drive/special/approot/children"
        else "$GRAPH/v1.0/me/drive/items/$parentId/children"
      val body = JSONObject().put("name", seg).put("folder", JSONObject())
        .put("@microsoft.graph.conflictBehavior", "fail").toString().toByteArray(Charsets.UTF_8)
      val created = send(createUrl, true, emptyMap(), { ByteArrayInputStream(body) }, body.size.toLong(),
        collect = true, contentType = "application/json", method = "POST")
      val id = when {
        created.status in setOf(200, 201) -> jsonObject(created.body).optString("id").takeIf { validId(it) }
          ?: throw FilesFailure("webdav_response")
        created.status == 409 -> {
          val fetched = send(itemUrl(prefix, "?\$select=id,folder"), false, collect = true, method = "GET")
          require(fetched, setOf(200))
          val json = jsonObject(fetched.body)
          if (json.isNull("folder") || json.opt("folder") == null) throw FilesFailure("conflict")
          json.optString("id").takeIf { validId(it) } ?: throw FilesFailure("webdav_response")
        }
        else -> { require(created, setOf(200, 201)); throw FilesFailure("webdav_response") }
      }
      folderIds[key] = id
      parentId = id
    }
    return parentId ?: throw FilesFailure("backup_path_rejected")
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

  private fun send(url: String, mutation: Boolean, headers: Map<String, String> = emptyMap(),
    body: (() -> java.io.InputStream)? = null, size: Long = 0, maximum: Long = 65536,
    collect: Boolean = false, contentType: String = "application/octet-stream",
    receive: ((ByteArray, Int) -> Unit)? = null, method: String = "POST"): WebDavReply {
    var fresh = false
    if (access == null) { access = token(); fresh = true }
    while (true) {
      val stream = body?.invoke()
      val reply = try { client.call(url.toHttpUrl(), "Bearer $access", mutation, headers, stream, size, maximum, collect, contentType, receive, method) }
        finally { stream?.close() }
      if (reply.status != 401) return reply
      if (fresh) throw FilesFailure("oauth_expired")
      access = token(); fresh = true
    }
  }

  private fun token(): String {
    check()
    val current = AndroidOAuthLogin(context, OAuthProvider.ONEDRIVE).also { login = it }
    try {
      val refreshed = current.refreshFull(currentRefresh)
      val rotated = refreshed.refreshToken
      if (rotated != null && rotated != currentRefresh) {
        AndroidOAuthVault(context, profile.targetId()).rotate(profile.revision, rotated)
        currentRefresh = rotated
      }
      return refreshed.accessToken
    } catch (error: FilesFailure) {
      throw if (error.code == "oauth_login") FilesFailure("oauth_expired") else error
    } finally { login = null }
  }

  private fun parts(relative: String): List<String> {
    val all = profile.targetPath.split('/').filter { it.isNotEmpty() } + relative.split('/').filter { it.isNotEmpty() }
    if (all.isEmpty() || relative.contains('\\') || all.any { it == "." || it == ".." || it.toByteArray().size > 255 || it.any(Char::isISOControl) }) {
      throw FilesFailure("backup_path_rejected")
    }
    return all
  }

  private fun itemUrl(segs: List<String>, suffix: String): String =
    "$GRAPH/v1.0/me/drive/special/approot:/${encodePath(segs)}$suffix"

  private fun itemActionUrl(segs: List<String>, action: String): String =
    "$GRAPH/v1.0/me/drive/special/approot:/${encodePath(segs)}:$action"

  private fun jsonObject(bytes: ByteArray): JSONObject =
    runCatching { JSONObject(String(bytes, Charsets.UTF_8)) }.getOrNull() ?: throw FilesFailure("webdav_response")

  companion object {
    const val CHUNK = 25 * 320 * 1024 // 8,192,000 bytes: exact multiple of Graph 320 KiB, < 60 MiB.
    private const val GRAPH = "https://graph.microsoft.com"
    private val REDIRECTS = setOf(301, 302, 303, 307, 308)
    private val EMPTY_SHA256 = AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256").digest(ByteArray(0)))

    fun encodeSegment(segment: String): String = buildString {
      for (b in segment.toByteArray(Charsets.UTF_8)) {
        val u = b.toInt() and 0xFF
        val unreserved = (u in 'A'.code..'Z'.code) || (u in 'a'.code..'z'.code) || (u in '0'.code..'9'.code) ||
          u == '-'.code || u == '.'.code || u == '_'.code || u == '~'.code
        if (unreserved) append(u.toChar()) else append("%%%02X".format(u))
      }
    }

    fun encodePath(segs: List<String>): String = segs.joinToString("/", transform = ::encodeSegment)

    fun requireHttpsUrl(raw: String): String {
      val parsed = raw.toHttpUrlOrNull() ?: throw FilesFailure("webdav_response")
      if (parsed.scheme != "https" || parsed.host.isEmpty() || parsed.username.isNotEmpty() || parsed.password.isNotEmpty()) {
        throw FilesFailure("webdav_response")
      }
      return raw
    }

    private fun resolveRedirect(base: String, location: String): String {
      val resolved = base.toHttpUrlOrNull()?.resolve(location) ?: throw FilesFailure("webdav_response")
      return resolved.toString()
    }

    private fun validId(value: String): Boolean =
      value.isNotEmpty() && value.length <= 512 && value.none { it.isISOControl() || it == '/' || it == '\\' }

    fun graphErrorCode(reply: WebDavReply): String =
      runCatching { JSONObject(String(reply.body, Charsets.UTF_8)).optJSONObject("error")?.optString("code") }.getOrNull().orEmpty()

    fun require(reply: WebDavReply, allowed: Set<Int>) {
      if (reply.status in allowed) return
      val errCode = graphErrorCode(reply)
      throw FilesFailure(when {
        reply.status == 401 -> "oauth_expired"
        reply.status == 507 || errCode in setOf("quotaLimitReached", "insufficientSpace") -> "disk_full"
        reply.status in setOf(409, 412) || errCode == "nameAlreadyExists" -> "conflict"
        reply.status == 400 && errCode in setOf("invalidRequest", "notAllowed") -> "backup_path_rejected"
        reply.status == 403 -> "webdav_auth"
        reply.status in setOf(429, 500, 502, 503, 504) -> "connection_unavailable"
        else -> "webdav_response"
      })
    }
  }
}
