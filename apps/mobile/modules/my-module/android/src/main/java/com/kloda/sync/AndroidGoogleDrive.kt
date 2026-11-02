package com.kloda.sync

import android.accounts.Account
import android.app.Activity
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.tasks.await
import java.util.concurrent.atomic.AtomicReference

// Google Drive on Android (ADR0028 §1, user decision 2026-11-02): Google Play services holds the grant and hands out
// short-lived access tokens; Kloda's vault keeps only the account (permission ID + device account name), never a token.
// Google offers no refresh token to an app without a server, and custom-scheme redirects are not supported on Android.
internal object AndroidGoogleDrive {
  const val SCOPE = "https://www.googleapis.com/auth/drive.file"
  const val REQUEST_CODE = 0x4b44
  private val pending = AtomicReference<CompletableDeferred<Pair<Int, Intent?>>?>()

  fun available(context: Context) = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
  private fun request(account: String?): AuthorizationRequest = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(SCOPE)))
    .apply { if (account != null) setAccount(Account(account, "com.google")) }.build()

  // Silent when access was already granted; otherwise the result carries Google's consent screen.
  suspend fun authorize(context: Context, account: String?): AuthorizationResult =
    try { Identity.getAuthorizationClient(context).authorize(request(account)).await() }
    catch (error: FilesFailure) { throw error } catch (error: CancellationException) { throw error }
    catch (_: Exception) { throw FilesFailure("oauth_login") }

  // Shows the consent screen over the activity and waits for its result (delivered by the module's activity-result hook).
  suspend fun consent(activity: Activity, result: AuthorizationResult): AuthorizationResult {
    val sender = result.pendingIntent?.intentSender ?: throw FilesFailure("oauth_login")
    val waiting = CompletableDeferred<Pair<Int, Intent?>>().also { pending.getAndSet(it)?.cancel() }
    activity.startIntentSenderForResult(sender, REQUEST_CODE, null, 0, 0, 0, null)
    val (code, data) = waiting.await()
    if (code != Activity.RESULT_OK) throw FilesFailure("cancelled")
    return try { Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data) }
    catch (_: Exception) { throw FilesFailure("oauth_login") }
  }
  fun delivered(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == REQUEST_CODE) pending.getAndSet(null)?.complete(resultCode to data)
  }
  fun cancel() { pending.getAndSet(null)?.completeExceptionally(FilesFailure("cancelled")) }

  // A granted result must include drive.file and an access token; anything less is treated as not granted.
  fun accessToken(result: AuthorizationResult): String {
    if (result.hasResolution()) throw FilesFailure("cancelled")
    if (SCOPE !in result.grantedScopes) throw FilesFailure("cancelled")
    return result.accessToken ?: throw FilesFailure("oauth_login")
  }
  // Best effort on removal or a failed save (ADR0028 §6).
  // Cancellation (the caller's timeout) is rethrown so a bounded revoke reports that it got no answer.
  suspend fun revoke(context: Context, account: String) {
    try {
      Identity.getAuthorizationClient(context).revokeAccess(RevokeAccessRequest.builder().setAccount(Account(account, "com.google"))
        .setScopes(listOf(Scope(SCOPE))).build()).await()
    } catch (error: CancellationException) { throw error } catch (_: Exception) {}
  }
}
