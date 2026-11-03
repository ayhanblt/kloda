package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.util.UUID

internal data class WebDavUpload(val id: String, val target: String, val binding: String, val source: String,
  val reference: String, val relativePath: String, val revision: String, val snapshot: String, val sha256: String,
  val size: Long, val phase: String = "prepared", val issue: String? = null, val skipped: Boolean = false, val kind: String? = null, val sourceIdentity: String? = null) {
  fun validate() {
    if (listOf(id, source).any { runCatching { UUID.fromString(it).toString().equals(it, ignoreCase = true) }.getOrDefault(false).not() } || size < 0 ||
      listOf(target, binding, reference, revision, snapshot, sha256).any { it.isEmpty() } ||
      listOf(target, binding, source, reference, relativePath, revision, snapshot, sha256).any { it.contains('\u0000') || it.toByteArray().size > 8192 } ||
      !relativePath.startsWith("$source/") || relativePath.any { it == '\\' || it.isISOControl() } ||
      relativePath.split('/').any { it.isEmpty() || it == "." || it == ".." || it.toByteArray().size > 255 } ||
      !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(sha256) ||
      !Regex("[A-Za-z0-9_-]{21}[AQgw]").matches(snapshot) ||
      !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(target) ||
      phase !in setOf("prepared", "uploaded", "moving", "moved", "conflict", "completed") ||
      (issue != null && (issue.length > 128 || issue.contains('\u0000'))) || (sourceIdentity != null && (sourceIdentity.isEmpty() || sourceIdentity.toByteArray().size > 255 || sourceIdentity.contains('\u0000'))) || (kind != null && kind !in setOf("file", "photo_resource", "photo_manifest")) || (skipped && phase == "completed")) throw FilesFailure("outcome_unknown")
  }
  fun payload(): String = JSONObject().put("id", id).put("target", target).put("binding", binding).put("source", source)
    .put("reference", reference).put("relativePath", relativePath).put("revision", revision).put("snapshot", snapshot)
    .put("sha256", sha256).put("size", size.toString()).put("kind", kind ?: JSONObject.NULL).put("sourceIdentity", sourceIdentity ?: JSONObject.NULL).toString()
}

