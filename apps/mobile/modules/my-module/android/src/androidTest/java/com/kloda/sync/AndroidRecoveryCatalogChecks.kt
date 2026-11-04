package com.kloda.sync

import android.content.Context
import org.json.JSONObject
import java.util.UUID

// ADR0029 29/2: shared vectors from tools/recovery-catalog-vectors.py against the production codec, then the
// production journal + writer against an in-memory create-only destination (same cases as IosRecoveryCatalogChecks).
// Real DAV/Dropbox transports are runtime checks.
internal object AndroidRecoveryCatalogChecks {
  internal class MemoryDestination : AndroidBackupTransport {
    val files = mutableMapOf<String, ByteArray>()
    val staged = mutableMapOf<String, ByteArray>()
    var failMove: FilesFailure? = null
    var loseMoveAck = false
    override fun inspect(path: String, job: WebDavUpload): String {
      val data = files[path] ?: return "missing"
      return if (AndroidRecoveryCatalog.digest(data) == job.sha256 && data.size.toLong() == job.size) "match" else "mismatch"
    }
    override fun upload(path: String, job: WebDavUpload) {
      if (files.containsKey(path)) throw FilesFailure("conflict")
      files[path] = staged[job.snapshot] ?: throw FilesFailure("conflict")
    }
    override fun move(from: String, to: String) {
      failMove?.let { failMove = null; throw it }
      if (files.containsKey(to)) throw FilesFailure("conflict")
      files[to] = files.remove(from) ?: throw FilesFailure("conflict")
      if (loseMoveAck) { loseMoveAck = false; throw FilesFailure("connection_unavailable") }
    }
    // Like the clients: a body over the expected size is refused as `review_required`.
    override fun download(path: String, job: WebDavUpload, receive: (ByteArray, Int) -> Unit): WebDavReply {
      val data = files[path] ?: throw FilesFailure("not_found")
      if (data.size > job.size) throw FilesFailure("review_required")
      receive(data, data.size)
      return WebDavReply(200, data.size.toLong(), AndroidRecoveryCatalog.digest(data))
    }
    override fun list(folder: String): List<RemoteChild> = files.keys.filter { it.startsWith("$folder/") }
      .map { it.removePrefix("$folder/").split('/', limit = 2) }.groupBy { it[0] }.map { (name, rows) -> RemoteChild(name, rows.any { it.size > 1 }) }
    override fun cancel() {}
  }
  fun sha(text: String) = AndroidRecoveryCatalog.digest(text.toByteArray())
  fun fails(code: String, action: () -> Unit) {
    var observed: String? = null
    try { action() } catch (error: FilesFailure) { observed = error.code }
    check(observed == code) { "Expected $code; observed $observed" }
  }
  private fun entries(data: ByteArray) = JSONObject(String(data)).getJSONArray("entries").let { array -> List(array.length()) { array.getJSONObject(it) } }

  private fun vectors() {
    val keys = AndroidRecoveryCatalog.keys(ByteArray(32) { it.toByte() })
    check(keys.chain == "c6d1c4897cde441fdbd14d1f1b4e6f75") { "chain" }
    val installation = "00000000-0000-4000-8000-000000000001"; val target = sha("fixture-target")
    val source = "11111111-1111-4111-8111-111111111111"
    val list = listOf(
      AndroidRecoveryCatalog.Entry("a", "$source/Belgeler/Fotoğraf \"ü\".jpg", sha("one"), 3, "file", "files:a\tb", 1762128000123),
      AndroidRecoveryCatalog.Entry("b", "$source/photos/x.json", sha("two"), 0, "photo_manifest", null, null))
    val first = AndroidRecoveryCatalog.encode(keys, installation, target, 1, null, list)
    check(first.size == 650 && AndroidRecoveryCatalog.digest(first) == "opP5n9sO-AqIaqgYO4UXJzrRqm2E96TSyw06bbbEBMA") { "first delta" }
    check(AndroidRecoveryCatalog.fitting(installation, target, keys.chain, 1, null, list) == 2) { "fitting" }
    val second = AndroidRecoveryCatalog.encode(keys, installation, target, 2, AndroidRecoveryCatalog.digest(first), emptyList())
    check(second.size == 299 && AndroidRecoveryCatalog.digest(second) == "ofj1ltRYQrBnegLcb3bGF4Dhv0SQ6UV_Hgw19EREYsM") { "second delta" }
  }

  private fun completed(journal: AndroidWebDavJournal, target: String, source: String, name: String, last: String = "completed"): WebDavUpload {
    var job = WebDavUpload(UUID.randomUUID().toString(), target, "b", source, name, "$source/$name", "1", AndroidFilesSnapshots.randomId(),
      sha(name), name.toByteArray().size.toLong(), kind = "file", sourceIdentity = "files:$name")
    journal.insert(job)
    for (next in listOf("uploaded", "moving", "moved", "completed")) {
      if (job.phase == last) break
      journal.advance(job, next); job = job.copy(phase = next)
    }
    return job
  }

