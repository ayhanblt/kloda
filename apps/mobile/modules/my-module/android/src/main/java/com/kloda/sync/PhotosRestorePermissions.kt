package com.kloda.sync

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.AppContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

internal suspend fun requestPhotosRestorePermissions(context: Context, appContext: AppContext): Boolean {
  val needed = AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT) +
    if (Build.VERSION.SDK_INT < 29) arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE) else emptyArray()
  if (needed.all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) return true
  val permissions = appContext.permissions ?: return false
  withContext(Dispatchers.Main) {
    suspendCancellableCoroutine<Unit> { continuation ->
      permissions.askForPermissions({ if (continuation.isActive) continuation.resume(Unit) },
        *(needed + if (Build.VERSION.SDK_INT >= 34) arrayOf(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) else emptyArray()))
    }
  }
  return needed.all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
}
