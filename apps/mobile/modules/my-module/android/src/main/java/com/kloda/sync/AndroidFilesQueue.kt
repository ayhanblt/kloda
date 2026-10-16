package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteFullException
import android.database.sqlite.SQLiteException
import android.os.CancellationSignal
import android.system.ErrnoException
import android.system.OsConstants
import org.json.JSONArray
import java.util.concurrent.atomic.AtomicBoolean

internal class AndroidFilesQueue(private val context: Context, private val foreground: () -> Boolean) {
  private val lock = Any()
  private val journal = AndroidSyncJournal(context)
  private val stopped = AtomicBoolean(true)
  private val snapshots = AndroidFilesSnapshots(context) { checkPaused() }
  private val manifests = AndroidPhotoManifestPublisher(context, journal, snapshots, { checkPaused() }, { sources() })
  @Volatile private var worker: Thread? = null
  @Volatile private var errorCode: String? = null
  @Volatile private var activeRecord: String? = null
  @Volatile private var scanCancellation: CancellationSignal? = null

  fun start(record: String, owner: Long): Map<String, Any> = synchronized(lock) {
    if (worker?.isAlive == true) {
      if (activeRecord != record) throw FilesFailure("denied")
      return@synchronized status()
    }
    val observed = journal.status(true, null)
    stopped.set(false); errorCode = null; activeRecord = record
    worker = Thread({
      try { run(record, owner) }
      catch (error: Throwable) {
        val code = failureCode(error)
        errorCode = code
        runCatching { journal.interrupt(record, code) }
      } finally {
        stopped.set(true)
        runCatching { journal.interrupt(record, errorCode ?: "paused") }
      }
    }, "kloda-files-queue").also { it.start() }
    observed
  }

  fun status(): Map<String, Any> = journal.status(worker?.isAlive == true, errorCode)

  fun requestPause() { stopped.set(true); scanCancellation?.cancel(); snapshots.cancelRead() }

  fun pause(): Map<String, Any> {
    requestPause()
    val retained = synchronized(lock) { worker }
    if (retained != null && retained !== Thread.currentThread()) {
      var interrupted = false
      while (retained.isAlive) {
        try { retained.join() } catch (_: InterruptedException) { interrupted = true }
      }
      if (interrupted) Thread.currentThread().interrupt()
    }
    activeRecord?.let { journal.interrupt(it, "paused") }
    return status()
  }

  fun close() { try { pause() } finally { try { manifests.close() } finally { journal.close() } } }

  private fun checkPaused() { if (stopped.get() || !foreground()) throw FilesFailure("paused") }

  private fun sources(): Map<String, String> {
    val preferences = context.getSharedPreferences("kloda-sync", 0)
    return buildMap { for (key in listOf("directorySources", "photoSources")) {
      val values = JSONArray(preferences.getString(key, "[]"))
      repeat(values.length()) {
        val source = values.getJSONObject(it)
        put(source.getString("id"), source.getString("reference"))
      }
    } }
  }

  private fun checkSource(job: FilesJob) {
    checkPaused()
    if (sources()[job.sourceId] != job.treeReference) throw FilesFailure("source_permission_lost")
    if (!journal.sourceAvailable(job)) throw FilesFailure("source_changed")
    snapshots.checkAccess(job.treeReference, job.reference)
  }

  private fun run(record: String, owner: Long) {
    snapshots.recover(journal)
    manifests.recover()
    val transfer = AndroidFilesTransfer { command, descriptor ->
      checkPaused()
      KlodaPairingJni.transfer(owner, record, command, descriptor)
    }
    prepare(record, transfer)
  }

