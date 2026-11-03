package com.kloda.sync

import android.content.Context
import org.json.JSONArray
import java.security.MessageDigest

internal data class AndroidWebDavContext(val destination: AndroidCloudTarget, val sources: FilesRunContext, val binding: String) {
  val kind: String get() = destination.kind
  fun check(context: Context, journal: AndroidWebDavJournal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (stored(context, kind, destination.targetId()) != destination || FilesRunContext.webdav(context).binding != sources.binding ||
      !journal.enabled(kind, destination.targetId(), destination.revision)) throw FilesFailure("settings_changed")
  }
  fun complete(context: Context, journal: AndroidWebDavJournal, value: WebDavUpload) = synchronized(AndroidSyncJournal.sourceLock) {
    check(context, journal)
    if (value.target != destination.targetId() || value.binding != binding) throw FilesFailure("settings_changed")
    journal.advance(value, "completed")
  }
  companion object {
    fun binding(target: String, revision: String, sources: String): String {
      val canonical = JSONArray().put(target).put(revision).put(sources).toString()
      return AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8)))
    }
    // The legacy WebDAV entry or the destination's own vault slot (ADR0027 §3, ADR0028 §2); a slot must hold the same
    // provider and target. OAuth slots count only for providers with an upload adapter.
    fun stored(context: Context, kind: String, target: String): AndroidCloudTarget? = when {
      kind == "webdav" -> AndroidWebDavVault(context).read()?.let { AndroidCloudTarget.Dav(it) }
      kind in AndroidCloudTarget.OAUTH_KINDS -> AndroidOAuthVault(context, target).read()
        ?.takeIf { it.provider == kind && it.targetId() == target }?.let { AndroidCloudTarget.OAuth(it) }
      else -> AndroidWebDavVault(context, target).read()?.takeIf { it.provider == kind && it.targetId() == target }?.let { AndroidCloudTarget.Dav(it) }
    }
    // target == null is the original WebDAV destination (manual start from its screen).
    fun capture(context: Context, journal: AndroidWebDavJournal, target: String? = null): AndroidWebDavContext = synchronized(AndroidSyncJournal.sourceLock) {
      val header = if (target == null) null else journal.destination(target) ?: throw FilesFailure("destination_disabled")
      val kind = header?.kind ?: "webdav"
      val destination = if (header == null) AndroidWebDavVault(context).read()?.let { AndroidCloudTarget.Dav(it) } ?: throw FilesFailure("webdav_missing")
        else stored(context, kind, header.target) ?: throw FilesFailure("webdav_missing")
      val sources = FilesRunContext.webdav(context)
      if (sources.sources.isEmpty()) throw FilesFailure("source_unavailable")
      if (!journal.enabled(kind, destination.targetId(), destination.revision)) throw FilesFailure("destination_disabled")
      val binding = binding(destination.targetId(), destination.revision, sources.binding)
      AndroidWebDavContext(destination, sources, binding)
    }
  }
}
