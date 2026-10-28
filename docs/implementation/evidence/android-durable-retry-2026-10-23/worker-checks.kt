package com.kloda.sync

internal class FilesFailure(val code: String): RuntimeException(code)
internal class AndroidSyncJournal {
  val interrupted = mutableListOf<String>()
  fun interrupt(record: String, code: String) { check(record == "same-peer"); interrupted.add(code) }
}
// Journal test double: production SQLite storage is checked separately; this exercises the unmodified worker.
internal class AndroidFilesRunJournal {
  var result: FilesRun? = null
  var wait = false
  var waitFailure = false
  val starts = mutableListOf<Int>()
  fun waiting(run: FilesRun): Boolean {
    if (waitFailure && run.retryAt != null) throw IllegalStateException("injected wait failure")
    return wait && run.retryAt != null
  }
  fun startAttempt(run: FilesRun): FilesRun = run.copy(attempts = run.attempts + if (run.retryAt != null) 1 else 0,
    state = "running", retryAt = null).also { check(it.attempts <= 5); starts.add(it.attempts) }
  fun finish(run: FilesRun, state: String, code: String?) { result = run.copy(state = state, retryAt = if (state == "paused") run.retryAt else null) }
  fun failure(run: FilesRun, code: String, now: Long): FilesRun =
    run.failed(code, now, 1000, 7).also { result = it }
}

fun main() {
  val initial = FilesRun("same-run", "same-peer", null, 1, "running", null, null)
  val failed = initial.failed("connection_closed", 1000, 5000, 7)
  check(failed.retryAt == 61000L && failed.retryElapsed == 65000L)
  check(failed.waiting(64999, 7) && !failed.waiting(65000, 7))
  check(failed.waiting(100000, 8))
  check(failed.view(false)["state"] == "paused")
  check(initial.copy(attempts = 5).failed("connection_closed", 1000, 5000, 7).retryAt == null)
  check(initial.failed("connection_closed", 1000, 5000, null).error == "retry_clock_unavailable")
  for (code in listOf("owner_deleted", "revoked", "denied", "source_changed", "outcome_unknown", "tls_rejected", "conflict")) {
    check(initial.failed(code, 1000, 5000, 7).retryAt == null)
  }
  println("PASS actual retry policy: monotonic wait, five attempts, absent boot, nonretryable states, paused view")
  for (case in listOf("five", "pause", "success", "early", "attention", "waitFailure")) {
    val runs = AndroidFilesRunJournal()
    val journal = AndroidSyncJournal()
    var error: String? = null
    var stopped = false
    var calls = 0
    var checks = 0
    runs.wait = case == "pause"
    runs.waitFailure = case == "waitFailure"
    AndroidFilesRunWorker(runs, journal, {
      checks++
      if (case == "pause" && checks >= 4) throw FilesFailure("paused")
    }, { (it as? FilesFailure)?.code ?: "queue_unavailable" }, { error = it }, { error }, { stopped = true }) {
      calls++
      when (case) {
        "five", "pause", "waitFailure" -> throw FilesFailure("connection_closed")
        "early" -> throw FilesFailure("revoked")
        "attention" -> error = "denied"
      }
    }.execute(FilesRun("same-run", "same-peer", null, 1, "running", null, null))
    check(stopped)
    when (case) {
      "five" -> { check(calls == 5); check(runs.starts == listOf(1,2,3,4,5)); check(runs.result?.state == "failed") }
      "pause" -> { check(calls == 1); check(runs.result?.state == "paused"); check(runs.result?.retryAt != null) }
      "success" -> { check(calls == 1); check(runs.result?.state == "finished") }
      "early" -> { check(calls == 1); check(runs.result?.state == "failed") }
      "waitFailure" -> { check(calls == 1); check(runs.result?.state == "failed"); check(runs.result?.retryAt == null) }
      "attention" -> { check(calls == 1); check(runs.result?.state == "needs_attention") }
    }
    println("PASS worker unit: " + case)
  }
}
