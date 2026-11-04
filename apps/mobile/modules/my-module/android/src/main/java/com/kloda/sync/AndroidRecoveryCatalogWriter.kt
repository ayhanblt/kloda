package com.kloda.sync

import java.util.UUID

// ADR0029 §3 (29/2): after a run, every Completed receipt of the destination that the current chain does not list yet
// goes into new create-only deltas. The same call is the backfill (first confirmed secret) and the full re-sign
// (regenerated secret = new chain). Each delta follows the upload contract: create-only temp, inspect, no-overwrite
// move, post-commit verification; anything unexpected is kept as an issue and never assumed published.
internal class AndroidRecoveryCatalogWriter(private val journal: AndroidRecoveryCatalogJournal, private val target: String,
  private val keys: AndroidRecoveryCatalog.Keys, private val transport: AndroidBackupTransport, private val check: () -> Unit,
  private val stage: (ByteArray) -> String, private val discard: (String) -> Unit) {
  private class Refused(val code: String) : Exception(code)

  fun publish() {
    val installation = journal.installation()
    for (delta in journal.pending(target, keys.chain)) execute(delta, installation)
    while (true) {
      check()
      val rows = journal.uncatalogued(target, keys.chain)
      if (rows.isEmpty()) return
      val head = journal.head(target, keys.chain)
      val sequence = (head?.first ?: 0L) + 1
      val count = AndroidRecoveryCatalog.fitting(installation, target, keys.chain, sequence, head?.second, rows)
      val entries = rows.take(count)
      val bytes = AndroidRecoveryCatalog.encode(keys, installation, target, sequence, head?.second, entries)
      val delta = CatalogDelta(UUID.randomUUID().toString(), target, keys.chain, sequence, bytes, AndroidRecoveryCatalog.digest(bytes))
      check()
      journal.insert(delta, entries.map { it.job })
      execute(delta, installation)
    }
  }

  private fun job(delta: CatalogDelta, installation: String, path: String, snapshot: String = "") = WebDavUpload(delta.id, delta.target,
    "catalog", installation, path, path, delta.sequence.toString(), snapshot, delta.sha256, delta.payload.size.toLong())
  private fun execute(start: CatalogDelta, installation: String) {
    if (start.issue != null) throw FilesFailure("outcome_unknown")
    var delta = start
    val destination = AndroidRecoveryCatalog.path(installation, delta.chain, delta.target, delta.sequence)
    val temporary = AndroidRecoveryCatalog.folder(installation, delta.chain, delta.target) + "/.kloda-upload-" + delta.id
    val expected = job(delta, installation, destination)
    try {
      check()
      if (delta.phase == "prepared") {
        if (transport.inspect(temporary, expected) != "missing") throw Refused("review_required")
        check()
        val snapshot = stage(delta.payload)
        try { transport.upload(temporary, job(delta, installation, destination, snapshot)) } finally { discard(snapshot) }
        delta = journal.advance(delta, "uploaded")
        check()
      }
      if (delta.phase == "uploaded" || delta.phase == "moving") {
        if (transport.inspect(temporary, expected) != "match") throw Refused("review_required")
        check()
        if (transport.inspect(destination, expected) != "missing") throw Refused("conflict")
        check()
        if (delta.phase == "uploaded") delta = journal.advance(delta, "moving")
        transport.move(temporary, destination)
        delta = journal.advance(delta, "moved")
        check()
      }
      if (delta.phase != "moved" || transport.inspect(destination, expected) != "match") throw Refused("review_required")
      check()
      journal.advance(delta, "completed")
    } catch (refused: Refused) {
      journal.issue(delta, refused.code)
      throw FilesFailure("outcome_unknown")
    }
  }
}
