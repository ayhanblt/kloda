package com.kloda.sync

internal class AndroidFilesRunWorker(private val runs: AndroidFilesRunJournal,
  private val journal: AndroidSyncJournal, private val checkPaused: () -> Unit,
  private val failureCode: (Throwable) -> String, private val reportError: (String?) -> Unit,
  private val currentError: () -> String?, private val stopped: () -> Unit,
  private val run: (FilesRun) -> Unit) {
  fun execute(initial: FilesRun) {
    var retained = initial
    try {
      while (true) {
        checkPaused()
        while (runs.waiting(retained)) {
          checkPaused()
          Thread.sleep(200)
        }
        checkPaused()
        retained = runs.startAttempt(retained)
        reportError(null)
        try {
          run(retained)
          synchronized(AndroidSyncJournal.sourceLock) {
            checkPaused()
            runs.finish(retained, if (currentError() == null) "finished" else "needs_attention", currentError())
          }
          return
        } catch (error: Throwable) {
          val code = failureCode(error)
          reportError(code)
          journal.interrupt(retained.record, code)
          if (code == "paused") throw error
          retained = runs.failure(retained, code, System.currentTimeMillis())
          if (retained.retryAt == null) return
        }
      }
    } catch (error: Throwable) {
      val code = failureCode(error)
      reportError(code)
      runCatching { runs.finish(retained, if (code == "paused") "paused" else "failed", code) }
    } finally {
      stopped()
      runCatching { journal.interrupt(retained.record, currentError() ?: "paused") }
    }
  }

}
