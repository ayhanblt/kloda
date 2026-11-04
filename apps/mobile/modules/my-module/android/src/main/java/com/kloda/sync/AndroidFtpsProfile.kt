package com.kloda.sync

import org.json.JSONObject
import java.util.UUID

// Separate FTPS custody; immutable receipt generations never contain the password.
internal data class AndroidFtpsProfile(val target: FtpsTarget, val password: String) {
  override fun toString(): String = "AndroidFtpsProfile(target=$target, password=<redacted>)"
  fun validate() {
    target.validate()
    val fields = listOf(target.address, target.hostname, target.root, target.username, password)
    if (password.isEmpty() || target.address.isEmpty() || target.hostname.isEmpty() || target.username.isEmpty() ||
      target.port !in 1..65535 || fields.any { it.contains('\u0000') || it.toByteArray().size > 4096 } ||
      listOf(target.profileGeneration, target.credentialGeneration).any {
        runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false).not()
      }) throw FtpsFailure("invalid_request")
  }
  fun encode(): ByteArray {
    validate()
    return JSONObject().put("version", 1).put("target", target.json()).put("password", password)
      .toString().toByteArray(Charsets.UTF_8)
  }
  companion object {
    fun decode(bytes: ByteArray): AndroidFtpsProfile {
      try {
        val json = JSONObject(String(bytes, Charsets.UTF_8))
        if (json.keys().asSequence().toSet() != setOf("version", "target", "password") ||
          json.opt("version") != 1 || json.opt("password") !is String) throw FtpsFailure("storage_failure")
        val t = json.getJSONObject("target")
        val strings = setOf("address", "hostname", "root", "username", "profileGeneration", "credentialGeneration")
        if (t.keys().asSequence().toSet() != strings + "port" || strings.any { t.opt(it) !is String } ||
          t.opt("port") !is Int) throw FtpsFailure("storage_failure")
        return AndroidFtpsProfile(FtpsTarget(t.getString("address"), t.getInt("port"), t.getString("hostname"),
          t.getString("root"), t.getString("username"),
          t.getString("profileGeneration"), t.getString("credentialGeneration")), json.getString("password")).also { it.validate() }
      } catch (_: Exception) { throw FtpsFailure("storage_failure") }
    }
  }
}
