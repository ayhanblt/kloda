package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File
import java.util.UUID

// S3 gets one app-private journal per provider; no shared backup_destination migration.
internal class AndroidS3Journal(context: Context, val provider: String, diagnostic: Boolean = false) {
  val database: SQLiteDatabase
  init {
    if (provider !in setOf("amazon-s3", "s3-compatible")) throw S3Failure("invalid_request")
    database = SQLiteDatabase.openOrCreateDatabase(File(context.noBackupFilesDir, "kloda-$provider${if (diagnostic) "-diagnostic" else ""}.sqlite"), null)
    database.enableWriteAheadLogging(); database.execSQL("PRAGMA synchronous=FULL"); database.execSQL("PRAGMA foreign_keys=ON")
    database.rawQuery("PRAGMA journal_mode", null).use { if (!it.moveToFirst() || it.getString(0).lowercase() != "wal") throw S3Failure("storage_failure") }
    database.rawQuery("PRAGMA synchronous", null).use { if (!it.moveToFirst() || it.getInt(0) != 2) throw S3Failure("storage_failure") }
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_identity(id INTEGER PRIMARY KEY CHECK(id=1),installation TEXT NOT NULL,context TEXT NOT NULL,provider TEXT NOT NULL)")
    database.execSQL("INSERT OR IGNORE INTO s3_identity VALUES(1,?,?,?)", arrayOf(UUID.randomUUID().toString(), UUID.randomUUID().toString(), provider))
    if (text("SELECT provider FROM s3_identity WHERE id=1") != provider) throw S3Failure("storage_failure")
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_profile(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN(0,1)))")
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_enabled(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL CHECK(value IN(0,1)))")
    database.execSQL("INSERT OR IGNORE INTO s3_enabled VALUES(1,0)")
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_automatic(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL CHECK(value IN(0,1)))")
    database.execSQL("INSERT OR IGNORE INTO s3_automatic VALUES(1,0)")
    createJobs()
  }
  internal fun text(sql: String, values: Array<String> = emptyArray()): String = database.rawQuery(sql, values).use {
    if (!it.moveToFirst()) throw S3Failure("storage_failure"); it.getString(0)
  }
  internal fun <T> transaction(block: () -> T): T = synchronized(AndroidSyncJournal.sourceLock) {
    database.beginTransaction()
    try { val value = block(); database.setTransactionSuccessful(); value } finally { database.endTransaction() }
  }
  fun automatic(): Boolean = text("SELECT value FROM s3_automatic WHERE id=1") == "1"
  fun setAutomatic(value: Boolean) = transaction {
    if (value && !enabled()) throw S3Failure("target_pause")
    invalidate(); database.execSQL("UPDATE s3_automatic SET value=? WHERE id=1", arrayOf(if (value) 1 else 0))
  }
  fun context(): String = text("SELECT context FROM s3_identity WHERE id=1")
  fun hasProfile(): Boolean = text("SELECT COUNT(*) FROM s3_profile") == "1"
  fun profileCurrent(target: S3Target): Boolean = target.provider == provider && text(
    "SELECT COUNT(*) FROM s3_profile WHERE id=1 AND ready=1 AND target=?", arrayOf(target.json().toString())) == "1"
  fun prepareProfile(target: S3Target) = transaction {
    target.validate(); if (target.provider != provider) throw S3Failure("invalid_request")
    database.execSQL("UPDATE s3_identity SET context=? WHERE id=1", arrayOf(UUID.randomUUID().toString()))
    database.execSQL("UPDATE s3_enabled SET value=0 WHERE id=1"); database.execSQL("UPDATE s3_automatic SET value=0 WHERE id=1")
    database.execSQL("INSERT OR REPLACE INTO s3_profile VALUES(1,?,0)", arrayOf(target.json().toString()))
  }
  fun confirmProfile(target: S3Target) {
    database.execSQL("UPDATE s3_profile SET ready=1 WHERE id=1 AND ready=0 AND target=?", arrayOf(target.json().toString()))
    if (!profileCurrent(target)) throw S3Failure("context_changed")
  }
}
