package com.kloda.sync

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import java.security.MessageDigest
import java.util.UUID

internal data class FilesRunContext(val binding: String, val sources: Map<String, String>) {
  fun check(context: Context) {
    if (capture(context).binding != binding) throw FilesFailure("settings_changed")
  }

  companion object {
    // The revision and changed values share one preferences commit, including change-away/back.
    fun stamp(editor: SharedPreferences.Editor): SharedPreferences.Editor =
      editor.putString("filesContextRevision", UUID.randomUUID().toString()).putString("backupContextRevision", UUID.randomUUID().toString())

    fun invalidate(context: Context) = synchronized(AndroidSyncJournal.sourceLock) {
      if (!context.getSharedPreferences("kloda-sync", 0).edit().putString("filesContextRevision", UUID.randomUUID().toString()).commit()) throw FilesFailure("storage_failure")
    }

    fun webdav(context: Context): FilesRunContext {
      val values = context.getSharedPreferences("kloda-sync", 0).all.toMutableMap()
      values["filesContextRevision"] = values["backupContextRevision"] ?: "legacy"
      return from(values)
    }

    fun capture(context: Context): FilesRunContext = from(context.getSharedPreferences("kloda-sync", 0).all)

    fun from(values: Map<String, *>): FilesRunContext {
      val sources = sortedMapOf<String, String>()
      for (key in listOf("directorySources", "photoSources")) {
        val raw = values[key]
        if (raw != null && raw !is String) throw FilesFailure("queue_unavailable")
        val rows = JSONArray(raw as? String ?: "[]")
        repeat(rows.length()) {
          val row = rows.getJSONObject(it)
          val id = row.get("id") as? String ?: throw FilesFailure("queue_unavailable")
          val reference = row.get("reference") as? String ?: throw FilesFailure("queue_unavailable")
          if (id.isEmpty() || reference.isEmpty() || sources.put(id, reference) != null) throw FilesFailure("queue_unavailable")
        }
      }
      val interval = values["intervalHours"] ?: 12
      val time = values["localTime"] ?: "12:00"
      val revision = values["filesContextRevision"] ?: "legacy"
      if (revision !is String || interval !in listOf(12, 24) || time !is String || !Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(time)) {
        throw FilesFailure("queue_unavailable")
      }
      val mode = values["backupMode"] ?: if (values.containsKey("intervalHours")) "scheduled" else "live"
      if (mode !in listOf("live", "scheduled")) throw FilesFailure("queue_unavailable")
      val canonical = JSONArray().put(revision)
        .put(interval).put(time).put(JSONArray().apply {
          sources.forEach { (id, reference) -> put(JSONArray().put(id).put(reference)) }
        }).apply { if (values.containsKey("backupMode")) put(mode) }.toString()
      val hash = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
      return FilesRunContext(hash, sources.toMap())
    }
  }
}
