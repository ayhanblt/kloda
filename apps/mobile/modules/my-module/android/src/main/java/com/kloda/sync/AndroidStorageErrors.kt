package com.kloda.sync

import android.database.sqlite.SQLiteFullException
import android.system.ErrnoException
import android.system.OsConstants

internal fun isLocalStorageFull(error: Throwable): Boolean {
  var current: Throwable? = error
  repeat(16) {
    val cause = current ?: return false
    if (cause is SQLiteFullException || cause is ErrnoException && cause.errno in setOf(OsConstants.ENOSPC, OsConstants.EDQUOT)) return true
    current = cause.cause
  }
  return false
}
