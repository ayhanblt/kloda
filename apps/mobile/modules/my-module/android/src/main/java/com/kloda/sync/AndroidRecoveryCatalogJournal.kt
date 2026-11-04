package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.util.UUID

// ADR0029 §3 (29/2): catalog deltas live beside the DAV receipts. A delta row is immutable apart from its phase,
// which follows the upload contract; `catalog_entry` binds each Completed receipt to the delta that lists it in one
// chain, so a new chain (regenerated secret) lists every receipt again. Nothing here is ever deleted.
internal data class CatalogDelta(val id: String, val target: String, val chain: String, val sequence: Long, val payload: ByteArray,
  val sha256: String, val phase: String = "prepared", val issue: String? = null)

internal class AndroidRecoveryCatalogJournal(private val database: SQLiteDatabase, private val publications: AndroidWebDavPublicationPaths) {
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS catalog_installation(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO catalog_installation(id,value) VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_completion(job TEXT PRIMARY KEY REFERENCES webdav_upload(id),at INTEGER NOT NULL)")
    database.execSQL("""CREATE TABLE IF NOT EXISTS catalog_delta(id TEXT PRIMARY KEY,target TEXT NOT NULL,chain TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK(sequence>0),payload TEXT NOT NULL,sha256 TEXT NOT NULL,
      phase TEXT NOT NULL CHECK(phase IN ('prepared','uploaded','moving','moved','completed')),issue TEXT,UNIQUE(target,chain,sequence))""")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_catalog_delta BEFORE UPDATE ON catalog_delta
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.chain IS NOT OLD.chain OR NEW.sequence IS NOT OLD.sequence
        OR NEW.payload IS NOT OLD.payload OR NEW.sha256 IS NOT OLD.sha256 OR (NEW.phase IS NOT OLD.phase AND NOT (
          (OLD.phase='prepared' AND NEW.phase='uploaded') OR (OLD.phase='uploaded' AND NEW.phase='moving')
          OR (OLD.phase='moving' AND NEW.phase='moved') OR (OLD.phase='moved' AND NEW.phase='completed')))
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("""CREATE TABLE IF NOT EXISTS catalog_entry(target TEXT NOT NULL,chain TEXT NOT NULL,job TEXT NOT NULL REFERENCES webdav_upload(id),
      delta TEXT NOT NULL REFERENCES catalog_delta(id),PRIMARY KEY(target,chain,job))""")
    for (table in listOf("catalog_delta", "catalog_entry", "webdav_completion")) {
      database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_$table BEFORE DELETE ON $table BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
    database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_catalog_entry BEFORE UPDATE ON catalog_entry BEGIN SELECT RAISE(ABORT,'binding'); END")
  }
  fun installation(): String = database.rawQuery("SELECT value FROM catalog_installation WHERE id=1", null).use {
    if (!it.moveToFirst()) throw FilesFailure("storage_failure")
    it.getString(0).also { value -> if (runCatching { UUID.fromString(value).toString() == value }.getOrDefault(false).not()) throw FilesFailure("outcome_unknown") }
  }
  // Completion time is informative only (catalog `completed`); receipts from before 29/2 have none.
  fun recordCompletion(value: WebDavUpload) {
    runCatching { database.execSQL("INSERT OR IGNORE INTO webdav_completion(job,at) VALUES(?,?)", arrayOf(value.id, System.currentTimeMillis())) }
  }
  // Completed receipts of this destination that this chain does not list yet, oldest first.
  fun uncatalogued(target: String, chain: String): List<AndroidRecoveryCatalog.Entry> = database.rawQuery("""
    SELECT u.payload,c.at FROM webdav_upload u LEFT JOIN webdav_completion c ON c.job=u.id
    WHERE u.target=? AND u.phase='completed' AND u.skipped=0 AND u.issue IS NULL
      AND NOT EXISTS(SELECT 1 FROM catalog_entry e WHERE e.target=u.target AND e.chain=? AND e.job=u.id)
    ORDER BY u.rowid LIMIT 500""", arrayOf(target, chain)).use { cursor -> buildList {
    while (cursor.moveToNext()) {
      val json = JSONObject(cursor.getString(0))
      val value = WebDavUpload(json.getString("id"), json.getString("target"), json.getString("binding"), json.getString("source"),
        json.getString("reference"), json.getString("relativePath"), json.getString("revision"), json.getString("snapshot"),
        json.getString("sha256"), json.getString("size").toLong(), "completed", null, false, json.opt("kind") as? String, json.opt("sourceIdentity") as? String)
      value.validate()
      add(AndroidRecoveryCatalog.Entry(value.id, publications.read(value), value.sha256, value.size, value.kind ?: "file",
        value.sourceIdentity, if (cursor.isNull(1)) null else cursor.getLong(1)))
    }
  } }
  // The last delta of the chain (sequence and file hash), the `previous` of the next one.
  fun head(target: String, chain: String): Pair<Long, String>? = database.rawQuery(
    "SELECT sequence,sha256 FROM catalog_delta WHERE target=? AND chain=? ORDER BY sequence DESC LIMIT 1", arrayOf(target, chain)
  ).use { if (it.moveToFirst()) it.getLong(0) to it.getString(1) else null }
  fun pending(target: String, chain: String): List<CatalogDelta> = database.rawQuery(
    "SELECT id,sequence,payload,sha256,phase,issue FROM catalog_delta WHERE target=? AND chain=? AND phase!='completed' ORDER BY sequence",
    arrayOf(target, chain)).use { cursor -> buildList {
    while (cursor.moveToNext()) {
      val value = CatalogDelta(cursor.getString(0), target, chain, cursor.getLong(1), cursor.getString(2).toByteArray(Charsets.UTF_8),
        cursor.getString(3), cursor.getString(4), if (cursor.isNull(5)) null else cursor.getString(5))
      if (AndroidRecoveryCatalog.digest(value.payload) != value.sha256) throw FilesFailure("outcome_unknown")
      add(value)
    }
  } }
  // One transaction: the delta and the receipts it lists; it must extend the chain head the caller read.
  fun insert(value: CatalogDelta, jobs: List<String>) {
    val payload = String(value.payload, Charsets.UTF_8)
    if (value.phase != "prepared" || value.issue != null || jobs.isEmpty() || runCatching { UUID.fromString(value.id) }.isFailure ||
      !payload.toByteArray(Charsets.UTF_8).contentEquals(value.payload) || AndroidRecoveryCatalog.digest(value.payload) != value.sha256) throw FilesFailure("invalid_request")
    database.beginTransaction()
    try {
      val head = database.rawQuery("SELECT COALESCE(MAX(sequence),0) FROM catalog_delta WHERE target=? AND chain=?", arrayOf(value.target, value.chain))
        .use { if (it.moveToFirst()) it.getLong(0) else throw FilesFailure("storage_failure") }
      if (head + 1 != value.sequence) throw FilesFailure("outcome_unknown")
      database.insertOrThrow("catalog_delta", null, ContentValues().apply {
        put("id", value.id); put("target", value.target); put("chain", value.chain); put("sequence", value.sequence)
        put("payload", payload); put("sha256", value.sha256); put("phase", "prepared")
      })
      for (job in jobs) database.insertOrThrow("catalog_entry", null, ContentValues().apply {
        put("target", value.target); put("chain", value.chain); put("job", job); put("delta", value.id)
      })
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  fun advance(value: CatalogDelta, phase: String): CatalogDelta {
    val changes = database.update("catalog_delta", ContentValues().apply { put("phase", phase) },
      "id=? AND phase=? AND issue IS NULL", arrayOf(value.id, value.phase))
    if (changes != 1) throw FilesFailure("outcome_unknown")
    return value.copy(phase = phase)
  }
  fun issue(value: CatalogDelta, code: String) {
    val changes = database.update("catalog_delta", ContentValues().apply { put("issue", code) },
      "id=? AND phase=? AND phase!='completed'", arrayOf(value.id, value.phase))
    if (changes != 1) throw FilesFailure("outcome_unknown")
  }
}
