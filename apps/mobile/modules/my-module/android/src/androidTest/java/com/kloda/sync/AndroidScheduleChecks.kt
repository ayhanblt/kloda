package com.kloda.sync

import android.content.Context
import android.app.job.JobScheduler
import android.database.sqlite.SQLiteException
import android.os.Build
import java.util.Calendar
import java.util.Locale

/** Real Android SQLite; synthetic receipts only, no native owner, transport or media. */
internal object AndroidScheduleChecks {
  fun run(context: Context) {
    val record = "AAAAAAAAAAAAAAAAAAAAAA"
    val binding = "a".repeat(64)
    var journal = AndroidSyncJournal(context)
    try {
      var schedule = AndroidScheduleJournal(journal)
      val occurrence = schedule.claim(binding, record, 1000, 1000, 100, 1)!!
      check(schedule.claim(binding, record, 1000, 1000, 100, 1) == null)
      val runs = AndroidFilesRunJournal(journal, context)
      val wrongRecord = runs.begin("BBBBBBBBBBBBBBBBBBBBBB", null, binding)
      val wrongContext = runs.begin(record, null, "b".repeat(64))
      val run = runs.begin(record, null, binding)
      rejects("settings_changed") { schedule.attachRun(occurrence.id, wrongRecord.id, 1) }
      rejects("settings_changed") { schedule.attachRun(occurrence.id, wrongContext.id, 1) }
      schedule.attachRun(occurrence.id, run.id, 1)
      val file = FilesJob(AndroidFilesSnapshots.randomId(), record, "source", "content://fixture/file", "content://fixture/tree",
        "file", AndroidFilesSnapshots.randomId(), "hash", 4, null, 0, "queued", null)
      journal.insert(file)
      journal.update(file.id, "completed", operation = AndroidFilesSnapshots.randomId(), offset = 4)
      AndroidScheduleJournal.track(journal.writableDatabase, run.id, file.id, record)
      AndroidScheduleJournal.track(journal.writableDatabase, run.id, file.id, record)
      journal.readableDatabase.rawQuery("SELECT count(*) FROM files_run_job WHERE run_id=?", arrayOf(run.id)).use {
        check(it.moveToFirst() && it.getInt(0) == 1)
      }
      rejects("settings_changed") { AndroidScheduleJournal.track(journal.writableDatabase, run.id, file.id, "wrong-record") }
      check(runCatching { journal.writableDatabase.execSQL("DELETE FROM files_run_job WHERE run_id=?", arrayOf(run.id)) }
        .exceptionOrNull() is SQLiteException)
      check(runCatching { journal.writableDatabase.execSQL("UPDATE files_run_job SET job_id='replacement' WHERE run_id=?", arrayOf(run.id)) }
        .exceptionOrNull() is SQLiteException)
      schedule.stop(occurrence.id, 1000, 100, 1, 1)
      val waiting = schedule.find(occurrence.id)!!
      check(waiting.phase == "waiting" && waiting.osAttempts == 1 && waiting.runId == run.id)
      check(waiting.retryAt == 301000L && waiting.retryElapsed == 300100L && waiting.retryBoot == 1)
      journal.close()
      journal = AndroidSyncJournal(context)
      schedule = AndroidScheduleJournal(journal)
      check(schedule.find(occurrence.id) == waiting)
      check(schedule.claim(binding, record, 1000, 600000, 300099, 1) == null)
      val second = schedule.claim(binding, record, 1000, 600000, 300100, 1)!!
      check(second.osAttempts == 2 && second.phase == "running" && second.runId == run.id)
      schedule.stop(second.id, 600000, 400000, 1, 1)
      check(schedule.find(second.id) == second)
      schedule.stop(second.id, 600000, 400000, 1, 2)
      check(schedule.claim(binding, record, 1000, 1000000, 10, 2) == null)
      val rearmed = schedule.find(second.id)!!
      check(rearmed.osAttempts == 2 && rearmed.retryBoot == 2 && rearmed.retryElapsed == 300010L)
      val third = schedule.claim(binding, record, 1000, 1300000, 300010, 2)!!
      check(third.osAttempts == 3)
      schedule.stop(third.id, 1300000, 300010, 2, 3, userPause = true)
      check(schedule.find(third.id)!!.phase == "paused")
      val resumed = schedule.resumePaused(third.id, 1300001, 300011, 2)!!
      check(resumed.phase == "running" && resumed.osAttempts == 3 && resumed.runId == run.id)
      val reopenedRuns = AndroidFilesRunJournal(journal, context)
      reopenedRuns.finish(run, "finished")
      journal.close()
      journal = AndroidSyncJournal(context)
      schedule = AndroidScheduleJournal(journal)
      val count = runCount(journal)
      check(schedule.reconcileLinked(third.id, 3))
      check(schedule.find(third.id)!!.let { it.phase == "finished" && it.updated == 1 && it.runId == run.id && it.osAttempts == 3 })
      check(!schedule.reconcileLinked(third.id, 3))
      check(schedule.claim(binding, record, 1000, 2000000, 500000, 2) == null && runCount(journal) == count)

      val deletedOccurrence = schedule.claim(binding, record, 2000, 2000, 100, 1)!!
      val deletedRun = AndroidFilesRunJournal(journal, context).begin(record, null, binding)
      schedule.attachRun(deletedOccurrence.id, deletedRun.id, 1)
      AndroidScheduleJournal.track(journal.writableDatabase, deletedRun.id, file.id, record)
      journal.markDeleted(file.id)
      AndroidFilesRunJournal(journal, context).finish(deletedRun, "finished")
      check(schedule.reconcileLinked(deletedOccurrence.id, 1))
      check(schedule.find(deletedOccurrence.id)!!.updated == 0 && journal.find(file.id)!!.state == "completed")

      val emptyOccurrence = schedule.claim(binding, record, 3000, 3000, 100, 1)!!
      val emptyRun = AndroidFilesRunJournal(journal, context).begin(record, null, binding)
      schedule.attachRun(emptyOccurrence.id, emptyRun.id, 1)
      AndroidFilesRunJournal(journal, context).finish(emptyRun, "finished")
      check(schedule.reconcileLinked(emptyOccurrence.id, 1) && schedule.find(emptyOccurrence.id)!!.updated == 0)

      var budget = schedule.claim(binding, record, 4000, 4000, 100, 1)!!
      var wall = 4000L
      var elapsed = 100L
      for (attempt in 1..5) {
        check(budget.osAttempts == attempt)
        schedule.stop(budget.id, wall, elapsed, 1, attempt)
        val stopped = schedule.find(budget.id)!!
        if (attempt < 5) {
          wall = stopped.retryAt!!; elapsed = stopped.retryElapsed!!
          budget = schedule.claim(binding, record, 4000, wall, elapsed, 1)!!
        }
        else check(stopped.phase == "exhausted" && stopped.osAttempts == 5)
      }
      journal.close()
      journal = AndroidSyncJournal(context)
      check(AndroidScheduleJournal(journal).claim(binding, record, 4000, 2000000, 2000000, 1) == null)
    } finally { journal.close() }
    registration(context)
  }

