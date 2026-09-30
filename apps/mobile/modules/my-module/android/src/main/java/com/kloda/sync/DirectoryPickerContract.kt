package com.kloda.sync

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.providers.AppContextProvider
import java.io.Serializable

internal class DirectoryPickerContract(
  private val appContextProvider: AppContextProvider
) : AppContextActivityResultContract<DirectoryPickerInput, String?> {
  override fun createIntent(context: Context, input: DirectoryPickerInput): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }

  override fun parseResult(input: DirectoryPickerInput, resultCode: Int, intent: Intent?): String? {
    if (resultCode != Activity.RESULT_OK) return null
    val uri = intent?.data ?: return null
    val flags = intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION
    requireNotNull(appContextProvider.appContext.reactContext).contentResolver.takePersistableUriPermission(uri, flags)
    return uri.toString()
  }
}

internal data class DirectoryPickerInput(val request: String = "directory") : Serializable
