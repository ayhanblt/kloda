package com.kloda.sync

import com.facebook.react.modules.network.OkHttpClientProvider
import android.content.Context
import android.net.ConnectivityManager
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.Credentials
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

internal data class NextcloudLoginStart(val server: HttpUrl, val login: HttpUrl, val poll: HttpUrl, val token: String)
internal data class NextcloudCredential(val loginName: String, val appPassword: String)

// Nextcloud Login Flow v2 (ADR0027): same Wi-Fi/Ethernet, no-redirect, no-cookie policy as the DAV client.
internal class AndroidNextcloudLogin(context: Context) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private val network = connectivity.activeNetwork ?: throw FilesFailure("wifi_required")
  private fun currentNetwork() {
    val capabilities = connectivity.getNetworkCapabilities(network)
    if (connectivity.activeNetwork != network || capabilities == null || NativeLanRoutes.transport(capabilities) == null) throw FilesFailure("wifi_required")
  }
  private val active = AtomicReference<Call?>()
  @Volatile private var cancelled = false
  private val client = OkHttpClientProvider.createClientBuilder()
    .socketFactory(network.socketFactory).dns(object : okhttp3.Dns {
      override fun lookup(hostname: String): List<java.net.InetAddress> {
        currentNetwork(); return network.getAllByName(hostname).toList()
      }
    })
    .cookieJar(CookieJar.NO_COOKIES).cache(null).authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
    .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()

  fun cancel() { cancelled = true; active.get()?.cancel() }

  fun start(entered: String): NextcloudLoginStart {
    val server = server(entered)
    val (status, body) = exchange(Request.Builder().url(server.newBuilder().addPathSegments("index.php/login/v2").build())
      .post(ByteArray(0).toRequestBody()).build())
    if (status != 200 || body == null) throw FilesFailure("nextcloud_login")
    return try {
      val json = JSONObject(body)
      val poll = json.getJSONObject("poll")
      val token = poll.getString("token")
      if (token.isEmpty() || token.length > 1024 || token.any { it.isISOControl() }) throw FilesFailure("nextcloud_login")
      NextcloudLoginStart(server, sameOrigin(server, json.getString("login")), sameOrigin(server, poll.getString("endpoint")), token)
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("nextcloud_login") }
  }

  // One poll: null until the user grants access in the browser (Nextcloud answers 404).
  fun poll(start: NextcloudLoginStart): NextcloudCredential? {
    val (status, body) = exchange(Request.Builder().url(start.poll).post(FormBody.Builder().add("token", start.token).build()).build())
    if (status == 404) return null
    if (status != 200 || body == null) throw FilesFailure("nextcloud_login")
    return try {
      val json = JSONObject(body)
      val name = json.getString("loginName"); val password = json.getString("appPassword")
      if (runCatching { server(json.getString("server")) }.getOrNull() != start.server) {
        // The entered server issued this app password: revoke it there, never at the other address.
        if (name.isNotEmpty() && password.isNotEmpty()) revoke(start.server, Credentials.basic(name, password, Charsets.UTF_8))
        throw FilesFailure("nextcloud_server_mismatch")
      }
      if (name.isBlank() || name.contains(':') || password.isEmpty() || listOf(name, password).any { it.contains('\u0000') || it.toByteArray().size > 8192 })
        throw FilesFailure("nextcloud_login")
      NextcloudCredential(name, password)
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("nextcloud_login") }
  }

  // The poll token is valid for 20 minutes; polling stops on cancel, expiry or any non-404 failure.
  fun waitForGrant(start: NextcloudLoginStart, interval: Long = 2000, limit: Long = 20 * 60 * 1000): NextcloudCredential {
    val deadline = System.nanoTime() + limit * 1_000_000
    while (true) {
      if (cancelled) throw FilesFailure("cancelled")
      poll(start)?.let { return it }
      if (System.nanoTime() + interval * 1_000_000 > deadline) throw FilesFailure("nextcloud_login_expired")
      Thread.sleep(interval)
    }
  }

  fun profile(start: NextcloudLoginStart, credential: NextcloudCredential, folder: String): AndroidWebDavProfile {
    val endpoint = start.server.newBuilder().addPathSegments("remote.php/dav/files").addPathSegment(credential.loginName).build()
    return AndroidWebDavProfile(UUID.randomUUID().toString(), endpoint.toString(), folder, credential.loginName,
      credential.appPassword, "nextcloud").also { it.validate() }
  }

  // Best effort on removal: local custody is deleted whatever the server answers.
  fun revoke(profile: AndroidWebDavProfile) {
    if (profile.provider != "nextcloud") throw FilesFailure("invalid_request")
    val endpoint = profile.endpoint.toHttpUrlOrNull() ?: return
    val segments = endpoint.pathSegments.filter { it.isNotEmpty() }
    if (segments.size < 4 || segments.takeLast(4).take(3) != listOf("remote.php", "dav", "files")) return
    val base = endpoint.newBuilder().encodedPath("/").apply { segments.dropLast(4).forEach { addPathSegment(it) } }.build()
    revoke(base, Credentials.basic(profile.username, profile.password, Charsets.UTF_8))
  }
  private fun revoke(base: HttpUrl, authorization: String) {
    runCatching {
      exchange(Request.Builder().url(base.newBuilder().addPathSegments("ocs/v2.php/core/apppassword").build()).delete()
        .header("Authorization", authorization).header("OCS-APIREQUEST", "true").build())
    }
  }

  private fun exchange(request: Request): Pair<Int, String?> {
    if (cancelled) throw FilesFailure("cancelled")
    currentNetwork()
    val call = client.newCall(request)
    if (!active.compareAndSet(null, call)) throw FilesFailure("backup_busy")
    try {
      call.execute().use { response ->
        if (response.code != 200) return response.code to null
        val bytes = response.body?.byteStream()?.use { input ->
          val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(4096)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            if (count > 65536 - output.size()) throw FilesFailure("nextcloud_login")
            output.write(buffer, 0, count)
          }
          output.toByteArray()
        } ?: return response.code to null
        return response.code to String(bytes, Charsets.UTF_8)
      }
    } catch (error: FilesFailure) { throw error }
    catch (_: java.io.IOException) { throw FilesFailure(if (cancelled) "cancelled" else "connection_unavailable") }
    finally { active.compareAndSet(call, null) }
  }

  companion object {
    // HTTPS origin plus optional sub-path, no credentials/query/fragment, without a trailing slash.
    fun server(value: String): HttpUrl {
      val url = value.trim().toHttpUrlOrNull() ?: throw FilesFailure("webdav_fields")
      if (url.scheme != "https" || url.host.isEmpty() || url.username.isNotEmpty() || url.password.isNotEmpty() ||
        url.query != null || url.fragment != null) throw FilesFailure("webdav_fields")
      val segments = url.pathSegments.filter { it.isNotEmpty() }
      if (segments.any { it == "." || it == ".." }) throw FilesFailure("webdav_fields")
      return url.newBuilder().encodedPath("/").apply { segments.forEach { addPathSegment(it) } }.build()
    }
    // Login and poll URLs must stay on the entered server; anything else is refused before it is opened or polled.
    fun sameOrigin(server: HttpUrl, value: String): HttpUrl {
      val url = value.toHttpUrlOrNull() ?: throw FilesFailure("nextcloud_server_mismatch")
      val prefix = server.pathSegments.filter { it.isNotEmpty() }
      if (url.scheme != "https" || url.host != server.host || url.port != server.port || url.username.isNotEmpty() ||
        url.pathSegments.take(prefix.size) != prefix) throw FilesFailure("nextcloud_server_mismatch")
      return url
    }
  }
}
