package com.kloda.sync

import android.content.Context
import org.json.JSONObject
import java.io.InputStream
import java.util.UUID

// 18B/5 (ADR0028 §5) without network: Dropbox-API-Arg escaping, error mapping, and the opt-in/forget wiring of an
// OAuth destination through the shared journal and context. A provider without an adapter stays unsupported.
internal object AndroidDropboxChecks {
  private fun rejects(code: String, action: () -> Unit) {
    var observed: String? = null
    try { action() } catch (error: FilesFailure) { observed = error.code }
    check(observed == code) { "Expected $code; observed $observed" }
  }
  private fun reply(status: Int, summary: String? = null) =
    WebDavReply(status, 0, "", summary?.let { JSONObject().put("error_summary", it).toString().toByteArray() } ?: ByteArray(0))

  fun run(context: Context, announce: (String) -> Unit) {
    val arg = AndroidDropboxTransport.arg(JSONObject().put("path", "/Kloda/ğ😀\u007f"))
    check(arg.all { it.code in 0x20 until 0x7F } && "\\u011f" in arg && "\\ud83d\\ude00" in arg && "\\u007f" in arg) { "header-safe arg $arg" }
    check(JSONObject(arg).getString("path") == "/Kloda/ğ😀\u007f") { "arg round trip" }
    AndroidDropboxTransport.require(reply(200))
    rejects("conflict") { AndroidDropboxTransport.require(reply(409, "path/conflict/file/..")) }
    rejects("conflict") { AndroidDropboxTransport.require(reply(409, "to/conflict/file/..")) }
    rejects("disk_full") { AndroidDropboxTransport.require(reply(409, "path/insufficient_space/..")) }
    rejects("backup_path_rejected") { AndroidDropboxTransport.require(reply(409, "path/malformed_path/..")) }
    rejects("webdav_response") { AndroidDropboxTransport.require(reply(409, "from_lookup/not_found/..")) }
    rejects("webdav_response") { AndroidDropboxTransport.require(reply(409)) }
    rejects("connection_unavailable") { AndroidDropboxTransport.require(reply(429)) }
    rejects("webdav_auth") { AndroidDropboxTransport.require(reply(403)) }
    announce("PASS dropbox-arg-escaping error-mapping")

    val dropbox = AndroidOAuthProfile(UUID.randomUUID().toString(), "dropbox", "dbid:owned", "Kloda", "fixture-token")
    val onedrive = AndroidOAuthProfile(UUID.randomUUID().toString(), "onedrive", "owned", "Kloda", "fixture-token")
    val target = dropbox.targetId()
    try {
      listOf(dropbox, onedrive).forEach { AndroidOAuthVault(context, it.targetId()).add(it) }
      check(AndroidWebDavDestinations.added(context, target) == AndroidCloudTarget.OAuth(dropbox))
      check(AndroidWebDavDestinations.added(context, onedrive.targetId()) == null)
      rejects("destination_unsupported") { AndroidWebDavDestinations.setEnabled(context, onedrive.targetId(), true) }
      rejects("not_found") { AndroidWebDavDestinations.setEnabled(context, "A".repeat(42) + "E", true) }
      // Saving custody is not enabling (ADR0023).
      check(!AndroidWebDavDestinations.enabled(context, target))
      AndroidWebDavDestinations.setEnabled(context, target, true)
      check(AndroidWebDavDestinations.enabled(context, target))
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        check(journal.destination(target)?.kind == "dropbox" && journal.destination(target)?.revision == dropbox.revision)
        check(journal.destinations().none { it.target == onedrive.targetId() })
      }
      check(AndroidWebDavContext.stored(context, "dropbox", target) == AndroidCloudTarget.OAuth(dropbox))
      check(AndroidWebDavContext.stored(context, "onedrive", onedrive.targetId()) == null)
      check(AndroidWebDavContext.stored(context, "nextcloud", target) == null) { "kind must match the slot" }
      val snapshots = AndroidFilesSnapshots(context, true) {}
      check(AndroidCloudTarget.OAuth(dropbox).transport(context, snapshots) {} is AndroidDropboxTransport)
      rejects("destination_unsupported") { AndroidCloudTarget.OAuth(onedrive).transport(context, snapshots) {} }
      announce("PASS dropbox saved-not-enabled explicit-enable journal-row stored-target transport onedrive-unsupported")
      AndroidWebDavDestinations.forget(context, target)
      check(!AndroidWebDavDestinations.enabled(context, target))
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        check(journal.destination(target) == null && journal.schedule.read(target) == null)
      }
      announce("PASS dropbox forget disables and drops plan")
    } finally {
      listOf(dropbox, onedrive).forEach { runCatching { AndroidOAuthVault(context, it.targetId()).delete() } }
    }
  }

  // Real account (user sign-in and approval 2026-11-03): the unchanged publication state machine over the Dropbox transport,
  // in a fresh root inside the app folder. Kloda never deletes remotely, so the test files stay for the user to remove.
  fun live(context: Context, signedIn: AndroidOAuthProfile, announce: (String) -> Unit) {
    val profile = signedIn.copy(targetPath = "Kloda/test18b5-" + UUID.randomUUID().toString().take(8))
    val snapshots = AndroidFilesSnapshots(context, true) {}
    val transport = AndroidDropboxTransport(context, profile, snapshots) {}
    val source = UUID.randomUUID().toString()
    AndroidSyncJournal.webdav(context).use { owner ->
      val journal = AndroidWebDavJournal(owner.writableDatabase)
      fun job(name: String, staged: FilesSnapshot) = WebDavUpload(UUID.randomUUID().toString(), profile.targetId(), "live-binding", source,
        name, "$source/$name", "1", staged.id, staged.digest.sha256, staged.digest.size, kind = "file", sourceIdentity = "live")
          .also { journal.insert(it) }
      fun publish(value: WebDavUpload) = AndroidWebDavPublication(journal, transport::inspect, transport::upload, transport::move, {},
        { journal.advance(it, "completed") }).execute(value.id)
      val small = job("Fotoğraf ü 😀.txt", snapshots.stageMetadata("kloda 18B/5 small ${UUID.randomUUID()}".toByteArray()))
      check(publish(small) && journal.find(small.id)?.phase == "completed") { "small publication" }
      check(transport.inspect(small.relativePath, small) == "match") { "small verified by own SHA-256" }
      check(transport.inspect("$source/never-${UUID.randomUUID()}", small) == "missing")
      announce("PASS dropbox small create-only upload+move_v2 own-sha256 verified, unicode path")
      val other = job("Fotoğraf ü 😀.txt", snapshots.stageMetadata("kloda 18B/5 other ${UUID.randomUUID()}".toByteArray()))
      // Same length, other bytes: a mismatch. A longer remote file stops at the size bound (review_required), as on DAV.
      check(transport.inspect(other.relativePath, other) == "mismatch") { "existing destination is a mismatch" }
      rejects("conflict") { transport.upload(other.relativePath, other) }
      val temporary = AndroidWebDavPublication.temporary(other)
      transport.upload(temporary, other)
      rejects("conflict") { transport.move(temporary, other.relativePath) }
      check(transport.inspect(small.relativePath, small) == "match") { "original untouched after refused writes" }
      val third = job("Fotoğraf ü 😀.txt", snapshots.stageMetadata("kloda 18B/5 third ${UUID.randomUUID()}".toByteArray()))
      rejects("conflict") { publish(third) }
      announce("PASS dropbox upload mode=add and move_v2 refuse an existing file; original unchanged; publication stops at conflict")
      val size = AndroidDropboxTransport.SINGLE + 1
      val digest = AndroidFilesSnapshots.digest(bytes(size))
      val staged = snapshots.stageDownload(digest) { out -> AndroidFilesSnapshots.digest(bytes(size), output = out) }
      val large = job("large.bin", staged)
      check(publish(large) && journal.find(large.id)?.phase == "completed") { "session publication" }
      check(transport.inspect(large.relativePath, large) == "match") { "session result verified by own SHA-256" }
      announce("PASS dropbox upload_session ${size} bytes in one run, own-sha256 verified")
    }
  }
  // Deterministic, incompressible-enough bytes without holding the file in memory.
  private fun bytes(size: Long): InputStream = object : InputStream() {
    private val random = java.util.Random(18_05L); private var left = size
    override fun read(): Int = if (left-- > 0) random.nextInt(256) else -1
    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
      if (left <= 0) return -1
      val count = minOf(length.toLong(), left).toInt()
      val chunk = ByteArray(count).also(random::nextBytes); System.arraycopy(chunk, 0, buffer, offset, count); left -= count
      return count
    }
  }
}
