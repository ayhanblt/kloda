package com.kloda.sync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AndroidBackupReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    Thread({ try {
      val changed = intent.action == Intent.ACTION_TIME_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED
      AndroidBackupScheduler.reconcile(context.applicationContext, changed)
      AndroidWebDavScheduler.reconcile(context.applicationContext, changed)
    } finally { pending.finish() } }, "kloda-backup-reconcile").start()
  }
}
