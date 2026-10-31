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

internal data class WebDavReply(val status: Int, val size: Long, val sha256: String)

internal class AndroidWebDavClient(context: Context, val profile: AndroidWebDavProfile, private val check: () -> Unit) {
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
    return exchange(profile.url(path), method, headers, upload, uploadSize, maximum, receive)
  }
  fun collection(prefix: String): WebDavReply = exchange(
    profile.copy(targetPath = prefix).url().newBuilder().addPathSegment("").build(), "MKCOL")

  private fun exchange(url: okhttp3.HttpUrl, method: String, headers: Map<String, String> = emptyMap(),
    upload: InputStream? = null, uploadSize: Long = 0, maximum: Long = 65536,
    receive: ((ByteArray, Int) -> Unit)? = null): WebDavReply {
    currentNetwork()
    if (uploadSize < 0 || maximum < 0) throw FilesFailure("invalid_request")
    val body = upload?.let { input -> object : RequestBody() {
      override fun contentType() = "application/octet-stream".toMediaType()
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
    val request = Request.Builder().url(url).header("Authorization", profile.authorization())
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
