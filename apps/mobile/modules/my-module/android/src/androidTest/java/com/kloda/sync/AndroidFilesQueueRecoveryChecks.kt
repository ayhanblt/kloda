package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteException
import android.system.Os
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream

/** Invoke with a fresh isolated Android test Context; no native library or network is needed. */
internal object AndroidFilesQueueRecoveryChecks {
  fun run(context: Context) {
    val directory = File(context.noBackupFilesDir, "kloda-files")
    check(!context.getDatabasePath("kloda-sync.sqlite").exists() && !directory.exists())
    val first = QueuedSourceFile("content://test/tree/root/document/first", "first.jpg", "4:1", 4)
    val second = first.copy(reference = "content://test/tree/root/document/second", relativePath = "second.jpg")
    val tree = "content://test/tree/root"
    context.openOrCreateDatabase("kloda-sync.sqlite", 0, null).use { database ->
      database.execSQL("""CREATE TABLE queued_source_file (source_id TEXT NOT NULL, reference TEXT NOT NULL,
        relative_path TEXT NOT NULL, revision TEXT NOT NULL, size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL, PRIMARY KEY(source_id,reference))""")
      for ((file, state) in listOf(first to "pending", second to "completed")) {
        database.execSQL("INSERT INTO queued_source_file VALUES(?,?,?,?,?,?)",
          arrayOf<Any>("source", file.reference, file.relativePath, file.revision, file.size, state))
      }
      database.version = 1
    }
    var journal = AndroidSyncJournal(context)
    try {
      check(journal.writableDatabase.version == 2)
      val legacy = journal.readableDatabase.rawQuery("SELECT status FROM queued_source_file ORDER BY reference", null).use { cursor ->
        buildList { while (cursor.moveToNext()) add(cursor.getString(0)) }
      }
      check(legacy == listOf("pending", "completed"))
      journal.reconcileSourceFiles("source", tree, sequenceOf(first, second))
      val content = byteArrayOf(1, 2, 3, 4)
      val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(content))
      val changed = AndroidFilesSnapshots.digest(ByteArrayInputStream(byteArrayOf(1, 2, 9, 4)))
      check(digest.size == changed.size && digest.sha256 != changed.sha256)
      val record = AndroidFilesSnapshots.randomId()
      val pending = FilesJob(AndroidFilesSnapshots.randomId(), record, "source", first.reference, tree, "first.jpg",
        AndroidFilesSnapshots.randomId(), digest.sha256, 4, null, 0, "queued", null)
      val completed = pending.copy(id = AndroidFilesSnapshots.randomId(), reference = second.reference, name = "second.jpg")
      journal.insert(pending); journal.insert(completed)
      val operation = AndroidFilesSnapshots.randomId()
      journal.update(pending.id, "uploading", operation = operation, offset = 2)
      journal.update(completed.id, "completed", operation = AndroidFilesSnapshots.randomId(), offset = 4)
      journal.close(); journal = AndroidSyncJournal(context)
      val resumed = journal.jobs(record, "source", null).single()
      check(resumed.operationId == operation && resumed.offset == 2L && resumed.sha256 == digest.sha256)
      check(journal.jobs(AndroidFilesSnapshots.randomId(), "source", null).isEmpty())
      check(journal.version(record, "source", first, tree, changed.sha256, 4) == null)
      val ack = response(resumed, 4, "receiving")
      check(AndroidFilesTransfer.parse(ack.toString(), resumed).state == "receiving")
      journal.update(resumed.id, "finalizing", offset = 4)
      check(journal.jobs(record, "source", null).single().state == "finalizing")
      expect("outcome_unknown") { AndroidFilesTransfer.parse(response(resumed, 1, "receiving").toString(), resumed) }
      expect("outcome_unknown") { AndroidFilesTransfer.parse(response(resumed, 3, "completed").toString(), resumed) }
      expect("outcome_unknown") {
        val wrong = response(resumed, 4, "completed")
        wrong.getJSONObject("operation").put("requestId", AndroidFilesSnapshots.randomId())
        AndroidFilesTransfer.parse(wrong.toString(), resumed)
      }
      expect("outcome_unknown") { AndroidFilesTransfer.parse("{\"status\":200,\"bytes\":[1,2,3]}", resumed) }
      expect("connection_closed") { AndroidFilesTransfer.parse("{\"status\":0,\"errorCode\":\"connection_closed\"}", resumed) }
      expect("outcome_unknown") { AndroidFilesTransfer.parse("{\"status\":202}", resumed) }
      try {
        journal.reconcileSourceFiles("source", tree, sequence { yield(first); throw FilesFailure("source_changed") })
        error("A failed scan must roll back")
      } catch (_: FilesFailure) { check(journal.sourceFiles("source", null).size == 2) }
      journal.reconcileSourceFiles("source", tree, sequenceOf(first.copy(revision = "4:2")))
      check(journal.retainsSnapshot(pending.id) && journal.retainsSnapshot(completed.id))
      journal.removeSource("source")
      val removed = journal.jobs(record, "source", null).single()
      check(removed.state == "blocked" && removed.errorCode == "source_permission_lost" && removed.offset == 4L)
      val jobs = journal.status(false, null)["jobs"] as List<*>
      check(jobs.size == 2 && jobs.any { (it as Map<*, *>)["state"] == "completed" })
      check(jobs.all { (it as Map<*, *>)["acknowledgedBytes"] is String })
      try { journal.writableDatabase.delete("files_job", "id=?", arrayOf(pending.id)); error("Retention must reject deletion") }
      catch (_: SQLiteException) { check(journal.retainsSnapshot(pending.id)) }
      check(directory.mkdirs())
      val retained = File(directory, "${pending.id}.snapshot")
      FileOutputStream(retained).use { it.write(content); it.fd.sync() }; Os.chmod(retained.path, 256)
      val orphan = File(directory, "${AndroidFilesSnapshots.randomId()}.snapshot")
      check(orphan.createNewFile())
      val completedSnapshot = File(directory, "${completed.id}.snapshot")
      check(completedSnapshot.createNewFile())
      val snapshots = AndroidFilesSnapshots(context) {}
      snapshots.recover(journal)
      check(retained.exists() && !orphan.exists() && !completedSnapshot.exists())
      Os.chmod(retained.path, 384)
      FileOutputStream(retained).use { it.write(byteArrayOf(1, 2, 9, 4)); it.fd.sync() }; Os.chmod(retained.path, 256)
      snapshots.open(pending).use { descriptor -> expect("snapshot_unavailable") { snapshots.validate(pending, descriptor) } }
      expect("source_permission_lost") { AndroidSafSourceScanner(context.contentResolver).permittedTree("https://test/root") }
      val foregroundChecked = java.util.concurrent.CountDownLatch(1)
      val queue = AndroidFilesQueue(context) { foregroundChecked.countDown(); false }
      try {
        queue.start(record, 0)
        check(foregroundChecked.await(5, java.util.concurrent.TimeUnit.SECONDS))
        queue.pause()
        check(queue.status()["errorCode"] == "paused")
        check(journal.jobs(record, "source", null).single().offset == 4L && retained.exists())
      } finally { queue.close() }
    } finally {
      journal.close()
      context.deleteDatabase("kloda-sync.sqlite")
      directory.listFiles()?.forEach { it.delete() }; directory.delete()
    }
  }

  private fun response(job: FilesJob, offset: Long, state: String): JSONObject = JSONObject().put("status", 200)
    .put("operation", JSONObject().put("id", job.operationId).put("requestId", job.id).put("sourceId", job.wireSourceId)
      .put("sourceRevision", job.sha256).put("name", job.name).put("sha256", job.sha256).put("size", job.size)
      .put("offset", offset).put("state", state))

  private fun expect(code: String, action: () -> Unit) {
    try { action(); error("Expected $code") } catch (error: FilesFailure) { check(error.code == code) }
  }
}
