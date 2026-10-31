package com.kloda.sync

import android.content.Context

internal class AndroidWebDavFilesRunner(context: Context, private val publisher: AndroidWebDavPublisher) {
  private val scanner = AndroidSafSourceScanner(context.contentResolver)
  private val snapshots = publisher.snapshots
  private val check = publisher.check
  var errorCode: String? = null
    private set
  fun cancel() = publisher.cancel()
  fun run(sources: Map<String, String>) {
    for ((source, tree) in sources.filterValues { !AndroidPhotosSources.isPhotos(it) }) {
      check()
      try {
        for (file in scanner.scan(tree)) {
          check()
          try { publish(file, source, tree) }
          catch (error: FilesFailure) {
            if (error.code in setOf("cancelled", "settings_changed", "connection_unavailable", "storage_failure", "local_storage_full")) throw error
            errorCode = error.code
          }
        }
      } catch (error: FilesFailure) {
        if (error.code in setOf("cancelled", "settings_changed", "connection_unavailable", "storage_failure", "local_storage_full")) throw error
        errorCode = error.code
      }
    }
  }
  private fun publish(file: QueuedSourceFile, source: String, tree: String) {
    val fingerprint = snapshots.currentDigest(tree, file.reference)
    if (fingerprint.size != file.size) throw FilesFailure("source_changed")
    publisher.publish(source, file.reference, "$source/${file.relativePath}", file.revision, fingerprint,
      "files:" + AndroidWebDavProfile.encode(java.security.MessageDigest.getInstance("SHA-256").digest(org.json.JSONArray().put(tree).put(file.reference).toString().toByteArray(Charsets.UTF_8))),
      { snapshots.stage(tree, file.reference) }, {
        check(); snapshots.checkAccess(tree, file.reference)
        if (snapshots.currentDigest(tree, file.reference) != fingerprint) throw FilesFailure("source_changed")
        check()
      })
  }
}
