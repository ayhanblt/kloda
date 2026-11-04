package com.kloda.sync

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import java.util.UUID

internal data class FtpsRun(val id: String, val target: String, val binding: String, val automatic: Boolean,
  val occurrence: Long, val phase: String = "running", val attempts: Int = 1, val osAttempts: Int = 1,
  val error: String? = null, val retryAt: Long? = null, val retryElapsed: Long? = null, val boot: String? = null) {
  data class Clock(val now: Long, val elapsed: Long, val boot: String?)
  fun validate() {
    if (runCatching { UUID.fromString(id).toString() != id }.getOrDefault(true) || occurrence < 0 ||
      !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(target) || binding.isEmpty() || binding.toByteArray().size > 4096 || binding.contains('\u0000') ||
      phase !in setOf("running", "waiting", "paused", "finished", "needs_attention", "exhausted") || attempts !in 1..5 || osAttempts !in 1..5 ||
      (error != null && (error.isEmpty() || error.toByteArray().size > 128 || error.contains('\u0000')))) throw FilesFailure("outcome_unknown")
    if (phase == "waiting") {
      if (retryAt == null || retryElapsed == null || boot.isNullOrEmpty() || retryAt < 0 || retryElapsed < 0 || boot.length > 255 ||
        boot.contains('\u0000') || delay(error) == null) throw FilesFailure("outcome_unknown")
    } else if (retryAt != null || retryElapsed != null || boot != null) throw FilesFailure("outcome_unknown")
  }
  fun failed(code: String, clock: Clock): FtpsRun {
    if (phase !in setOf("running", "waiting") || clock.now < 0 || clock.elapsed < 0) throw FilesFailure("outcome_unknown")
    val next = copy(error = code, retryAt = null, retryElapsed = null, boot = null)
    if (code in setOf("cancelled", "settings_changed", "user_pause", "target_pause")) return next.copy(phase = "paused")
    val delay = delay(code) ?: return next.copy(phase = "needs_attention")
    if ((if (code == "lan_unavailable") attempts else osAttempts) >= 5) return next.copy(phase = "exhausted")
    if (clock.boot == null) return next.copy(phase = "exhausted", error = "retry_clock_unavailable")
    return try { next.copy(phase = "waiting", retryAt = Math.addExact(clock.now, delay),
      retryElapsed = Math.addExact(clock.elapsed, delay), boot = clock.boot).also { it.validate() } }
    catch (_: ArithmeticException) { throw FilesFailure("retry_clock_unavailable") }
  }
  fun retried(clock: Clock): FtpsRun? {
    validate()
    if (phase != "waiting") return null
    val delay = delay(error)!!
    if (boot != clock.boot || clock.elapsed < retryElapsed!! - delay) return failed(error!!, clock)
    if (clock.elapsed < retryElapsed) return null
    return copy(phase = "running", attempts = attempts + if (error == "lan_unavailable") 1 else 0,
      osAttempts = osAttempts + if (error == "lan_unavailable") 0 else 1,
      error = null, retryAt = null, retryElapsed = null, boot = null).also { it.validate() }
  }
  fun payload(): String = JSONObject().put("id", id).put("target", target).put("binding", binding).put("automatic", automatic)
    .put("occurrence", occurrence.toString()).put("phase", phase).put("attempts", attempts).put("osAttempts", osAttempts)
    .put("error", error ?: JSONObject.NULL).put("retryAt", retryAt?.toString() ?: JSONObject.NULL)
    .put("retryElapsed", retryElapsed?.toString() ?: JSONObject.NULL).put("boot", boot ?: JSONObject.NULL).toString()
  companion object {
    fun delay(code: String?): Long? = when (code) { "lan_unavailable" -> 60000L; "os_interrupted", "credential_locked" -> 300000L; else -> null }
    fun clock(context: Context): Clock {
      val now = System.currentTimeMillis(); val elapsed = SystemClock.elapsedRealtime()
      if (now < 0 || elapsed < 0) throw FilesFailure("retry_clock_unavailable")
      val boot = runCatching { Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT).takeIf { it >= 0 }?.toString() }.getOrNull()
      return Clock(now, elapsed, boot)
    }
    fun decode(payload: String): FtpsRun {
      if (payload.toByteArray().size > 8192) throw FilesFailure("outcome_unknown")
      val json = JSONObject(payload)
      if (json.keys().asSequence().toSet() != setOf("id", "target", "binding", "automatic", "occurrence", "phase", "attempts", "osAttempts", "error", "retryAt", "retryElapsed", "boot")) throw FilesFailure("outcome_unknown")
      fun text(key: String) = json.get(key) as? String ?: throw FilesFailure("outcome_unknown")
      fun optional(key: String): String? = if (json.isNull(key)) null else text(key)
      fun number(key: String): Long? = optional(key)?.let { value ->
        if (!Regex("0|[1-9][0-9]{0,18}").matches(value)) throw FilesFailure("outcome_unknown")
        value.toLongOrNull() ?: throw FilesFailure("outcome_unknown")
      }
      return FtpsRun(text("id"), text("target"), text("binding"), json.get("automatic") as? Boolean ?: throw FilesFailure("outcome_unknown"),
        number("occurrence") ?: throw FilesFailure("outcome_unknown"), text("phase"), json.getInt("attempts"), json.getInt("osAttempts"),
        optional("error"), number("retryAt"), number("retryElapsed"), optional("boot")).also { it.validate() }
    }
  }
}
