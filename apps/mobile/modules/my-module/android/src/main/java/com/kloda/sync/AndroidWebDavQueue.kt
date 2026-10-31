package com.kloda.sync

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.UUID

// Only native foreground/OS callbacks supply mayRun; JS cannot create an OS lease.
internal class AndroidWebDavQueue(private val context: Context, private val mayRun: (WebDavRun) -> Boolean) {
  private val helper = AndroidSyncJournal.webdav(context)
  private val journal = AndroidWebDavJournal(helper.writableDatabase)
  private val handler = Handler(Looper.getMainLooper())
  private var active: Execution? = null
  private var retryWork: Runnable? = null
  private var lastError: String? = null
  private class Execution(val captured: AndroidWebDavContext, var run: WebDavRun, val finished: ((WebDavRun) -> Unit)?) {
    val token = UUID.randomUUID()
    @Volatile var publisher: AndroidWebDavPublisher? = null
  }
  private fun <T> locked(block: () -> T): T = synchronized(AndroidSyncJournal.sourceLock, block)
  fun configure(requested: AndroidWebDavProfile) {
    requested.validate()
    var ended: Execution? = null
    try {
      locked {
        disableFlags(); ended = detach("settings_changed", null)
        if (ended?.run?.error == "storage_failure") throw FilesFailure("storage_failure")
        val vault = AndroidWebDavVault(context); val old = vault.read()
        val profile = if (old != null && old.copy(revision = requested.revision) == requested) old else requested
        vault.write(profile); journal.setEnabled("webdav", profile.targetId(), true, profile.revision)
      }
    } finally { deliver(ended) }
  }
  private fun disableFlags() {
    helper.writableDatabase.execSQL("UPDATE backup_destination SET enabled=0 WHERE kind='webdav'")
    if (!context.getSharedPreferences("kloda-sync", 0).edit().putString("backupContextRevision", UUID.randomUUID().toString()).commit()) throw FilesFailure("storage_failure")
  }
  fun disable() {
    var ended: Execution? = null
    try { locked { disableFlags(); ended = detach("settings_changed", null) } }
    finally { deliver(ended) }
  }
  private fun detach(code: String, expected: UUID?): Execution? {
    if (expected != null && active?.token != expected) return null
    val value = active; active = null
    retryWork?.let { handler.removeCallbacks(it) }; retryWork = null
    if (value != null) {
      try { value.run = value.run.failed(code, WebDavRun.clock(context)); journal.runs.save(value.run) }
      catch (error: Exception) {
        lastError = "storage_failure"
        value.run = value.run.copy(phase = "needs_attention", error = "storage_failure", retryAt = null, retryElapsed = null, boot = null)
      }
    }
    return value
  }
  private fun deliver(value: Execution?) {
    value?.publisher?.cancel()
    value?.finished?.invoke(value.run)
  }
  fun pause(code: String = "user_pause", expected: UUID? = null) {
    val ended = locked { detach(code, expected) }
    deliver(ended)
    if (ended?.run?.error == "storage_failure") throw FilesFailure("storage_failure")
  }
  fun pauseRun(id: String, code: String) {
    val token = locked { active?.takeIf { it.run.id == id }?.token }
    if (token != null) pause(code, token)
  }
  fun foregroundLost() {
    val token = locked { active?.takeUnless { it.run.automatic }?.token }
    if (token != null) pause("os_interrupted", token)
  }
  fun available() = locked { active == null }
  fun start(automatic: Boolean = false, prior: WebDavRun? = null, finished: ((WebDavRun) -> Unit)? = null): Map<String, Any> {
    val execution = locked {
      if (active != null) throw FilesFailure("backup_busy")
      if (automatic && AndroidBackupScheduler.paused(context)) throw FilesFailure("user_pause")
      val captured = AndroidWebDavContext.capture(context, journal)
      val run = prior ?: WebDavRun(UUID.randomUUID().toString(), captured.profile.targetId(), captured.binding, automatic, WebDavRun.clock(context).now)
      if (run.target != captured.profile.targetId() || run.binding != captured.binding || run.automatic != automatic || run.phase != "running") throw FilesFailure("settings_changed")
      if (!mayRun(run)) throw FilesFailure("candidate_stale")
      journal.runs.save(run)
      Execution(captured, run, finished).also { active = it; lastError = null }
    }
    launch(execution); return status()
  }
  private fun check(execution: Execution) = locked {
    if (active?.token != execution.token || execution.run.phase != "running") throw FilesFailure("cancelled")
    if (!mayRun(execution.run)) throw FilesFailure("os_interrupted")
    if (execution.run.automatic && AndroidBackupScheduler.paused(context)) throw FilesFailure("user_pause")
    execution.captured.check(context, journal)
  }
  private fun launch(execution: Execution) {
    Thread({
      var error: String? = null
      try {
        check(execution)
        val snapshots = AndroidFilesSnapshots(context, true) { check(execution) }
        val publisher = AndroidWebDavPublisher(context, execution.captured.profile, execution.captured.binding, journal, snapshots,
          { check(execution) }, { value -> locked { check(execution); execution.captured.complete(context, journal, value) } },
          { value -> locked { check(execution); journal.runs.track(execution.run, value) } })
        execution.publisher = publisher; check(execution)
        val files = AndroidWebDavFilesRunner(context, publisher); files.run(execution.captured.sources.sources)
        val photos = AndroidWebDavPhotosRunner(context, publisher); photos.run(execution.captured.sources.sources)
        error = photos.errorCode ?: files.errorCode
      } catch (failure: Exception) { error = code(failure) }
      finally { execution.publisher?.cancel(); execution.publisher = null }
      finish(execution, error)
    }, "kloda-webdav-sender").start()
  }
  private fun finish(execution: Execution, error: String?) {
    var deliver = false
    try {
      locked {
        if (active?.token != execution.token) return@locked
        var outcome = error
        if (outcome == null) {
          check(execution)
          val counts = journal.runs.counts(execution.run.id)
          if (counts["operations"] != counts["completedOperations"]) outcome = "review_required"
        }
        execution.run = if (outcome == null) execution.run.copy(phase = "finished", error = null)
          else execution.run.failed(outcome, WebDavRun.clock(context))
        journal.runs.save(execution.run); lastError = execution.run.error
        if (execution.run.phase == "waiting" && !execution.run.automatic && mayRun(execution.run)) arm(execution)
        else { active = null; deliver = true }
      }
    } catch (failure: Exception) {
      locked { if (active?.token == execution.token) { active = null; lastError = "storage_failure" } }
      // Persistence failure must not report success to a native OS caller.
      execution.run = execution.run.copy(phase = "needs_attention", error = "storage_failure", retryAt = null, retryElapsed = null, boot = null)
      deliver = true
    }
    if (deliver) execution.finished?.invoke(execution.run)
  }
  private fun arm(execution: Execution) {
    retryWork?.let { handler.removeCallbacks(it) }
    val delay = maxOf(0, execution.run.retryElapsed!! - WebDavRun.clock(context).elapsed)
    val work = Runnable { retry(execution) }; retryWork = work; handler.postDelayed(work, delay)
  }
  private fun retry(execution: Execution) {
    var deliver = false
    try {
      val ready = locked {
        if (active?.token != execution.token) return@locked false
        if (!mayRun(execution.run)) throw FilesFailure("os_interrupted")
        execution.captured.check(context, journal)
        val next = execution.run.retried(WebDavRun.clock(context))
        if (next == null) { arm(execution); return@locked false }
        execution.run = next; journal.runs.save(next)
        if (next.phase == "waiting") { arm(execution); return@locked false }
        if (next.phase != "running") { active = null; deliver = true; return@locked false }
        true
      }
      if (ready) launch(execution)
      if (deliver) execution.finished?.invoke(execution.run)
    } catch (failure: Exception) { pause(code(failure), execution.token) }
  }
  fun status(): Map<String, Any> = locked {
    val profile = AndroidWebDavVault(context).read()
    buildMap {
      put("running", active?.run?.phase == "running"); put("configured", profile != null); put("enabled", false)
      if (profile != null) {
        val target = profile.targetId(); put("targetId", target)
        put("config", mapOf("endpoint" to profile.endpoint, "targetPath" to profile.targetPath, "username" to profile.username))
        put("enabled", journal.enabled("webdav", target, profile.revision))
        journal.runs.read(target = target)?.let { run ->
          val state = if (active?.run?.id != run.id && (run.phase == "running" || (!run.automatic && run.phase == "waiting"))) "paused" else run.phase
          put("run", buildMap<String, Any> {
            put("id", run.id); put("targetId", run.target); put("automatic", run.automatic); put("state", state)
            put("attempts", run.attempts); put("osAttempts", run.osAttempts); put("counts", journal.runs.counts(run.id))
            run.error?.let { put("errorCode", it) }
            if (state == "waiting") run.retryAt?.let { put("retryAt", it.toString()) }
          })
        }
      }
      lastError?.let { put("errorCode", it) }
    }
  }
  private fun code(error: Exception): String = when {
    error is FilesFailure -> error.code
    error is SecurityException -> "source_permission_lost"
    isLocalStorageFull(error) -> "local_storage_full"
    error is android.database.sqlite.SQLiteException -> "storage_failure"
    else -> "queue_unavailable"
  }
}
