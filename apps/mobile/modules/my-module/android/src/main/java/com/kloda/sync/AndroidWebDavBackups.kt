package com.kloda.sync

import android.content.Context
import java.util.UUID

internal object AndroidWebDavBackups {
  fun list(context: Context, after: String, target: String): Map<String, Any> {
    if (after.isNotEmpty() && runCatching { UUID.fromString(after).toString() == after }.getOrDefault(false).not()) throw FilesFailure("invalid_request")
    val destination = AndroidWebDavContext.restoreTarget(context, target)
    return AndroidSyncJournal.webdav(context).use { owner ->
      val journal = AndroidWebDavJournal(owner.writableDatabase)
      val (rows, cursor) = merged(journal.uploads(destination.targetId(), after), journal.imports.receipts(destination.targetId(), after))
      val items = rows.filter { it.phase == "completed" && !it.skipped && it.issue == null && it.sourceIdentity != null && it.kind in setOf("file", "photo_manifest") }.map {
        mapOf("id" to it.id, "sourceId" to it.source, "name" to it.relativePath.substringAfterLast('/'), "kind" to it.kind!!, "sha256" to it.sha256, "size" to it.size.toString())
      }
      buildMap {
        put("targetId", destination.targetId()); put("items", items); put("hasMore", cursor != null)
        put("canRestoreFiles", true); put("canRestorePhotos", true)
        if (cursor != null) put("nextCursor", cursor)
      }
    }
  }
  // 29/4: this device's receipts and imported receipts in one id-ordered page of at most 100. Below the smaller last id
  // of a full page both lists are complete, so the cursor never skips a row of either.
  fun merged(local: List<WebDavUpload>, imported: List<WebDavUpload>): Pair<List<WebDavUpload>, String?> {
    val bound = listOf(local, imported).mapNotNull { if (it.size == 100) it.last().id else null }.minOrNull()
    val known = (local + imported).filter { bound == null || it.id <= bound }.sortedBy { it.id }
    val rows = known.take(100)
    return rows to (if (bound != null || known.size > rows.size) rows.lastOrNull()?.id else null)
  }
}
