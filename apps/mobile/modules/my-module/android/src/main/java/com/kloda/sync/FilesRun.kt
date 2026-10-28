package com.kloda.sync

internal data class FilesRun(val id: String, val record: String, val rebackup: String?, val attempts: Int,
  val state: String, val retryAt: Long?, val error: String?, val retryElapsed: Long? = null, val retryBoot: Int? = null,
  val context: String? = null) {
  fun visibleFor(binding: String): Boolean = context == binding || error == "settings_changed"

  fun view(running: Boolean): Map<String, Any> = buildMap {
    put("id", id); put("recordId", record); put("attempts", attempts)
    put("state", if (!running && state in setOf("running", "retry_wait")) "paused" else state)
    retryAt?.let { put("retryAt", it.toString()) }
    error?.let { put("errorCode", it) }
  }


  fun waiting(elapsed: Long, boot: Int?): Boolean = retryAt != null &&
    (retryBoot != boot || retryElapsed == null || elapsed < retryElapsed)

  fun failed(code: String, wall: Long, elapsed: Long, boot: Int?): FilesRun {
    val accessFailure = code in setOf("lan_unavailable", "connection_closed")
    val retry = accessFailure && attempts < 5 && boot != null
    val cause = if (accessFailure && attempts < 5 && boot == null) "retry_clock_unavailable" else code
    return copy(state = if (retry) "retry_wait" else "failed", error = cause,
      retryAt = if (retry) Math.addExact(wall, 60_000L) else null,
      retryElapsed = if (retry) Math.addExact(elapsed, 60_000L) else null, retryBoot = if (retry) boot else null)
  }
}
