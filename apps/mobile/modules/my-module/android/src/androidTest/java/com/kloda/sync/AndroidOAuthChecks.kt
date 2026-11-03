package com.kloda.sync

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import android.app.Activity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

// Code + PKCE, refresh and (where the provider allows) revoke against the user's own account, plus OAuth Keystore custody
// (ADR0028). Tokens never leave memory: the stream holds pass lines only.
internal object AndroidOAuthChecks {
  private fun rejects(code: String, action: () -> Unit) {
    var observed: String? = null
    try { action() } catch (error: FilesFailure) { observed = error.code }
    check(observed == code) { "Expected $code; observed $observed" }
  }

  fun run(isolated: Context, providerName: String, open: () -> Activity,
    use: ((Context, AndroidOAuthProfile) -> Unit)? = null, announce: (String) -> Unit) {
    val provider = OAuthProvider.named(providerName)
    val namespace = UUID.randomUUID().toString().replace("-", "")
    val context = object : ContextWrapper(isolated) {
      override fun getPackageName() = isolated.packageName + ".oauth." + namespace
    }
    if (provider == OAuthProvider.GOOGLE_DRIVE) { custody(context, provider); drive(open(), context, announce); return }
    offline(context, provider)
    custody(context, provider)
    live(isolated, context, provider, announce, use)
  }

  private fun offline(context: Context, provider: OAuthProvider) {
    val request = AndroidOAuthLogin.request(provider)
    check(request.url.getQueryParameter("client_id") == provider.clientId && request.url.getQueryParameter("redirect_uri") == provider.redirect &&
      request.url.getQueryParameter("code_challenge_method") == "S256" && request.url.getQueryParameter("state") == request.state &&
      request.url.getQueryParameter("scope") == provider.scope && request.url.getQueryParameter("code_challenge")?.length == 43 &&
      request.verifier.length == 43 && request.url.getQueryParameter("client_secret") == null &&
      provider.extra.all { (key, value) -> request.url.getQueryParameter(key) == value }) { "authorize url" }
    check(AndroidOAuthLogin.request(provider).state != request.state) { "fresh state" }
    val base = provider.redirect
    check(AndroidOAuthLogin.code(Uri.parse("$base?state=${request.state}&code=abc"), request) == "abc")
    check(AndroidOAuthLogin.code(Uri.parse("${base.substringBefore('?')}/?state=${request.state}&code=abc"), request) == "abc") { "trailing slash" }
    rejects("oauth_login") { AndroidOAuthLogin.code(Uri.parse("$base/other?state=${request.state}&code=abc"), request) }
    rejects("oauth_login") { AndroidOAuthLogin.code(Uri.parse("$base?state=other&code=abc"), request) }
    rejects("oauth_login") { AndroidOAuthLogin.code(Uri.parse("db-other://oauth?state=${request.state}&code=abc"), request) }
    rejects("cancelled") { AndroidOAuthLogin.code(Uri.parse("$base?state=${request.state}&error=access_denied"), request) }
  }

  private fun custody(context: Context, provider: OAuthProvider) {
    val drive = provider == OAuthProvider.GOOGLE_DRIVE
    val profile = AndroidOAuthProfile(UUID.randomUUID().toString(), provider.name, "owned", "/Kloda/", if (drive) "" else "fixture-token",
      if (provider == OAuthProvider.YANDEX) 4102444800 else null, if (drive) "owner@example.com" else null)
    val same = profile.copy(revision = UUID.randomUUID().toString(), targetPath = "Kloda", refreshToken = if (drive) "" else "other")
    val elsewhere = AndroidOAuthProfile(UUID.randomUUID().toString(), if (provider == OAuthProvider.DROPBOX) "onedrive" else "dropbox",
      "owned", "Kloda", "x")
    if (drive) {
      rejects("webdav_fields") { profile.copy(refreshToken = "token").validate() }
      rejects("webdav_fields") { profile.copy(accountName = null).validate() }
    } else rejects("webdav_fields") { profile.copy(accountName = "owner@example.com").validate() }
    check(profile.targetId() == same.targetId() && profile.targetId() != profile.copy(accountId = "other").targetId() &&
      profile.targetId() != elsewhere.targetId()) { "provider+account+root identity" }
    val vault = AndroidOAuthVault(context, profile.targetId())
    vault.add(profile)
    check(vault.read() == profile) { "round trip" }
    rejects("destination_exists") { vault.add(same) }
    rejects("invalid_request") { AndroidOAuthVault(context, profile.targetId()).add(profile.copy(accountId = "other")) }
    rejects("invalid_request") { AndroidOAuthVault(context, "not-a-target") }
    rejects("webdav_fields") { profile.copy(provider = "box").validate() }
    rejects("webdav_fields") { profile.copy(expiresAt = if (provider == OAuthProvider.YANDEX) null else 4102444800).validate() }
    rejects("webdav_fields") { profile.copy(targetPath = "../x").validate() }
    check(AndroidOAuthVault.slots(context) == listOf(profile.targetId())) { "slots" }
    vault.delete()
    check(vault.read() == null && AndroidOAuthVault.slots(context).isEmpty()) { "delete" }
  }

