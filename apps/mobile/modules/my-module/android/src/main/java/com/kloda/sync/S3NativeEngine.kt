package com.kloda.sync

import org.json.JSONObject

// Native-only bearer output. Never return these objects through the Expo/JS API.
internal object S3NativeEngine {
  private val available = if (BuildConfig.KLODA_S3_NATIVE) runCatching { System.loadLibrary("kloda_s3_native"); true }.getOrDefault(false) else false
  @JvmStatic private external fun process(kind: Int, input: ByteArray): ByteArray?
  private fun invoke(kind: Int, json: JSONObject): JSONObject {
    if (!available) throw S3Failure("native_unavailable")
    val input = json.toString().toByteArray(Charsets.UTF_8)
    val output = try { process(kind, input) ?: throw S3Failure("invalid_request") } finally { input.fill(0) }
    return try { JSONObject(String(output, Charsets.UTF_8)) } finally { output.fill(0) }
  }
  fun prepare(profile: AndroidS3Profile, key: String, operation: JSONObject): JSONObject = invoke(0, JSONObject()
    .put("provider", profile.target.provider).put("endpoint", profile.target.endpoint).put("region", profile.target.region)
    .put("bucket", profile.target.bucket).put("prefix", profile.target.prefix).put("path_style", profile.target.pathStyle)
    .put("access_key", profile.accessKey).put("secret", profile.secret).put("token", profile.token ?: JSONObject.NULL)
    .put("key", key).put("operation", operation))
  fun reply(kind: Int, status: Int, body: String, target: S3Target, key: String): JSONObject = invoke(kind, JSONObject()
    .put("status", status).put("body", body).put("bucket", target.bucket).put("key", if (target.prefix.isEmpty()) key else "${target.prefix}/$key"))
}
