package com.kloda.sync

import android.content.SharedPreferences
import java.util.UUID

// Amazon S3 automatic occurrence authority: one SQLite row plus immutable acceptances.
// A wake token only wakes an evaluation; acceptance always needs the exact occurrence CAS.
internal data class S3AutoAuthority(val target: String, val binding: String, val context: String) {
  companion object {
    fun of(sources: AndroidS3Sources, capture: S3Capture) =
      S3AutoAuthority(capture.profile.target.archiveId(), S3Target.hash(capture.profile.target.profileGeneration + sources.sources.binding), capture.context)
  }
}
internal data class S3AutoPlan(val occurrence: String, val target: String, val binding: String, val context: String, val due: Long, val wake: String?, val retry: Long?) {
  fun eligibleAt(): Long = maxOf(due, retry ?: due)
}
// Owner identity + exact expected snapshot + pre-transaction run id; never a secret.
internal class S3Attempt(val owner: Any, val expected: S3AutoPlan, val candidateRun: String, val nextDue: Long)
internal sealed class S3Admission {
  data class Accepted(val runId: String) : S3Admission()
  data class NotAccepted(val reason: String) : S3Admission()
  class OutcomeUnknown(val attempt: S3Attempt) : S3Admission()
}
internal sealed class S3Resolution {
  data class ResolvedAccepted(val runId: String) : S3Resolution()
  object ResolvedNotAccepted : S3Resolution()
  object Unresolved : S3Resolution()
}
internal sealed class S3Settle {
  object NoFence : S3Settle()
  object MigrationSettled : S3Settle()
  data class ClockCommitted(val expected: S3AutoPlan, val revised: S3AutoPlan) : S3Settle()
  data class ClockRolledBack(val expected: S3AutoPlan, val revised: S3AutoPlan) : S3Settle()
}
internal sealed class S3Refresh {
  data class Updated(val plan: S3AutoPlan, val rotated: Boolean) : S3Refresh()
  data class Same(val plan: S3AutoPlan) : S3Refresh()
  object Revoked : S3Refresh()
}

// Instance-bound transaction/read port. Production uses the journal's own transaction;
// tests run the same real transaction and inject only acknowledgment/read failures.
internal open class S3PlanBoundary(private val journal: AndroidS3Journal) {
  open fun <T> commit(block: () -> T): T = journal.transaction(block)
  open fun <T> read(block: () -> T): T = synchronized(AndroidSyncJournal.sourceLock) {
    val database = journal.database
    if (database.inTransaction()) throw S3Failure("storage_failure")
    database.beginTransactionNonExclusive()
    try { block().also { database.setTransactionSuccessful() } } finally { database.endTransaction() }
  }
}