  // Play services consent runs through the product consent() path over a test activity that forwards its result.
  private fun drive(launcher: Activity, context: Context, announce: (String) -> Unit) {
    check(AndroidGoogleDrive.available(launcher)) { "Google Play services unavailable" }
    var result = runBlocking { AndroidGoogleDrive.authorize(launcher, null) }
    if (result.hasResolution()) {
      announce("SIGN_IN google-drive consent open")
      val pending = result
      result = runBlocking { withTimeout(10 * 60 * 1000L) { withContext(Dispatchers.Main) { AndroidGoogleDrive.consent(launcher, pending) } } }
    }
    val access = AndroidGoogleDrive.accessToken(result)
    val login = AndroidOAuthLogin(context, OAuthProvider.GOOGLE_DRIVE)
    val (id, account) = login.driveIdentity(access)
    val profile = AndroidOAuthProfile(UUID.randomUUID().toString(), "google-drive", id, "Kloda", "", accountName = account)
    val vault = AndroidOAuthVault(context, profile.targetId())
    vault.add(profile)
    check(vault.read() == profile) { "stored account" }
    // Later tokens come silently from Play services for the stored account, which is what upload work will do.
    val again = runBlocking { AndroidGoogleDrive.authorize(launcher, account) }
    check(!again.hasResolution() && AndroidGoogleDrive.accessToken(again).isNotEmpty()) { "silent token for stored account" }
    announce("PASS play-services-grant drive-identity keystore-account-only silent-token")
    // Removal bounds revoke the same way (KlodaCloudModule); an older Play services may never answer revokeAccess.
    val answered = runBlocking { withTimeoutOrNull(30_000) { AndroidGoogleDrive.revoke(launcher, account) } } != null
    if (answered) {
      val after = runBlocking { AndroidGoogleDrive.authorize(launcher, account) }
      check(after.hasResolution()) { "grant still silent after revoke" }
      announce("PASS revoke-requires-new-consent")
    } else announce("OPEN revoke no answer in 30s; user removes access in Google account settings")
    vault.delete()
    check(vault.read() == null) { "custody deleted" }
    launcher.finish()
    announce("PASS custody-deleted")
  }

  // The redirect reaches KlodaOAuthRedirectActivity in this test package, which completes the pending deferred.
  private fun live(launcher: Context, context: Context, provider: OAuthProvider, announce: (String) -> Unit,
    use: ((Context, AndroidOAuthProfile) -> Unit)?) {
    val request = AndroidOAuthLogin.request(provider)
    val redirect = AndroidOAuthRedirect.expect()
    launcher.startActivity(CustomTabsIntent.Builder().build().intent.setData(request.url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    announce("SIGN_IN ${provider.name} tab open")
    val callback = try { runBlocking { withTimeout(10 * 60 * 1000L) { redirect.await() } } } finally { AndroidOAuthRedirect.cancel() }
    val login = AndroidOAuthLogin(context, provider)
    fun <T> stage(name: String, action: () -> T): T = try { action() } catch (error: FilesFailure) { throw IllegalStateException("$name: ${error.code}") }
    val grant = stage("exchange") { login.exchange(AndroidOAuthLogin.code(callback, request), request) }
    val profile = AndroidOAuthProfile(UUID.randomUUID().toString(), provider.name, grant.accountId, "Kloda", grant.refreshToken, grant.expiresAt)
    val vault = AndroidOAuthVault(context, profile.targetId())
    vault.add(profile)
    check(vault.read() == profile) { "stored grant" }
    stage("refresh") { login.refresh(grant.refreshToken, grant.expiresAt) }
    if (provider == OAuthProvider.YANDEX) {
      rejects("oauth_expired") { login.refresh(grant.refreshToken, 1) }
      check((grant.expiresAt ?: 0) > System.currentTimeMillis() / 1000 + 86400) { "yandex expiry" }
    }
    announce("PASS pkce-exchange account-id keystore-round-trip refresh")
    // Optional work with the live grant (18B/5 upload) before it is revoked; revoke and custody deletion always follow.
    try { use?.invoke(context, profile) } catch (error: Throwable) {
      if (login.canRevoke) runCatching { AndroidOAuthLogin(context, provider).revoke(grant.refreshToken) }
      runCatching { vault.delete() }
      throw error
    }
    if (login.canRevoke) {
      AndroidOAuthLogin(context, provider).revoke(grant.refreshToken)
      var revoked = false
      try { AndroidOAuthLogin(context, provider).refresh(grant.refreshToken) } catch (error: FilesFailure) { revoked = error.code == "oauth_login" }
      check(revoked) { "refresh token still valid after revoke" }
      announce("PASS revoke-invalidates-refresh")
    } else announce("SKIP revoke not offered by provider; user removes access in account settings")
    vault.delete()
    check(vault.read() == null) { "custody deleted" }
    announce("PASS custody-deleted")
  }
}
