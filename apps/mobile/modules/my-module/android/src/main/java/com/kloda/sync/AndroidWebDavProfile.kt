package com.kloda.sync

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Credentials
import org.json.JSONArray
import java.security.MessageDigest
import java.util.UUID
import android.util.Base64

// provider == null is the original single WebDAV destination; its targetId formula never changes (ADR0027).
internal data class AndroidWebDavProfile(val revision: String, val endpoint: String, val targetPath: String,
  val username: String, val password: String, val provider: String? = null) {
  fun validate() {
    if (provider != null && provider !in PROVIDERS) throw FilesFailure("webdav_fields")
    if (runCatching { UUID.fromString(revision) }.isFailure || username.isBlank() || username.contains(':') || password.isEmpty() ||
      listOf(endpoint, targetPath, username, password).any { it.contains('\u0000') || it.toByteArray().size > 8192 }) throw FilesFailure("webdav_fields")
    val base = endpoint.toHttpUrlOrNull() ?: throw FilesFailure("webdav_fields")
    if (base.scheme != "https" || base.host.isEmpty() || base.username.isNotEmpty() || base.password.isNotEmpty() ||
      base.query != null || base.fragment != null || parts(targetPath).isEmpty()) throw FilesFailure("webdav_fields")
  }
  fun url(relative: String = ""): HttpUrl {
    validate()
    val result = endpoint.toHttpUrlOrNull()!!.newBuilder()
    (parts(targetPath) + parts(relative)).forEach { result.addPathSegment(it) }
    return result.build()
  }
  private fun parts(value: String): List<String> {
    val parts = value.split('/').filter { it.isNotEmpty() }
    if (value.any { it == '\\' || it.isISOControl() } || parts.any { it == "." || it == ".." || it.toByteArray().size > 255 })
      throw FilesFailure("backup_path_rejected")
    return parts
  }
  fun targetId(): String {
    val identity = if (provider == null) JSONArray().put(url().toString()).put(username)
      else JSONArray().put(provider).put(url().toString()).put(username)
    return encode(MessageDigest.getInstance("SHA-256").digest(identity.toString().toByteArray()))
  }
  fun authorization(): String = Credentials.basic(username, password, Charsets.UTF_8)
  companion object {
    val PROVIDERS = setOf("nextcloud", "cloudme", "kolab-now")
    fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  }
}
