package com.kloda.sync

import android.content.Context
import android.os.SystemClock
import android.provider.Settings

/** Two instrumentation processes share only a token-scoped disposable journal. */
internal object AndroidRestartChecks {
  fun run(context: Context, phase: String) {
    val metadata = context.getSharedPreferences("restart-proof", 0)
    val record = "AAAAAAAAAAAAAAAAAAAAAA"
    val binding = FilesRunContext.capture(context).binding
    AndroidSyncJournal(context).use { journal ->
      val schedule = AndroidScheduleJournal(journal)
      if (phase == "write") {
        check(!metadata.contains("pending"))
        val pending = FilesJob(AndroidFilesSnapshots.randomId(), record, "source", "content://fixture/pending", "content://fixture/tree",
          "pending.bin", AndroidFilesSnapshots.randomId(), "fixture-hash", 4, null, 0, "queued", null)
        val completed = pending.copy(id = AndroidFilesSnapshots.randomId(), reference = "content://fixture/completed", name = "completed.bin")
        journal.insert(pending); journal.insert(completed)
        val operation = AndroidFilesSnapshots.randomId()
        journal.update(pending.id, "uploading", operation = operation, offset = 2)
        journal.update(completed.id, "completed", operation = AndroidFilesSnapshots.randomId(), offset = 4)
        journal.markDeleted(completed.id)
        val wall = System.currentTimeMillis()
        val elapsed = SystemClock.elapsedRealtime()
        val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT)
        val run = AndroidFilesRunJournal(journal, context).begin(record, null, binding)
        val occurrence = schedule.claim(binding, record, wall, wall, elapsed, boot)!!
        schedule.attachRun(occurrence.id, run.id, 1)
        AndroidScheduleJournal.track(journal.writableDatabase, run.id, pending.id, record)
        schedule.stop(occurrence.id, wall, elapsed, boot, 1)
        val waiting = schedule.find(occurrence.id)!!
        check(metadata.edit().putString("pending", pending.id).putString("completed", completed.id)
          .putInt("writerPid", android.os.Process.myPid())
          .putString("operation", operation).putString("run", run.id).putString("occurrence", occurrence.id)
          .putLong("retryElapsed", waiting.retryElapsed!!).putLong("retryWall", waiting.retryAt!!).commit())
        check(context.getSharedPreferences("kloda-sync", 0).edit().putBoolean("automaticPaused", true).commit())
      } else {
        check(phase == "read")
        check(metadata.getInt("writerPid", -1) != android.os.Process.myPid())
        fun required(key: String) = metadata.getString(key, null) ?: error("Missing restart fixture metadata")
        val pending = journal.find(required("pending"))!!
        check(pending.recordId == record && pending.reference == "content://fixture/pending" && pending.treeReference == "content://fixture/tree")
        check(pending.state == "uploading" && pending.offset == 2L && pending.size == 4L && pending.sha256 == "fixture-hash")
        check(pending.operationId == required("operation"))
        val completed = journal.find(required("completed"))!!
        check(completed.state == "completed" && completed.offset == 4L && journal.deleted(completed.id))
        val occurrence = schedule.find(required("occurrence"))!!
        check(occurrence.binding == binding && occurrence.record == record)
        check(occurrence.phase == "waiting" && occurrence.osAttempts == 1 && occurrence.updated == 0)
        check(occurrence.runId == required("run") && occurrence.retryElapsed == metadata.getLong("retryElapsed", -1))
        check(occurrence.retryAt == metadata.getLong("retryWall", -1))
        check(context.getSharedPreferences("kloda-sync", 0).getBoolean("automaticPaused", false))
        journal.readableDatabase.rawQuery("SELECT count(*) FROM files_run_job WHERE run_id=? AND job_id=?",
          arrayOf(required("run"), pending.id)).use { check(it.moveToFirst() && it.getInt(0) == 1) }
        check(!schedule.reconcileLinked(occurrence.id, 1))
        check(journal.find(pending.id)!!.state != "completed")
      }
    }
  }
}
