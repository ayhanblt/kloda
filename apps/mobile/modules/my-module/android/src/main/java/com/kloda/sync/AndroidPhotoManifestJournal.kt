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
  File(context.noBackupFilesDir, "kloda-photos-source.sqlite").absolutePath, null, 1) {
  override fun onConfigure(database: SQLiteDatabase) { database.execSQL("PRAGMA synchronous=FULL") }
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL("CREATE TABLE installation (id TEXT NOT NULL)")
    database.execSQL("INSERT INTO installation VALUES (?)", arrayOf(AndroidFilesSnapshots.randomId()))
    database.execSQL("CREATE TABLE identity (kind TEXT NOT NULL, local_key TEXT NOT NULL, id TEXT NOT NULL UNIQUE, PRIMARY KEY(kind,local_key))")
    database.execSQL("CREATE TABLE revision (asset TEXT PRIMARY KEY, signature TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0))")
    database.execSQL("""CREATE TABLE publication (record TEXT NOT NULL, asset TEXT NOT NULL, revision INTEGER NOT NULL,
      request TEXT NOT NULL UNIQUE, wire_source TEXT NOT NULL, payload BLOB NOT NULL CHECK(length(payload)<=65536),
      operation TEXT, offset INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'queued',
      PRIMARY KEY(record,asset,revision))""")
    database.execSQL("""CREATE TRIGGER immutable_publication BEFORE UPDATE ON publication
      WHEN NEW.record IS NOT OLD.record OR NEW.asset IS NOT OLD.asset OR NEW.revision IS NOT OLD.revision
      OR NEW.request IS NOT OLD.request OR NEW.wire_source IS NOT OLD.wire_source OR NEW.payload IS NOT OLD.payload
      OR (OLD.operation IS NOT NULL AND NEW.operation IS NOT OLD.operation) OR NEW.offset<OLD.offset
      OR (OLD.state='completed' AND NEW.state!='completed') BEGIN SELECT RAISE(ABORT,'binding'); END""")
  }
  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) { throw FilesFailure("storage_failure") }

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
    readableDatabase.rawQuery("SELECT payload FROM publication WHERE record=? AND asset=? ORDER BY revision DESC LIMIT 1",
      arrayOf(record, asset)).use { cursor ->
      if (!cursor.moveToFirst()) null else PhotoManifestCodec.decode(cursor.getBlob(0)).resources.singleOrNull {
        it.role == "original" && it.name == name && it.sha256 == digest.sha256 && it.size == digest.size
      }?.operationId
    }

  fun prepare(record: String, draft: PhotoManifest): PhotoPublication = synchronized(AndroidSyncJournal.sourceLock) {
    val canonical = draft.copy(revision = 1, resources = draft.resources.map { it.copy(operationId = "AAAAAAAAAAAAAAAAAAAAAA") })
    val signature = AndroidFilesSnapshots.digest(ByteArrayInputStream(PhotoManifestCodec.encode(canonical))).sha256
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
      val existing = database.rawQuery("SELECT * FROM publication WHERE record=? AND asset=? AND revision=?",
        arrayOf(record, draft.assetId, revision.toString())).use { if (it.moveToFirst()) decode(it) else null }
      val publication = existing ?: run {
        val wire = database.rawQuery("SELECT wire_source FROM publication WHERE record=? AND asset=? LIMIT 1",
          arrayOf(record, draft.assetId)).use { if (it.moveToFirst()) it.getString(0) else AndroidFilesSnapshots.randomId() }
        database.insertOrThrow("publication", null, ContentValues().apply {
          put("record", record); put("asset", draft.assetId); put("revision", revision)
          put("request", AndroidFilesSnapshots.randomId()); put("wire_source", wire); put("payload", bytes)
        })
        database.rawQuery("SELECT * FROM publication WHERE record=? AND asset=? AND revision=?",
          arrayOf(record, draft.assetId, revision.toString())).use { check(it.moveToFirst()); decode(it) }
      }
      if (!publication.bytes.contentEquals(bytes)) throw FilesFailure("conflict")
      database.setTransactionSuccessful()
      publication
    } finally { database.endTransaction() }
  }

  fun retain(job: FilesJob, ack: FilesAck): FilesJob {
    val state = when (ack.state) { "completed" -> "completed"; "receiving" -> "uploading"; else -> "finalizing" }
    val updated = writableDatabase.update("publication", ContentValues().apply {
      put("operation", ack.id); put("offset", ack.offset); put("state", state)
    }, "request=?", arrayOf(job.id))
    if (updated != 1) throw FilesFailure("storage_failure")
    return job.copy(operationId = ack.id, offset = ack.offset, state = state)
  }

  private fun decode(cursor: Cursor): PhotoPublication {
    fun text(key: String): String = cursor.getString(cursor.getColumnIndexOrThrow(key))
    val bytes = cursor.getBlob(cursor.getColumnIndexOrThrow("payload"))
    val manifest = PhotoManifestCodec.decode(bytes)
    val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
    val job = FilesJob(text("request"), text("record"), manifest.assetId, manifest.assetId, AndroidPhotosSources.library,
      "${PhotoManifestCodec.prefix}${manifest.sourceDeviceId}-${manifest.assetId}-${manifest.revision}.json", text("wire_source"),
      digest.sha256, digest.size, cursor.getString(cursor.getColumnIndexOrThrow("operation")),
      cursor.getLong(cursor.getColumnIndexOrThrow("offset")), text("state"), null)
    return PhotoPublication(manifest, bytes, job)
  }
}
