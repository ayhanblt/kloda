package com.kloda.sync

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle
import android.os.SystemClock
import java.util.UUID

// ADR0029 decision 6: the copied recovery code is marked sensitive (API 33+) and cleared after LIFETIME while this
// app's clip is still the current one. Android 10+ hides the clipboard from a background app, so a check that cannot
// read it waits for the next resume (`expire` from JS); a different clip is never cleared. Main thread only.
internal object AndroidRecoveryClip {
  const val LIFETIME = 60_000L
  private val handler = Handler(Looper.getMainLooper())
  private var label: String? = null
  private var deadline = 0L

  fun copy(context: Context, code: String) {
    val name = "kloda:" + UUID.randomUUID()
    val clip = ClipData.newPlainText(name, code)
    if (Build.VERSION.SDK_INT >= 33) clip.description.extras = PersistableBundle().apply { putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true) }
    context.getSystemService(ClipboardManager::class.java).setPrimaryClip(clip)
    label = name; deadline = SystemClock.elapsedRealtime() + LIFETIME
    val application = context.applicationContext
    handler.removeCallbacksAndMessages(null)
    handler.postDelayed({ expire(application) }, LIFETIME)
  }
  fun expire(context: Context) {
    val name = label ?: return
    if (SystemClock.elapsedRealtime() < deadline) return
    val clipboard = context.getSystemService(ClipboardManager::class.java)
    val current = clipboard.primaryClipDescription?.label?.toString() ?: return
    if (current == name) {
      if (Build.VERSION.SDK_INT >= 28) clipboard.clearPrimaryClip() else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
    }
    label = null
  }
}
