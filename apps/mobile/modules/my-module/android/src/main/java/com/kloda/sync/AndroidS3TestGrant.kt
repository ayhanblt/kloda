package com.kloda.sync

import java.util.UUID

// Separate from the source/journal lock so foreground loss can revoke blocked I/O.
internal class AndroidS3TestGrant {
  private val lock = Any()
  private var active = false
  private var protected = false
  private var ticket: UUID? = null
  private var running = false
  private val cancelled = mutableSetOf<UUID>()
  fun activate(protected: Boolean) = synchronized(lock) {
    active = true; this.protected = protected
    if (!protected) { ticket?.let(cancelled::add); ticket = null }
  }
  fun deactivate() = synchronized(lock) { active = false; protected = false; ticket?.let(cancelled::add); ticket = null }
  fun start(request: UUID) = synchronized(lock) {
    if (!active || !protected || running || request in cancelled) throw S3Failure("candidate_stale")
    ticket = request; running = true
  }
  fun current(request: UUID): Boolean = synchronized(lock) { active && protected && ticket == request && request !in cancelled }
  fun cancel(request: UUID) = synchronized(lock) { cancelled.add(request); if (ticket == request) ticket = null }
  fun finish(request: UUID) = synchronized(lock) { cancelled.add(request); if (ticket == request) ticket = null; running = false }
}
