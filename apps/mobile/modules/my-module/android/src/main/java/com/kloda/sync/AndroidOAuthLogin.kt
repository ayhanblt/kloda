package com.kloda.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Uri
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.FormBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.atomic.AtomicReference

// Public-client registrations (ADR0028); IDs are not secrets. Redirects must equal the registered strings exactly, and each
// redirect's scheme/host/path is claimed by KlodaOAuthRedirectActivity in the manifest.
internal data class OAuthProvider(val name: String, val clientId: String, val authorize: String, val token: String,
  val redirect: String, val scope: String?, val extra: Map<String, String>, val api: String) {
  companion object {
    val DROPBOX = OAuthProvider("dropbox", "5435jnh71fcmfck", "https://www.dropbox.com/oauth2/authorize",
      "https://api.dropboxapi.com/oauth2/token", "db-5435jnh71fcmfck://oauth", null, mapOf("token_access_type" to "offline"),
      "https://api.dropboxapi.com")
    // `common` accepts personal and work accounts. The redirect carries the debug signing hash; a release key needs its own registration.
    val ONEDRIVE = OAuthProvider("onedrive", "dcd6301f-639d-4289-80d0-620f376fab71",
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "msauth://com.kloda.app/Xo8WBi6jzSxKDVR4drqm84yr9iU%3D", "offline_access User.Read Files.ReadWrite.AppFolder",
      mapOf("response_mode" to "query"), "https://graph.microsoft.com")
    // Scopes come from the Yandex app registration (Disk app folder only). The redirect uses Yandex's own `yx<client ID>` scheme.
    val YANDEX = OAuthProvider("yandex", "c50f110fd8ab48debcabb20f8b1474f0", "https://oauth.yandex.com/authorize",
      "https://oauth.yandex.com/token", "yxc50f110fd8ab48debcabb20f8b1474f0://authorize", null, emptyMap(), "https://cloud-api.yandex.net")
    // Android client: authorization runs through Play services (AndroidGoogleDrive); only the Drive API origin is used here.
    val GOOGLE_DRIVE = OAuthProvider("google-drive", "169708313293-ra0u8gcc0pkgeb2squjpgfejhqqoe044.apps.googleusercontent.com",
      "", "", "", AndroidGoogleDrive.SCOPE, emptyMap(), "https://www.googleapis.com")
    fun named(name: String) = listOf(DROPBOX, ONEDRIVE, YANDEX, GOOGLE_DRIVE).firstOrNull { it.name == name } ?: throw FilesFailure("invalid_request")
  }
}
internal data class OAuthRequest(val provider: OAuthProvider, val url: Uri, val state: String, val verifier: String)
// `refreshToken` is the stored credential: a refresh token, or for Yandex the long-lived access token with its expiry.
internal data class OAuthGrant(val accessToken: String, val refreshToken: String, val accountId: String, val expiresAt: Long? = null)

