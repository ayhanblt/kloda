package com.kloda.sync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AndroidBackupReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    Thread({ try { AndroidBackupScheduler.reconcile(context.applicationContext, intent.action == Intent.ACTION_TIME_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED) } finally { pending.finish() } }, "kloda-backup-reconcile").start()
  }
}
