package com.kloda.sync

import android.content.Context

// ADR0027 §4 / ADR0023: explicit opt-in per added destination (the original WebDAV entry keeps KlodaBackup's own
// configure/disable). Disabling or removing one destination ends only its own run and plan. OAuth destinations
// join only once their provider has an upload adapter (ADR0028 §5; Dropbox first, user decision 2026-11-03).
internal object AndroidWebDavDestinations {
  // Added custody only: a DAV slot of a queue kind, or an OAuth slot whose provider has an upload adapter.
  fun added(context: Context, target: String): AndroidCloudTarget? {
    val profile = AndroidWebDavVault(context, target).read()
    if (profile != null) return if (profile.targetId() == target && profile.provider in AndroidWebDavJournal.DAV_KINDS)
      AndroidCloudTarget.Dav(profile) else null
    return AndroidOAuthVault(context, target).read()?.takeIf { it.provider in AndroidCloudTarget.OAUTH_KINDS }?.let { AndroidCloudTarget.OAuth(it) }
  }
  private fun destination(context: Context, target: String): AndroidCloudTarget = added(context, target) ?: throw FilesFailure(
    if (AndroidWebDavVault(context, target).read() != null || AndroidOAuthVault(context, target).read() != null) "destination_unsupported" else "not_found")
  fun enabled(context: Context, target: String): Boolean = AndroidSyncJournal.webdav(context).use {
    val destination = added(context, target) ?: return@use false
    AndroidWebDavJournal(it.writableDatabase).enabled(destination.kind, target, destination.revision)
  }
  fun setEnabled(context: Context, target: String, enabled: Boolean) {
    val changed = synchronized(AndroidSyncJournal.sourceLock) {
      val destination = destination(context, target)
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        if (journal.enabled(destination.kind, target, destination.revision) == enabled) return@use false
        journal.setEnabled(destination.kind, target, enabled, destination.revision)
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
      val destination = added(context, target) ?: return
      AndroidSyncJournal.webdav(context).use {
        val journal = AndroidWebDavJournal(it.writableDatabase)
        if (journal.enabled(destination.kind, target)) journal.setEnabled(destination.kind, target, false, destination.revision)
        journal.schedule.delete(target)
      }
    }
    AndroidWebDavRuntime.queue(context).pauseTarget(target)
    AndroidWebDavScheduler.reconcile(context)
  }
}
