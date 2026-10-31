package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.util.UUID

internal class SmbFailure(val code: String) : Exception(code)
internal data class SmbTarget(val address: String, val port: Int, val share: String, val root: String,
  val username: String, val domain: String, val profileGeneration: String, val credentialGeneration: String) {
  fun json(): JSONObject = JSONObject().put("address", address).put("port", port).put("share", share).put("root", root)
    .put("username", username).put("domain", domain).put("profileGeneration", profileGeneration).put("credentialGeneration", credentialGeneration)
}
internal data class SmbUpload(val id: String, val installation: String, val target: SmbTarget, val context: String,
  val source: String, val reference: String, val revision: String, val relativePath: String, val snapshot: String,
  val sha256: String, val size: Long, val kind: String, val asset: String? = null) {
  fun payload(): String = JSONObject().put("id", id).put("installation", installation).put("target", target.json())
    .put("context", context).put("source", source).put("reference", reference).put("revision", revision)
    .put("relativePath", relativePath).put("snapshot", snapshot).put("sha256", sha256).put("size", size.toString())
    .put("kind", kind).put("asset", asset ?: JSONObject.NULL).toString()
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
      payload().toByteArray().size > 16384) throw SmbFailure("invalid_request")
  }
}
internal data class SmbReceiptState(val step: Int, val issue: String?, val completed: Boolean)

// Caller supplies the separate app-private SMB database, configured FULL/WAL.
internal class AndroidSmbJournal(private val database: SQLiteDatabase) {
  init {
    database.rawQuery("PRAGMA synchronous", null).use { if (!it.moveToFirst() || it.getInt(0) != 2) throw SmbFailure("storage_failure") }
    database.rawQuery("PRAGMA journal_mode", null).use { if (!it.moveToFirst() || !it.getString(0).equals("wal", true)) throw SmbFailure("storage_failure") }
    database.execSQL("CREATE TABLE IF NOT EXISTS smb_context(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO smb_context VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
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
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_smb_upload BEFORE DELETE ON smb_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun context(): String = database.rawQuery("SELECT revision FROM smb_context WHERE id=1", null).use {
    if (!it.moveToFirst()) throw SmbFailure("storage_failure"); it.getString(0)
  }
  fun invalidate() = synchronized(AndroidSyncJournal.sourceLock) {
    database.execSQL("UPDATE smb_context SET revision=? WHERE id=1", arrayOf(UUID.randomUUID().toString()))
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
    database.execSQL("INSERT INTO smb_upload(id,header,context,size) VALUES(?,?,?,?)", arrayOf<Any>(job.id, job.payload(), job.context, job.size))
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
