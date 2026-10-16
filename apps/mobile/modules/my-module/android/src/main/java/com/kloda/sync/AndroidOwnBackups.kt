package com.kloda.sync

import android.util.Base64
import org.json.JSONObject

internal data class OwnBackup(val id: String, val name: String, val sha256: String, val size: Long) {
  fun publicValue(): Map<String, String> = mapOf("id" to id, "name" to name, "sha256" to sha256, "size" to size.toString())
}

internal object AndroidOwnBackups {
  private val fields = setOf("id", "requestId", "sourceId", "sourceRevision", "name", "sha256", "size", "offset", "state")
  private val referencePattern = Regex("[A-Za-z0-9_-]+")
  private fun text(value: JSONObject, key: String): String =
    value.get(key) as? String ?: throw FilesFailure("outcome_unknown")
  fun number(value: JSONObject, key: String): Long {
    val raw = value.get(key)
    if (raw !is Int && raw !is Long) throw FilesFailure("outcome_unknown")
    return (raw as Number).toLong().also { if (it < 0) throw FilesFailure("outcome_unknown") }
  }
  private fun fixed(value: String, bytes: Int) {
    val flags = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
    if (!referencePattern.matches(value)) throw FilesFailure("outcome_unknown")
    val decoded = Base64.decode(value, flags)
    if (decoded.size != bytes || Base64.encodeToString(decoded, flags) != value) throw FilesFailure("outcome_unknown")
  }
  fun operation(value: JSONObject): OwnBackup {
    if (value.keys().asSequence().toSet() != fields) throw FilesFailure("outcome_unknown")
    val id = text(value, "id")
    fixed(id, 16); fixed(text(value, "requestId"), 16); fixed(text(value, "sourceId"), 16)
    val name = text(value, "name")
    val revision = text(value, "sourceRevision")
    val sha256 = text(value, "sha256")
    fixed(sha256, 32)
    val size = number(value, "size")
    if (name.isEmpty() || name.length > 255 || name == "." || name == ".." || name.any { it == '/' || it == '\\' || it.code < 32 || it.code == 127 } ||
      revision.isEmpty() || revision.length > 1024 || text(value, "state") != "completed" || number(value, "offset") != size) {
      throw FilesFailure("outcome_unknown")
    }
    return OwnBackup(id, name, sha256, size)
  }
  fun response(raw: String, expected: Set<String>, limit: Int = 8192): JSONObject {
    try {
      if (raw.length > limit) throw FilesFailure("outcome_unknown")
      val value = JSONObject(raw)
      val status = number(value, "status")
      if (value.has("errorCode")) {
        val code = text(value, "errorCode")
        if (value.keys().asSequence().toSet() != setOf("status", "errorCode") ||
          code !in AndroidFilesTransfer.codes || status != 0L && status !in 400..599) throw FilesFailure("outcome_unknown")
        throw FilesFailure(code)
      }
      if (status != 200L || value.keys().asSequence().toSet() != expected + "status") throw FilesFailure("outcome_unknown")
      return value
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("outcome_unknown") }
  }
  fun list(raw: String, after: String?): Map<String, Any> {
    val photos = response(raw, setOf("photos"), 262144).getJSONArray("photos")
    if (photos.length() > 32) throw FilesFailure("outcome_unknown")
    var previous = after
    val items = List(photos.length()) { index ->
      val backup = operation(photos.getJSONObject(index))
      if (previous != null && previous!! >= backup.id) throw FilesFailure("outcome_unknown")
      previous = backup.id
      backup.publicValue()
    }
    return mapOf("items" to items, "hasMore" to (items.size == 32))
  }
  fun status(raw: String, id: String): OwnBackup = operation(response(raw, setOf("operation")).getJSONObject("operation"))
    .also { if (it.id != id) throw FilesFailure("outcome_unknown") }
  fun chunk(raw: String, offset: Long, size: Long): Long {
    val value = try { response(raw, setOf("bytes", "offset", "size")) }
    catch (failure: FilesFailure) {
      if (failure.code == "backup_full" && JSONObject(raw).optInt("status", -1) == 0) throw FilesFailure("local_storage_full")
      throw failure
    }
    val bytes = number(value, "bytes")
    if (number(value, "offset") != offset || number(value, "size") != size || offset > size ||
      bytes != minOf(65536L, size - offset)) throw FilesFailure("outcome_unknown")
    return bytes
  }
}
