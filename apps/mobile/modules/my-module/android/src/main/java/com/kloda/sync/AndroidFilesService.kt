package com.kloda.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Only a visible UI request may start this non-exported, non-restarting service. */
class AndroidFilesService : Service() {
  @Volatile private var retiring = false
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    activate()
  }

  private fun activate() {
    try {
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
        NotificationChannel(CHANNEL, getString(R.string.kloda_backup_channel), NotificationManager.IMPORTANCE_LOW))
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
      val open = packageManager.getLaunchIntentForPackage(packageName)
      val notification = builder.setSmallIcon(android.R.drawable.stat_sys_upload)
        .setContentTitle(getString(R.string.kloda_backup_title))
        .setContentText(getString(R.string.kloda_backup_body)).setOngoing(true).setOnlyAlertOnce(true)
        .apply { open?.let { setContentIntent(PendingIntent.getActivity(this@AndroidFilesService, 0, it,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)) } }
        .build()
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      else startForeground(NOTIFICATION, notification)
      synchronized(gate) {
        val request = current
        if (retiring || request == null || request.stopped) {
          request?.takeIf { it.service == null }?.let { it.stopped = true; it.ready.countDown() }
          retiring = true
          stopSelf()
        }
        else { request.service = this; request.ready.countDown() }
      }
    } catch (_: Exception) {
      synchronized(gate) { current?.let { it.stopped = true; it.ready.countDown() } }
      stopSelf()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!running()) activate()
    return START_NOT_STICKY
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    interrupt()
    stopSelf()
  }

  override fun onDestroy() {
    interrupt()
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun interrupt() = synchronized(gate) {
    retiring = true
    if (current?.service === this) {
      current?.stopped = true
      current = null
      // Never join JNI or journal work on the Android main thread.
      AndroidPairingRuntime.files?.requestPause()
    }
  }

  companion object {
    private const val CHANNEL = "kloda-backup"
    private const val NOTIFICATION = 2701
    private val gate = Any()
    private class Request {
      val ready = CountDownLatch(1)
      @Volatile var service: AndroidFilesService? = null
      @Volatile var stopped = false
    }
    @Volatile private var current: Request? = null

    internal fun running(): Boolean = current?.let { !it.stopped && it.service != null } == true

    internal fun acquire(context: Context) {
      val request = synchronized(gate) {
        if (running()) return
        Request().also { current = it }
      }
      try {
        val intent = Intent(context, AndroidFilesService::class.java)
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
        if (!request.ready.await(4, TimeUnit.SECONDS) || request.stopped || request.service == null)
          throw FilesFailure("background_unavailable")
      } catch (_: Exception) {
        stop()
        throw FilesFailure("background_unavailable")
      }
    }

    internal fun stop() {
      val service = synchronized(gate) {
        current?.let {
          it.stopped = true; current = null; it.ready.countDown()
          it.service?.also { service -> service.retiring = true }
        }
      }
      service?.stopSelf()
    }
  }
}
