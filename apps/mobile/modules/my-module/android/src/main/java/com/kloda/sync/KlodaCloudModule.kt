package com.kloda.sync

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

// Step18A/4 (ADR0027): add, list, enable and remove DAV destinations. Saving custody is not enabling (ADR0023);
// an enabled DAV destination gets its own queue plan (18A/3). The original WebDAV entry is managed by KlodaBackup.
class KlodaCloudModule : Module() {
  private val login = AtomicReference<AndroidNextcloudLogin?>()
  private val oauth = AtomicReference<AndroidOAuthLogin?>()
  private fun context() = appContext.reactContext?.applicationContext ?: throw FilesFailure("native_unsupported")
  private fun resumed() = (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
  private fun <T> guarded(action: () -> T): T = try { action() } catch (error: Exception) {
    val code = if (error is FilesFailure) error.code else "outcome_unknown"
    throw CodedException(code, code, null)
  }

  override fun definition() = ModuleDefinition {
    Name("KlodaCloud")
    OnDestroy { cancel() }
    OnActivityEntersForeground { AndroidOAuthRedirect.resumed() }
    OnActivityResult { _, payload ->
      AndroidGoogleDrive.delivered(payload.requestCode, payload.resultCode, payload.data)
      AndroidDeviceCheck.delivered(payload.requestCode, payload.resultCode)
    }
    AsyncFunction("destinations") Coroutine { -> withContext(Dispatchers.IO) { guarded { mapOf("destinations" to summaries()) } } }
    AsyncFunction("signInNextcloud") Coroutine { server: String, folder: String -> signIn(server, folder) }
    AsyncFunction("signInOAuth") Coroutine { provider: String, folder: String -> signInOAuth(provider, folder) }
    AsyncFunction("cancelSignIn") { cancel() }
    AsyncFunction("addKolabNow") Coroutine { username: String, password: String, folder: String ->
      if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
      withContext(Dispatchers.IO) { guarded {
        val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), KOLAB_NOW, folder, username, password, "kolab-now")
        store(profile)
        summary(profile)
      } }
    }
    AsyncFunction("removeDestination") Coroutine { targetId: String ->
      if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
      withContext(Dispatchers.IO) { guarded {
        val vault = AndroidWebDavVault(context(), targetId)
        val saved = AndroidOAuthVault(context(), targetId)
        val profile = vault.read()
        // Best effort (ADR0027/0028): no network must not keep local custody alive.
        if (profile != null) {
          AndroidWebDavDestinations.forget(context(), targetId)
          if (profile.provider == "nextcloud") runCatching { AndroidNextcloudLogin(context()) }.getOrNull()?.revoke(profile)
          vault.delete()
        } else {
          val grant = saved.read() ?: throw FilesFailure("not_found")
          AndroidWebDavDestinations.forget(context(), targetId)
          if (grant.accountName != null) runBlocking { withTimeoutOrNull(15_000) { AndroidGoogleDrive.revoke(context(), grant.accountName) } }
          else runCatching { AndroidOAuthLogin(context(), OAuthProvider.named(grant.provider)) }.getOrNull()?.revoke(grant.refreshToken)
          saved.delete()
        }
        mapOf("destinations" to summaries())
      } }
    }
    // Explicit, foreground-only opt-in (ADR0023); OAuth destinations stay unsupported until their adapters exist
    // (Dropbox has one since 18B/5).
    AsyncFunction("setDestinationEnabled") Coroutine { targetId: String, enabled: Boolean ->
      if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
      withContext(Dispatchers.IO) { guarded {
        if (enabled) AndroidRecoveryVault(context()).requireConfirmed()
        AndroidWebDavDestinations.setEnabled(context(), targetId, enabled)
        mapOf("destinations" to summaries())
      } }
    }
    // ADR0029 29/1: the recovery code is shown only after the device lock check and confirmed before the first
    // cloud destination is enabled. The window is FLAG_SECURE while the code is on screen.
    AsyncFunction("recoveryStatus") Coroutine { -> withContext(Dispatchers.IO) { guarded { mapOf("state" to AndroidRecoveryVault(context()).state()) } } }
    AsyncFunction("revealRecovery") Coroutine { title: String, reason: String ->
      if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
      if (listOf(title, reason).any { it.isBlank() || it.length > 200 }) throw CodedException("invalid_request", "invalid_request", null)
      val activity = appContext.currentActivity ?: throw CodedException("candidate_stale", "candidate_stale", null)
      try { withContext(Dispatchers.Main) { AndroidDeviceCheck.confirm(activity, title, reason) } }
      catch (error: FilesFailure) { throw CodedException(error.code, error.code, null) }
      val code = withContext(Dispatchers.IO) { guarded { AndroidRecoveryVault(context()).reveal() } }
      withContext(Dispatchers.Main) { activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE) }
      mapOf("code" to code)
    }
    AsyncFunction("hideRecovery") Coroutine { ->
      withContext(Dispatchers.Main) { appContext.currentActivity?.window?.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE) }
      Unit
    }
    AsyncFunction("confirmRecovery") Coroutine { first: Int, firstGroup: String, second: Int, secondGroup: String ->
      if (first == second) throw CodedException("invalid_request", "invalid_request", null)
      withContext(Dispatchers.IO) { guarded { mapOf("state" to AndroidRecoveryVault(context()).confirm(mapOf(first to firstGroup, second to secondGroup))) } }
    }
    // Step18A/4c: one manual run of an enabled, added destination (DAV, or Dropbox since 18B/5) through the shared
    // queue (same lock and begin() order as the original WebDAV run); the original entry keeps KlodaBackup's run/pause.
    AsyncFunction("runDestination") Coroutine { targetId: String ->
      if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
      withContext(Dispatchers.IO) { guarded {
        added(targetId); AndroidWebDavRuntime.queue(context()).start(target = targetId)
        mapOf("destinations" to summaries())
      } }
    }
    AsyncFunction("pauseDestination") Coroutine { targetId: String ->
      withContext(Dispatchers.IO) { guarded {
        added(targetId); AndroidWebDavRuntime.queue(context()).pauseTarget(targetId, "target_pause")
        mapOf("destinations" to summaries())
      } }
    }
  }

  // Login Flow v2: the login page opens in a Custom Tab while the poll waits for the grant (up to 20 minutes).
  private suspend fun signIn(server: String, folder: String): Map<String, Any> {
    if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
    val current = withContext(Dispatchers.IO) { guarded { AndroidNextcloudLogin(context()) } }
    if (oauth.get() != null || !login.compareAndSet(null, current)) throw CodedException("backup_busy", "backup_busy", null)
    try {
      val start = withContext(Dispatchers.IO) { guarded {
        if (total() >= AndroidWebDavVault.LIMIT) throw FilesFailure("destination_limit")
        current.start(server)
      } }
      withContext(Dispatchers.Main) { guarded {
        val activity = appContext.currentActivity ?: throw FilesFailure("candidate_stale")
        // No browser at all: stop instead of polling for a page the user cannot open.
        try { CustomTabsIntent.Builder().build().launchUrl(activity, Uri.parse(start.login.toString())) }
        catch (_: android.content.ActivityNotFoundException) { throw FilesFailure("nextcloud_login") }
      } }
      val summary = withContext(Dispatchers.IO) { guarded {
        val profile = current.profile(start, current.waitForGrant(start), folder)
        try { store(profile) } catch (error: Exception) { current.revoke(profile); throw error }
        summary(profile)
      } }
      withContext(Dispatchers.Main) { returnToApp() }
      return summary
    } finally { login.compareAndSet(current, null) }
  }
  // Code + PKCE (ADR0028): the Custom Tab returns through KlodaOAuthRedirectActivity; exchange and save run on IO.
  private suspend fun signInOAuth(name: String, folder: String): Map<String, Any> {
    val provider = guarded { OAuthProvider.named(name) }
    if (!resumed()) throw CodedException("candidate_stale", "candidate_stale", null)
    val current = withContext(Dispatchers.IO) { guarded { AndroidOAuthLogin(context(), provider) } }
    if (login.get() != null || !oauth.compareAndSet(null, current)) throw CodedException("backup_busy", "backup_busy", null)
    try {
      if (provider == OAuthProvider.GOOGLE_DRIVE) return signInGoogleDrive(current, folder)
      val request = withContext(Dispatchers.IO) { guarded {
        if (total() >= AndroidWebDavVault.LIMIT) throw FilesFailure("destination_limit")
        AndroidOAuthLogin.request(provider)
      } }
      val redirect = AndroidOAuthRedirect.expect()
      withContext(Dispatchers.Main) { guarded {
        val activity = appContext.currentActivity ?: throw FilesFailure("candidate_stale")
        try { CustomTabsIntent.Builder().build().launchUrl(activity, request.url) }
        catch (_: android.content.ActivityNotFoundException) { throw FilesFailure("oauth_login") }
      } }
      val callback = try { withTimeout(10 * 60 * 1000L) { redirect.await() } }
        catch (error: FilesFailure) { throw CodedException(error.code, error.code, null) }
        catch (_: TimeoutCancellationException) { throw CodedException("cancelled", "cancelled", null) }
      return withContext(Dispatchers.IO) { guarded {
        val grant = current.exchange(AndroidOAuthLogin.code(callback, request), request)
        val profile = AndroidOAuthProfile(UUID.randomUUID().toString(), provider.name, grant.accountId, folder, grant.refreshToken, grant.expiresAt)
        try {
          if (current.cancelled) throw FilesFailure("cancelled")
          if (total() >= AndroidWebDavVault.LIMIT) throw FilesFailure("destination_limit")
          AndroidOAuthVault(context(), profile.targetId()).add(profile)
        } catch (error: Exception) {
          runCatching { AndroidOAuthLogin(context(), provider) }.getOrNull()?.revokeAccess(grant.accessToken); throw error
        }
        summary(profile)
      } }
    } finally { AndroidOAuthRedirect.cancel(); oauth.compareAndSet(current, null) }
  }
  // Google Drive (ADR0028 §1): Play services shows its own account and consent screens; no token reaches the vault.
  private suspend fun signInGoogleDrive(current: AndroidOAuthLogin, folder: String): Map<String, Any> {
    val context = context()
    val access = try {
      withContext(Dispatchers.IO) {
        if (!AndroidGoogleDrive.available(context)) throw FilesFailure("google_play_unavailable")
        if (total() >= AndroidWebDavVault.LIMIT) throw FilesFailure("destination_limit")
      }
      withContext(Dispatchers.Main) {
        val activity = appContext.currentActivity ?: throw FilesFailure("candidate_stale")
        var result = AndroidGoogleDrive.authorize(activity, null)
        if (result.hasResolution()) result = withTimeout(10 * 60 * 1000L) { AndroidGoogleDrive.consent(activity, result) }
        AndroidGoogleDrive.accessToken(result)
      }
    } catch (error: FilesFailure) { throw CodedException(error.code, error.code, null) }
      catch (_: TimeoutCancellationException) { throw CodedException("cancelled", "cancelled", null) }
    return withContext(Dispatchers.IO) { guarded {
      val (id, account) = current.driveIdentity(access)
      val profile = AndroidOAuthProfile(UUID.randomUUID().toString(), "google-drive", id, folder, "", accountName = account)
      try {
        if (current.cancelled) throw FilesFailure("cancelled")
        if (total() >= AndroidWebDavVault.LIMIT) throw FilesFailure("destination_limit")
        AndroidOAuthVault(context, profile.targetId()).add(profile)
      } catch (error: Exception) {
        runBlocking { withTimeoutOrNull(15_000) { AndroidGoogleDrive.revoke(context, account) } }; throw error
      }
      summary(profile)
    } }
  }
  private fun cancel() {
    login.get()?.cancel()
    oauth.get()?.cancel(); AndroidOAuthRedirect.cancel(); AndroidGoogleDrive.cancel(); AndroidDeviceCheck.cancel()
  }

  // Custom Tabs cannot be closed by the app; bringing the existing Kloda activity forward finishes the tab above it.
  private fun returnToApp() {
    val activity = appContext.currentActivity ?: return
    activity.startActivity(Intent(activity, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
  }

  // An existing destination is never replaced; the vault refuses a new slot past the limit.
  private fun store(profile: AndroidWebDavProfile) {
    profile.validate()
    val vault = AndroidWebDavVault(context(), profile.targetId())
    if (vault.read() != null) throw FilesFailure("destination_exists")
    if (total() >= AndroidWebDavVault.LIMIT) throw FilesFailure("destination_limit")
    vault.write(profile)
  }
  private fun added(targetId: String) {
    if (AndroidWebDavDestinations.added(context(), targetId) != null) return
    val stored = AndroidWebDavVault(context(), targetId).read() != null || AndroidOAuthVault(context(), targetId).read() != null
    throw FilesFailure(if (stored) "destination_unsupported" else "not_found")
  }
  // ADR0028 §7: DAV and OAuth destinations share one limit.
  private fun total(): Int = AndroidWebDavVault.count(context()) + AndroidOAuthVault.slots(context()).size

  // Display metadata only: never the password.
  // `enabled` is the destination's queue opt-in (the original WebDAV entry's lives in KlodaBackup, so it reads false here).
  private fun summary(profile: AndroidWebDavProfile): Map<String, Any> = buildMap {
    put("targetId", profile.targetId()); put("provider", profile.provider ?: "webdav"); put("endpoint", profile.endpoint)
    put("targetPath", profile.targetPath); put("username", profile.username)
    put("enabled", profile.provider != null && AndroidWebDavDestinations.enabled(context(), profile.targetId()))
    if (profile.provider != null) AndroidWebDavRuntime.queue(context()).runView(profile.targetId())?.let { put("run", it) }
  }
  // Display metadata only: never the refresh token. The account ID stands in for the user name.
  private fun summary(profile: AndroidOAuthProfile): Map<String, Any> = buildMap {
    val target = profile.targetId()
    put("targetId", target); put("provider", profile.provider); put("endpoint", OAuthProvider.named(profile.provider).api)
    put("targetPath", profile.targetPath); put("username", profile.accountId)
    put("enabled", AndroidWebDavDestinations.enabled(context(), target))
    if (profile.provider in AndroidCloudTarget.OAUTH_KINDS) AndroidWebDavRuntime.queue(context()).runView(target)?.let { put("run", it) }
  }
  private fun summaries(): List<Map<String, Any>> {
    val context = context()
    val legacy = AndroidWebDavVault(context).read()?.let { listOf(summary(it)) } ?: emptyList()
    return legacy + AndroidWebDavVault.slots(context).mapNotNull { AndroidWebDavVault(context, it).read()?.let(::summary) } +
      AndroidOAuthVault.slots(context).mapNotNull { AndroidOAuthVault(context, it).read()?.let(::summary) }
  }

  companion object {
    // ADR0027 §6: the documented HTTPS Basic DAV endpoint; the server is never user-entered. CloudMe offers only
    // Digest (probed 2026-11-01), so it has no add path and stays blocked.
    const val KOLAB_NOW = "https://apps.kolabnow.com/files"
  }
}