internal class AndroidS3AutomaticPlan(val journal: AndroidS3Journal, private val boundary: S3PlanBoundary = S3PlanBoundary(journal)) {
  private val database = journal.database
  init {
    if (journal.provider != "amazon-s3") throw S3Failure("invalid_request")
    synchronized(AndroidSyncJournal.sourceLock) {
      database.execSQL("""CREATE TABLE IF NOT EXISTS s3_auto_state(id INTEGER PRIMARY KEY CHECK(id=1),schema INTEGER NOT NULL CHECK(schema=1),
        occurrence TEXT,target TEXT,binding TEXT,context TEXT,due INTEGER,wake TEXT,retry INTEGER,
        CHECK((occurrence IS NULL AND target IS NULL AND binding IS NULL AND context IS NULL AND due IS NULL AND wake IS NULL AND retry IS NULL) OR
          (occurrence IS NOT NULL AND target IS NOT NULL AND binding IS NOT NULL AND context IS NOT NULL AND due IS NOT NULL AND due>=0)))""")
      database.execSQL("""CREATE TABLE IF NOT EXISTS s3_auto_accept(occurrence TEXT PRIMARY KEY,run TEXT NOT NULL UNIQUE REFERENCES s3_run(id),
        target TEXT NOT NULL,binding TEXT NOT NULL,context TEXT NOT NULL,due INTEGER NOT NULL)""")
      for (operation in listOf("UPDATE", "DELETE")) database.execSQL(
        "CREATE TRIGGER IF NOT EXISTS retain_s3_auto_accept_${operation.lowercase()} BEFORE $operation ON s3_auto_accept BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }
  private fun uuid() = UUID.randomUUID().toString()
  // §3.1.5 migration acknowledgment uncertainty: every authority read/write stays fenced until settle()
  // proves the ended transaction with one consistent read. In memory only; a new process starts after it.
  // old != null: an explicit clock revision (§4 clock contract), proven by exact old or new; never migration cleanup.
  private class Uncertain(val plan: S3AutoPlan?, val old: S3AutoPlan? = null)
  @Volatile private var uncertain: Uncertain? = null
  val fenced: Boolean get() = uncertain != null
  private fun open() { if (uncertain != null) throw S3Failure("storage_failure") }
  private fun has() = journal.text("SELECT COUNT(*) FROM s3_auto_state WHERE id=1") == "1"
  fun marked(): Boolean = synchronized(AndroidSyncJournal.sourceLock) { open(); has() }
  fun current(): S3AutoPlan? = synchronized(AndroidSyncJournal.sourceLock) { open(); row() }
  private fun row(): S3AutoPlan? = database.rawQuery("SELECT schema,occurrence,target,binding,context,due,wake,retry FROM s3_auto_state WHERE id=1", null).use {
    if (!it.moveToFirst()) return@use null
    if (it.getInt(0) != 1) throw S3Failure("storage_failure")
    if (it.isNull(1)) return@use null
    val plan = S3AutoPlan(it.getString(1), it.getString(2), it.getString(3), it.getString(4), it.getLong(5),
      if (it.isNull(6)) null else it.getString(6), if (it.isNull(7)) null else it.getLong(7))
    if (listOfNotNull(plan.occurrence, plan.wake).any { value -> runCatching { UUID.fromString(value).toString() != value }.getOrDefault(true) }) throw S3Failure("storage_failure")
    plan
  }
  private fun write(plan: S3AutoPlan?) = database.execSQL("INSERT OR REPLACE INTO s3_auto_state VALUES(1,1,?,?,?,?,?,?,?)",
    arrayOf(plan?.occurrence, plan?.target, plan?.binding, plan?.context, plan?.due, plan?.wake, plan?.retry))
  private fun fresh(authority: S3AutoAuthority, due: Long) = S3AutoPlan(uuid(), authority.target, authority.binding, authority.context, due, uuid(), null)

  // One-way legacy import. The caller only invokes this unlocked with fresh authority (or null).
  fun migrate(legacy: SharedPreferences, authority: S3AutoAuthority?, now: Long, next: (Long) -> Long): S3AutoPlan? = synchronized(AndroidSyncJournal.sourceLock) {
    open()
    if (has()) return@synchronized row()
    val values = legacy.all
    val due = values["due"]; val binding = values["binding"]; val dispatch = values["dispatch"]
    // A corrupt type or a negative due is a storage outcome, never a fresh authority (§3.1.3).
    if (due != null && (due !is Long || due < 0) || binding != null && binding !is String || dispatch != null && dispatch !is String) throw S3Failure("storage_failure")
    val plan = authority?.let { fresh(it, (due as Long?)?.takeIf { _ -> binding == it.binding } ?: next(now)) }
    try {
      boundary.commit { if (has()) throw S3Failure("plan_stale"); write(plan); plan }
    } catch (error: Exception) {
      // Never assume rollback or commit: only one consistent read may prove the marker.
      val seen = runCatching { boundary.read { if (has()) row() to true else null to false } }.getOrNull()
      // R11: an unreadable proof and a marker with a mismatched plan are the same storage gate;
      // only a proven absent marker (rollback) may be re-evaluated later.
      if (seen == null || seen.second && seen.first != plan) { uncertain = Uncertain(plan); throw S3Failure("storage_failure") }
      if (!seen.second) throw S3Failure("storage_failure")
    }
    plan.also { cleanup(legacy) }
  }
  // Cleanup failure never rolls back SQLite authority; a marker means prefs are never read again.
  private fun cleanup(legacy: SharedPreferences) { legacy.edit().remove("due").remove("binding").remove("dispatch").commit() }
  // Ends a migration fence only with one consistent proof: committed exact import, or proven absence.
  // A marker with a different plan never settles (no reset/adoption in this process).
  // R14: a clock proof is an event result (committed vs rolled back), bound by the caller to its exact request;
  // only a clock result keeps the plan armed (no disarm/cleanup).
  fun settle(legacy: SharedPreferences): S3Settle = synchronized(AndroidSyncJournal.sourceLock) {
    val pending = uncertain ?: return@synchronized S3Settle.NoFence
    val seen = boundary.read { if (has()) row() to true else null to false }
    if (pending.old != null) {
      val result = when (seen.first) { pending.plan -> S3Settle.ClockCommitted(pending.old, pending.plan!!); pending.old -> S3Settle.ClockRolledBack(pending.old, pending.plan!!); else -> throw S3Failure("storage_failure") }
      uncertain = null; return@synchronized result
    }
    if (seen.second && seen.first != pending.plan) throw S3Failure("storage_failure")
    uncertain = null
    if (seen.second) cleanup(legacy)
    S3Settle.MigrationSettled
  }
  // Explicit same-configuration clock revision: exact CAS, wake kept, retry cleared, no run/accept. Our own CAS
  // miss writes nothing; any other throw is proven by one read: exact new = committed, exact old = not, else fenced.
  fun clock(expected: S3AutoPlan, revised: S3AutoPlan): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    open()
    if (expected.wake == null || revised.wake != expected.wake || revised.target != expected.target ||
      revised.binding != expected.binding || revised.retry != null || revised.occurrence == expected.occurrence) throw S3Failure("invalid_request")
    var stale = false
    try { boundary.commit { if (row() != expected) { stale = true; throw S3Failure("plan_stale") }; write(revised) }; true } catch (error: Exception) {
      if (stale) return@synchronized false
      when (runCatching { boundary.read { row() } }.getOrNull()) {
        revised -> true
        expected -> false
        else -> { uncertain = Uncertain(revised, expected); throw S3Failure("storage_failure") }
      }
    }
  }

  fun arm(authority: S3AutoAuthority?, now: Long, next: (Long) -> Long, changed: Boolean): S3Refresh = boundary.commit {
    open()
    val current = row()
    if (!has()) throw S3Failure("storage_failure")
    when {
      authority == null -> { if (current?.wake != null) write(current.copy(wake = null)); S3Refresh.Revoked }
      current == null || current.target != authority.target || current.binding != authority.binding || changed ->
        fresh(authority, next(now)).also { write(it) }.let { S3Refresh.Updated(it, true) }
      current.wake == null -> current.copy(wake = uuid(), context = authority.context,
        occurrence = if (current.context == authority.context) current.occurrence else uuid()).also { write(it) }.let { S3Refresh.Updated(it, true) }
      current.context != authority.context -> current.copy(occurrence = uuid(), context = authority.context).also { write(it) }.let { S3Refresh.Updated(it, false) }
      else -> S3Refresh.Same(current)
    }
  }
  fun disarm() = boundary.commit { open(); row()?.let { if (it.wake != null) write(it.copy(wake = null)) }; Unit }
  fun defer(expected: S3AutoPlan, retry: Long): S3AutoPlan = boundary.commit {
    open()
    if (row() != expected) throw S3Failure("plan_stale")
    expected.copy(retry = retry).also { write(it) }
  }
  fun matches(expected: S3AutoPlan, authority: S3AutoAuthority): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    open()
    expected.wake != null && row() == expected && expected.target == authority.target && expected.binding == authority.binding && expected.context == authority.context
  }
  // Exact CAS -> run -> immutable accept -> advanced occurrence, all in one commit.
  fun admit(expected: S3AutoPlan, run: S3Run, nextDue: Long, runs: AndroidS3Runs) = boundary.commit {
    open()
    if (expected.wake == null || row() != expected || run.target != expected.target || run.binding != expected.context) throw S3Failure("plan_stale")
    runs.start(run)
    database.execSQL("INSERT INTO s3_auto_accept VALUES(?,?,?,?,?,?)", arrayOf(expected.occurrence, run.id, expected.target, expected.binding, expected.context, expected.due))
    write(expected.copy(occurrence = uuid(), due = nextDue, retry = null))
  }
  // §4.1: one consistent read of accept + candidate run + state. Anything else stays fenced.
  fun resolve(attempt: S3Attempt): S3Resolution = try {
    open()
    boundary.read {
      val expected = attempt.expected; val id = attempt.candidateRun
      val accept = database.rawQuery("SELECT run,target,binding,context,due FROM s3_auto_accept WHERE occurrence=?", arrayOf(expected.occurrence)).use {
        if (it.moveToFirst()) listOf(it.getString(0), it.getString(1), it.getString(2), it.getString(3), it.getLong(4).toString()) else null
      }
      val byRun = journal.text("SELECT COUNT(*) FROM s3_auto_accept WHERE run=?", arrayOf(id))
      val run = database.rawQuery("SELECT target,binding FROM s3_run WHERE id=?", arrayOf(id)).use { if (it.moveToFirst()) it.getString(0) to it.getString(1) else null }
      val state = row()
      when {
        accept == listOf(id, expected.target, expected.binding, expected.context, expected.due.toString()) && byRun == "1" &&
          run == expected.target to expected.context && state != null && state.occurrence != expected.occurrence &&
          state == expected.copy(occurrence = state.occurrence, due = attempt.nextDue, retry = null) -> S3Resolution.ResolvedAccepted(id)
        accept == null && byRun == "0" && run == null && state == expected -> S3Resolution.ResolvedNotAccepted
        else -> S3Resolution.Unresolved
      }
    }
  } catch (_: Exception) { S3Resolution.Unresolved }

  companion object {
    const val LEGACY = "kloda-s3-automatic"
    // Locked legacy-recovery identity: a hash of the legacy snapshot, never authority.
    fun legacySnapshot(legacy: SharedPreferences): String? {
      val values = legacy.all; val due = values["due"]; val binding = values["binding"]
      return if (due is Long && due >= 0 && binding is String) S3Target.hash("$due|$binding|${values["dispatch"]}") else null
    }
  }
}
