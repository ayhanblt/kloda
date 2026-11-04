package com.kloda.sync

import android.content.Context

// Reuse persisted source revision and mutation lock, never DAV receipts/authority.
internal data class AndroidFtpsSources(val sources: FilesRunContext, val context: String) {
  fun check(app: Context, journal: AndroidFtpsJournal) = synchronized(AndroidSyncJournal.sourceLock) {
    if (FilesRunContext.webdav(app).binding != sources.binding || journal.context() != context) throw FtpsFailure("context_changed")
  }
  companion object {
    fun capture(app: Context, journal: AndroidFtpsJournal): AndroidFtpsSources = synchronized(AndroidSyncJournal.sourceLock) {
      val sources = FilesRunContext.webdav(app)
      val files = sources.sources
      if (files.keys.any { runCatching { java.util.UUID.fromString(it) }.isFailure }) throw FtpsFailure("source_unavailable")
      AndroidFtpsSources(sources, journal.bindSources(sources.binding))
    }
  }
}
