package com.kloda.sync

internal data class ScheduledOccurrence(
  val id: String, val binding: String, val record: String, val occurrenceMs: Long,
  val osAttempts: Int = 1, val updated: Int = 0, val phase: String = "running",
  val retryAt: Long? = null, val retryElapsed: Long? = null, val retryBoot: Int? = null,
  val runId: String? = null, val error: String? = null
) {
  companion object { const val RETRY_MS = 300_000L }

  // Wall time is a display/dispatch hint; same-boot monotonic time controls retry eligibility.
  fun due(elapsed: Long, boot: Int?): Boolean = phase == "waiting" &&
    boot != null && retryBoot == boot && retryAt != null && retryElapsed != null &&
    elapsed >= retryElapsed

  fun stopped(wall: Long, elapsed: Long, boot: Int?, userPause: Boolean, code: String?): ScheduledOccurrence {
    if (phase != "running") return this
    if (userPause) return copy(phase = "paused", error = code ?: "paused")
    if (osAttempts >= 5 || boot == null) return copy(phase = "exhausted",
      error = if (boot == null) "retry_clock_unavailable" else code ?: "os_interrupted")
    return waiting(wall, elapsed, boot, code ?: "os_interrupted")
  }

  fun waiting(wall: Long, elapsed: Long, boot: Int, code: String?): ScheduledOccurrence = copy(
    phase = "waiting", retryAt = Math.addExact(wall, RETRY_MS),
    retryElapsed = Math.addExact(elapsed, RETRY_MS), retryBoot = boot, error = code)

  fun claimed(): ScheduledOccurrence = copy(osAttempts = osAttempts + 1, phase = "running",
    retryAt = null, retryElapsed = null, retryBoot = null, error = null)
}
