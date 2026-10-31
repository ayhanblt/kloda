package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal class AndroidWebDavPublicationPaths(private val database: SQLiteDatabase) {
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_publication(job TEXT PRIMARY KEY REFERENCES webdav_upload(id),path TEXT NOT NULL)")
    for (operation in listOf("INSERT", "UPDATE")) database.execSQL("""CREATE TRIGGER IF NOT EXISTS scoped_webdav_publication_${operation.lowercase()} BEFORE $operation ON webdav_publication
      WHEN NOT EXISTS(SELECT 1 FROM webdav_upload WHERE id=NEW.job AND phase IN ('uploaded','moving') AND issue='conflict' AND skipped=0)
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_webdav_publication BEFORE DELETE ON webdav_publication BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  private fun validate(value: WebDavUpload, path: String) {
    if (path.toByteArray().size > 8192 || !path.startsWith("${value.source}/") || path.any { it == '\\' || it.isISOControl() } ||
      path.split('/').any { it.isEmpty() || it == "." || it == ".." || it.toByteArray().size > 255 } ||
      path.substringBeforeLast('/') != value.relativePath.substringBeforeLast('/')) throw FilesFailure("backup_path_rejected")
  }
  fun read(value: WebDavUpload): String = database.rawQuery("SELECT path FROM webdav_publication WHERE job=?", arrayOf(value.id)).use {
    if (!it.moveToFirst()) value.relativePath else it.getString(0).also { path -> validate(value, path) }
  }
  fun choose(value: WebDavUpload, path: String) {
    validate(value, path)
    val values = ContentValues().apply { put("job", value.id); put("path", path) }
    if (database.update("webdav_publication", values, "job=?", arrayOf(value.id)) == 0) database.insertOrThrow("webdav_publication", null, values)
  }
  fun clearIssue(value: WebDavUpload) {
    if (database.update("webdav_upload", ContentValues().apply { putNull("issue") }, "id=? AND target=? AND phase=? AND skipped=0", arrayOf(value.id, value.target, value.phase)) != 1) throw FilesFailure("outcome_unknown")
  }
}
