package com.kloda.sync

import org.json.JSONObject
import java.util.UUID

// Separate SMB custody; immutable receipt generations never contain the password.
internal data class AndroidSmbProfile(val target: SmbTarget, val password: String) {
  override fun toString(): String = "AndroidSmbProfile(target=$target, password=<redacted>)"
  fun validate() {
    val fields = listOf(target.address, target.share, target.root, target.username, target.domain, password)
    if (target.address.isEmpty() || target.share.isEmpty() || target.username.isEmpty() ||
      target.port !in 1..65535 || fields.any { it.contains('\u0000') || it.toByteArray().size > 4096 } ||
      listOf(target.profileGeneration, target.credentialGeneration).any {
        runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false).not()
      }) throw SmbFailure("invalid_request")
  }
  fun encode(): ByteArray {
    validate()
    return JSONObject().put("version", 1).put("target", target.json()).put("password", password)
      .toString().toByteArray(Charsets.UTF_8)
  }
  companion object {
    fun decode(bytes: ByteArray): AndroidSmbProfile {
      try {
        val json = JSONObject(String(bytes, Charsets.UTF_8))
        if (json.keys().asSequence().toSet() != setOf("version", "target", "password") ||
          json.opt("version") != 1 || json.opt("password") !is String) throw SmbFailure("storage_failure")
        val t = json.getJSONObject("target")
        val strings = setOf("address", "share", "root", "username", "domain", "profileGeneration", "credentialGeneration")
        if (t.keys().asSequence().toSet() != strings + "port" || strings.any { t.opt(it) !is String } ||
          t.opt("port") !is Int) throw SmbFailure("storage_failure")
        return AndroidSmbProfile(SmbTarget(t.getString("address"), t.getInt("port"), t.getString("share"),
          t.getString("root"), t.getString("username"), t.getString("domain"),
          t.getString("profileGeneration"), t.getString("credentialGeneration")), json.getString("password")).also { it.validate() }
      } catch (_: Exception) { throw SmbFailure("storage_failure") }
    }
  }
}
