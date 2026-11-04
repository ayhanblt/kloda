package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import java.util.UUID

// ADR0029 §4 (29/3): imported receipts are restore-only and bound to the destination they were read from (`target`).
// They live in their own tables, never in `webdav_upload`, so nothing that completes, skips, settles or authorizes an
// upload can see them. A verified delta and its entries are stored in one transaction; nothing is updated or deleted.
internal class AndroidRecoveryImportJournal(private val database: SQLiteDatabase) {
  init {
    database.execSQL("""CREATE TABLE IF NOT EXISTS imported_delta(target TEXT NOT NULL,installation TEXT NOT NULL,chain TEXT NOT NULL,source TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK(sequence>0),sha256 TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(target,installation,chain,source,sequence))""")
    database.execSQL("""CREATE TABLE IF NOT EXISTS imported_receipt(id TEXT PRIMARY KEY,target TEXT NOT NULL,installation TEXT NOT NULL,chain TEXT NOT NULL,
      source TEXT NOT NULL,sequence INTEGER NOT NULL,position INTEGER NOT NULL CHECK(position>=0),path TEXT NOT NULL,sha256 TEXT NOT NULL,
      size INTEGER NOT NULL CHECK(size>=0),kind TEXT NOT NULL CHECK(kind IN ('file','photo_resource','photo_manifest')),identity TEXT,completed INTEGER,
      UNIQUE(target,installation,chain,source,sequence,position),
      FOREIGN KEY(target,installation,chain,source,sequence) REFERENCES imported_delta(target,installation,chain,source,sequence))""")
    for (table in listOf("imported_delta", "imported_receipt")) {
      database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_$table BEFORE UPDATE ON $table BEGIN SELECT RAISE(ABORT,'binding'); END")
      database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_$table BEFORE DELETE ON $table BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
    AndroidWebDavRestoreJournal(database, "imported_file_restore", "imported_receipt")
  }
  // True when the delta is stored now or was stored before with the same bytes; false when this position of the chain
  // was imported earlier with other bytes (kept as it was; the caller counts the rest as unverified).
  fun importDelta(target: String, installation: String, chain: String, source: String, sequence: Long, sha256: String,
    entries: List<AndroidRecoveryCatalog.Entry>): Boolean {
    val key = arrayOf(target, installation, chain, source, sequence.toString())
    database.beginTransactionNonExclusive()
    try {
      val existing = database.rawQuery("SELECT sha256 FROM imported_delta WHERE target=? AND installation=? AND chain=? AND source=? AND sequence=?",
        key).use { if (it.moveToFirst()) it.getString(0) else null }
      if (existing != null) { database.setTransactionSuccessful(); return existing == sha256 }
      database.insertOrThrow("imported_delta", null, ContentValues().apply {
        put("target", target); put("installation", installation); put("chain", chain); put("source", source); put("sequence", sequence)
        put("sha256", sha256); put("at", System.currentTimeMillis())
      })
      entries.forEachIndexed { position, entry ->
        database.insertOrThrow("imported_receipt", null, ContentValues().apply {
          put("id", UUID.randomUUID().toString()); put("target", target); put("installation", installation); put("chain", chain)
          put("source", source); put("sequence", sequence); put("position", position); put("path", entry.path); put("sha256", entry.sha256)
          put("size", entry.size); put("kind", entry.kind); put("identity", entry.identity); put("completed", entry.completed)
        })
      }
      database.setTransactionSuccessful()
      return true
    } finally { database.endTransaction() }
  }
  fun count(target: String): Long = database.rawQuery("SELECT COUNT(*) FROM imported_receipt WHERE target=?", arrayOf(target))
    .use { if (it.moveToFirst()) it.getLong(0) else throw FilesFailure("storage_failure") }
  // 29/4 (ADR0029 §5): restore reads an imported receipt only through the destination it is bound to, as a projection
  // with the `imported` binding and no snapshot. It is never stored: `insert` refuses it (no snapshot, not `prepared`).
  fun imported(id: String, target: String): WebDavUpload? = rows("SELECT $COLUMNS FROM imported_receipt r WHERE r.id=? AND r.target=?", arrayOf(id, target)).firstOrNull()
  fun receipts(target: String, after: String): List<WebDavUpload> =
    rows("SELECT $COLUMNS FROM imported_receipt r WHERE r.target=? AND r.id>? ORDER BY r.id LIMIT 100", arrayOf(target, after))
  // A photo resource of an imported manifest must come from the same catalog origin (installation, chain, old destination).
  fun resource(manifest: String, target: String, path: String, identity: String, hash: String, size: Long): WebDavUpload? = rows(
    """SELECT $COLUMNS FROM imported_receipt r JOIN imported_receipt m ON m.id=? AND m.target=r.target
      AND m.installation=r.installation AND m.chain=r.chain AND m.source=r.source AND m.kind='photo_manifest'
      WHERE r.target=? AND r.path=? AND r.kind='photo_resource' AND r.identity=? AND r.sha256=? AND r.size=? ORDER BY r.rowid DESC LIMIT 1""",
    arrayOf(manifest, target, path, identity, hash, size.toString())).firstOrNull()
  private fun rows(sql: String, args: Array<String>): List<WebDavUpload> = database.rawQuery(sql, args).use { cursor -> buildList {
    while (cursor.moveToNext()) {
      val path = cursor.getString(2)
      // The restore list and photo identities need the old device's source folder (first path part) to be a UUID.
      val source = path.substringBefore('/')
      if (runCatching { UUID.fromString(source).toString() == source }.getOrDefault(false).not() || cursor.isNull(6)) continue
      add(WebDavUpload(cursor.getString(0), cursor.getString(1), BINDING, source, path, path, BINDING, "", cursor.getString(3), cursor.getLong(4),
        "completed", null, false, cursor.getString(5), cursor.getString(6)))
    }
  } }
  companion object {
    const val BINDING = "imported"
    private const val COLUMNS = "r.id,r.target,r.path,r.sha256,r.size,r.kind,r.identity"
  }
}
