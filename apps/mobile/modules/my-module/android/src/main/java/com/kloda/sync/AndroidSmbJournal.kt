package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.util.UUID

internal class SmbFailure(val code: String, val jobId: String? = null) : Exception(code)
internal data class SmbTarget(val address: String, val port: Int, val share: String, val root: String,
  val username: String, val domain: String, val profileGeneration: String, val credentialGeneration: String) {
  fun archiveId(): String {
    val raw = org.json.JSONArray().put(address).put(port.toString()).put(share).put(root).put(username).put(domain).toString()
    return android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8)),
      android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
  }
  fun sameArchive(other: SmbTarget): Boolean = address == other.address && port == other.port && share == other.share &&
    root == other.root && username == other.username && domain == other.domain
  fun json(): JSONObject = JSONObject().put("address", address).put("port", port).put("share", share).put("root", root)
    .put("username", username).put("domain", domain).put("profileGeneration", profileGeneration).put("credentialGeneration", credentialGeneration)
}
internal data class SmbUpload(val id: String, val installation: String, val target: SmbTarget, val context: String,
  val source: String, val reference: String, val revision: String, val relativePath: String, val snapshot: String,
  val sha256: String, val size: Long, val kind: String, val asset: String? = null, val name: String? = null, val logicalPath: String? = null, val mimeType: String? = null) {
  fun payload(): String = JSONObject().put("id", id).put("installation", installation).put("target", target.json())
    .put("context", context).put("source", source).put("reference", reference).put("revision", revision)
    .put("relativePath", relativePath).put("snapshot", snapshot).put("sha256", sha256).put("size", size.toString())
    .put("kind", kind).put("asset", asset ?: JSONObject.NULL).apply { if (name != null) put("name", name); if (logicalPath != null) put("logicalPath", logicalPath); if (mimeType != null) put("mimeType", mimeType) }.toString()
  fun validate() {
    val fields = listOf(installation, context, source, reference, revision, relativePath, snapshot, target.address,
      target.share, target.root, target.username, target.domain, target.profileGeneration, target.credentialGeneration)
    if (listOf(id, context, source).any { runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false).not() } ||
      listOf(installation, reference, revision, relativePath, target.address, target.share, target.username,
        target.profileGeneration, target.credentialGeneration).any { it.isEmpty() } ||
      target.port !in 1..65535 || size < 0 || fields.any { it.toByteArray().size > 4096 || it.contains('\u0000') } ||
      kind !in setOf("file", "photo_resource", "photo_manifest") ||
      (kind != "file" && (asset.isNullOrEmpty() || asset.toByteArray().size > 128)) ||
      !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(sha256) || snapshot != "$id.snapshot" ||
      (name != null && (name.isEmpty() || name.toByteArray().size > 255 || name.any { it == '/' || it == '\\' || it.isISOControl() })) ||
      (logicalPath != null && (logicalPath.isEmpty() || logicalPath.toByteArray().size > 4096 || logicalPath.contains('\u0000'))) ||
      (mimeType != null && (mimeType.length > 127 || !Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+").matches(mimeType))) ||
      payload().toByteArray().size > 16384) throw SmbFailure("invalid_request")
  }
}
internal data class SmbCatalogPage(val jobs: List<SmbUpload>, val next: String?)
internal data class SmbReceiptState(val step: Int, val issue: String?, val completed: Boolean)

// Caller supplies the separate app-private SMB database, configured FULL/WAL.
internal class AndroidSmbJournal(val database: SQLiteDatabase) {
  init { synchronized(AndroidSyncJournal.sourceLock) {
    database.rawQuery("PRAGMA synchronous", null).use { if (!it.moveToFirst() || it.getInt(0) != 2) throw SmbFailure("storage_failure") }
    database.rawQuery("PRAGMA journal_mode", null).use { if (!it.moveToFirst() || !it.getString(0).equals("wal", true)) throw SmbFailure("storage_failure") }
    database.execSQL("CREATE TABLE IF NOT EXISTS smb_installation(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO smb_installation VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
    database.execSQL("CREATE TABLE IF NOT EXISTS smb_context(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO smb_context VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
    database.execSQL("CREATE TABLE IF NOT EXISTS smb_sources(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL)")
    database.execSQL("CREATE TABLE IF NOT EXISTS smb_profile(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN (0,1)))")
    database.execSQL("""CREATE TABLE IF NOT EXISTS smb_upload(id TEXT PRIMARY KEY,header TEXT NOT NULL,context TEXT NOT NULL,
      size INTEGER NOT NULL CHECK(size>=0),step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 5),
      issue TEXT,completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)))""")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_smb_upload BEFORE UPDATE ON smb_upload
      WHEN NEW.id IS NOT OLD.id OR NEW.header IS NOT OLD.header OR NEW.context IS NOT OLD.context
        OR NEW.size IS NOT OLD.size OR (NEW.step IS NOT OLD.step AND NEW.step!=OLD.step+1)
        OR NEW.completed<OLD.completed OR (OLD.issue IS NOT NULL AND NEW.issue IS NOT OLD.issue)
        OR (OLD.completed=1 AND (NEW.step IS NOT OLD.step OR NEW.issue IS NOT OLD.issue))
        OR (NEW.completed=1 AND (NEW.step!=5 OR NEW.issue IS NOT NULL
          OR NEW.context IS NOT (SELECT revision FROM smb_context WHERE id=1)))
      BEGIN SELECT RAISE(ABORT,'smb_binding'); END""")
    val columns = database.rawQuery("PRAGMA table_info(smb_upload)", null).use {
      buildSet { while (it.moveToNext()) add(it.getString(1)) }
    }
    for (column in listOf("locator_source", "locator_reference", "locator_archive", "locator_installation", "locator_hash")) {
      if (column !in columns) database.execSQL("ALTER TABLE smb_upload ADD COLUMN $column TEXT")
    }
    database.execSQL("CREATE INDEX IF NOT EXISTS smb_completed_locator ON smb_upload(locator_archive,locator_installation,locator_source,locator_reference,locator_hash) WHERE completed=1 AND issue IS NULL")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_smb_locator BEFORE UPDATE ON smb_upload
      WHEN NEW.locator_source IS NOT OLD.locator_source OR NEW.locator_reference IS NOT OLD.locator_reference
      OR NEW.locator_archive IS NOT OLD.locator_archive OR NEW.locator_installation IS NOT OLD.locator_installation OR NEW.locator_hash IS NOT OLD.locator_hash
      BEGIN SELECT RAISE(ABORT,'smb_binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_smb_upload BEFORE DELETE ON smb_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  }
  fun installation(): String = database.rawQuery("SELECT value FROM smb_installation WHERE id=1", null).use {
    if (!it.moveToFirst()) throw SmbFailure("storage_failure")
    val value = it.getString(0)
    if (runCatching { UUID.fromString(value).toString() == value }.getOrDefault(false).not()) throw SmbFailure("storage_failure")
    value
  }
  fun decode(header: String): SmbUpload {
    try {
      val j = JSONObject(header); val t = j.getJSONObject("target")
      val target = SmbTarget(t.getString("address"), t.getInt("port"), t.getString("share"), t.getString("root"),
        t.getString("username"), t.getString("domain"), t.getString("profileGeneration"), t.getString("credentialGeneration"))
      val job = SmbUpload(j.getString("id"), j.getString("installation"), target, j.getString("context"), j.getString("source"),
        j.getString("reference"), j.getString("revision"), j.getString("relativePath"), j.getString("snapshot"), j.getString("sha256"),
        j.getString("size").toLong(), j.getString("kind"), if (j.isNull("asset")) null else j.getString("asset"), if (j.has("name")) j.getString("name") else null, if (j.has("logicalPath")) j.getString("logicalPath") else null, if (j.has("mimeType")) j.getString("mimeType") else null)
      job.validate()
      if (job.payload() != header) throw SmbFailure("binding_changed")
      return job
    } catch (_: Exception) { throw SmbFailure("storage_failure") }
  }
  fun catalog(target: SmbTarget, after: String? = null): SmbCatalogPage {
    if (after != null && runCatching { UUID.fromString(after).toString() == after }.getOrDefault(false).not()) throw SmbFailure("invalid_request")
    val own = installation()
    return database.rawQuery("SELECT header FROM smb_upload WHERE completed=1 AND issue IS NULL AND id>? ORDER BY id LIMIT 101", arrayOf(after ?: "")).use {
      val jobs = mutableListOf<SmbUpload>(); var cursor: String? = null; var count = 0
      while (it.moveToNext()) {
        if (count == 100) return@use SmbCatalogPage(jobs, cursor)
        val job = decode(it.getString(0)); cursor = job.id; count++
        if (job.installation == own && job.target.sameArchive(target)) jobs += job
      }
      SmbCatalogPage(jobs, null)
    }
  }
  fun issues(target: SmbTarget, after: String? = null): SmbCatalogPage {
    if (after != null && runCatching { UUID.fromString(after).toString() == after }.getOrDefault(false).not()) throw SmbFailure("invalid_request")
    return database.rawQuery("SELECT header FROM smb_upload WHERE (completed=0 OR EXISTS(SELECT 1 FROM smb_review_required r WHERE r.job=smb_upload.id AND r.resolved=0)) AND NOT EXISTS(SELECT 1 FROM smb_copy_request c JOIN smb_upload n ON n.id=c.job WHERE c.original=smb_upload.id AND n.completed=1 AND n.issue IS NULL) AND id>? ORDER BY id LIMIT 101", arrayOf(after ?: "")).use {
      val jobs = mutableListOf<SmbUpload>(); var cursor: String? = null; var count = 0
      while (it.moveToNext()) {
        if (count == 100) return@use SmbCatalogPage(jobs, cursor)
        val job = decode(it.getString(0)); cursor = job.id; count++
        if (job.installation == installation() && job.target.sameArchive(target)) jobs += job
      }
      SmbCatalogPage(jobs, null)
    }
  }
  fun knownCompleted(wanted: SmbUpload): SmbUpload? = candidate(wanted, true, false)
  fun unresolved(wanted: SmbUpload): SmbUpload? = candidate(wanted, false, false)
  fun resourceReceipt(wanted: SmbUpload): SmbUpload? = candidate(wanted, true, true)
  private fun candidate(wanted: SmbUpload, completed: Boolean, exactPath: Boolean): SmbUpload? {
    wanted.validate()
    val own = installation()
    if (wanted.installation != own) throw SmbFailure("binding_changed")
    val outcome = if (completed) "completed=1 AND issue IS NULL" else "completed=0"
    return database.rawQuery("SELECT header FROM smb_upload WHERE $outcome AND ((locator_archive=? AND locator_installation=? AND locator_source=? AND locator_reference=? AND locator_hash=?) OR locator_source IS NULL) ORDER BY rowid DESC",
      arrayOf(wanted.target.archiveId(), own, wanted.source, wanted.reference, wanted.sha256)).use {
      while (it.moveToNext()) {
        val row = decode(it.getString(0))
        if (row.installation == own && row.target.sameArchive(wanted.target) && row.source == wanted.source && row.reference == wanted.reference &&
          row.sha256 == wanted.sha256 && row.size == wanted.size && row.kind == wanted.kind && row.asset == wanted.asset && row.name == wanted.name && row.logicalPath == wanted.logicalPath && row.mimeType == wanted.mimeType && (!exactPath || row.relativePath == wanted.relativePath)) return@use row
      }
      null
    }
  }
  fun ownReceipt(id: String, target: SmbTarget): SmbUpload {
    val job = reviewJob(id, target)
    if (!state(job).completed || state(job).issue != null) throw SmbFailure("receipt_missing")
    return job
  }
  fun reviewJob(id: String, target: SmbTarget): SmbUpload {
    if (runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false).not()) throw SmbFailure("invalid_request")
    val job = database.rawQuery("SELECT header FROM smb_upload WHERE id=?", arrayOf(id)).use {
      if (!it.moveToFirst()) throw SmbFailure("receipt_missing"); decode(it.getString(0))
    }
    if (job.installation != installation() || job.id != id || !job.target.sameArchive(target)) throw SmbFailure("binding_changed")
    return job
  }
  fun context(): String = database.rawQuery("SELECT revision FROM smb_context WHERE id=1", null).use {
    if (!it.moveToFirst()) throw SmbFailure("storage_failure"); it.getString(0)
  }
  // Owner startup before admitting workers; ACK/hash equality never adopts an unknown result.
  fun recoverInterrupted() = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try {
      invalidate()
      database.execSQL("UPDATE smb_upload SET issue=COALESCE(issue,'restart_review_required') WHERE completed=0")
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  fun invalidate() = synchronized(AndroidSyncJournal.sourceLock) {
    database.execSQL("UPDATE smb_context SET revision=? WHERE id=1", arrayOf(UUID.randomUUID().toString()))
  }
  fun bindSources(binding: String): String = synchronized(AndroidSyncJournal.sourceLock) {
    if (!Regex("[a-f0-9]{64}").matches(binding)) throw SmbFailure("invalid_request")
    database.beginTransaction()
    try {
      val same = database.rawQuery("SELECT binding FROM smb_sources WHERE id=1", null).use {
        it.moveToFirst() && it.getString(0) == binding
      }
      if (!same) {
        invalidate()
        database.execSQL("INSERT OR REPLACE INTO smb_sources VALUES(1,?)", arrayOf(binding))
      }
      val value = context()
      database.setTransactionSuccessful()
      value
    } finally { database.endTransaction() }
  }
  fun hasProfile(): Boolean = database.rawQuery("SELECT 1 FROM smb_profile WHERE id=1", null).use { it.moveToFirst() }
  fun profileCurrent(target: SmbTarget): Boolean = database.rawQuery(
    "SELECT 1 FROM smb_profile WHERE id=1 AND target=? AND ready=1", arrayOf(target.json().toString())).use { it.moveToFirst() }
  // Invalidate old work before custody changes. A crash leaves the new profile pending.
  fun prepareProfile(target: SmbTarget) = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try {
      invalidate()
      database.execSQL("INSERT OR REPLACE INTO smb_profile VALUES(1,?,0)", arrayOf(target.json().toString()))
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  fun confirmProfile(target: SmbTarget) = synchronized(AndroidSyncJournal.sourceLock) {
    database.execSQL("UPDATE smb_profile SET ready=1 WHERE id=1 AND target=? AND ready=0", arrayOf(target.json().toString()))
    if (!profileCurrent(target)) throw SmbFailure("context_changed")
  }
  fun insert(job: SmbUpload) {
    job.validate()
    if (context() != job.context) throw SmbFailure("context_changed")
    database.execSQL("INSERT INTO smb_upload(id,header,context,size,locator_source,locator_reference,locator_archive,locator_installation,locator_hash) VALUES(?,?,?,?,?,?,?,?,?)",
      arrayOf<Any>(job.id, job.payload(), job.context, job.size, job.source, job.reference, job.target.archiveId(), job.installation, job.sha256))
  }
  fun state(job: SmbUpload): SmbReceiptState = database.rawQuery("SELECT header,step,issue,completed FROM smb_upload WHERE id=?", arrayOf(job.id)).use {
    if (!it.moveToFirst() || it.getString(0) != job.payload()) throw SmbFailure("binding_changed")
    SmbReceiptState(it.getInt(1), if (it.isNull(2)) null else it.getString(2), it.getInt(3) == 1)
  }
  fun record(job: SmbUpload, event: Int, bytes: Long) {
    val old = state(job)
    if (event !in 1..5 || old.step + 1 != event || old.completed || bytes != (if (event == 2) job.size else 0L)) throw SmbFailure("outcome_unknown")
    // Persist a received ACK even when cancellation/context invalidation just happened.
    database.execSQL("UPDATE smb_upload SET step=? WHERE id=? AND step=?", arrayOf<Any>(event, job.id, old.step))
    if (state(job).step != event) throw SmbFailure("storage_failure")
  }
  fun markIssue(job: SmbUpload, code: Int) {
    database.execSQL("UPDATE smb_upload SET issue=COALESCE(issue,?) WHERE id=? AND completed=0", arrayOf("native_$code", job.id))
  }
  fun complete(job: SmbUpload, current: () -> Boolean) = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try {
      val row = state(job)
      if (row.step != 5 || row.issue != null || row.completed || context() != job.context || !current()) throw SmbFailure("context_changed")
      database.execSQL("UPDATE smb_upload SET completed=1 WHERE id=?", arrayOf(job.id))
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
}
