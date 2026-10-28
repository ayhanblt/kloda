package com.kloda.sync

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal data class RestoreDestinationInput(val name: String) : Serializable

internal class RestoreDestinationContract : AppContextActivityResultContract<RestoreDestinationInput, Uri?> {
  override fun createIntent(context: Context, input: RestoreDestinationInput): Intent =
    Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/octet-stream"
      putExtra(Intent.EXTRA_TITLE, input.name)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    }
  override fun parseResult(input: RestoreDestinationInput, resultCode: Int, intent: Intent?): Uri? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.takeIf { it.scheme == "content" } else null
}

// System picker/permission results arrive before onResume; wait for that explicit hand-off.
internal suspend fun awaitRestoreForeground(activity: Activity?) = withContext(Dispatchers.Main) {
  val current = activity ?: throw FilesFailure("paused")
  val lifecycle = (current as? LifecycleOwner)?.lifecycle ?: throw FilesFailure("paused")
  if (lifecycle.currentState == Lifecycle.State.DESTROYED) throw FilesFailure("cancelled")
  if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) suspendCancellableCoroutine<Unit> { continuation ->
    lateinit var observer: LifecycleEventObserver
    observer = LifecycleEventObserver { _, event ->
      if (event == Lifecycle.Event.ON_RESUME || event == Lifecycle.Event.ON_DESTROY) {
        lifecycle.removeObserver(observer)
        if (continuation.isActive) {
          if (event == Lifecycle.Event.ON_RESUME) continuation.resume(Unit)
          else continuation.resumeWithException(FilesFailure("cancelled"))
        }
      }
    }
    lifecycle.addObserver(observer)
    continuation.invokeOnCancellation { current.runOnUiThread { lifecycle.removeObserver(observer) } }
  }
}
