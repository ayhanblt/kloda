package com.kloda.sync

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.ByteArrayInputStream
import java.io.File

internal data class PhotoPublication(val manifest: PhotoManifest, val bytes: ByteArray, val job: FilesJob)

internal class AndroidPhotoManifestJournal(context: Context) : SQLiteOpenHelper(context,
  File(context.noBackupFilesDir, "kloda-photos-source.sqlite").absolutePath, null, 2) {
  override fun onConfigure(database: SQLiteDatabase) { database.execSQL("PRAGMA synchronous=FULL") }
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL("CREATE TABLE installation (id TEXT NOT NULL)")
    database.execSQL("INSERT INTO installation VALUES (?)", arrayOf(AndroidFilesSnapshots.randomId()))
    database.execSQL("CREATE TABLE identity (kind TEXT NOT NULL, local_key TEXT NOT NULL, id TEXT NOT NULL UNIQUE, PRIMARY KEY(kind,local_key))")
    database.execSQL("CREATE TABLE revision (asset TEXT PRIMARY KEY, signature TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0))")
    database.execSQL("""CREATE TABLE publication (record TEXT NOT NULL, asset TEXT NOT NULL, revision INTEGER NOT NULL,
      request TEXT NOT NULL UNIQUE, wire_source TEXT NOT NULL, payload BLOB NOT NULL CHECK(length(payload)<=65536),
      operation TEXT, offset INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'queued', rebackup_of TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(record,asset,revision,rebackup_of))""")
    createGuard(database)
    database.execSQL("CREATE TABLE owner_deleted (request TEXT PRIMARY KEY REFERENCES publication(request))")
  }
  private fun createGuard(database: SQLiteDatabase) {
    database.execSQL("""CREATE TRIGGER immutable_publication BEFORE UPDATE ON publication
      WHEN NEW.record IS NOT OLD.record OR NEW.asset IS NOT OLD.asset OR NEW.revision IS NOT OLD.revision
      OR NEW.rebackup_of IS NOT OLD.rebackup_of OR NEW.request IS NOT OLD.request OR NEW.wire_source IS NOT OLD.wire_source OR NEW.payload IS NOT OLD.payload
      OR (OLD.operation IS NOT NULL AND NEW.operation IS NOT OLD.operation) OR NEW.offset<OLD.offset
      OR (OLD.state='completed' AND NEW.state!='completed') BEGIN SELECT RAISE(ABORT,'binding'); END""")
  }
  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    database.execSQL("DROP TRIGGER immutable_publication")
    database.execSQL("ALTER TABLE publication RENAME TO old_publication")
    database.execSQL("""CREATE TABLE publication (record TEXT NOT NULL, asset TEXT NOT NULL, revision INTEGER NOT NULL,
      request TEXT NOT NULL UNIQUE, wire_source TEXT NOT NULL, payload BLOB NOT NULL CHECK(length(payload)<=65536),
      operation TEXT, offset INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'queued', rebackup_of TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(record,asset,revision,rebackup_of))""")
    database.execSQL("INSERT INTO publication SELECT *,'' FROM old_publication")
    database.execSQL("DROP TABLE old_publication")
    createGuard(database)
    database.execSQL("CREATE TABLE owner_deleted (request TEXT PRIMARY KEY REFERENCES publication(request))")
  }

  fun sourceDeviceId(): String = readableDatabase.rawQuery("SELECT id FROM installation", null).use {
    if (!it.moveToFirst()) throw FilesFailure("storage_failure")
    it.getString(0)
  }
  fun identity(kind: String, localKey: String): String = synchronized(AndroidSyncJournal.sourceLock) {
    val database = writableDatabase
    database.rawQuery("SELECT id FROM identity WHERE kind=? AND local_key=?", arrayOf(kind, localKey)).use {
      if (it.moveToFirst()) return@synchronized it.getString(0)
    }
    AndroidFilesSnapshots.randomId().also { id -> database.insertOrThrow("identity", null, ContentValues().apply {
      put("kind", kind); put("local_key", localKey); put("id", id)
    }) }
  }

  fun preferredOperation(record: String, asset: String, name: String, digest: FilesDigest): String? =
    readableDatabase.rawQuery("SELECT payload FROM publication WHERE record=? AND asset=? ORDER BY revision DESC,rowid DESC LIMIT 1",
      arrayOf(record, asset)).use { cursor ->
      if (!cursor.moveToFirst()) null else PhotoManifestCodec.decode(cursor.getBlob(0)).resources.singleOrNull {
        it.role == "original" && it.name == name && it.sha256 == digest.sha256 && it.size == digest.size
      }?.operationId
    }

  private fun signature(value: PhotoManifest): String {
    val canonical = value.copy(revision = 1, resources = value.resources.map { it.copy(operationId = "AAAAAAAAAAAAAAAAAAAAAA") })
    return AndroidFilesSnapshots.digest(ByteArrayInputStream(PhotoManifestCodec.encode(canonical))).sha256
  }

  fun metadataChanged(record: String, draft: PhotoManifest): Boolean = readableDatabase.rawQuery(
    "SELECT payload FROM publication WHERE record=? AND asset=? ORDER BY revision DESC,rowid DESC LIMIT 1",
    arrayOf(record, draft.assetId)
  ).use { it.moveToFirst() && signature(PhotoManifestCodec.decode(it.getBlob(0))) != signature(draft) }

  fun prepare(record: String, draft: PhotoManifest): PhotoPublication = synchronized(AndroidSyncJournal.sourceLock) {
    val signature = signature(draft)
    val database = writableDatabase
    database.beginTransaction()
    try {
      val revision = database.rawQuery("SELECT signature,revision FROM revision WHERE asset=?", arrayOf(draft.assetId)).use {
        if (!it.moveToFirst()) 1L else {
          val prior = it.getLong(1)
          if (it.getString(0) == signature) prior else {
            if (prior == Long.MAX_VALUE) throw FilesFailure("storage_failure")
            prior + 1
          }
        }
      }
      val manifest = draft.copy(revision = revision)
      val bytes = PhotoManifestCodec.encode(manifest)
      database.insertWithOnConflict("revision", null, ContentValues().apply {
        put("asset", draft.assetId); put("signature", signature); put("revision", revision)
      }, SQLiteDatabase.CONFLICT_REPLACE).also { if (it == -1L) throw FilesFailure("storage_failure") }
      val existing = database.rawQuery("SELECT * FROM publication WHERE record=? AND asset=? AND revision=? ORDER BY rowid DESC LIMIT 1",
        arrayOf(record, draft.assetId, revision.toString())).use { if (it.moveToFirst()) decode(it) else null }
      val publication = existing ?: run {
        val wire = wireSource(record, draft.assetId)
        database.insertOrThrow("publication", null, ContentValues().apply {
          put("record", record); put("asset", draft.assetId); put("revision", revision)
          put("request", AndroidFilesSnapshots.randomId()); put("wire_source", wire); put("payload", bytes)
        })
        database.rawQuery("SELECT * FROM publication WHERE record=? AND asset=? AND revision=? ORDER BY rowid DESC LIMIT 1",
          arrayOf(record, draft.assetId, revision.toString())).use { check(it.moveToFirst()); decode(it) }
      }
      if (!publication.bytes.contentEquals(bytes)) throw FilesFailure("conflict")
      database.setTransactionSuccessful()
      publication
    } finally { database.endTransaction() }
  }

  fun parent(prior: PhotoPublication): PhotoPublication? = readableDatabase.rawQuery("""SELECT * FROM publication
    WHERE asset=? AND revision=? AND wire_source=? AND operation IS NOT NULL ORDER BY rowid DESC LIMIT 2""",
    arrayOf(prior.manifest.assetId, prior.manifest.revision.toString(), prior.job.wireSourceId)
  ).use { cursor ->
    if (!cursor.moveToFirst()) null else decode(cursor).also {
      if (cursor.moveToNext()) throw FilesFailure("source_identity_unknown")
    }
  }

  fun currentAttempt(record: String, prior: PhotoPublication): PhotoPublication? = readableDatabase.rawQuery(
    "SELECT * FROM publication WHERE record=? AND asset=? AND revision=? AND rebackup_of!='' ORDER BY rowid DESC LIMIT 1",
    arrayOf(record, prior.manifest.assetId, prior.manifest.revision.toString())
  ).use { if (it.moveToFirst()) decode(it) else null }

  fun latest(prior: PhotoPublication): PhotoPublication = readableDatabase.rawQuery(
    "SELECT * FROM publication WHERE record=? AND asset=? AND revision=? ORDER BY rowid DESC LIMIT 1",
    arrayOf(prior.job.recordId, prior.manifest.assetId, prior.manifest.revision.toString())
  ).use { if (!it.moveToFirst()) throw FilesFailure("not_found"); decode(it) }

  fun find(id: String): PhotoPublication? = readableDatabase.rawQuery("SELECT * FROM publication WHERE request=?", arrayOf(id)).use {
    if (it.moveToFirst()) decode(it) else null
  }
  fun deleted(id: String): Boolean = readableDatabase.rawQuery("SELECT 1 FROM owner_deleted WHERE request=?", arrayOf(id)).use { it.moveToFirst() }
  fun clearDeleted(id: String) { writableDatabase.delete("owner_deleted", "request=?", arrayOf(id)) }
  fun markDeleted(id: String) { writableDatabase.execSQL("INSERT OR IGNORE INTO owner_deleted(request) SELECT request FROM publication WHERE request=?", arrayOf(id)) }
  fun status(): List<Map<String, Any>> = readableDatabase.rawQuery("""SELECT p.* FROM publication p
    JOIN owner_deleted d ON d.request=p.request ORDER BY p.rowid DESC LIMIT 100""", null).use { cursor -> buildList {
    while (cursor.moveToNext()) { val job = decode(cursor).job
      add(mapOf("id" to job.id, "recordId" to job.recordId, "sourceId" to job.sourceId, "name" to job.name,
        "state" to "owner_deleted", "errorCode" to "owner_deleted", "acknowledgedBytes" to job.offset.toString(), "totalBytes" to job.size.toString()))
    }
  } }
  fun count(): Long = readableDatabase.rawQuery("SELECT COUNT(*) FROM owner_deleted", null).use { it.moveToFirst(); it.getLong(0) }
  private fun wireSource(record: String, asset: String): String {
    val bindings = readableDatabase.rawQuery("SELECT record,wire_source FROM publication WHERE asset=? ORDER BY (record=?) DESC,rowid",
      arrayOf(asset, record)).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.getString(0) to cursor.getString(1)) } }
    bindings.firstOrNull { it.first == record }?.let { return it.second }
    val wires = bindings.map { it.second }.distinct()
    if (wires.size > 1) throw FilesFailure("source_identity_unknown")
    return wires.singleOrNull() ?: AndroidFilesSnapshots.randomId()
  }

  fun attempt(prior: PhotoPublication, manifest: PhotoManifest, record: String = prior.job.recordId): PhotoPublication {
    val job = prior.job
    if (job.operationId == null) throw FilesFailure("outcome_unknown")
    val database = writableDatabase
    database.execSQL("""INSERT OR IGNORE INTO publication(record,asset,revision,request,wire_source,payload,rebackup_of)
      SELECT ?,asset,revision,?,wire_source,?,operation FROM publication WHERE request=?""",
      arrayOf(record, AndroidFilesSnapshots.randomId(), PhotoManifestCodec.encode(manifest), job.id))
    return database.rawQuery("SELECT * FROM publication WHERE record=? AND asset=? AND revision=? AND rebackup_of=?",
      arrayOf(record, prior.manifest.assetId, prior.manifest.revision.toString(), job.operationId)).use {
      if (!it.moveToFirst()) throw FilesFailure("storage_failure")
      decode(it)
    }
  }

  fun retain(job: FilesJob, ack: FilesAck): FilesJob {
    val state = when (ack.state) { "completed" -> "completed"; "receiving" -> "uploading"; else -> "finalizing" }
    val updated = writableDatabase.update("publication", ContentValues().apply {
      put("operation", ack.id); put("offset", ack.offset); put("state", state)
    }, "request=?", arrayOf(job.id))
    if (updated != 1) throw FilesFailure("storage_failure")
    return job.copy(operationId = ack.id, offset = ack.offset, state = state)
  }

  internal fun decode(cursor: Cursor): PhotoPublication {
    fun text(key: String): String = cursor.getString(cursor.getColumnIndexOrThrow(key))
    val bytes = cursor.getBlob(cursor.getColumnIndexOrThrow("payload"))
    val manifest = PhotoManifestCodec.decode(bytes)
    val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
    val job = FilesJob(text("request"), text("record"), manifest.assetId, manifest.assetId, AndroidPhotosSources.library,
      "${PhotoManifestCodec.prefix}${manifest.sourceDeviceId}-${manifest.assetId}-${manifest.revision}.json", text("wire_source"),
      digest.sha256, digest.size, cursor.getString(cursor.getColumnIndexOrThrow("operation")),
      cursor.getLong(cursor.getColumnIndexOrThrow("offset")), text("state"), null, text("rebackup_of").ifEmpty { null })
    return PhotoPublication(manifest, bytes, job)
  }
}
