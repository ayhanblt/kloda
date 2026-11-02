package com.kloda.sync

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.atomic.AtomicReference

// One pending OAuth redirect at a time. PKCE and the state check make a redirect from another app useless.
internal object AndroidOAuthRedirect {
  private val pending = AtomicReference<CompletableDeferred<Uri>?>()
  fun expect(): CompletableDeferred<Uri> = CompletableDeferred<Uri>().also { pending.set(it) }
  fun deliver(uri: Uri) { pending.getAndSet(null)?.complete(uri) }
  fun cancel() { pending.getAndSet(null)?.completeExceptionally(FilesFailure("cancelled")) }
  // Back in the app without a redirect means the user closed the tab; the redirect activity runs before the app resumes.
  fun resumed() {
    val current = pending.get() ?: return
    Handler(Looper.getMainLooper()).postDelayed({ if (pending.compareAndSet(current, null)) current.completeExceptionally(FilesFailure("cancelled")) }, 750)
  }
}

// Receives the registered redirect from the Custom Tab, then brings the existing Kloda activity forward over the tab.
class KlodaOAuthRedirectActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    intent?.data?.let(AndroidOAuthRedirect::deliver)
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      startActivity(it.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    }
    finish()
  }
}
