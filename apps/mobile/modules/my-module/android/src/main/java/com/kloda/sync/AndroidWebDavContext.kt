package com.kloda.sync

import android.content.Context
import org.json.JSONArray
import java.security.MessageDigest

internal data class AndroidWebDavContext(val profile: AndroidWebDavProfile, val sources: FilesRunContext, val binding: String,
  val kind: String = "webdav") {
  fun check(context: Context, journal: AndroidWebDavJournal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (stored(context, kind, profile.targetId()) != profile || FilesRunContext.webdav(context).binding != sources.binding ||
      !journal.enabled(kind, profile.targetId(), profile.revision)) throw FilesFailure("settings_changed")
  }
  fun complete(context: Context, journal: AndroidWebDavJournal, value: WebDavUpload) = synchronized(AndroidSyncJournal.sourceLock) {
    check(context, journal)
    if (value.target != profile.targetId() || value.binding != binding) throw FilesFailure("settings_changed")
    journal.advance(value, "completed")
  }
  companion object {
    fun binding(target: String, revision: String, sources: String): String {
      val canonical = JSONArray().put(target).put(revision).put(sources).toString()
      return AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8)))
    }
    // The legacy WebDAV entry or the destination's own vault slot (ADR0027 §3); a slot must hold the same provider and target.
    fun stored(context: Context, kind: String, target: String): AndroidWebDavProfile? =
      if (kind == "webdav") AndroidWebDavVault(context).read()
      else AndroidWebDavVault(context, target).read()?.takeIf { it.provider == kind && it.targetId() == target }
    // target == null is the original WebDAV destination (manual start from its screen).
    fun capture(context: Context, journal: AndroidWebDavJournal, target: String? = null): AndroidWebDavContext = synchronized(AndroidSyncJournal.sourceLock) {
      val header = if (target == null) null else journal.destination(target) ?: throw FilesFailure("destination_disabled")
      val kind = header?.kind ?: "webdav"
      val profile = if (header == null) AndroidWebDavVault(context).read() ?: throw FilesFailure("webdav_missing")
        else stored(context, kind, header.target) ?: throw FilesFailure("webdav_missing")
      val sources = FilesRunContext.webdav(context)
      if (sources.sources.isEmpty()) throw FilesFailure("source_unavailable")
      if (!journal.enabled(kind, profile.targetId(), profile.revision)) throw FilesFailure("destination_disabled")
      val binding = binding(profile.targetId(), profile.revision, sources.binding)
      AndroidWebDavContext(profile, sources, binding, kind)
    }
  }
}
