package com.kloda.sync

import java.util.UUID

// ADR0029 §4/§6 (29/3): with the old phone's recovery code, a new device reads the catalog in this destination's folder.
// Every chain (installation/chain/target folder) must start at sequence 1, and each delta must be authentic under the
// code's keys, name its own folder and sequence and the previous delta's hash. The first gap, unreadable or unauthentic
// delta ends that chain; it and every later sequence are counted as unverified and never imported. This installation's
// own catalog is skipped. The code's keys live only for the call; nothing is uploaded or written remotely.
internal class AndroidRecoveryImport(private val catalog: AndroidRecoveryCatalogJournal, private val imports: AndroidRecoveryImportJournal,
  private val target: String, private val keys: AndroidRecoveryCatalog.Keys, private val transport: AndroidBackupTransport,
  private val check: () -> Unit) {
  data class Summary(var chains: Int = 0, var deltas: Int = 0, var entries: Int = 0, var unverified: Int = 0)

  fun run(): Summary {
    val own = catalog.installation()
    val summary = Summary()
    check()
    for (installation in transport.list(".kloda/catalog")) {
      if (!installation.folder || installation.name == own ||
        runCatching { UUID.fromString(installation.name).toString() == installation.name }.getOrDefault(false).not()) continue
      check()
      for (source in transport.list(".kloda/catalog/${installation.name}/${keys.chain}")) {
        if (!source.folder || !IDENTIFIER.matches(source.name)) continue
        summary.chains++
        chain(installation.name, source.name, summary)
      }
    }
    return summary
  }

  private fun chain(installation: String, source: String, summary: Summary) {
    check()
    val sequences = transport.list(AndroidRecoveryCatalog.folder(installation, keys.chain, source))
      .mapNotNull { if (!it.folder && SEQUENCE.matches(it.name)) it.name.dropLast(5).toLong() else null }.toSet()
    var sequence = 1L; var previous: String? = null
    while (sequence in sequences) {
      check()
      val bytes = read(AndroidRecoveryCatalog.path(installation, keys.chain, source, sequence)) ?: break
      val delta = runCatching { AndroidRecoveryCatalog.decode(bytes, keys) }.getOrNull() ?: break
      if (delta.installation != installation || delta.target != source || delta.sequence != sequence || delta.previous != previous ||
        !delta.entries.all(::valid)) break
      val hash = AndroidRecoveryCatalog.digest(bytes)
      check()
      if (!imports.importDelta(target, installation, keys.chain, source, sequence, hash, delta.entries)) break
      summary.deltas++; summary.entries += delta.entries.size
      previous = hash; sequence++
    }
    summary.unverified += sequences.count { it >= sequence }
  }

  // null for a file larger than any delta (the client refuses it as `review_required`); other failures propagate.
  private fun read(path: String): ByteArray? {
    val data = java.io.ByteArrayOutputStream()
    val probe = WebDavUpload(UUID.randomUUID().toString(), target, "catalog", "import", path, path, "0", "", "", AndroidRecoveryCatalog.LIMIT.toLong())
    return try {
      val reply = transport.download(path, probe) { bytes, size -> data.write(bytes, 0, size) }
      if (reply.size != data.size().toLong()) throw FilesFailure("outcome_unknown")
      data.toByteArray()
    } catch (error: FilesFailure) { if (error.code == "review_required") null else throw error }
  }

  companion object {
    val IDENTIFIER = Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]")
    private val SEQUENCE = Regex("[1-9][0-9]{0,17}\\.json")
    private val KINDS = setOf("file", "photo_resource", "photo_manifest")
    // A restore later writes to `path` under the destination root: one plain relative path outside `.kloda`.
    fun valid(entry: AndroidRecoveryCatalog.Entry): Boolean {
      val parts = entry.path.split('/')
      return entry.kind in KINDS && entry.size >= 0 && IDENTIFIER.matches(entry.sha256) && entry.path.toByteArray().size <= 4096 &&
        parts.first() != ".kloda" && !entry.path.contains('\\') && parts.all { it.isNotEmpty() && it != "." && it != ".." && it.toByteArray().size <= 255 } &&
        entry.path.none { it.code < 32 || it.code in 127..159 } &&
        (entry.identity?.let { it.isNotEmpty() && it.toByteArray().size <= 8192 && !it.contains('\u0000') } ?: true)
    }
  }
}
