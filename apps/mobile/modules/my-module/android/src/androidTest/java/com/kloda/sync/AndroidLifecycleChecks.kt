package com.kloda.sync

import android.Manifest
import android.app.Activity
import android.app.Instrumentation
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock

/** Test-only top activity; never creates an Expo bridge, pairing owner, queue or network. */
class AndroidLifecycleActivity : Activity() {
  @Volatile var resumed = false
    private set
  @Volatile var focused = false
    private set
  override fun onResume() { super.onResume(); resumed = true }
  override fun onPause() { resumed = false; super.onPause() }
  override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); focused = hasFocus }
  // Google Drive checks: Play services consent must be started for a result from an activity.
  @Deprecated("Activity result API of the platform Activity")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    AndroidGoogleDrive.delivered(requestCode, resultCode, data)
  }
}

/** FGS primitive only. The host grants/restores POST_NOTIFICATIONS outside this self-instrumented process. */
internal object AndroidLifecycleChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    val target = instrumentation.targetContext
    check(context.packageName == target.packageName)
    // Revoking this UID's permission from inside instrumentation may terminate its own process.
    if (Build.VERSION.SDK_INT >= 33) check(target.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    val notifications = target.getSystemService(NotificationManager::class.java)
    var activity: AndroidLifecycleActivity? = null
    try {
      check(!AndroidFilesService.running())
      val visible = instrumentation.startActivitySync(Intent(target, AndroidLifecycleActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible
      instrumentation.waitForIdleSync()
      eventually { visible.resumed && visible.focused }
      AndroidFilesService.acquire(target)
      eventually { AndroidFilesService.running() && notifications.activeNotifications.any { it.id == 2701 } }
      instrumentation.runOnMainSync { visible.finish() }
      instrumentation.waitForIdleSync()
      eventually { !visible.resumed }
      val until = SystemClock.elapsedRealtime() + 1000
      while (SystemClock.elapsedRealtime() < until) {
        check(AndroidFilesService.running())
        Thread.sleep(50)
      }
      check(notifications.activeNotifications.any { it.id == 2701 })
      AndroidFilesService.stop()
      eventually { !AndroidFilesService.running() && notifications.activeNotifications.none { it.id == 2701 } }
    } finally {
      AndroidFilesService.stop()
      instrumentation.runOnMainSync { activity?.finish() }
    }
  }

  private fun eventually(condition: () -> Boolean) {
    val deadline = SystemClock.elapsedRealtime() + 15_000
    while (!condition()) {
      check(SystemClock.elapsedRealtime() < deadline) { "Timed out waiting for lifecycle state" }
      Thread.sleep(50)
    }
  }
}
