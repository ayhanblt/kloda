package com.kloda.sync

import android.content.Context

// ADR0027 §4 / ADR0023: explicit opt-in per added DAV destination (the original WebDAV entry keeps KlodaBackup's own
// configure/disable). Disabling or removing one destination ends only its own run and plan.
internal object AndroidWebDavDestinations {
  private fun profile(context: Context, target: String): AndroidWebDavProfile {
    val profile = AndroidWebDavVault(context, target).read()
    if (profile == null) throw FilesFailure(if (AndroidOAuthVault(context, target).read() != null) "destination_unsupported" else "not_found")
    if (profile.targetId() != target || profile.provider !in AndroidWebDavJournal.DAV_KINDS) throw FilesFailure("destination_unsupported")
    return profile
  }
  fun enabled(context: Context, target: String): Boolean = AndroidSyncJournal.webdav(context).use {
    val profile = AndroidWebDavVault(context, target).read() ?: return@use false
    AndroidWebDavJournal(it.writableDatabase).enabled(profile.provider ?: "webdav", target, profile.revision)
  }
  fun setEnabled(context: Context, target: String, enabled: Boolean) {
    val changed = synchronized(AndroidSyncJournal.sourceLock) {
      val profile = profile(context, target)
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        val kind = profile.provider!!
        if (journal.enabled(kind, target, profile.revision) == enabled) return@use false
        journal.setEnabled(kind, target, enabled, profile.revision)
        true
      }
    }
    if (!changed) return
    if (!enabled) AndroidWebDavRuntime.queue(context).pauseTarget(target)
    AndroidWebDavScheduler.reconcile(context)
  }
  // Before the destination's custody is deleted: its row is disabled and its plan dropped; receipts stay bound to the target.
  fun forget(context: Context, target: String) {
    synchronized(AndroidSyncJournal.sourceLock) {
      val profile = AndroidWebDavVault(context, target).read() ?: return
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        val kind = profile.provider
        if (kind != null && kind in AndroidWebDavJournal.DAV_KINDS && journal.enabled(kind, target))
          journal.setEnabled(kind, target, false, profile.revision)
        journal.schedule.delete(target)
      }
    }
    AndroidWebDavRuntime.queue(context).pauseTarget(target)
    AndroidWebDavScheduler.reconcile(context)
  }
}
