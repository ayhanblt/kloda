package com.kloda.sync

import org.json.JSONArray

internal class AndroidS3PhotosState(private val journal: AndroidS3Journal) {
  fun identity(kind: String, locator: String): String = AndroidFilesSnapshots.digest(
    java.io.ByteArrayInputStream(JSONArray().put(journal.installation()).put(kind).put(locator).toString().toByteArray(Charsets.UTF_8))).sha256
  fun revision(asset: String, signature: String): Long = synchronized(AndroidSyncJournal.sourceLock) {
    val database = journal.database
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_photo_revision(asset TEXT PRIMARY KEY,signature TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0))")
    database.beginTransaction()
    try {
      val revision = database.rawQuery("SELECT signature,revision FROM s3_photo_revision WHERE asset=?", arrayOf(asset)).use {
        if (!it.moveToFirst()) 1L else {
          val prior = it.getLong(1)
          if (prior <= 0 || (it.getString(0) != signature && prior == Long.MAX_VALUE)) throw S3Failure("storage_failure")
          if (it.getString(0) == signature) prior else prior + 1
        }
      }
      database.execSQL("INSERT OR REPLACE INTO s3_photo_revision VALUES(?,?,?)", arrayOf<Any>(asset, signature, revision))
      database.setTransactionSuccessful(); revision
    } finally { database.endTransaction() }
  }
}
