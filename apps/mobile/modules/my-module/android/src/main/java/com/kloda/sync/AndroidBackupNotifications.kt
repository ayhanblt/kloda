package com.kloda.sync

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.AppContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

internal object AndroidBackupNotifications {
  private const val CHANNEL = "kloda-backup"
  private const val PROGRESS = 2704
  private const val ERROR = 2705

  fun enabled(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 26 ||
      manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE)
  }

  suspend fun request(context: Context, appContext: AppContext): Boolean {
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      val permissions = appContext.permissions ?: return false
      withContext(Dispatchers.Main) {
        suspendCancellableCoroutine<Unit> { continuation ->
          permissions.askForPermissions({ if (continuation.isActive) continuation.resume(Unit) }, Manifest.permission.POST_NOTIFICATIONS)
        }
      }
      awaitRestoreForeground(appContext.currentActivity)
    }
    return enabled(context)
  }

  fun progress(context: Context) = post(context, PROGRESS, R.string.kloda_backup_body, ongoing = true)
  fun failure(context: Context) = post(context, ERROR, R.string.kloda_backup_failure, ongoing = false)
  fun clear(context: Context) { context.getSystemService(NotificationManager::class.java).cancel(PROGRESS) }
  fun clearFailure(context: Context) { context.getSystemService(NotificationManager::class.java).cancel(ERROR) }

  private fun post(context: Context, id: Int, message: Int, ongoing: Boolean) {
    runCatching {
      if (!enabled(context)) return
      val manager = context.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL,
        context.getString(R.string.kloda_backup_channel), NotificationManager.IMPORTANCE_LOW))
      val open = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
      manager.notify(id, builder.setSmallIcon(android.R.drawable.stat_sys_upload)
        .setContentTitle(context.getString(R.string.kloda_backup_title)).setContentText(context.getString(message))
        .setOnlyAlertOnce(true).setOngoing(ongoing).setContentIntent(PendingIntent.getActivity(context, 0, open,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)).build())
    }
  }
}