// Authorization code + PKCE public client (ADR0028): no client secret, app-folder scope, offline refresh token.
// Same Wi-Fi/Ethernet, no-redirect, no-cookie policy as the Nextcloud login.
internal class AndroidOAuthLogin(context: Context, val provider: OAuthProvider) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private val network = connectivity.activeNetwork ?: throw FilesFailure("wifi_required")
  private fun currentNetwork() {
    val capabilities = connectivity.getNetworkCapabilities(network)
    if (connectivity.activeNetwork != network || capabilities == null || NativeLanRoutes.transport(capabilities) == null) throw FilesFailure("wifi_required")
  }
  private val active = AtomicReference<Call?>()
  @Volatile var cancelled = false
    private set
  private val client = OkHttpClientProvider.createClientBuilder()
    .socketFactory(network.socketFactory).dns(object : okhttp3.Dns {
      override fun lookup(hostname: String): List<java.net.InetAddress> {
        currentNetwork(); return network.getAllByName(hostname).toList()
      }
    })
    .cookieJar(CookieJar.NO_COOKIES).cache(null).authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
    .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()

  fun cancel() { cancelled = true; active.get()?.cancel() }

  fun exchange(code: String, request: OAuthRequest): OAuthGrant {
    if (request.provider != provider) throw FilesFailure("invalid_request")
    val form = FormBody.Builder().add("code", code).add("grant_type", "authorization_code").add("code_verifier", request.verifier)
      .add("client_id", provider.clientId).add("redirect_uri", provider.redirect)
    provider.scope?.let { form.add("scope", it) }
    val json = token(form.build())
    val access = json.optString("access_token").takeIf(::token) ?: throw FilesFailure("oauth_login")
    // ADR0028 §2 exception (user decision 2026-11-02): Yandex refreshes only with the app secret, so its long-lived
    // access token is kept with its expiry instead; the user signs in again when it ends.
    if (provider == OAuthProvider.YANDEX) {
      val lifetime = json.optLong("expires_in", 0).takeIf { it > 0 } ?: throw FilesFailure("oauth_login")
      return OAuthGrant(access, access, account(json, access), System.currentTimeMillis() / 1000 + lifetime)
    }
    val refresh = json.optString("refresh_token").takeIf(::token) ?: throw FilesFailure("oauth_login")
    return OAuthGrant(access, refresh, account(json, access))
  }
  // Dropbox names the account in the token reply; Microsoft and Yandex need the profile of the signed-in user.
  private fun account(json: JSONObject, access: String): String {
    val value = if (provider == OAuthProvider.DROPBOX) json.optString("account_id") else {
      val yandex = provider == OAuthProvider.YANDEX
      val url = if (yandex) "https://login.yandex.ru/info?format=json" else "${provider.api}/v1.0/me?\$select=id"
      val (status, body) = exchange(Request.Builder().url(url).header("Authorization", (if (yandex) "OAuth " else "Bearer ") + access).build())
      if (status == 200 && body != null) runCatching { JSONObject(body).optString("id") }.getOrDefault("") else ""
    }
    return value.takeIf(::token) ?: throw FilesFailure("oauth_login")
  }

  // Google Drive: the stable permission ID and the device account name used to ask Play services for later tokens.
  fun driveIdentity(access: String): Pair<String, String> {
    if (provider != OAuthProvider.GOOGLE_DRIVE) throw FilesFailure("invalid_request")
    val (status, body) = exchange(Request.Builder().url("${provider.api}/drive/v3/about?fields=user(permissionId,emailAddress)")
      .header("Authorization", "Bearer $access").build())
    val user = if (status == 200 && body != null) runCatching { JSONObject(body).getJSONObject("user") }.getOrNull() else null
    val id = user?.optString("permissionId")?.takeIf(::token) ?: throw FilesFailure("oauth_login")
    val email = user.optString("emailAddress").takeIf { it.contains('@') && token(it) } ?: throw FilesFailure("oauth_login")
    return id to email
  }

  // A fresh access token; for Yandex the stored token itself while it has not expired.
  fun refresh(refreshToken: String, expiresAt: Long? = null): String {
    if (provider == OAuthProvider.YANDEX) {
      if (expiresAt == null || expiresAt <= System.currentTimeMillis() / 1000) throw FilesFailure("oauth_expired")
      return refreshToken
    }
    val form = FormBody.Builder().add("grant_type", "refresh_token").add("refresh_token", refreshToken).add("client_id", provider.clientId)
    provider.scope?.let { form.add("scope", it) }
    return token(form.build()).optString("access_token").takeIf(::token) ?: throw FilesFailure("oauth_login")
  }
  // Best effort on removal or a failed save. Only Dropbox lets a public client revoke; Microsoft has no such call and
  // Yandex requires the app secret (ADR0028 §6).
  val canRevoke get() = provider == OAuthProvider.DROPBOX
  fun revoke(refreshToken: String) { if (canRevoke) runCatching { revokeAccess(refresh(refreshToken)) } }
  fun revokeAccess(accessToken: String) {
    if (!canRevoke || !token(accessToken)) return
    runCatching {
      exchange(Request.Builder().url("${provider.api}/2/auth/token/revoke").header("Authorization", "Bearer $accessToken")
        .post(ByteArray(0).toRequestBody()).build())
    }
  }

  private fun token(form: FormBody): JSONObject {
    val (status, body) = exchange(Request.Builder().url(provider.token).post(form).build())
    if (status != 200 || body == null) throw FilesFailure("oauth_login")
    return try { JSONObject(body) } catch (_: Exception) { throw FilesFailure("oauth_login") }
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
            if (count > 65536 - output.size()) throw FilesFailure("oauth_login")
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
    fun request(provider: OAuthProvider): OAuthRequest {
      val verifier = random(); val state = random()
      val challenge = AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
      val url = Uri.parse(provider.authorize).buildUpon()
        .appendQueryParameter("client_id", provider.clientId).appendQueryParameter("response_type", "code")
        .appendQueryParameter("redirect_uri", provider.redirect).appendQueryParameter("code_challenge", challenge)
        .appendQueryParameter("code_challenge_method", "S256").appendQueryParameter("state", state)
        .apply { provider.scope?.let { appendQueryParameter("scope", it) } }
        .apply { provider.extra.toSortedMap().forEach { (key, value) -> appendQueryParameter(key, value) } }.build()
      return OAuthRequest(provider, url, state, verifier)
    }
    // Only the registered redirect with the matching state is accepted; a denied grant is a cancel, anything else a failure.
    // Microsoft may add a trailing slash to the registered path, which is not a different path.
    fun code(callback: Uri, request: OAuthRequest): String {
      val expected = Uri.parse(request.provider.redirect)
      fun path(value: String?) = value.orEmpty().removeSuffix("/")
      if (callback.scheme != expected.scheme || callback.host != expected.host || path(callback.path) != path(expected.path) ||
        callback.getQueryParameter("state") != request.state) throw FilesFailure("oauth_login")
      if (callback.getQueryParameter("error") in listOf("access_denied", "consent_required")) throw FilesFailure("cancelled")
      return callback.getQueryParameter("code")?.takeIf(::token) ?: throw FilesFailure("oauth_login")
    }
    private fun token(value: String) = value.isNotEmpty() && value.toByteArray().size <= 8192 && value.all { it.code in 33..126 }
    private fun random(): String = AndroidWebDavProfile.encode(ByteArray(32).also { SecureRandom().nextBytes(it) })
  }
}
