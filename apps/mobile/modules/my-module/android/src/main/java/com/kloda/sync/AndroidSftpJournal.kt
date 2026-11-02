package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.util.UUID

internal class SftpFailure(val code: String, val jobId: String? = null) : Exception(code)
internal data class SftpTarget(val address: String, val port: Int, val fingerprint: String, val root: String,
  val username: String, val profileGeneration: String, val credentialGeneration: String) {
  fun validate() {
    val pin = Regex("SHA256:[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]")
    val rootValid = root == "/" || root.startsWith('/') && root.drop(1).split('/').all { it.isNotEmpty() && it != "." && it != ".." && it.toByteArray().size <= 255 }
    if (address.isEmpty() || username.isEmpty() || username.toByteArray().size > 1024 || port !in 1..65535 || !pin.matches(fingerprint) || !rootValid ||
      listOf(address, root, username).any { it.toByteArray().size > 4096 || it.any(Char::isISOControl) } || root.contains('\\') ||
      listOf(profileGeneration, credentialGeneration).any { runCatching { UUID.fromString(it).toString() != it }.getOrDefault(true) }) throw SftpFailure("invalid_request")
  }
  fun archiveId(): String {
    val raw = org.json.JSONArray().put("sftp").put(address).put(port.toString()).put(fingerprint).put(root).put(username).toString()
    return android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8)),
      android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
  }
  fun sameArchive(other: SftpTarget) = address == other.address && port == other.port && fingerprint == other.fingerprint && root == other.root && username == other.username
  fun json() = JSONObject().put("address", address).put("port", port).put("fingerprint", fingerprint).put("root", root)
    .put("username", username).put("profileGeneration", profileGeneration).put("credentialGeneration", credentialGeneration)
}
internal data class SftpUpload(val id: String, val installation: String, val target: SftpTarget, val context: String,
  val source: String, val reference: String, val revision: String, val relativePath: String, val snapshot: String,
  val sha256: String, val size: Long, val kind: String, val asset: String? = null, val name: String? = null, val logicalPath: String? = null, val mimeType: String? = null) {
  fun payload(): String = JSONObject().put("id", id).put("installation", installation).put("target", target.json())
    .put("context", context).put("source", source).put("reference", reference).put("revision", revision)
    .put("relativePath", relativePath).put("snapshot", snapshot).put("sha256", sha256).put("size", size.toString())
    .put("kind", kind).put("asset", asset ?: JSONObject.NULL).apply { if (name != null) put("name", name); if (logicalPath != null) put("logicalPath", logicalPath); if (mimeType != null) put("mimeType", mimeType) }.toString()
  fun validate() {
    target.validate()
    val fields = listOf(installation, context, source, reference, revision, relativePath, snapshot, target.address,
      target.fingerprint, target.root, target.username, target.profileGeneration, target.credentialGeneration)
    if (listOf(id, context, source).any { runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false).not() } ||
      listOf(installation, reference, revision, relativePath, target.address, target.fingerprint, target.username,
        target.profileGeneration, target.credentialGeneration).any { it.isEmpty() } ||
      target.port !in 1..65535 || size < 0 || fields.any { it.toByteArray().size > 4096 || it.contains('\u0000') } ||
      kind !in setOf("file", "photo_resource", "photo_manifest") ||
      (kind != "file" && (asset.isNullOrEmpty() || asset.toByteArray().size > 128)) ||
      !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(sha256) || snapshot != "$id.snapshot" ||
      (name != null && (name.isEmpty() || name.toByteArray().size > 255 || name.any { it == '/' || it == '\\' || it.isISOControl() })) ||
      (logicalPath != null && (logicalPath.isEmpty() || logicalPath.toByteArray().size > 4096 || logicalPath.contains('\u0000'))) ||
      (mimeType != null && (mimeType.length > 127 || !Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+").matches(mimeType))) ||
      payload().toByteArray().size > 16384) throw SftpFailure("invalid_request")
  }
}
internal data class SftpCatalogPage(val jobs: List<SftpUpload>, val next: String?)
internal data class SftpReceiptState(val step: Int, val issue: String?, val completed: Boolean)

// Caller supplies the separate app-private SFTP database, configured FULL/WAL.
internal class AndroidSftpJournal(val database: SQLiteDatabase) {
  init { synchronized(AndroidSyncJournal.sourceLock) {
    database.rawQuery("PRAGMA synchronous", null).use { if (!it.moveToFirst() || it.getInt(0) != 2) throw SftpFailure("storage_failure") }
    database.rawQuery("PRAGMA journal_mode", null).use { if (!it.moveToFirst() || !it.getString(0).equals("wal", true)) throw SftpFailure("storage_failure") }
    database.execSQL("CREATE TABLE IF NOT EXISTS sftp_installation(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO sftp_installation VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
    database.execSQL("CREATE TABLE IF NOT EXISTS sftp_context(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO sftp_context VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
    database.execSQL("CREATE TABLE IF NOT EXISTS sftp_sources(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL)")
    database.execSQL("CREATE TABLE IF NOT EXISTS sftp_profile(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN (0,1)))")
    database.execSQL("""CREATE TABLE IF NOT EXISTS sftp_upload(id TEXT PRIMARY KEY,header TEXT NOT NULL,context TEXT NOT NULL,
      size INTEGER NOT NULL CHECK(size>=0),step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 5),
      issue TEXT,completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)))""")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_sftp_upload BEFORE UPDATE ON sftp_upload
      WHEN NEW.id IS NOT OLD.id OR NEW.header IS NOT OLD.header OR NEW.context IS NOT OLD.context
        OR NEW.size IS NOT OLD.size OR (NEW.step IS NOT OLD.step AND NEW.step!=OLD.step+1)
        OR NEW.completed<OLD.completed OR (OLD.issue IS NOT NULL AND NEW.issue IS NOT OLD.issue)
        OR (OLD.completed=1 AND (NEW.step IS NOT OLD.step OR NEW.issue IS NOT OLD.issue))
        OR (NEW.completed=1 AND (NEW.step!=5 OR NEW.issue IS NOT NULL
          OR NEW.context IS NOT (SELECT revision FROM sftp_context WHERE id=1)))
      BEGIN SELECT RAISE(ABORT,'sftp_binding'); END""")
    val columns = database.rawQuery("PRAGMA table_info(sftp_upload)", null).use {
      buildSet { while (it.moveToNext()) add(it.getString(1)) }
    }
    for (column in listOf("locator_source", "locator_reference", "locator_archive", "locator_installation", "locator_hash")) {
      if (column !in columns) database.execSQL("ALTER TABLE sftp_upload ADD COLUMN $column TEXT")
    }
    database.execSQL("CREATE INDEX IF NOT EXISTS sftp_completed_locator ON sftp_upload(locator_archive,locator_installation,locator_source,locator_reference,locator_hash) WHERE completed=1 AND issue IS NULL")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_sftp_locator BEFORE UPDATE ON sftp_upload
      WHEN NEW.locator_source IS NOT OLD.locator_source OR NEW.locator_reference IS NOT OLD.locator_reference
      OR NEW.locator_archive IS NOT OLD.locator_archive OR NEW.locator_installation IS NOT OLD.locator_installation OR NEW.locator_hash IS NOT OLD.locator_hash
      BEGIN SELECT RAISE(ABORT,'sftp_binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_sftp_upload BEFORE DELETE ON sftp_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  }
  fun installation(): String = database.rawQuery("SELECT value FROM sftp_installation WHERE id=1", null).use {
    if (!it.moveToFirst()) throw SftpFailure("storage_failure")
    val value = it.getString(0)
    if (runCatching { UUID.fromString(value).toString() == value }.getOrDefault(false).not()) throw SftpFailure("storage_failure")
    value
  }
  fun decode(header: String): SftpUpload {
    try {
      val j = JSONObject(header); val t = j.getJSONObject("target")
      val target = SftpTarget(t.getString("address"), t.getInt("port"), t.getString("fingerprint"), t.getString("root"),
        t.getString("username"), t.getString("profileGeneration"), t.getString("credentialGeneration"))
      val job = SftpUpload(j.getString("id"), j.getString("installation"), target, j.getString("context"), j.getString("source"),
        j.getString("reference"), j.getString("revision"), j.getString("relativePath"), j.getString("snapshot"), j.getString("sha256"),
        j.getString("size").toLong(), j.getString("kind"), if (j.isNull("asset")) null else j.getString("asset"), if (j.has("name")) j.getString("name") else null, if (j.has("logicalPath")) j.getString("logicalPath") else null, if (j.has("mimeType")) j.getString("mimeType") else null)
      job.validate()
      if (job.payload() != header) throw SftpFailure("binding_changed")
      return job
    } catch (_: Exception) { throw SftpFailure("storage_failure") }
  }
  fun catalog(target: SftpTarget, after: String? = null): SftpCatalogPage {
    if (after != null && runCatching { UUID.fromString(after).toString() == after }.getOrDefault(false).not()) throw SftpFailure("invalid_request")
    val own = installation()
    return database.rawQuery("SELECT header FROM sftp_upload WHERE completed=1 AND issue IS NULL AND id>? ORDER BY id LIMIT 101", arrayOf(after ?: "")).use {
      val jobs = mutableListOf<SftpUpload>(); var cursor: String? = null; var count = 0
      while (it.moveToNext()) {
        if (count == 100) return@use SftpCatalogPage(jobs, cursor)
        val job = decode(it.getString(0)); cursor = job.id; count++
        if (job.installation == own && job.target.sameArchive(target)) jobs += job
      }
      SftpCatalogPage(jobs, null)
    }
  }
  fun issues(target: SftpTarget, after: String? = null): SftpCatalogPage {
    if (after != null && runCatching { UUID.fromString(after).toString() == after }.getOrDefault(false).not()) throw SftpFailure("invalid_request")
    return database.rawQuery("SELECT header FROM sftp_upload WHERE (completed=0 OR EXISTS(SELECT 1 FROM sftp_review_required r WHERE r.job=sftp_upload.id AND r.resolved=0)) AND NOT EXISTS(SELECT 1 FROM sftp_copy_request c JOIN sftp_upload n ON n.id=c.job WHERE c.original=sftp_upload.id AND n.completed=1 AND n.issue IS NULL) AND id>? ORDER BY id LIMIT 101", arrayOf(after ?: "")).use {
      val jobs = mutableListOf<SftpUpload>(); var cursor: String? = null; var count = 0
      while (it.moveToNext()) {
        if (count == 100) return@use SftpCatalogPage(jobs, cursor)
        val job = decode(it.getString(0)); cursor = job.id; count++
        if (job.installation == installation() && job.target.sameArchive(target)) jobs += job
      }
      SftpCatalogPage(jobs, null)
    }
  }
  fun knownCompleted(wanted: SftpUpload): SftpUpload? = candidate(wanted, true, false)
  fun unresolved(wanted: SftpUpload): SftpUpload? = candidate(wanted, false, false)
  fun resourceReceipt(wanted: SftpUpload): SftpUpload? = candidate(wanted, true, true)
  private fun candidate(wanted: SftpUpload, completed: Boolean, exactPath: Boolean): SftpUpload? {
    wanted.validate()
    val own = installation()
    if (wanted.installation != own) throw SftpFailure("binding_changed")
    val outcome = if (completed) "completed=1 AND issue IS NULL" else "completed=0"
    return database.rawQuery("SELECT header FROM sftp_upload WHERE $outcome AND ((locator_archive=? AND locator_installation=? AND locator_source=? AND locator_reference=? AND locator_hash=?) OR locator_source IS NULL) ORDER BY rowid DESC",
      arrayOf(wanted.target.archiveId(), own, wanted.source, wanted.reference, wanted.sha256)).use {
      while (it.moveToNext()) {
        val row = decode(it.getString(0))
        if (row.installation == own && row.target.sameArchive(wanted.target) && row.source == wanted.source && row.reference == wanted.reference &&
          row.sha256 == wanted.sha256 && row.size == wanted.size && row.kind == wanted.kind && row.asset == wanted.asset && row.name == wanted.name && row.logicalPath == wanted.logicalPath && row.mimeType == wanted.mimeType && (!exactPath || row.relativePath == wanted.relativePath)) return@use row
      }
      null
    }
  }
  fun ownReceipt(id: String, target: SftpTarget): SftpUpload {
    val job = reviewJob(id, target)
    if (!state(job).completed || state(job).issue != null) throw SftpFailure("receipt_missing")
    return job
  }
  fun reviewJob(id: String, target: SftpTarget): SftpUpload {
    if (runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false).not()) throw SftpFailure("invalid_request")
    val job = database.rawQuery("SELECT header FROM sftp_upload WHERE id=?", arrayOf(id)).use {
      if (!it.moveToFirst()) throw SftpFailure("receipt_missing"); decode(it.getString(0))
    }
    if (job.installation != installation() || job.id != id || !job.target.sameArchive(target)) throw SftpFailure("binding_changed")
    return job
  }
  fun context(): String = database.rawQuery("SELECT revision FROM sftp_context WHERE id=1", null).use {
    if (!it.moveToFirst()) throw SftpFailure("storage_failure"); it.getString(0)
  }
  // Owner startup before admitting workers; ACK/hash equality never adopts an unknown result.
  fun recoverInterrupted() = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try {
      invalidate()
      database.execSQL("UPDATE sftp_upload SET issue=COALESCE(issue,'restart_review_required') WHERE completed=0")
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  fun invalidate() = synchronized(AndroidSyncJournal.sourceLock) {
    database.execSQL("UPDATE sftp_context SET revision=? WHERE id=1", arrayOf(UUID.randomUUID().toString()))
  }
  fun bindSources(binding: String): String = synchronized(AndroidSyncJournal.sourceLock) {
    if (!Regex("[a-f0-9]{64}").matches(binding)) throw SftpFailure("invalid_request")
    database.beginTransaction()
    try {
      val same = database.rawQuery("SELECT binding FROM sftp_sources WHERE id=1", null).use {
        it.moveToFirst() && it.getString(0) == binding
      }
      if (!same) {
        invalidate()
        database.execSQL("INSERT OR REPLACE INTO sftp_sources VALUES(1,?)", arrayOf(binding))
      }
      val value = context()
      database.setTransactionSuccessful()
      value
    } finally { database.endTransaction() }
  }
  fun hasProfile(): Boolean = database.rawQuery("SELECT 1 FROM sftp_profile WHERE id=1", null).use { it.moveToFirst() }
  fun profileCurrent(target: SftpTarget): Boolean = database.rawQuery(
    "SELECT 1 FROM sftp_profile WHERE id=1 AND target=? AND ready=1", arrayOf(target.json().toString())).use { it.moveToFirst() }
  // Invalidate old work before custody changes. A crash leaves the new profile pending.
  fun prepareProfile(target: SftpTarget) = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try {
      invalidate()
      database.execSQL("INSERT OR REPLACE INTO sftp_profile VALUES(1,?,0)", arrayOf(target.json().toString()))
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  fun confirmProfile(target: SftpTarget) = synchronized(AndroidSyncJournal.sourceLock) {
    database.execSQL("UPDATE sftp_profile SET ready=1 WHERE id=1 AND target=? AND ready=0", arrayOf(target.json().toString()))
    if (!profileCurrent(target)) throw SftpFailure("context_changed")
  }
  fun insert(job: SftpUpload) {
    job.validate()
    if (context() != job.context) throw SftpFailure("context_changed")
    database.execSQL("INSERT INTO sftp_upload(id,header,context,size,locator_source,locator_reference,locator_archive,locator_installation,locator_hash) VALUES(?,?,?,?,?,?,?,?,?)",
      arrayOf<Any>(job.id, job.payload(), job.context, job.size, job.source, job.reference, job.target.archiveId(), job.installation, job.sha256))
  }
  fun state(job: SftpUpload): SftpReceiptState = database.rawQuery("SELECT header,step,issue,completed FROM sftp_upload WHERE id=?", arrayOf(job.id)).use {
    if (!it.moveToFirst() || it.getString(0) != job.payload()) throw SftpFailure("binding_changed")
    SftpReceiptState(it.getInt(1), if (it.isNull(2)) null else it.getString(2), it.getInt(3) == 1)
  }
  fun record(job: SftpUpload, event: Int, bytes: Long) {
    val old = state(job)
    if (event !in 1..5 || old.step + 1 != event || old.completed || bytes != (if (event == 2) job.size else 0L)) throw SftpFailure("outcome_unknown")
    // Persist a received ACK even when cancellation/context invalidation just happened.
    database.execSQL("UPDATE sftp_upload SET step=? WHERE id=? AND step=?", arrayOf<Any>(event, job.id, old.step))
    if (state(job).step != event) throw SftpFailure("storage_failure")
  }
  fun markIssue(job: SftpUpload, code: Int) {
    database.execSQL("UPDATE sftp_upload SET issue=COALESCE(issue,?) WHERE id=? AND completed=0", arrayOf("native_$code", job.id))
  }
  fun complete(job: SftpUpload, current: () -> Boolean) = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try {
      val row = state(job)
      if (row.step != 5 || row.issue != null || row.completed || context() != job.context || !current()) throw SftpFailure("context_changed")
      database.execSQL("UPDATE sftp_upload SET completed=1 WHERE id=?", arrayOf(job.id))
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
}
