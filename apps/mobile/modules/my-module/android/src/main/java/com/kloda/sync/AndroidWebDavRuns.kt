package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal class AndroidWebDavRuns(private val database: SQLiteDatabase) {
  init {
    database.execSQL("""CREATE TABLE IF NOT EXISTS webdav_run(id TEXT PRIMARY KEY,target TEXT NOT NULL,binding TEXT NOT NULL,
      automatic INTEGER NOT NULL CHECK(automatic IN (0,1)),occurrence INTEGER NOT NULL CHECK(occurrence>=0),payload TEXT NOT NULL,
      phase TEXT NOT NULL,error TEXT,attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 5),os_attempts INTEGER NOT NULL CHECK(os_attempts BETWEEN 1 AND 5))""")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_webdav_run BEFORE UPDATE ON webdav_run
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.binding IS NOT OLD.binding OR NEW.automatic IS NOT OLD.automatic
      OR NEW.occurrence IS NOT OLD.occurrence OR NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1
      OR NEW.os_attempts<OLD.os_attempts OR NEW.os_attempts>OLD.os_attempts+1
      OR ((OLD.phase IN ('finished','needs_attention','exhausted') OR (OLD.phase='paused' AND OLD.error='settings_changed')) AND NEW.payload IS NOT OLD.payload)
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_webdav_run BEFORE DELETE ON webdav_run BEGIN SELECT RAISE(ABORT,'retained'); END")
    database.execSQL("""CREATE TABLE IF NOT EXISTS webdav_run_job(run TEXT NOT NULL REFERENCES webdav_run(id),job TEXT NOT NULL REFERENCES webdav_upload(id),kind TEXT NOT NULL,PRIMARY KEY(run,job))""")
    for (operation in listOf("UPDATE", "DELETE")) database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_webdav_run_job_${operation.lowercase()} BEFORE $operation ON webdav_run_job BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun save(value: WebDavRun) {
    value.validate()
    val values = ContentValues().apply {
      put("id", value.id); put("target", value.target); put("binding", value.binding); put("automatic", if (value.automatic) 1 else 0)
      put("occurrence", value.occurrence); put("payload", value.payload()); put("phase", value.phase); put("error", value.error)
      put("attempts", value.attempts); put("os_attempts", value.osAttempts)
    }
    if (database.update("webdav_run", values, "id=?", arrayOf(value.id)) == 0) database.insertOrThrow("webdav_run", null, values)
  }
  fun read(id: String? = null, target: String? = null, automatic: Boolean? = null): WebDavRun? {
    val clauses = mutableListOf<String>(); val values = mutableListOf<String>()
    if (id != null) { clauses.add("id=?"); values.add(id) }
    if (target != null) { clauses.add("target=?"); values.add(target) }
    if (automatic != null) { clauses.add("automatic=?"); values.add(if (automatic) "1" else "0") }
    val where = if (clauses.isEmpty()) "" else " WHERE " + clauses.joinToString(" AND ")
    return database.rawQuery("SELECT payload,id,target,binding,phase,attempts,os_attempts,automatic,occurrence FROM webdav_run$where ORDER BY rowid DESC LIMIT 1", values.toTypedArray()).use {
      if (!it.moveToFirst()) return@use null
      val value = WebDavRun.decode(it.getString(0))
      if (it.getString(1) != value.id || it.getString(2) != value.target || it.getString(3) != value.binding || it.getString(4) != value.phase ||
        it.getInt(5) != value.attempts || it.getInt(6) != value.osAttempts || (it.getInt(7) == 1) != value.automatic || it.getLong(8) != value.occurrence) throw FilesFailure("outcome_unknown")
      value
    }
  }
  fun track(run: WebDavRun, job: WebDavUpload) {
    if (job.target != run.target || (job.phase != "completed" && job.binding != run.binding)) throw FilesFailure("settings_changed")
    database.execSQL("""INSERT OR IGNORE INTO webdav_run_job(run,job,kind) SELECT ?,?,? WHERE EXISTS(
      SELECT 1 FROM webdav_run WHERE id=? AND target=? AND binding=? AND phase='running')""", arrayOf(run.id, job.id, job.kind ?: "legacy", run.id, run.target, run.binding))
    database.rawQuery("SELECT 1 FROM webdav_run_job WHERE run=? AND job=?", arrayOf(run.id, job.id)).use {
      if (!it.moveToFirst()) throw FilesFailure("settings_changed")
    }
  }
  fun counts(id: String): Map<String, String> = database.rawQuery("""SELECT r.kind,u.payload,u.source,u.reference,u.phase,u.skipped
    FROM webdav_run_job r JOIN webdav_upload u ON u.id=r.job WHERE r.run=? ORDER BY u.rowid DESC""", arrayOf(id)).use {
    var operations = 0L; var completed = 0L; var files = 0L; var completedFiles = 0L; var photos = 0L; var completedPhotos = 0L
    val seen = mutableSetOf<String>()
    while (it.moveToNext()) {
      val kind = it.getString(0); val done = it.getString(4) == "completed" && it.getInt(5) == 0
      operations++; if (done) completed++
      if (kind !in setOf("file", "legacy", "photo_manifest")) continue
      val key = if (kind == "photo_manifest") {
        val payload = it.getString(1)
        if (payload.toByteArray().size > 65536) throw FilesFailure("outcome_unknown")
        val value = org.json.JSONObject(payload)
        it.getString(2) + ":photo:" + if (value.isNull("sourceIdentity")) it.getString(3) else value.getString("sourceIdentity")
      } else it.getString(2) + ":file:" + it.getString(3)
      // A retry may see several revisions; only the latest revision counts as an item.
      if (!seen.add(key)) continue
      if (kind == "photo_manifest") { photos++; if (done) completedPhotos++ }
      else { files++; if (done) completedFiles++ }
    }
    mapOf("operations" to operations.toString(), "completedOperations" to completed.toString(), "files" to files.toString(),
      "completedFiles" to completedFiles.toString(), "photos" to photos.toString(), "completedPhotos" to completedPhotos.toString())
  }
}
