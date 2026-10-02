package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal data class QueuedSourceFile(
  val reference: String,
  val relativePath: String,
  val revision: String,
  val size: Long
)

internal class AndroidSyncJournal(context: Context) : SQLiteOpenHelper(context, "kloda-sync.sqlite", null, 1) {
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL(
      """CREATE TABLE queued_source_file (
        source_id TEXT NOT NULL,
        reference TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        revision TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL,
        PRIMARY KEY (source_id, reference)
      )"""
    )
  }

  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  fun replaceSourceFiles(sourceId: String, files: Sequence<QueuedSourceFile>): Int {
    writableDatabase.beginTransaction()
    return try {
      writableDatabase.delete("queued_source_file", "source_id = ?", arrayOf(sourceId))
      var count = 0
      writableDatabase.compileStatement(
        "INSERT INTO queued_source_file (source_id, reference, relative_path, revision, size_bytes, status) VALUES (?, ?, ?, ?, ?, 'queued')"
      ).use { statement ->
        files.forEach { file ->
          statement.bindString(1, sourceId)
          statement.bindString(2, file.reference)
          statement.bindString(3, file.relativePath)
          statement.bindString(4, file.revision)
          statement.bindLong(5, file.size)
          statement.executeInsert()
          statement.clearBindings()
          count += 1
        }
      }
      writableDatabase.setTransactionSuccessful()
      count
    } finally {
      writableDatabase.endTransaction()
    }
  }

  fun removeSource(sourceId: String) {
    writableDatabase.delete("queued_source_file", "source_id = ?", arrayOf(sourceId))
  }
}
