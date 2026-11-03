package com.kloda.sync

import android.app.Activity
import android.app.KeyguardManager
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.resume

// ADR0029 user decision 5: the phone's own screen lock (fingerprint/face or PIN/pattern/password) before the recovery
// code is shown. API 30+ uses the framework BiometricPrompt with a credential fallback; older versions the Keyguard screen.
internal object AndroidDeviceCheck {
  const val REQUEST_CODE = 0x4b29
  private val pending = AtomicReference<CompletableDeferred<Int>?>()

  // Must run on the main thread with a resumed activity; throws recovery_lock_required, cancelled or recovery_auth_failed.
  suspend fun confirm(activity: Activity, title: String, reason: String) {
    val keyguard = activity.getSystemService(KeyguardManager::class.java)
    if (!keyguard.isDeviceSecure) throw FilesFailure("recovery_lock_required")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) return prompt(activity, title, reason)
    @Suppress("DEPRECATION")
    val intent = keyguard.createConfirmDeviceCredentialIntent(title, reason) ?: throw FilesFailure("recovery_lock_required")
    val waiting = CompletableDeferred<Int>().also { pending.getAndSet(it)?.cancel() }
    @Suppress("DEPRECATION")
    activity.startActivityForResult(intent, REQUEST_CODE)
    if (waiting.await() != Activity.RESULT_OK) throw FilesFailure("cancelled")
  }
  fun delivered(requestCode: Int, resultCode: Int) {
    if (requestCode == REQUEST_CODE) pending.getAndSet(null)?.complete(resultCode)
  }
  fun cancel() { pending.getAndSet(null)?.cancel() }

  @android.annotation.TargetApi(Build.VERSION_CODES.R)
  private suspend fun prompt(activity: Activity, title: String, reason: String) {
    val allowed = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
    if (activity.getSystemService(BiometricManager::class.java).canAuthenticate(allowed) != BiometricManager.BIOMETRIC_SUCCESS)
      throw FilesFailure("recovery_lock_required")
    val failure = suspendCancellableCoroutine { continuation ->
      val signal = CancellationSignal()
      continuation.invokeOnCancellation { signal.cancel() }
      BiometricPrompt.Builder(activity).setTitle(title).setSubtitle(reason).setAllowedAuthenticators(allowed).build()
        .authenticate(signal, activity.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { if (continuation.isActive) continuation.resume(null) }
          // A single unrecognised finger is not final; the prompt stays open until success or an error.
          override fun onAuthenticationError(code: Int, message: CharSequence) {
            if (continuation.isActive) continuation.resume(if (code == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED ||
              code == BiometricPrompt.BIOMETRIC_ERROR_CANCELED) "cancelled" else "recovery_auth_failed")
          }
        })
    }
    if (failure != null) throw FilesFailure(failure)
  }
}