  fun run(context: Context, announce: (String) -> Unit) {
    vectors()
    announce("PASS android catalog vectors (chain, canonical bytes, HMAC, previous hash)")
    AndroidSyncJournal.webdav(context).use { owner ->
      val journal = AndroidWebDavJournal(owner.writableDatabase)
      val installation = journal.catalog.installation()
      val target = sha("catalog-target"); val source = "22222222-2222-4222-8222-222222222222"
      val old = AndroidRecoveryCatalog.keys(ByteArray(32) { it.toByte() })
      var counter = 0
      fun writer(keys: AndroidRecoveryCatalog.Keys, target: String, destination: MemoryDestination) = AndroidRecoveryCatalogWriter(journal.catalog,
        target, keys, destination, {}, { bytes -> "stage-${++counter}".also { destination.staged[it] = bytes } }, { destination.staged.remove(it) })
      val remote = MemoryDestination()
      val a = completed(journal, target, source, "a.txt"); val b = completed(journal, target, source, "b.txt")
      completed(journal, target, source, "pending.txt", "moved")
      writer(old, target, remote).publish()
      val folder = AndroidRecoveryCatalog.folder(installation, old.chain, target)
      val first = remote.files.getValue("$folder/1.json")
      check(remote.files.size == 1 && remote.staged.isEmpty()) { "only the delta, staging discarded" }
      check(entries(first).map { it.getString("path") } == listOf(a.relativePath, b.relativePath)) { "completed receipts only" }
      check(entries(first).all { !it.isNull("completed") }) { "completion time recorded" }
      writer(old, target, remote).publish()
      check(remote.files.size == 1) { "idempotent" }
      announce("PASS backfill: one create-only delta of the Completed receipts, idempotent")

      val c = completed(journal, target, source, "c.txt")
      remote.failMove = FilesFailure("connection_unavailable")
      fails("connection_unavailable") { writer(old, target, remote).publish() }
      check(!remote.files.containsKey("$folder/2.json")) { "interrupted before move" }
      writer(old, target, remote).publish()
      val second = remote.files.getValue("$folder/2.json")
      check(JSONObject(String(second)).getString("previous") == AndroidRecoveryCatalog.digest(first) && JSONObject(String(second)).getLong("sequence") == 2L) { "chain" }
      check(entries(second).map { it.getString("path") } == listOf(c.relativePath) && remote.files.keys.none { ".kloda-upload-" in it }) { "delta 2" }
      announce("PASS chain: delta 2 names delta 1's hash; an interrupted move resumes from the journal")

      val lost = sha("lost-ack-target"); val lostRemote = MemoryDestination()
      completed(journal, lost, source, "x.txt")
      lostRemote.loseMoveAck = true
      fails("connection_unavailable") { writer(old, lost, lostRemote).publish() }
      fails("outcome_unknown") { writer(old, lost, lostRemote).publish() }
      fails("outcome_unknown") { writer(old, lost, lostRemote).publish() }
      announce("PASS lost move ACK stays unknown (issue kept, never assumed published)")

      val clash = sha("conflict-target"); val clashRemote = MemoryDestination()
      completed(journal, clash, source, "y.txt")
      val clashPath = AndroidRecoveryCatalog.path(installation, old.chain, clash, 1)
      val foreign = "foreign".toByteArray(); clashRemote.files[clashPath] = foreign
      fails("outcome_unknown") { writer(old, clash, clashRemote).publish() }
      check(clashRemote.files.getValue(clashPath).contentEquals(foreign)) { "existing file never replaced" }
      announce("PASS existing delta path is a conflict; nothing overwritten")

      val twin = sha("twin-target")
      completed(journal, twin, source, "a.txt")
      writer(old, twin, remote).publish()
      check(remote.files.containsKey(AndroidRecoveryCatalog.path(installation, old.chain, twin, 1)) && remote.files.size == 3) { "own folder" }
      announce("PASS two destinations sharing one remote folder keep separate chains")

      val renewed = AndroidRecoveryCatalog.keys(ByteArray(32) { 0xff.toByte() })
      check(renewed.chain != old.chain)
      val before = remote.files.toMap()
      writer(renewed, target, remote).publish()
      val fresh = JSONObject(String(remote.files.getValue(AndroidRecoveryCatalog.path(installation, renewed.chain, target, 1))))
      check(fresh.isNull("previous") && fresh.getJSONArray("entries").length() == 3) { "full re-sign under the new chain" }
      check(before.all { remote.files[it.key].contentEquals(it.value) } && remote.files.size == before.size + 1) { "old chain untouched" }
      announce("PASS regeneration: every Completed receipt catalogued again in a new chain; old deltas kept")

      val bulk = sha("bulk-target"); val bulkRemote = MemoryDestination()
      repeat(300) { completed(journal, bulk, source, "n".repeat(200) + "$it.bin") }
      writer(old, bulk, bulkRemote).publish()
      var listed = 0; var previous: String? = null
      for (sequence in 1..bulkRemote.files.size) {
        val data = bulkRemote.files.getValue(AndroidRecoveryCatalog.path(installation, old.chain, bulk, sequence.toLong()))
        val json = JSONObject(String(data))
        check(data.size <= AndroidRecoveryCatalog.LIMIT && (if (json.isNull("previous")) null else json.getString("previous")) == previous) { "bounded, chained" }
        listed += json.getJSONArray("entries").length(); previous = AndroidRecoveryCatalog.digest(data)
      }
      check(bulkRemote.files.size > 1 && listed == 300) { "split and complete" }
      announce("PASS bulk backfill split into ${bulkRemote.files.size} chained deltas of at most 64 KiB")
      AndroidRecoveryImportChecks.run(context, journal, remote, old, renewed, target, announce)
      AndroidRecoveryRestoreChecks.run(context, journal, remote, old, target, source, announce)
    }
  }
}