  private fun prepare(record: String, transfer: AndroidFilesTransfer) {
    val scanner = AndroidSafSourceScanner(context.contentResolver)
    val media = AndroidPhotosSources(context)
    for ((source, tree) in sources()) {
      checkPaused()
      try {
        val cancellation = CancellationSignal()
        scanCancellation = cancellation
        try {
          checkPaused()
          val files = if (AndroidPhotosSources.isPhotos(tree)) media.scan(tree, cancellation) else scanner.scan(tree, cancellation)
          journal.reconcileSourceFiles(source, tree, files.onEach { checkPaused() })
        } finally { scanCancellation = null }
        var retainedAfter: String? = null
        while (true) {
          checkPaused()
          val retained = journal.jobs(record, source, retainedAfter)
          if (retained.isEmpty()) break
          for (job in retained) {
            retainedAfter = job.id
            sendJob(job, transfer)
          }
        }
        var after: String? = null
        while (true) {
          checkPaused()
          val files = journal.sourceFiles(source, after)
          if (files.isEmpty()) break
          for (file in files) {
            after = file.reference
            var staged: FilesJob? = null
            synchronized(AndroidSyncJournal.sourceLock) {
              checkPaused()
              if (sources()[source] != tree) throw FilesFailure("source_permission_lost")
              val current = snapshots.currentDigest(tree, file.reference)
              val prior = if (AndroidPhotosSources.isPhotos(tree)) manifests.completed(record, file, current, transfer) ?:
                journal.version(record, source, file, tree, current.sha256, current.size)
                else journal.version(record, source, file, tree, current.sha256, current.size)
              if (prior?.state == "completed") {
                checkPaused()
                if (transfer.status(prior).state != "completed") throw FilesFailure("outcome_unknown")
              }
              if (prior == null) {
                val snapshot = snapshots.stage(tree, file.reference)
                var insertionAttempted = false
                try {
                  checkPaused()
                  if (sources()[source] != tree) throw FilesFailure("source_permission_lost")
                  if (journal.version(record, source, file, tree, snapshot.digest.sha256, snapshot.digest.size) == null) {
                    insertionAttempted = true
                    val job = FilesJob(snapshot.id, record, source, file.reference, tree, file.relativePath.substringAfterLast('/'),
                      AndroidFilesSnapshots.randomId(), snapshot.digest.sha256, snapshot.digest.size, null, 0, "queued", null)
                    journal.insert(job)
                    staged = job
                  }
                } finally { if (!insertionAttempted) snapshots.discard(snapshot) }
              }
            }
            staged?.let { sendJob(it, transfer) }
            if (AndroidPhotosSources.isPhotos(tree)) manifests.publish(record, source, tree, file, transfer)
          }
        }
      } catch (error: Throwable) {
        val code = failureCode(error)
        if (code != "source_changed" && code != "source_permission_lost") throw FilesFailure(code)
        journal.blockSource(source, code)
        errorCode = code
      }
    }
  }

  private fun sendJob(initial: FilesJob, transfer: AndroidFilesTransfer) {
    try {
    var job = initial
    snapshots.open(job).use { descriptor ->
      synchronized(AndroidSyncJournal.sourceLock) {
        checkSource(job)
        snapshots.validate(job, descriptor)
        checkSource(job)
      }
      var ack = if (job.operationId == null) transfer.create(job) else transfer.status(job)
      fun retain(value: FilesAck) {
        if (value.state == "completed") synchronized(AndroidSyncJournal.sourceLock) {
          checkSource(job)
          snapshots.validateSource(job)
          checkSource(job)
          journal.update(job.id, "completed", operation = value.id, offset = value.offset)
        }
        val state = when (value.state) { "completed" -> "completed"; "receiving" -> "uploading"; else -> "finalizing" }
        if (state != "completed") journal.update(job.id, state, operation = value.id, offset = value.offset)
        job = job.copy(operationId = value.id, offset = value.offset, state = state, errorCode = null)
        if (state == "completed") snapshots.discard(FilesSnapshot(job.id, FilesDigest(job.sha256, job.size)))
      }
      retain(ack)
      if (ack.state == "completed") return
      while (ack.state == "receiving" && job.offset < job.size) {
        checkSource(job)
        ack = transfer.chunk(job, descriptor.fd)
        retain(ack)
      }
      if (ack.state == "completed") return
      synchronized(AndroidSyncJournal.sourceLock) {
        checkSource(job)
        snapshots.validateSource(job)
        checkSource(job)
        journal.update(job.id, "finalizing")
        val final = transfer.finalize(job)
        if (final.state != "completed") throw FilesFailure("outcome_unknown")
        retain(final)
      }
    }
    } catch (error: Throwable) {
      val code = failureCode(error)
      val blocked = code in setOf("source_changed", "source_permission_lost", "snapshot_unavailable", "denied", "revoked",
        "hash_mismatch", "backup_scope_changed", "backup_path_rejected", "invalid_request", "conflict", "not_found")
      journal.update(initial.id, if (blocked) "blocked" else "paused", code)
      errorCode = code
      if (!blocked) throw FilesFailure(code)
    }
  }

  private fun failureCode(error: Throwable): String {
    if (stopped.get()) return "paused"
    if (error is FilesFailure) return error.code
    if (error is SecurityException) return "source_permission_lost"
    if (error is SQLiteFullException) return "local_storage_full"
    var cause: Throwable? = error
    while (cause != null) {
      if (cause is ErrnoException && cause.errno == OsConstants.ENOSPC) return "local_storage_full"
      cause = cause.cause
    }
    if (error is SQLiteException) return "storage_failure"
    if (error is UnsatisfiedLinkError) return "native_unsupported"
    return "queue_unavailable"
  }
}
