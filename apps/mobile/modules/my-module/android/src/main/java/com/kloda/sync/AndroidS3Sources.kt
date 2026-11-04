package com.kloda.sync

import android.content.Context

// Reuse persisted source revision and mutation lock, never DAV receipts/authority.
internal data class AndroidS3Sources(val sources: FilesRunContext, val context: String) {
  fun check(app: Context, journal: AndroidS3Journal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (FilesRunContext.webdav(app).binding != sources.binding || journal.context() != context) throw S3Failure("context_changed")
  }
  companion object {
    fun capture(app: Context, journal: AndroidS3Journal): AndroidS3Sources = synchronized(AndroidSyncJournal.sourceLock) {
      val sources = FilesRunContext.webdav(app)
      val files = sources.sources
      if (files.keys.any { runCatching { java.util.UUID.fromString(it) }.isFailure }) throw S3Failure("source_unavailable")
      AndroidS3Sources(sources, journal.bindSources(S3Target.hash(sources.binding)))
    }
  }
}
