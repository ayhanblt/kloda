package com.kloda.sync

import android.content.Context
import org.json.JSONObject

internal object AndroidBackupDestinations {
  private fun validate(record: String) { if (!Regex("[A-Za-z0-9_-]{21}[AQgw]").matches(record)) throw FilesFailure("invalid_request") }
  fun pcEnabled(context: Context, record: String): Boolean {
    validate(record)
    return AndroidSyncJournal.webdav(context).use {
      AndroidWebDavJournal(it.writableDatabase).enabled("pc", record, "v1")
    }
  }
  fun hasEnabledPc(context: Context): Boolean = AndroidSyncJournal.webdav(context).use {
    AndroidWebDavJournal(it.writableDatabase)
    it.readableDatabase.rawQuery("SELECT 1 FROM backup_destination WHERE kind='pc' AND enabled=1 LIMIT 1", null).use { row -> row.moveToFirst() }
  }
  fun currentPairedRecordId(context: Context): String? {
    val owner = AndroidPairingRuntime.currentOwner(context)
    val status = JSONObject(KlodaPairingJni.status(owner))
    if (status.optString("phase") != "complete" || status.optBoolean("repairRequired", true)) return null
    val record = status.optString("recordId")
    return record.takeIf { it.isNotEmpty() }
  }
  fun currentPairedPcEnabled(context: Context): Boolean {
    val record = currentPairedRecordId(context) ?: return false
    return pcEnabled(context, record)
  }
  fun enablePcIfUnset(context: Context, record: String) {
    validate(record)
    val changed = synchronized(AndroidSyncJournal.sourceLock) {
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        if (journal.exists("pc", record)) return@use false
        FilesRunContext.invalidate(context)
        journal.setEnabled("pc", record, true, "v1")
        true
      }
    }
    if (changed) {
      AndroidBackupScheduler.reconcile(context)
    }
  }
  fun disablePcIfPresent(context: Context, record: String) {
    validate(record)
    val changed = synchronized(AndroidSyncJournal.sourceLock) {
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        if (!journal.enabled("pc", record, "v1")) return@use false
        FilesRunContext.invalidate(context)
        journal.setEnabled("pc", record, false, "v1")
        true
      }
    }
    AndroidBackupScheduler.clearExecutionError(context)
    if (changed) {
      AndroidPairingRuntime.files?.requestPause("settings_changed")
    }
    AndroidBackupScheduler.reconcile(context)
  }
  fun setPcEnabled(context: Context, record: String, enabled: Boolean) {
    validate(record)
    val changed = synchronized(AndroidSyncJournal.sourceLock) {
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        if (journal.enabled("pc", record, "v1") == enabled) return@use false
        // PC-only generation; this cannot spend or invalidate a WebDAV opportunity.
        FilesRunContext.invalidate(context)
        journal.setEnabled("pc", record, enabled, "v1")
        true
      }
    }
    if (changed) {
      AndroidPairingRuntime.files?.requestPause("settings_changed")
      AndroidBackupScheduler.reconcile(context)
    }
  }
}
