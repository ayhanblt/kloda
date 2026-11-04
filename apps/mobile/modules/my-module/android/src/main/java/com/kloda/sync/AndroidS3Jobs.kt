package com.kloda.sync

import org.json.JSONObject
import java.util.UUID

internal data class AndroidS3Job(val id: String, val installation: String, val context: String, val target: S3Target,
  val source: String, val reference: String, val revision: String, val sourceGeneration: String,
  val snapshot: String, val key: String, val sha256: String, val size: Long, val name: String? = null, val logicalPath: String? = null, val kind: String? = null, val asset: String? = null, val mimeType: String? = null) {
  fun payload(): String {
    target.validate()
    if (listOf(id, installation, context, source).any { runCatching { UUID.fromString(it).toString() != it }.getOrDefault(true) } ||
      size < 0 || snapshot != "$id.snapshot" || key != "objects/$installation/$id" ||
      listOf(reference, revision, sourceGeneration).any { it.isEmpty() || it.toByteArray(Charsets.UTF_8).size > 4096 || '\u0000' in it } ||
      !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(sha256)) throw S3Failure("invalid_request")
    if (name != null && (name.isEmpty() || name.toByteArray().size > 255 || name in listOf(".", "..") || name.any { it == '/' || it == '\\' || it.isISOControl() }) ||
      logicalPath != null && (logicalPath.isEmpty() || logicalPath.toByteArray().size > 4096 || '\u0000' in logicalPath)) throw S3Failure("invalid_request")
    if (kind != null && kind !in setOf("file", "photo_resource", "photo_manifest") ||
      kind in setOf("photo_resource", "photo_manifest") && (asset == null || !Regex("[A-Za-z0-9_-]{1,128}").matches(asset)) ||
      mimeType != null && (mimeType.length > 127 || !Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+").matches(mimeType))) throw S3Failure("invalid_request")
    val json = JSONObject().put("id", id).put("installation", installation).put("context", context).put("target", target.json())
      .put("source", source).put("reference", reference).put("revision", revision).put("sourceGeneration", sourceGeneration)
      .put("snapshot", snapshot).put("key", key).put("sha256", sha256).put("size", size)
    kind?.let { json.put("kind", it) }; asset?.let { json.put("asset", it) }; mimeType?.let { json.put("mimeType", it) }
    name?.let { json.put("name", it) }; logicalPath?.let { json.put("logicalPath", it) }
    return json.toString().also {
        if (it.toByteArray(Charsets.UTF_8).size > 16384) throw S3Failure("invalid_request")
      }
  }
  companion object {
    fun decode(raw: String): AndroidS3Job {
      val json = JSONObject(raw)
      val strings = setOf("id", "installation", "context", "source", "reference", "revision", "sourceGeneration", "snapshot", "key", "sha256")
      val optional = setOf("name", "logicalPath", "kind", "asset", "mimeType").filter { json.has(it) }.toSet()
      if (json.keys().asSequence().toSet() != strings + setOf("target", "size") + optional ||
        (strings + optional).any { json.opt(it) !is String } || (json.opt("size") !is Long && json.opt("size") !is Int)) throw S3Failure("storage_failure")
      return AndroidS3Job(json.getString("id"), json.getString("installation"), json.getString("context"), S3Target.decode(json.getJSONObject("target")),
        json.getString("source"), json.getString("reference"), json.getString("revision"), json.getString("sourceGeneration"), json.getString("snapshot"),
        json.getString("key"), json.getString("sha256"), json.getLong("size"), if ("name" in optional) json.getString("name") else null,
        if ("logicalPath" in optional) json.getString("logicalPath") else null,
        if ("kind" in optional) json.getString("kind") else null, if ("asset" in optional) json.getString("asset") else null,
        if ("mimeType" in optional) json.getString("mimeType") else null).also { it.payload() }
    }
  }
}

internal fun AndroidS3Journal.createJobs() {
  database.execSQL("CREATE TABLE IF NOT EXISTS s3_job(id TEXT PRIMARY KEY,header TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'prepared')")
  database.execSQL("CREATE TABLE IF NOT EXISTS s3_event(sequence INTEGER PRIMARY KEY AUTOINCREMENT,job TEXT NOT NULL REFERENCES s3_job(id),kind TEXT NOT NULL,payload TEXT NOT NULL)")
  database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_s3_job BEFORE UPDATE ON s3_job WHEN NEW.id IS NOT OLD.id OR NEW.header IS NOT OLD.header OR OLD.state IN('completed','aborted','review') BEGIN SELECT RAISE(ABORT,'s3_binding'); END")
  for (table in listOf("s3_job", "s3_event")) {
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_$table BEFORE DELETE ON $table BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  createCatalog()
  database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_s3_event BEFORE UPDATE ON s3_event BEGIN SELECT RAISE(ABORT,'retained'); END")
}
internal fun AndroidS3Journal.installation(): String = text("SELECT installation FROM s3_identity WHERE id=1")
internal fun AndroidS3Journal.invalidate() = database.execSQL("UPDATE s3_identity SET context=? WHERE id=1", arrayOf(UUID.randomUUID().toString()))
internal fun AndroidS3Journal.enabled(): Boolean = text("SELECT value FROM s3_enabled WHERE id=1") == "1"
internal fun AndroidS3Journal.setEnabled(value: Boolean) = transaction {
  if (value && text("SELECT COUNT(*) FROM s3_profile WHERE id=1 AND ready=1") != "1") throw S3Failure("profile_missing")
  invalidate(); database.execSQL("UPDATE s3_enabled SET value=? WHERE id=1", arrayOf(if (value) 1 else 0))
}
internal fun AndroidS3Journal.insert(job: AndroidS3Job) = transaction {
  if (job.installation != installation() || job.context != context() || !profileCurrent(job.target) || !enabled()) throw S3Failure("context_changed")
  database.execSQL("INSERT INTO s3_job(id,header) VALUES(?,?)", arrayOf(job.id, job.payload()))
  index(job)
}
internal fun AndroidS3Journal.state(job: AndroidS3Job): String = text("SELECT state FROM s3_job WHERE id=? AND header=?", arrayOf(job.id, job.payload()))
internal fun AndroidS3Journal.events(job: AndroidS3Job, kind: String): List<JSONObject> {
  state(job)
  return database.rawQuery("SELECT payload FROM s3_event WHERE job=? AND kind=? ORDER BY sequence", arrayOf(job.id, kind)).use { row ->
    val result = mutableListOf<JSONObject>()
    while (row.moveToNext()) {
      if (result.size >= 10000) throw S3Failure("storage_failure")
      result.add(JSONObject(row.getString(0)))
    }
    result
  }
}
// Persist ACK history even after authority changes; new I/O and Completed require fresh authority.
internal fun AndroidS3Journal.record(job: AndroidS3Job, from: String, to: String, payload: JSONObject = JSONObject(), current: () -> Boolean) {
  val allowed = mapOf("prepared" to listOf("creating"), "creating" to listOf("created"), "created" to listOf("part-intent", "aborting"),
    "part-intent" to listOf("part-ack"), "part-ack" to listOf("part-intent", "completing", "aborting"),
    "completing" to listOf("complete-ack"), "complete-ack" to listOf("completed"), "aborting" to listOf("aborted"))
  if (to !in (allowed[from] ?: emptyList()) && !(to == "review" && from !in listOf("completed", "aborted", "review"))) throw S3Failure("outcome_unknown")
  val data = payload.toString()
  if (data.toByteArray(Charsets.UTF_8).size > 65536) throw S3Failure("invalid_request")
  transaction {
    if (state(job) != from) throw S3Failure("binding_changed")
    if (to in listOf("creating", "part-intent", "completing", "completed", "aborting") &&
      (context() != job.context || !profileCurrent(job.target) || !enabled() || !current())) throw S3Failure("context_changed")
    if (to == "completed" && (payload.opt("sha256") != job.sha256 || payload.opt("size") != job.size.toString())) throw S3Failure("outcome_unknown")
    database.execSQL("UPDATE s3_job SET state=? WHERE id=? AND state=? AND header=?", arrayOf(to, job.id, from, job.payload()))
    if (state(job) != to) throw S3Failure("storage_failure")
    database.execSQL("INSERT INTO s3_event(job,kind,payload) VALUES(?,?,?)", arrayOf(job.id, to, data))
  }
}
internal fun AndroidS3Journal.bindSources(binding: String): String {
  if (!Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(binding)) throw S3Failure("invalid_request")
  return transaction {
    database.execSQL("CREATE TABLE IF NOT EXISTS s3_sources(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL)")
    val previous = database.rawQuery("SELECT binding FROM s3_sources WHERE id=1", null).use { if (it.moveToFirst()) it.getString(0) else null }
    if (previous != binding) { invalidate(); database.execSQL("INSERT OR REPLACE INTO s3_sources VALUES(1,?)", arrayOf(binding)) }
    context()
  }
}
internal fun AndroidS3Journal.recoverInterrupted() = transaction {
  invalidate(); database.execSQL("UPDATE s3_job SET state='review' WHERE state NOT IN('completed','review','aborted')")
}