// Separate typed rows in the existing FULL/WAL journal; no fabricated PC pairing or grant.
internal class AndroidWebDavJournal(private val database: SQLiteDatabase) {
  val runs: AndroidWebDavRuns
  val schedule: AndroidWebDavSchedule
  val reviewAuthority: AndroidWebDavReviewAuthorization
  val publications: AndroidWebDavPublicationPaths
  init {
    database.execSQL("""CREATE TABLE IF NOT EXISTS webdav_upload (
      id TEXT PRIMARY KEY,target TEXT NOT NULL,source TEXT NOT NULL,reference TEXT NOT NULL,
      payload TEXT NOT NULL,phase TEXT NOT NULL,issue TEXT,skipped INTEGER NOT NULL DEFAULT 0 CHECK(skipped IN (0,1)))""")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_webdav_upload BEFORE UPDATE ON webdav_upload
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.source IS NOT OLD.source
      OR NEW.reference IS NOT OLD.reference OR NEW.payload IS NOT OLD.payload
      OR (NEW.phase IS NOT OLD.phase AND NOT (
        (OLD.phase='prepared' AND NEW.phase='uploaded') OR (OLD.phase='uploaded' AND NEW.phase IN ('moving','conflict'))
        OR (OLD.phase='moving' AND NEW.phase IN ('moved','conflict')) OR (OLD.phase='moved' AND NEW.phase='completed')))
      OR (NEW.phase='completed' AND NEW.skipped!=0)
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_webdav_upload BEFORE DELETE ON webdav_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
    database.execSQL("CREATE INDEX IF NOT EXISTS webdav_upload_locator ON webdav_upload(target,source,reference)")
    database.execSQL("CREATE INDEX IF NOT EXISTS webdav_upload_unfinished ON webdav_upload(id) WHERE phase!='completed'")
    migrateDestinations()
    runs = AndroidWebDavRuns(database)
    schedule = AndroidWebDavSchedule(database)
    publications = AndroidWebDavPublicationPaths(database)
    reviewAuthority = AndroidWebDavReviewAuthorization(database)
  }
  fun photoRevision(asset: String, signature: String): Long {
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_photo_revision(asset TEXT PRIMARY KEY,signature TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0))")
    database.beginTransaction()
    try {
      val revision = database.rawQuery("SELECT signature,revision FROM webdav_photo_revision WHERE asset=?", arrayOf(asset)).use {
        if (!it.moveToFirst()) 1L else if (it.getString(0) == signature) it.getLong(1) else {
          val prior = it.getLong(1)
          if (prior <= 0 || prior == Long.MAX_VALUE) throw FilesFailure("storage_failure")
          prior + 1
        }
      }
      database.insertWithOnConflict("webdav_photo_revision", null, ContentValues().apply {
        put("asset", asset); put("signature", signature); put("revision", revision)
      }, SQLiteDatabase.CONFLICT_REPLACE).also { if (it == -1L) throw FilesFailure("storage_failure") }
      database.setTransactionSuccessful(); return revision
    } finally { database.endTransaction() }
  }
  // ADR0027: one shared kind list; an existing table with the original CHECK is rebuilt once, rows unchanged, all or nothing.
  private fun destinationSql(): String? = database.rawQuery("SELECT sql FROM sqlite_master WHERE type='table' AND name='backup_destination'", null)
    .use { if (it.moveToFirst()) it.getString(0) else null }
  private fun migrateDestinations() {
    if (destinationSql()?.contains(DESTINATION_KINDS) == true) return
    database.beginTransaction()
    try {
      // Re-read under the write lock: another opener may have created or rebuilt the table meanwhile.
      val sql = destinationSql()
      if (sql == null) database.execSQL(destinationTable("backup_destination"))
      else if (!sql.contains(DESTINATION_KINDS)) {
        database.execSQL(destinationTable("backup_destination_next"))
        database.execSQL("INSERT INTO backup_destination_next(kind,id,enabled,revision) SELECT kind,id,enabled,revision FROM backup_destination")
        database.execSQL("DROP TABLE backup_destination")
        database.execSQL("ALTER TABLE backup_destination_next RENAME TO backup_destination")
      }
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  data class Header(val target: String, val revision: String, val kind: String = "webdav")
  // ADR0027 §4: every enabled DAV destination, each with its own opportunity; at most one legacy WebDAV row.
  fun destinations(): List<Header> = database.rawQuery(
    "SELECT id,revision,kind FROM backup_destination WHERE kind IN ($QUEUE_SQL) AND enabled=1 ORDER BY kind,id", null
  ).use {
    val values = buildList { while (it.moveToNext()) add(Header(it.getString(0), it.getString(1), it.getString(2))) }
    if (values.size > AndroidWebDavVault.LIMIT || values.count { value -> value.kind == "webdav" } > 1 || values.any { value ->
        !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(value.target) || runCatching { UUID.fromString(value.revision) }.isFailure
      }) throw FilesFailure("outcome_unknown")
    values
  }
  fun destination(target: String): Header? = destinations().firstOrNull { it.target == target }
  fun setEnabled(kind: String, id: String, enabled: Boolean, revision: String) {
    val pattern = if (kind == "pc") Regex("[A-Za-z0-9_-]{21}[AQgw]") else Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]")
    if (kind != "pc" && kind !in QUEUE_KINDS || !pattern.matches(id) || revision.isEmpty() || revision.toByteArray().size > 128 || revision.contains('\u0000')) throw FilesFailure("invalid_request")
    database.beginTransaction()
    try {
      val values = ContentValues().apply { put("enabled", if (enabled) 1 else 0); put("revision", revision) }
      if (database.update("backup_destination", values, "kind=? AND id=?", arrayOf(kind, id)) == 0) {
        values.put("kind", kind); values.put("id", id); database.insertOrThrow("backup_destination", null, values)
      }
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  fun enabled(kind: String, id: String, revision: String? = null): Boolean = database.rawQuery(
    "SELECT enabled,revision FROM backup_destination WHERE kind=? AND id=?", arrayOf(kind, id)
  ).use { it.moveToFirst() && it.getInt(0) == 1 && (revision == null || revision == it.getString(1)) }
  fun insert(value: WebDavUpload) {
    value.validate()
    if (value.phase != "prepared" || value.issue != null || value.skipped) throw FilesFailure("invalid_request")
    val payload = value.payload()
    if (payload.toByteArray().size > 65536) throw FilesFailure("invalid_request")
    database.insertOrThrow("webdav_upload", null, ContentValues().apply {
      put("id", value.id); put("target", value.target); put("source", value.source); put("reference", value.reference)
      put("payload", payload); put("phase", "prepared")
    })
  }
  fun find(id: String): WebDavUpload? = read("SELECT payload,phase,issue,skipped FROM webdav_upload WHERE id=?", arrayOf(id)).firstOrNull()
  fun uploads(target: String, after: String = ""): List<WebDavUpload> = read(
    "SELECT payload,phase,issue,skipped FROM webdav_upload WHERE target=? AND id>? ORDER BY id LIMIT 100", arrayOf(target, after))
  fun photoReceipt(target: String, source: String, path: String, identity: String, hash: String, size: Long): WebDavUpload? {
    val rows = read("SELECT u.payload,u.phase,u.issue,u.skipped FROM webdav_upload u LEFT JOIN webdav_publication p ON p.job=u.id WHERE u.target=? AND u.source=? AND COALESCE(p.path,u.reference)=? ORDER BY u.rowid DESC LIMIT 101", arrayOf(target, source, path))
    if (rows.size > 100) throw FilesFailure("review_required")
    return rows.firstOrNull { it.kind == "photo_resource" && it.sourceIdentity == identity && it.phase == "completed" && it.issue == null && !it.skipped && it.sha256 == hash && it.size == size && publications.read(it) == path }
  }
  fun unfinished(after: String): List<WebDavUpload> {
    if (after.isNotEmpty() && runCatching { UUID.fromString(after).toString().equals(after, true) }.getOrDefault(false).not()) throw FilesFailure("invalid_request")
    return read("SELECT payload,phase,issue,skipped FROM webdav_upload WHERE phase!='completed' AND id>? ORDER BY id LIMIT 101", arrayOf(after))
  }
  fun candidates(target: String, source: String, reference: String): List<WebDavUpload> = read(
    "SELECT payload,phase,issue,skipped FROM webdav_upload WHERE target=? AND source=? AND reference=? ORDER BY rowid DESC LIMIT 101",
    arrayOf(target, source, reference)).also { if (it.size > 100) throw FilesFailure("review_required") }
  private fun read(sql: String, args: Array<String>): List<WebDavUpload> = database.rawQuery(sql, args).use { cursor -> buildList {
    while (cursor.moveToNext()) {
      val json = JSONObject(cursor.getString(0))
      val value = WebDavUpload(json.getString("id"), json.getString("target"), json.getString("binding"), json.getString("source"),
        json.getString("reference"), json.getString("relativePath"), json.getString("revision"), json.getString("snapshot"),
        json.getString("sha256"), json.getString("size").toLong(), cursor.getString(1), if (cursor.isNull(2)) null else cursor.getString(2), cursor.getInt(3) == 1, json.opt("kind") as? String, json.opt("sourceIdentity") as? String)
      value.validate(); add(value)
    }
  } }
  fun advance(value: WebDavUpload, phase: String) {
    value.copy(phase = phase).validate()
    val changes = database.update("webdav_upload", ContentValues().apply { put("phase", phase); putNull("issue") },
      "id=? AND target=? AND phase=? AND skipped=0", arrayOf(value.id, value.target, value.phase))
    if (changes != 1) throw FilesFailure("outcome_unknown")
  }
  fun issue(value: WebDavUpload, code: String, skipped: Boolean = false) {
    if (code.isEmpty() || code.length > 128 || code.contains('\u0000') || value.phase == "completed") throw FilesFailure("invalid_request")
    val changes = database.update("webdav_upload", ContentValues().apply { put("issue", code); put("skipped", if (skipped) 1 else 0) },
      "id=? AND target=? AND phase=?", arrayOf(value.id, value.target, value.phase))
    if (changes != 1) throw FilesFailure("outcome_unknown")
  }
  companion object {
    // ADR0028 adds the OAuth kinds; each stays disabled until its upload adapter exists (user decision 2026-11-02).
    // Dropbox has one since 18B/5 (user decision 2026-11-03).
    const val DESTINATION_KINDS = "'pc','webdav','nextcloud','cloudme','kolab-now','smb','dropbox','onedrive','yandex','google-drive'"
    // DAV kinds the WebDAV queue uploads to; CloudMe stays blocked (Digest only).
    val DAV_KINDS = setOf("webdav", "nextcloud", "kolab-now")
    // Every kind the shared queue uploads to.
    val QUEUE_KINDS = DAV_KINDS + AndroidCloudTarget.OAUTH_KINDS
    private val QUEUE_SQL = QUEUE_KINDS.joinToString(",") { "'$it'" }
    fun destinationTable(name: String) = """CREATE TABLE $name (
      kind TEXT NOT NULL CHECK(kind IN ($DESTINATION_KINDS)),id TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),revision TEXT NOT NULL,PRIMARY KEY(kind,id))"""
  }
}
