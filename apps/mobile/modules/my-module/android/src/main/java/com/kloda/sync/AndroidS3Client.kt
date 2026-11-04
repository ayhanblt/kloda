package com.kloda.sync

import android.content.Context
import android.net.ConnectivityManager
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.Proxy
import java.security.MessageDigest
import java.util.Timer
import java.util.TimerTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

internal data class AndroidS3Reply(val status: Int, val body: String, val headers: Map<String, String>, val size: Long, val sha256: String)

// Native-only signed requests; no redirect, automatic replay, cookie, cache or credential discovery.
internal class AndroidS3Client(context: Context, private val profile: AndroidS3Profile, private val check: () -> Unit) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private val network = connectivity.activeNetwork ?: throw S3Failure("wifi_required")
  private val active = AtomicReference<Call?>()
  private fun currentNetwork() {
    check()
    val capabilities = connectivity.getNetworkCapabilities(network)
    if (connectivity.activeNetwork != network || capabilities == null || NativeLanRoutes.transport(capabilities) == null) throw S3Failure("wifi_required")
  }
  private val client = OkHttpClientProvider.createClientBuilder()
    .socketFactory(network.socketFactory).dns(object : okhttp3.Dns {
      override fun lookup(hostname: String): List<java.net.InetAddress> { currentNetwork(); return network.getAllByName(hostname).toList() }
    }).proxy(Proxy.NO_PROXY).cookieJar(CookieJar.NO_COOKIES).cache(null)
    .authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
    .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
    .connectTimeout(30, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).writeTimeout(60, TimeUnit.SECONDS).callTimeout(180, TimeUnit.SECONDS).build()
  fun cancel() { active.get()?.cancel() }
  fun send(key: String, operation: JSONObject, upload: InputStream? = null, uploadSize: Long = 0,
    maximum: Long = 65536, receive: ((ByteArray, Int) -> Unit)? = null): AndroidS3Reply {
    currentNetwork()
    if (uploadSize < 0 || maximum < 0) throw S3Failure("invalid_request")
    val prepared = S3NativeEngine.prepare(profile, key, operation)
    val method = prepared.getString("method"); val raw = prepared.getString("body").toByteArray(Charsets.UTF_8)
    if (upload != null && (method != "PUT" || raw.isNotEmpty())) throw S3Failure("invalid_request")
    val input = upload ?: ByteArrayInputStream(raw)
    val length = if (upload != null) uploadSize else raw.size.toLong()
    val body = if (method in listOf("PUT", "POST")) object : RequestBody() {
      override fun contentType() = (if (raw.isNotEmpty()) "application/xml" else "application/octet-stream").toMediaType()
      override fun contentLength() = length
      override fun isOneShot() = true
      override fun writeTo(sink: BufferedSink) {
        val buffer = ByteArray(65536); var count = 0L
        while (true) {
          currentNetwork(); val size = input.read(buffer)
          if (size < 0) break
          if (size == 0) continue
          if (size.toLong() > length - count) throw S3Failure("source_changed")
          sink.write(buffer, 0, size); count += size
        }
        if (count != length) throw S3Failure("source_changed")
      }
    } else null
    val request = Request.Builder().url(prepared.getString("url"))
    if (!request.build().url.isHttps) throw S3Failure("invalid_request")
    val headers = prepared.getJSONArray("headers")
    for (index in 0 until headers.length()) {
      val pair = headers.getJSONArray(index)
      if (pair.length() != 2) throw S3Failure("invalid_request")
      request.header(pair.getString(0), pair.getString(1))
    }
    val call = client.newCall(request.method(method, body).build())
    if (!active.compareAndSet(null, call)) throw S3Failure("backup_busy")
    val invalidated = AtomicReference<Throwable?>()
    val timer = Timer("kloda-s3-context", true)
    try {
      currentNetwork()
      timer.schedule(object : TimerTask() {
        override fun run() { try { currentNetwork() } catch (error: Throwable) { invalidated.compareAndSet(null, error); call.cancel() } }
      }, 100, 100)
      call.execute().use { response ->
        val streaming = response.code == 200 && method == "GET" && receive != null
        val limit = if (streaming) maximum else minOf(maximum, 65536)
        val digest = MessageDigest.getInstance("SHA-256"); var count = 0L
        val collected = ByteArrayOutputStream()
        response.body?.byteStream()?.use { source ->
          val buffer = ByteArray(65536)
          while (true) {
            currentNetwork(); val size = source.read(buffer)
            if (size < 0) break
            if (size == 0) continue
            if (size.toLong() > limit - count) throw S3Failure("review_required")
            if (streaming) receive!!.invoke(buffer, size) else collected.write(buffer, 0, size)
            digest.update(buffer, 0, size); count += size
          }
        }
        val bytes = collected.toByteArray()
        val text = try { Charsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString() }
          catch (_: java.nio.charset.CharacterCodingException) { throw S3Failure("review_required") }
        return AndroidS3Reply(response.code, text, response.headers.names().associate { it.lowercase() to response.headers.values(it).joinToString(",") },
          count, android.util.Base64.encodeToString(digest.digest(), android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP))
      }
    } catch (error: S3Failure) { throw error }
    catch (_: java.io.IOException) { throw (invalidated.get() as? S3Failure ?: S3Failure("connection_unavailable")) }
    finally { timer.cancel(); active.compareAndSet(call, null); raw.fill(0); client.connectionPool.evictAll() }
  }
}
