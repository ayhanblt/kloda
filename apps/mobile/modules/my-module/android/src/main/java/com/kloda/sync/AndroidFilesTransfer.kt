package com.kloda.sync

import org.json.JSONObject

internal data class FilesAck(val id: String, val offset: Long, val state: String)

internal class AndroidFilesTransfer(private val send: (String, Int) -> String) {
  companion object {
    val codes = setOf("invalid_qr", "unsupported_version", "lan_unavailable", "native_unsupported", "identity_unavailable",
      "continuity_lost", "tls_rejected", "proof_rejected", "invitation_expired", "candidate_stale", "already_paired",
      "storage_failure", "connection_closed", "outcome_unknown", "cancelled", "revoked", "denied", "invalid_request",
      "not_found", "conflict", "hash_mismatch", "acl_busy", "acl_unavailable", "backup_unavailable", "backup_full",
      "backup_busy", "backup_permission_denied", "backup_path_rejected", "backup_scope_changed")

    private fun number(value: JSONObject, key: String): Long {
      val raw = value.get(key)
      if (raw !is Int && raw !is Long) throw FilesFailure("outcome_unknown")
      return (raw as Number).toLong().also { if (it < 0) throw FilesFailure("outcome_unknown") }
    }

    fun parse(raw: String, job: FilesJob): FilesAck {
      if (raw.length > 8192) throw FilesFailure("outcome_unknown")
      try {
        val value = JSONObject(raw)
        if (value.keys().asSequence().any { it !in setOf("status", "operation", "errorCode") }) throw FilesFailure("outcome_unknown")
        val status = number(value, "status")
        if (status != 0L && status !in 100..599) throw FilesFailure("outcome_unknown")
        if (value.has("errorCode")) {
          val code = value.getString("errorCode")
          if (code !in codes || status in 1..399 || value.has("operation")) throw FilesFailure("outcome_unknown")
          throw FilesFailure(code)
        }
        if (status != 200L) throw FilesFailure("outcome_unknown")
        val operation = value.getJSONObject("operation")
        val fields = setOf("id", "requestId", "sourceId", "sourceRevision", "name", "sha256", "size", "offset", "state")
        if (operation.keys().asSequence().toSet() != fields || operation.getString("requestId") != job.id ||
          operation.getString("sourceId") != job.wireSourceId || operation.getString("sourceRevision") != job.sha256 ||
          operation.getString("name") != job.name || operation.getString("sha256") != job.sha256 || number(operation, "size") != job.size) {
          throw FilesFailure("outcome_unknown")
        }
        val id = operation.getString("id")
        if (id.length != 22 || id.any { !(it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it == '-' || it == '_') } ||
          job.operationId != null && job.operationId != id) throw FilesFailure("outcome_unknown")
        val offset = number(operation, "offset")
        val state = operation.getString("state")
        if (offset !in job.offset..job.size || state !in setOf("receiving", "validating", "publishing", "completed") ||
          state != "receiving" && offset != job.size) throw FilesFailure("outcome_unknown")
        return FilesAck(id, offset, state)
      } catch (error: FilesFailure) { throw error }
      catch (_: Exception) { throw FilesFailure("outcome_unknown") }
    }
  }

  fun create(job: FilesJob): FilesAck = request(JSONObject().put("kind", "create").put("upload", JSONObject()
    .put("requestId", job.id).put("sourceId", job.wireSourceId).put("sourceRevision", job.sha256)
    .put("name", job.name).put("sha256", job.sha256).put("size", job.size)), job)

  fun status(job: FilesJob): FilesAck = request(JSONObject().put("kind", "status").put("id", job.operationId), job)

  fun chunk(job: FilesJob, descriptor: Int): FilesAck {
    val length = minOf(65536L, job.size - job.offset)
    val ack = request(JSONObject().put("kind", "chunk").put("id", job.operationId)
      .put("offset", job.offset).put("length", length), job, descriptor)
    if (ack.offset != job.offset + length) throw FilesFailure("outcome_unknown")
    return ack
  }

  fun finalize(job: FilesJob): FilesAck = request(JSONObject().put("kind", "finalize").put("id", job.operationId), job)

  private fun request(command: JSONObject, job: FilesJob, descriptor: Int = -1): FilesAck =
    parse(send(command.toString(), descriptor), job)
}
