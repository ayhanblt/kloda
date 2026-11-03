package com.kloda.sync

import com.facebook.react.modules.network.OkHttpClientProvider
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicReference

// `body`: bounded (64 KiB) body of a REST error reply, or of a REST reply the caller asked to collect (JSON APIs).
internal data class WebDavReply(val status: Int, val size: Long, val sha256: String, val body: ByteArray = ByteArray(0))

// `profile` is null for REST destinations (Dropbox), which use `call` with their own authorization.
internal class AndroidWebDavClient(context: Context, val profile: AndroidWebDavProfile?, private val check: () -> Unit) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private val network = connectivity.activeNetwork ?: throw FilesFailure("wifi_required")
  private fun currentNetwork() {
    check()
    val capabilities = connectivity.getNetworkCapabilities(network)
    if (connectivity.activeNetwork != network || capabilities == null || NativeLanRoutes.transport(capabilities) == null) throw FilesFailure("wifi_required")
  }
  private val active = AtomicReference<Call?>()
  private val client = OkHttpClientProvider.createClientBuilder()
    .socketFactory(network.socketFactory).dns(object : okhttp3.Dns {
      override fun lookup(hostname: String): List<java.net.InetAddress> {
        currentNetwork(); return network.getAllByName(hostname).toList()
      }
    })
    .cookieJar(CookieJar.NO_COOKIES).cache(null).authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
    .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()

  fun cancel() { active.get()?.cancel() }
  fun request(path: String, method: String, headers: Map<String, String> = emptyMap(),
    upload: InputStream? = null, uploadSize: Long = 0, maximum: Long = 65536,
    receive: ((ByteArray, Int) -> Unit)? = null): WebDavReply {
    val dav = requireNotNull(profile)
    return exchange(dav.url(path), method, dav.authorization(), headers, upload, uploadSize, maximum, receive)
  }
  fun collection(prefix: String): WebDavReply {
    val dav = requireNotNull(profile)
    return exchange(dav.copy(targetPath = prefix).url().newBuilder().addPathSegment("").build(), "MKCOL", dav.authorization())
  }
  // REST APIs (Dropbox): POST, body always read. A mutation's received status stays its ACK even if its body is lost;
  // a read's interrupted body is a failure. `collect` keeps a 200 body (at most `maximum`, bounded to 64 KiB).
  fun call(url: okhttp3.HttpUrl, authorization: String, mutation: Boolean, headers: Map<String, String> = emptyMap(),
    upload: InputStream? = null, uploadSize: Long = 0, maximum: Long = 65536, collect: Boolean = false,
    contentType: String = "application/octet-stream", receive: ((ByteArray, Int) -> Unit)? = null): WebDavReply {
    if (collect && maximum > 65536) throw FilesFailure("invalid_request")
    return exchange(url, "POST", authorization, headers, upload, uploadSize, maximum, receive, Rest(mutation, collect), contentType)
  }
  private class Rest(val mutation: Boolean, val collect: Boolean)

  private fun exchange(url: okhttp3.HttpUrl, method: String, authorization: String, headers: Map<String, String> = emptyMap(),
    upload: InputStream? = null, uploadSize: Long = 0, maximum: Long = 65536,
    receive: ((ByteArray, Int) -> Unit)? = null, rest: Rest? = null, contentType: String = "application/octet-stream"): WebDavReply {
    currentNetwork()
    if (uploadSize < 0 || maximum < 0) throw FilesFailure("invalid_request")
    val body = upload?.let { input -> object : RequestBody() {
      override fun contentType() = contentType.toMediaType()
      override fun contentLength() = uploadSize
      override fun isOneShot() = true
      override fun writeTo(sink: BufferedSink) {
        val bytes = ByteArray(65536); var count = 0L
        while (true) {
          currentNetwork()
          val size = input.read(bytes)
          if (size < 0) break
          if (size == 0) continue
          if (size.toLong() > uploadSize - count) throw FilesFailure("source_changed")
          sink.write(bytes, 0, size); count += size
        }
        if (count != uploadSize) throw FilesFailure("source_changed")
        currentNetwork()
      }
    } }
    val request = Request.Builder().url(url).header("Authorization", authorization)
    headers.forEach { (key, value) -> request.header(key, value) }
    // WebDAV methods with no payload still use an explicit empty body where OkHttp requires one.
    request.method(method, body ?: if (method in setOf("PUT", "POST", "PATCH", "PROPPATCH", "REPORT")) EmptyBody else null)
    val call = client.newCall(request.build())
    if (!active.compareAndSet(null, call)) throw FilesFailure("backup_busy")
    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onLost(lost: Network) { if (lost == network) call.cancel() }
    }
    var registered = false
    try {
      currentNetwork()
      connectivity.registerNetworkCallback(NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET).build(), callback)
      registered = true
      currentNetwork()
      call.execute().use { response ->
        if (rest != null) return restReply(response, rest, maximum, receive)
        if (response.code != 200 || method != "GET") return WebDavReply(response.code, 0, "")
        val digest = MessageDigest.getInstance("SHA-256"); var count = 0L
        response.body?.byteStream()?.use { input ->
          val bytes = ByteArray(65536)
          while (true) {
            currentNetwork()
            val size = input.read(bytes)
            if (size < 0) break
            if (size == 0) continue
            if (size.toLong() > maximum - count) throw FilesFailure("review_required")
            receive?.invoke(bytes, size); digest.update(bytes, 0, size); count += size
          }
        }
        return WebDavReply(response.code, count, AndroidWebDavProfile.encode(digest.digest()))
      }
    } catch (error: FilesFailure) { throw error }
    catch (_: java.io.IOException) { throw FilesFailure("connection_unavailable") }
    finally {
      if (registered) runCatching { connectivity.unregisterNetworkCallback(callback) }
      active.compareAndSet(call, null)
    }
  }
  // Only a 200 body reaches `receive` (a REST download); error bodies stay bounded diagnostics.
  private fun restReply(response: okhttp3.Response, rest: Rest, maximum: Long, receive: ((ByteArray, Int) -> Unit)?): WebDavReply {
    val limit = if (response.code == 200) maximum else 65536L
    val keep = rest.collect || response.code != 200
    val digest = MessageDigest.getInstance("SHA-256"); val kept = java.io.ByteArrayOutputStream(); var count = 0L
    try {
      response.body?.byteStream()?.use { input ->
        val bytes = ByteArray(65536)
        while (true) {
          currentNetwork()
          val size = input.read(bytes)
          if (size < 0) break
          if (size == 0) continue
          if (size.toLong() > limit - count) {
            // A mutation's ACK stands; its oversized diagnostic body is simply dropped.
            if (rest.mutation) return WebDavReply(response.code, count, "") else throw FilesFailure("review_required")
          }
          if (response.code == 200) receive?.invoke(bytes, size)
          digest.update(bytes, 0, size); if (keep) kept.write(bytes, 0, size); count += size
        }
      }
    } catch (error: java.io.IOException) {
      if (rest.mutation) return WebDavReply(response.code, count, "", kept.toByteArray())
      throw error
    }
    return WebDavReply(response.code, count, AndroidWebDavProfile.encode(digest.digest()), kept.toByteArray())
  }
  companion object {
    private val EmptyBody = object : RequestBody() {
      override fun contentType() = "application/octet-stream".toMediaType()
      override fun contentLength() = 0L
      override fun writeTo(sink: BufferedSink) {}
    }
    fun require(reply: WebDavReply, vararg codes: Int) {
      if (reply.status in codes) return
      throw FilesFailure(when (reply.status) { 401, 403 -> "webdav_auth"; 507 -> "disk_full"; 412 -> "conflict"; else -> "webdav_response" })
    }
  }
}
