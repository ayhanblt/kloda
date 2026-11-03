package com.kloda.sync

import android.content.Context
import java.util.UUID

internal class AndroidWebDavReview(private val context: Context, private val visible: () -> Boolean) {
  private val lock = Any()
  private var active: UUID? = null
  private val cancelled = mutableSetOf<UUID>()
  @Volatile private var sender: AndroidBackupTransport? = null
  fun cancel(request: UUID? = null) {
    val ended = synchronized(lock) {
      if (request != null) cancelled.add(request)
      if (request != null && active != request) return@synchronized null
      active?.let(cancelled::add); active = null; sender.also { sender = null }
    }
    ended?.cancel()
  }
  private fun current(token: UUID) { if (!synchronized(lock) { active == token } || !visible()) throw FilesFailure("cancelled") }
  fun items(after: String): Map<String, Any> = AndroidSyncJournal.webdav(context).use { owner ->
    val journal = AndroidWebDavJournal(owner.writableDatabase)
    val rows = journal.unfinished(after); val page = rows.take(100)
    if (rows.isEmpty()) return@use mapOf("items" to emptyList<Map<String, Any>>(), "hasMore" to false)
    var captured: AndroidWebDavContext? = null
    var contextError: String? = null
    try { captured = AndroidWebDavContext.capture(context, journal) }
    catch (error: Exception) { contextError = (error as? FilesFailure)?.code ?: "outcome_unknown" }
    buildMap {
      put("items", page.map { value ->
        val current = value.target == captured?.destination?.targetId() && captured?.sources?.sources?.containsKey(value.source) == true && value.sourceIdentity != null && value.kind != null && !value.skipped && (value.binding == captured?.binding || value.phase in setOf("uploaded", "moving", "moved"))
        val path = journal.publications.read(value)
        buildMap<String, Any> {
          put("id", value.id); put("targetId", value.target); put("sourceId", value.source); put("name", value.relativePath.substringAfterLast('/'))
          put("relativePath", value.relativePath); put("kind", value.kind ?: "unknown"); put("phase", value.phase); put("skipped", value.skipped)
          put("errorCode", value.issue ?: if (current) "review_required" else "settings_changed"); put("canRecheck", current)
          put("requiresAuthorization", current && value.binding != captured?.binding)
          put("canKeepBoth", current && value.issue == "conflict" && value.phase in setOf("uploaded", "moving"))
          if (path != value.relativePath) put("publishedPath", path)
        }
      })
      put("hasMore", rows.size > 100); if (rows.size > 100) put("nextCursor", page.last().id)
      contextError?.let { put("errorCode", it) }
    }
  }
  fun perform(id: String, requested: String, request: UUID): Map<String, String> {
    val explicit = requested in setOf("authorize_recheck", "authorize_keep_both")
    val action = if (explicit) requested.removePrefix("authorize_") else requested
    val token = synchronized(lock) { if (request in cancelled) throw FilesFailure("cancelled"); if (active != null) throw FilesFailure("backup_busy"); request.also { active = it } }
    var transport: AndroidBackupTransport? = null
    try {
      if (runCatching { UUID.fromString(id).toString() != id }.getOrDefault(true) || action !in setOf("skip", "recheck", "keep_both")) throw FilesFailure("invalid_request")
      current(token)
      return AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        val value = journal.find(id) ?: throw FilesFailure("outcome_unknown")
        if (value.phase == "completed" || value.skipped) throw FilesFailure("review_required")
        if (action == "skip") return@use AndroidWebDavPublication.withJob(id) {
          current(token); journal.issue(value, value.issue ?: "review_required", true); mapOf("state" to "skipped")
        }
        val captured = AndroidWebDavContext.capture(context, journal)
        if (captured.destination.targetId() != value.target || (!explicit && captured.binding != value.binding)) throw FilesFailure("settings_changed")
        val check = { current(token); captured.check(context, journal) }
        val snapshots = AndroidFilesSnapshots(context, true, checkPaused = check)
        val activeTransport = captured.destination.transport(context, snapshots, check)
        transport = activeTransport
        synchronized(lock) { if (active != token) throw FilesFailure("cancelled"); sender = activeTransport }
        val validation = AndroidWebDavSourceValidation(context, captured, journal, snapshots, activeTransport, check)
        if (explicit) {
          check(); validation.validate(value); check()
          journal.reviewAuthority.authorize(value, request, captured.binding, journal)
        }
        val publication = AndroidWebDavPublication(journal, activeTransport::inspect, activeTransport::upload, activeTransport::move, check, { upload ->
          validation.validate(upload)
          synchronized(AndroidSyncJournal.sourceLock) { synchronized(lock) {
            check()
            if (explicit) {
              journal.reviewAuthority.require(upload, request, captured.binding)
              if (upload.target != captured.destination.targetId()) throw FilesFailure("settings_changed")
              journal.advance(upload, "completed")
            } else captured.complete(context, journal, upload)
          } }
        })
        if (!publication.review(id, action, validation::validate) || journal.find(id)?.phase != "completed") throw FilesFailure("review_required")
        mapOf("state" to "completed")
      }
    } finally {
      transport?.cancel()
      synchronized(lock) { if (active == token) { active = null; sender = null } }
    }
  }
}
