package com.kloda.sync

import org.json.JSONObject
import java.util.UUID

internal class S3Failure(val code: String, val jobId: String? = null) : Exception(code)
// Access-key identity is kept distinct from an inferred AWS account ID.
internal data class S3Target(val provider: String, val endpoint: String, val region: String, val bucket: String,
  val prefix: String, val pathStyle: Boolean, val accountBinding: String,
  val profileGeneration: String, val credentialGeneration: String) {
  fun validate() {
    if (provider !in setOf("amazon-s3", "s3-compatible") || listOf(profileGeneration, credentialGeneration).any {
        runCatching { UUID.fromString(it).toString() != it }.getOrDefault(true)
      } || listOf(endpoint, region, bucket, prefix, accountBinding).any { it.toByteArray().size > 4096 || it.any(Char::isISOControl) } ||
      accountBinding.length != 43) throw S3Failure("invalid_request")
  }
  fun json() = JSONObject().put("provider", provider).put("endpoint", endpoint).put("region", region).put("bucket", bucket)
    .put("prefix", prefix).put("pathStyle", pathStyle).put("accountBinding", accountBinding)
    .put("profileGeneration", profileGeneration).put("credentialGeneration", credentialGeneration)
  fun archiveId(): String = hash(org.json.JSONArray().put(provider).put(endpoint).put(region).put(bucket).put(prefix).put(pathStyle).put(accountBinding).toString())
  companion object {
    fun hash(value: String): String = android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)),
      android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
    fun decode(json: JSONObject): S3Target {
      val keys = setOf("provider", "endpoint", "region", "bucket", "prefix", "pathStyle", "accountBinding", "profileGeneration", "credentialGeneration")
      if (json.keys().asSequence().toSet() != keys || json.opt("pathStyle") !is Boolean || (keys - "pathStyle").any { json.opt(it) !is String }) throw S3Failure("storage_failure")
      return S3Target(json.getString("provider"), json.getString("endpoint"), json.getString("region"), json.getString("bucket"), json.getString("prefix"),
        json.getBoolean("pathStyle"), json.getString("accountBinding"), json.getString("profileGeneration"), json.getString("credentialGeneration")).also { it.validate() }
    }
  }
}
internal data class AndroidS3Profile(val target: S3Target, val accessKey: String, val secret: String, val token: String?) {
  override fun toString() = "AndroidS3Profile(provider=${target.provider}, credentials=<redacted>)"
  fun validate() {
    target.validate()
    if (accessKey.isEmpty() || secret.isEmpty() || listOf(accessKey, secret, token ?: "").any { it.toByteArray().size > 4096 || it.any(Char::isISOControl) } ||
      S3Target.hash(accessKey) != target.accountBinding || token?.isEmpty() == true) throw S3Failure("invalid_request")
    S3NativeEngine.prepare(this, "validation", JSONObject().put("kind", "head"))
  }
  fun encode(): ByteArray = JSONObject().put("version", 1).put("target", target.json()).put("accessKey", accessKey)
    .put("secret", secret).put("token", token ?: JSONObject.NULL).toString().toByteArray(Charsets.UTF_8)
  companion object {
    fun decode(bytes: ByteArray): AndroidS3Profile {
      try {
        val json = JSONObject(String(bytes, Charsets.UTF_8))
        if (json.keys().asSequence().toSet() != setOf("version", "target", "accessKey", "secret", "token") || json.opt("version") != 1 ||
          json.opt("accessKey") !is String || json.opt("secret") !is String || (!json.isNull("token") && json.opt("token") !is String)) throw S3Failure("storage_failure")
        return AndroidS3Profile(S3Target.decode(json.getJSONObject("target")), json.getString("accessKey"), json.getString("secret"),
          if (json.isNull("token")) null else json.getString("token")).also { it.validate() }
      } catch (_: Exception) { throw S3Failure("storage_failure") }
    }
  }
}
