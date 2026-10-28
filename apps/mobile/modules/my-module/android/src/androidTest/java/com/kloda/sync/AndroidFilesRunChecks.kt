package com.kloda.sync

import android.content.Context

internal object AndroidFilesRunChecks {
  fun run(context: Context) {
    val record = "AAAAAAAAAAAAAAAAAAAAAA"
    val journal = AndroidSyncJournal(context)
    val runs = AndroidFilesRunJournal(journal, context)
    var run = runs.begin(record, null, FilesRunContext.capture(context).binding)
    check(run.attempts == 1)
    // An observed failure sets the wait; reopening and pausing cannot erase it.
    run = runs.failure(run, "connection_closed", 1000)
    check(run.retryAt == 61000L && run.state == "retry_wait")
    runs.finish(run, "paused", "paused")
    journal.close()
    AndroidSyncJournal(context).use { reopened ->
      val retained = AndroidFilesRunJournal(reopened, context)
      run = retained.begin(record, null, FilesRunContext.capture(context).binding)
      check(run.attempts == 1 && run.retryAt == 61000L && run.state == "paused")
      check(runCatching { retained.startAttempt(run) }.exceptionOrNull() is FilesFailure)
      for (attempt in 2..5) {
        run = retained.startAttempt(run.copy(retryElapsed = 0))
        check(run.attempts == attempt && run.retryAt == null)
        run = retained.failure(run, "lan_unavailable", 61000L * (attempt - 1))
      }
      check(run.state == "failed" && run.retryAt == null && run.attempts == 5)
      val explicit = retained.begin(record, null, FilesRunContext.capture(context).binding)
      check(explicit.id != run.id && explicit.attempts == 1)
      for (code in listOf("owner_deleted", "revoked", "denied", "source_changed", "outcome_unknown", "tls_rejected")) {
        val failure = retained.failure(explicit, code, 1000)
        check(failure.state == "failed" && failure.retryAt == null)
      }
      val waiting = retained.failure(retained.begin(record, null, FilesRunContext.capture(context).binding), "connection_closed", 1000)
      retained.finish(waiting, "failed", "queue_unavailable")
      check(retained.latest(record)?.retryAt == null)
      check(retained.latest("BBBBBBBBBBBBBBBBBBBBBB") == null)
      val contextA = FilesRunContext.capture(context).binding
      val old = retained.begin(record, null, contextA)
      retained.finish(old, "paused", "paused")
      val changed = retained.begin(record, null, "b".repeat(64))
      check(changed.id != old.id && changed.attempts == 1)
      reopened.readableDatabase.rawQuery("SELECT state,error_code FROM files_run WHERE id=?", arrayOf(old.id)).use {
        check(it.moveToFirst() && it.getString(0) == "failed" && it.getString(1) == "settings_changed")
      }
      // A late completion/pause cannot resurrect the stale run, and binding is immutable.
      retained.finish(old, "finished")
      retained.finish(old, "paused", "paused")
      check(runCatching { reopened.writableDatabase.execSQL("UPDATE files_run SET context_binding=? WHERE id=?",
        arrayOf(contextA, changed.id)) }.isFailure)
      retained.begin("BBBBBBBBBBBBBBBBBBBBBB", null, "b".repeat(64))
      check(retained.latest(record)?.error == "settings_changed")
    }
  }
}
