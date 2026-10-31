package com.kloda.sync

import android.content.Context
import org.json.JSONArray
import java.security.MessageDigest

internal data class AndroidWebDavContext(val profile: AndroidWebDavProfile, val sources: FilesRunContext, val binding: String) {
  fun check(context: Context, journal: AndroidWebDavJournal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (AndroidWebDavVault(context).read() != profile || FilesRunContext.webdav(context).binding != sources.binding ||
      !journal.enabled("webdav", profile.targetId(), profile.revision)) throw FilesFailure("settings_changed")
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
    fun capture(context: Context, journal: AndroidWebDavJournal): AndroidWebDavContext = synchronized(AndroidSyncJournal.sourceLock) {
      val profile = AndroidWebDavVault(context).read() ?: throw FilesFailure("webdav_missing")
      val sources = FilesRunContext.webdav(context)
      if (sources.sources.isEmpty()) throw FilesFailure("source_unavailable")
      if (!journal.enabled("webdav", profile.targetId(), profile.revision)) throw FilesFailure("destination_disabled")
      val binding = binding(profile.targetId(), profile.revision, sources.binding)
      AndroidWebDavContext(profile, sources, binding)
    }
  }
}
