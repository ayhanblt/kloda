package com.kloda.sync

import android.content.Context
import android.os.SystemClock
import java.util.UUID

// 18A/3 (ADR0027 §4, sequential): two added DAV destinations on the owned HTTPS fixture next to the original WebDAV one.
// The wrong-password destination fails alone; the other completes through the real JobService; the original plan is untouched.
internal object AndroidWebDavTargetChecks {
  fun run(context: Context, legacy: AndroidWebDavProfile, announce: (String) -> Unit) {
    val good = AndroidWebDavProfile(UUID.randomUUID().toString(), legacy.endpoint, "targets-" + UUID.randomUUID(), "owned", "disposable-https-fixture", "nextcloud")
    val bad = AndroidWebDavProfile(UUID.randomUUID().toString(), legacy.endpoint, "targets-" + UUID.randomUUID(), "owned", "wrong-password", "kolab-now")
    val added = listOf(good, bad)
    try {
      added.forEach { AndroidWebDavVault(context, it.targetId()).write(it) }
      val before = AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        // Saving custody is not enabling (ADR0023).
        check(journal.destinations().map { it.target } == listOf(legacy.targetId()))
        journal.schedule.read(legacy.targetId())!!
      }
      check(added.none { AndroidWebDavDestinations.enabled(context, it.targetId()) })
      added.forEach { AndroidWebDavDestinations.setEnabled(context, it.targetId(), true) }
      announce("PASS saved-not-enabled explicit-enable")
      val deadline = SystemClock.elapsedRealtime() + 90000
      var runs: List<WebDavRun?> = emptyList()
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        fun settled(run: WebDavRun?, target: String) = run != null && run.phase != "running" && run.phase != "waiting" &&
          journal.schedule.read(target)?.run == null && !AndroidWebDavRuntime.hasAutomatic(run.id)
        while (SystemClock.elapsedRealtime() < deadline) {
          runs = added.map { journal.runs.read(target = it.targetId(), automatic = true) }
          if (added.indices.all { settled(runs[it], added[it].targetId()) }) break
          Thread.sleep(200)
        }
        val (ok, failed) = runs
        check(ok?.phase == "finished") { "good target: ${ok?.phase}:${ok?.error}:${AndroidWebDavScheduler.error(context)}" }
        check(failed != null && failed.phase != "finished" && failed.error != null) { "bad target: ${failed?.phase}:${failed?.error}" }
        val counts = journal.runs.counts(ok!!.id)
        check(counts["photos"] == "1" && counts["completedPhotos"] == "1" && counts["operations"] == "2" && counts["completedOperations"] == "2")
        // Each destination kept its own plan and run; the original WebDAV opportunity was not consumed.
        check(added.all { journal.schedule.read(it.targetId())!!.due > System.currentTimeMillis() })
        check(journal.schedule.read(legacy.targetId()) == before) { "original plan changed" }
        check(journal.runs.read(target = legacy.targetId(), automatic = true)!!.id != ok.id)
        announce("PASS sequential-runs failure-isolated (${failed.error}) own-plans original-untouched")
      }
      AndroidWebDavDestinations.setEnabled(context, good.targetId(), false)
      AndroidWebDavDestinations.forget(context, bad.targetId())
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase)
        check(journal.destinations().map { it.target } == listOf(legacy.targetId()))
        check(journal.schedule.read(good.targetId()) != null && journal.schedule.read(bad.targetId()) == null)
      }
      announce("PASS disable-keeps-plan forget-drops-plan")
    } finally {
      added.forEach { runCatching { AndroidWebDavDestinations.forget(context, it.targetId()) }; runCatching { AndroidWebDavVault(context, it.targetId()).delete() } }
    }
  }
}
