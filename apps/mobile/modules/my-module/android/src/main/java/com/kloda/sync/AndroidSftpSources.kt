package com.kloda.sync

import android.content.Context

// Reuse persisted source revision and mutation lock, never DAV receipts/authority.
internal data class AndroidSftpSources(val sources: FilesRunContext, val context: String) {
  fun check(app: Context, journal: AndroidSftpJournal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (FilesRunContext.webdav(app).binding != sources.binding || journal.context() != context) throw SftpFailure("context_changed")
  }
  companion object {
    fun capture(app: Context, journal: AndroidSftpJournal): AndroidSftpSources = synchronized(AndroidSyncJournal.sourceLock) {
      val sources = FilesRunContext.webdav(app)
      val files = sources.sources
      if (files.keys.any { runCatching { java.util.UUID.fromString(it) }.isFailure }) throw SftpFailure("source_unavailable")
      AndroidSftpSources(sources, journal.bindSources(sources.binding))
    }
  }
}