  private fun registration(context: Context) {
    val scheduler = context.getSystemService(JobScheduler::class.java)
    val preferences = context.getSharedPreferences("kloda-sync", 0)
    val future = Calendar.getInstance().apply { add(Calendar.HOUR_OF_DAY, 1) }
    check(FilesRunContext.stamp(preferences.edit().putString("backupMode", "scheduled").putInt("intervalHours", 12)
      .putString("localTime", String.format(Locale.ROOT, "%02d:%02d", future.get(Calendar.HOUR_OF_DAY), future.get(Calendar.MINUTE)))
      .putString("directorySources", "[{\"id\":\"registration-fixture\",\"reference\":\"content://fixture/tree/root\"}]")
      .putString("photoSources", "[]").putBoolean("automaticPaused", false)).commit())
    try {
      AndroidBackupScheduler.resume(context)
      val pending = scheduler.getPendingJob(AndroidBackupScheduler.JOB) ?: error("Future OS job was not registered")
      check(pending.isPersisted && pending.minLatencyMillis > 30 * 60_000L)
      check(pending.service.className == AndroidBackupJob::class.java.name)
      if (Build.VERSION.SDK_INT >= 28) check(pending.requiredNetwork == null)
      check(pending.extras.getString("binding") == FilesRunContext.capture(context).binding)
      check(scheduler.getPendingJob(AndroidBackupScheduler.WATCH) == null)
      AndroidBackupScheduler.pause(context)
      check(preferences.getBoolean("automaticPaused", false) && AndroidBackupScheduler.paused(context))
      check(scheduler.getPendingJob(AndroidBackupScheduler.JOB) == null && scheduler.getPendingJob(AndroidBackupScheduler.WATCH) == null)
      AndroidBackupScheduler.reconcile(context, clockChanged = true)
      check(scheduler.getPendingJob(AndroidBackupScheduler.JOB) == null && scheduler.getPendingJob(AndroidBackupScheduler.WATCH) == null)
      AndroidBackupScheduler.resume(context)
      check(!AndroidBackupScheduler.paused(context) && !preferences.getBoolean("automaticPaused", true))
      check(scheduler.getPendingJob(AndroidBackupScheduler.JOB)?.let { it.isPersisted && it.minLatencyMillis > 30 * 60_000L } == true)
    } finally { AndroidBackupScheduler.pause(context) }
  }

  private fun runCount(journal: AndroidSyncJournal): Int = journal.readableDatabase.rawQuery("SELECT count(*) FROM files_run", null).use {
    check(it.moveToFirst()); it.getInt(0)
  }

  private fun rejects(code: String, action: () -> Unit) {
    try { action(); error("Expected $code") }
    catch (failure: FilesFailure) { check(failure.code == code) }
  }
}
