package com.kloda.sync

import android.database.sqlite.SQLiteDatabase
import android.content.ContentValues
import android.net.Uri
import java.util.UUID
import org.json.JSONObject

internal data class S3FileRestore(val id: String, val target: String, val job: String, val name: String,
  val sha256: String, val size: Long, val snapshot: String, val directory: String,
  val document: String? = null, val phase: String = "verified", val error: String? = null) {
  fun header() = JSONObject().put("id", id).put("target", target).put("job", job).put("name", name).put("sha256", sha256)
    .put("size", size.toString()).put("snapshot", snapshot).put("directory", directory).toString()
  fun validate() {
    if (listOf(id, job).any { runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false).not() } ||
      listOf(target, sha256).any { !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(it) } || size < 0 ||
      runCatching { UUID.fromString(snapshot).toString() == snapshot }.getOrDefault(false).not() || name.isEmpty() || name.toByteArray().size > 255 || name in setOf(".", "..") || name.any { it == '/' || it == '\\' || it.isISOControl() } ||
      listOfNotNull(directory, document).any { it.toByteArray().size > 8192 || Uri.parse(it).scheme != "content" } ||
      phase !in setOf("verified", "creating", "created", "writing", "completed", "review_required") ||
      (phase in setOf("created", "writing", "completed") && document == null) || (error != null && !Regex("[a-z][a-z0-9_]{0,127}").matches(error))) throw FilesFailure("outcome_unknown")
  }
}
internal class AndroidS3RestoreJournal(private val database: SQLiteDatabase) {
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_file_restore(id TEXT PRIMARY KEY,target TEXT NOT NULL,job TEXT NOT NULL REFERENCES s3_job(id),header TEXT NOT NULL,document TEXT,phase TEXT NOT NULL,error TEXT)")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_s3_file_restore BEFORE UPDATE ON s3_file_restore
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.job IS NOT OLD.job OR NEW.header IS NOT OLD.header
      OR (OLD.document IS NOT NULL AND NEW.document IS NOT OLD.document)
      OR (NEW.phase!=OLD.phase AND NOT ((OLD.phase='verified' AND NEW.phase='creating') OR (OLD.phase='creating' AND NEW.phase='created')
      OR (OLD.phase='created' AND NEW.phase='writing') OR (OLD.phase='writing' AND NEW.phase='completed') OR (OLD.phase!='completed' AND NEW.phase='review_required')))
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_s3_file_restore BEFORE DELETE ON s3_file_restore BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun latest(target: String, job: String): S3FileRestore? = database.rawQuery("SELECT header,document,phase,error FROM s3_file_restore WHERE target=? AND job=? ORDER BY rowid DESC LIMIT 1", arrayOf(target, job)).use {
    if (!it.moveToFirst()) return@use null
    val v = JSONObject(it.getString(0))
    S3FileRestore(v.getString("id"), v.getString("target"), v.getString("job"), v.getString("name"), v.getString("sha256"), v.getString("size").toLong(), v.getString("snapshot"), v.getString("directory"),
      if (it.isNull(1)) null else it.getString(1), it.getString(2), if (it.isNull(3)) null else it.getString(3)).also { row ->
      row.validate(); if (row.target != target || row.job != job) throw FilesFailure("outcome_unknown")
    }
  }
  fun save(row: S3FileRestore) {
    row.validate()
    val values = ContentValues().apply {
      put("id", row.id); put("target", row.target); put("job", row.job); put("header", row.header()); put("document", row.document); put("phase", row.phase); put("error", row.error)
    }
    if (database.update("s3_file_restore", values, "id=?", arrayOf(row.id)) == 0) {
      if (row.phase != "verified" || row.document != null || row.error != null) throw FilesFailure("outcome_unknown")
      database.insertOrThrow("s3_file_restore", null, values)
    }
  }
}
