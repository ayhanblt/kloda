package com.kloda.sync

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.UUID

internal class AndroidSmbQueue(private val app: Context, val journal: AndroidSmbJournal,
  private val mayRun: (SmbRun) -> Boolean) {
  val lan = AndroidSmbLan(app)
  val profiles = AndroidSmbProfiles(app, journal)
  val runs = AndroidSmbRuns(journal)
  val schedule = AndroidSmbSchedule(journal.database)
  private val handler = Handler(Looper.getMainLooper())
  private var foregroundWork: UUID? = null
  @Volatile private var interruptible: Execution? = null
  private var active: Execution? = null
    set(value) { field = value; interruptible = value }
  private var retryWork: Runnable? = null
  private class Execution(val captured: SmbProfileCapture, val sources: AndroidSmbSources,
    var run: SmbRun, val finished: ((SmbRun) -> Unit)?) { val token = UUID.randomUUID(); @Volatile var cancelled = false }
  init {
    // User decision31.10: SMB opt-in stays beside its native profile/job generation fence.
    journal.database.execSQL("CREATE TABLE IF NOT EXISTS smb_enabled(id INTEGER PRIMARY KEY CHECK(id=1),profile TEXT NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)))")
    AndroidSmbCopyRequests(journal)
    journal.recoverInterrupted()
  }
  private fun <T> locked(block: () -> T): T = synchronized(AndroidSyncJournal.sourceLock, block)
  fun enabled(profile: AndroidSmbProfile): Boolean = journal.database.rawQuery("SELECT 1 FROM smb_enabled WHERE id=1 AND profile=? AND enabled=1", arrayOf(profile.target.json().toString())).use { it.moveToFirst() }
  data class Header(val target: String, val revision: String)
  fun destination(): Header? = locked {
    AndroidSmbSources.capture(app, journal)
    profiles.capture()?.takeIf { enabled(it.profile) }?.let { Header(it.profile.target.archiveId(), it.context) }
  }
  fun pauseRun(id: String, code: String) { val token = locked { active?.takeIf { it.run.id == id }?.token }; if (token != null) pause(code, token) }
  fun configure(target: SmbTarget, password: String) {
    pause("settings_changed")
    locked {
      journal.database.execSQL("UPDATE smb_enabled SET enabled=0")
      val profile = profiles.save(target, password)
      journal.database.beginTransaction()
      try {
        if (!journal.profileCurrent(profile.target)) throw SmbFailure("context_changed")
        journal.database.execSQL("INSERT OR REPLACE INTO smb_enabled VALUES(1,?,1)", arrayOf(profile.target.json().toString()))
        journal.database.setTransactionSuccessful()
      } finally { journal.database.endTransaction() }
    }
  }
  fun enable() {
    pause("settings_changed")
    locked {
      val profile = profiles.capture()?.profile ?: throw SmbFailure("profile_missing")
      journal.database.beginTransaction()
      try {
        journal.invalidate()
        if (!journal.profileCurrent(profile.target)) throw SmbFailure("context_changed")
        journal.database.execSQL("INSERT OR REPLACE INTO smb_enabled VALUES(1,?,1)", arrayOf(profile.target.json().toString()))
        journal.database.setTransactionSuccessful()
      } finally { journal.database.endTransaction() }
    }
  }
  fun disable() {
    pause("settings_changed")
    locked {
      journal.database.beginTransaction()
      try {
        journal.invalidate(); journal.database.execSQL("UPDATE smb_enabled SET enabled=0")
        journal.database.setTransactionSuccessful()
      } finally { journal.database.endTransaction() }
    }
  }
  fun available() = locked { active == null && foregroundWork == null }
  fun beginReview(ticket: UUID) = locked {
    if (active != null || foregroundWork != null) throw FilesFailure("backup_busy")
    foregroundWork = ticket
  }
  fun endReview(ticket: UUID) = locked { if (foregroundWork == ticket) foregroundWork = null }
  fun foregroundLost() { val value = interruptible; if (value != null && !value.run.automatic) pause("os_interrupted", value.token) }
  fun pause(code: String = "user_pause", expected: UUID? = null) {
    val current = interruptible
    if (expected == null || current?.token == expected) current?.cancelled = true
    var failed = false
    val ended = locked {
      if (expected != null && active?.token != expected) return@locked null
      val prior = active; active = null
      retryWork?.let(handler::removeCallbacks); retryWork = null
      if (prior != null) {
        try { prior.run = prior.run.failed(code, SmbRun.clock(app)); runs.save(prior.run) }
        catch (_: Exception) { failed = true; prior.run = prior.run.copy(phase = "needs_attention", error = "storage_failure", retryAt = null, retryElapsed = null, boot = null) }
      }
      prior
    }
    ended?.finished?.invoke(ended.run)
    if (failed) throw FilesFailure("storage_failure")
  }
  fun start(automatic: Boolean = false, prior: SmbRun? = null, finished: ((SmbRun) -> Unit)? = null): Map<String, Any> {
    val execution = locked {
      if (active != null || foregroundWork != null) throw FilesFailure("backup_busy")
      if (automatic && AndroidBackupScheduler.paused(app)) throw FilesFailure("user_pause")
      val sources = AndroidSmbSources.capture(app, journal)
      if (sources.sources.sources.isEmpty()) throw FilesFailure("source_unavailable")
      val captured = profiles.capture() ?: throw SmbFailure("profile_missing")
      if (!enabled(captured.profile)) throw FilesFailure("target_pause")
      val run = prior ?: SmbRun(UUID.randomUUID().toString(), captured.profile.target.archiveId(), captured.context, automatic, SmbRun.clock(app).now)
      if (run.target != captured.profile.target.archiveId() || run.binding != captured.context || run.automatic != automatic || run.phase != "running") throw FilesFailure("settings_changed")
      if (!mayRun(run)) throw FilesFailure("candidate_stale")
      runs.save(run)
      Execution(captured, sources, run, finished).also { active = it }
    }
    launch(execution); return status()
  }
  private fun check(value: Execution) = locked {
    if (value.cancelled || active?.token != value.token || value.run.phase != "running") throw FilesFailure("cancelled")
    if (!mayRun(value.run)) throw FilesFailure("os_interrupted")
    if (value.run.automatic && AndroidBackupScheduler.paused(app)) throw FilesFailure("user_pause")
    if (!enabled(value.captured.profile) || !profiles.current(value.captured)) throw FilesFailure("settings_changed")
    value.sources.check(app, journal)
  }
  private fun launch(value: Execution) {
    Thread({
      var error: String? = null
      try {
        check(value)
        val track = { job: SmbUpload -> locked { check(value); runs.track(value.run, job) } }
        run {
          val cancelled = { runCatching { check(value) }.isFailure }
          AndroidSmbFiles(app, journal, profiles, lan, track).run(cancelled)
          check(value)
          AndroidSmbPhotos(app, journal, profiles, lan, track).run(cancelled)
        }
      } catch (failure: Exception) { error = code(failure) }
      finish(value, error)
    }, "kloda-smb-sender").start()
  }
  private fun finish(value: Execution, error: String?) {
    var deliver = false
    try {
      locked {
        if (active?.token != value.token) return@locked
        var outcome = error
        if (outcome == null) {
          check(value)
          val counts = runs.counts(value.run.id)
          if (counts["operations"] != counts["completedOperations"]) outcome = "review_required"
        }
        value.run = if (outcome == null) value.run.copy(phase = "finished", error = null) else value.run.failed(outcome, SmbRun.clock(app))
        runs.save(value.run)
        if (value.run.phase == "waiting" && !value.run.automatic && mayRun(value.run)) arm(value)
        else { active = null; deliver = true }
      }
    } catch (_: Exception) {
      locked { if (active?.token == value.token) active = null }
      value.run = value.run.copy(phase = "needs_attention", error = "storage_failure", retryAt = null, retryElapsed = null, boot = null)
      deliver = true
    }
    if (deliver) value.finished?.invoke(value.run)
  }
  private fun arm(value: Execution) {
    retryWork?.let(handler::removeCallbacks)
    val delay = maxOf(0, value.run.retryElapsed!! - SmbRun.clock(app).elapsed)
    val work = Runnable {
      var terminal = false
      try {
        val ready = locked {
          if (active?.token != value.token) return@locked false
          if (!mayRun(value.run)) throw FilesFailure("os_interrupted")
          if (!profiles.current(value.captured)) throw FilesFailure("settings_changed")
          value.sources.check(app, journal)
          val next = value.run.retried(SmbRun.clock(app))
          if (next == null) { arm(value); return@locked false }
          value.run = next; runs.save(next)
          if (next.phase == "waiting") { arm(value); return@locked false }
          if (next.phase != "running") { active = null; terminal = true }
          next.phase == "running"
        }
        if (ready) launch(value)
        if (terminal) value.finished?.invoke(value.run)
      } catch (error: Exception) { pause(code(error), value.token) }
    }
    retryWork = work; handler.postDelayed(work, delay)
  }
  fun status(): Map<String, Any> = locked {
    val profile = profiles.capture()?.profile
    buildMap {
      put("running", active?.run?.phase == "running"); put("configured", profile != null); put("enabled", profile?.let(::enabled) == true)
      if (profile != null) {
        val target = profile.target.archiveId(); put("targetId", target)
        put("config", mapOf("address" to profile.target.address, "port" to profile.target.port, "share" to profile.target.share, "root" to profile.target.root, "username" to profile.target.username, "domain" to profile.target.domain))
        runs.read(target = target)?.let { run ->
          val state = if (active?.run?.id != run.id && (run.phase == "running" || !run.automatic && run.phase == "waiting")) "paused" else run.phase
          put("run", buildMap<String, Any> {
            put("id", run.id); put("targetId", target); put("automatic", run.automatic); put("state", state)
            put("attempts", run.attempts); put("osAttempts", run.osAttempts); put("counts", runs.counts(run.id))
            run.error?.let { put("errorCode", it) }; if (state == "waiting") run.retryAt?.let { put("retryAt", it.toString()) }
          })
        }
      }
    }
  }
  companion object {
    fun code(error: Exception): String = when (error) {
      is SmbFailure -> if (error.code == "connection_unavailable") "lan_unavailable" else error.code
      is FilesFailure -> error.code
      is SecurityException -> "source_permission_lost"
      is IllegalStateException -> if (error.message == "lan_unavailable") "lan_unavailable" else "queue_unavailable"
      is android.database.sqlite.SQLiteException -> "storage_failure"
      else -> if (isLocalStorageFull(error)) "local_storage_full" else "queue_unavailable"
    }
  }
}
