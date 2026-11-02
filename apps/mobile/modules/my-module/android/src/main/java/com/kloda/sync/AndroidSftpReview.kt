package com.kloda.sync
import android.content.Context
import java.util.UUID

internal class AndroidSftpReview(private val app: Context, private val queue: AndroidSftpQueue, private val visible: () -> Boolean) {
  private val lock = Any()
  private var active: UUID? = null
  private val cancelled = mutableSetOf<UUID>()
  fun cancel(ticket: UUID? = null) = synchronized(lock) {
    if (ticket != null) cancelled.add(ticket)
    if (ticket == null || active == ticket) { active?.let(cancelled::add); active = null }
  }
  fun perform(id: String, request: UUID): Map<String, String> {
    synchronized(lock) {
      if (!visible() || request in cancelled || active != null) throw FilesFailure("cancelled")
      active = request
    }
    var claimed = false
    try {
      queue.beginReview(request); claimed = true
      run {
        val result = AndroidSftpFiles(app, queue.journal, queue.profiles, queue.lan).keepBoth(id, request) {
          synchronized(lock) { active != request || request in cancelled || !visible() }
        }
        return mapOf("id" to result.id, "state" to "completed", "path" to result.relativePath)
      }
    } finally { if (claimed) queue.endReview(request); synchronized(lock) { if (active == request) active = null } }
  }
}
