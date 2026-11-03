package com.kloda.sync

import android.content.Context
import java.util.UUID

internal object AndroidWebDavBackups {
  fun list(context: Context, after: String, target: String): Map<String, Any> {
    if (after.isNotEmpty() && runCatching { UUID.fromString(after).toString() == after }.getOrDefault(false).not()) throw FilesFailure("invalid_request")
    val destination = AndroidWebDavContext.restoreTarget(context, target)
    return AndroidSyncJournal.webdav(context).use { owner ->
      val rows = AndroidWebDavJournal(owner.writableDatabase).uploads(destination.targetId(), after)
      val items = rows.filter { it.phase == "completed" && !it.skipped && it.issue == null && it.sourceIdentity != null && it.kind in setOf("file", "photo_manifest") }.map {
        mapOf("id" to it.id, "sourceId" to it.source, "name" to it.relativePath.substringAfterLast('/'), "kind" to it.kind!!, "sha256" to it.sha256, "size" to it.size.toString())
      }
      buildMap {
        put("targetId", destination.targetId()); put("items", items); put("hasMore", rows.size == 100)
        put("canRestoreFiles", true); put("canRestorePhotos", true)
        if (rows.size == 100) put("nextCursor", rows.last().id)
      }
    }
  }
}
