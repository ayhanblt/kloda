package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteException
import android.os.CancellationSignal
import java.util.concurrent.atomic.AtomicBoolean

internal class AndroidFilesQueue(private val context: Context, private val onStopped: (Thread) -> Unit = {}, private val mayRun: () -> Boolean) {
  private val lock = Any()
  private val journal = AndroidSyncJournal(context)
  private val runs = AndroidFilesRunJournal(journal, context)
  private val stopped = AtomicBoolean(true)
  private val snapshots = AndroidFilesSnapshots(context) { checkPaused() }
  private val manifests = AndroidPhotoManifestPublisher(context, journal, snapshots, { checkPaused() }, { sources() })
  @Volatile private var worker: Thread? = null
  @Volatile private var errorCode: String? = null
  @Volatile private var activeRun: String? = null
  @Volatile private var activeRecord: String? = null
  @Volatile private var activeContext: FilesRunContext? = null
  @Volatile private var pauseCode = "paused"
  @Volatile private var scanCancellation: CancellationSignal? = null

  fun start(record: String, owner: Long, rebackup: String? = null, expectedBinding: String? = null): Map<String, Any> = synchronized(lock) {
    if (worker?.isAlive == true) {
      if (activeRecord != record) throw FilesFailure("denied")
      if (rebackup != null) throw FilesFailure("backup_busy")
      return@synchronized status()
    }
    val run = synchronized(AndroidSyncJournal.sourceLock) {
      val snapshot = FilesRunContext.capture(context)
      if (expectedBinding != null && snapshot.binding != expectedBinding) throw FilesFailure("settings_changed")
      runs.begin(record, rebackup, snapshot.binding).also { activeContext = snapshot }
    }
    activeRun = run.id
    stopped.set(false); pauseCode = "paused"; errorCode = null; activeRecord = record
    if (rebackup == null) runCatching { AndroidBackupScheduler.clearExecutionError(context) }
    val observed = status()
    worker = Thread({ AndroidFilesRunWorker(runs, journal, ::checkPaused, ::failureCode,
      { errorCode = it }, { errorCode }, { stopped.set(true) }) { retained ->
      run(retained.record, owner, retained.rebackup)
    }.execute(run)
      onStopped(Thread.currentThread())
    }, "kloda-files-queue").also { it.start() }
    observed
  }

  fun awaitStopped() {
    val retained = worker
    if (retained != null && retained !== Thread.currentThread()) retained.join()
  }

  fun running(): Boolean = worker?.isAlive == true

  fun clearPeerState() = synchronized(lock) {
    if (worker?.isAlive != true) {
      activeRecord = null
      activeRun = null
      errorCode = null
    }
  }

  fun status(): Map<String, Any> {
    val binding = FilesRunContext.capture(context).binding
    runs.invalidate(binding)
    val running = worker?.isAlive == true
    val currentRecord = activeRecord ?: runCatching { AndroidBackupDestinations.currentPairedRecordId(context) }.getOrNull()
    val files = journal.status(running, if (currentRecord != null || running) errorCode else null, currentRecord, filterByRecord = true)
    val photos = manifests.status(currentRecord, filterByRecord = true)
    @Suppress("UNCHECKED_CAST")
    val jobs = (photos + (files["jobs"] as List<Map<String, Any>>)).take(100)
    val total = (files["totalJobs"] as String).toLong() + manifests.count(currentRecord, filterByRecord = true)
    val run = currentRecord?.let { runs.latest(it)?.takeIf { r -> r.visibleFor(binding) }?.view(running) }
    return files + (if (run == null) emptyMap() else mapOf("run" to run)) + mapOf("jobs" to jobs, "totalJobs" to total.toString(), "hasMore" to (total > jobs.size))
  }

  fun requestPause(code: String = "paused") { pauseCode = code; stopped.set(true); scanCancellation?.cancel(); snapshots.cancelRead() }

  fun pause(code: String = "paused"): Map<String, Any> {
    requestPause(code)
    val retained = synchronized(lock) { worker }
    if (retained != null && retained !== Thread.currentThread()) {
      var interrupted = false
      while (retained.isAlive) {
        try { retained.join() } catch (_: InterruptedException) { interrupted = true }
      }
      if (interrupted) Thread.currentThread().interrupt()
    }
    activeRecord?.let { journal.interrupt(it, code) }
    return status()
  }

  fun close() { try { pause() } finally { try { manifests.close() } finally { journal.close() } } }

  private fun checkPaused() {
    activeContext?.check(context)
    if (stopped.get() || !mayRun()) throw FilesFailure(if (stopped.get()) pauseCode else "paused")
  }

  private fun sources(): Map<String, String> = activeContext?.sources ?: throw FilesFailure("queue_unavailable")

  private fun checkSource(job: FilesJob) {
    checkPaused()
    if (sources()[job.sourceId] != job.treeReference) throw FilesFailure("source_permission_lost")
    if (!journal.sourceAvailable(job)) throw FilesFailure("source_changed")
    snapshots.checkAccess(job.treeReference, job.reference)
  }

  private fun run(record: String, owner: Long, rebackup: String?) {
    snapshots.recover(journal)
    manifests.recover()
    val transfer = AndroidFilesTransfer { command, descriptor ->
      checkPaused()
      KlodaPairingJni.transfer(owner, record, command, descriptor)
    }
    if (rebackup != null) rebackup(record, rebackup, transfer)
    prepare(record, transfer)
  }

  private fun rebackup(record: String, id: String, transfer: AndroidFilesTransfer) {
    checkPaused()
    val prior = journal.find(id)
    if (prior == null) {
      manifests.rebackup(record, id, transfer) { resource -> rebackupResource(resource, transfer, record) }
      return
    }
    rebackupResource(prior, transfer, record)
  }

  private fun rebackupResource(initial: FilesJob, transfer: AndroidFilesTransfer, record: String = initial.recordId): FilesJob {
    val latest = journal.version(record, initial.sourceId, QueuedSourceFile(initial.reference, initial.name, "", initial.size),
      initial.treeReference, initial.sha256, initial.size)
    val prior = latest ?: initial.copy(recordId = record)
    if (prior.wireSourceId != initial.wireSourceId) throw FilesFailure("source_identity_unknown")
    if (prior.rebackupOf != null && prior.state != "completed" && !journal.deleted(prior.id)) {
      sendJob(prior, transfer)
      val resumed = journal.find(prior.id) ?: throw FilesFailure("outcome_unknown")
      if (resumed.state == "completed" && !journal.deleted(resumed.id)) return resumed
      if (!journal.deleted(resumed.id)) throw FilesFailure("outcome_unknown")
    } else if (prior.id != initial.id && prior.operationId != null) {
      try { if (transfer.status(prior).state == "completed") return prior }
      catch (error: FilesFailure) { if (error.code != "owner_deleted") throw error }
    }
    val proof = if (prior.operationId != null) prior else if (initial.operationId != null) initial
      else journal.parent(prior) ?: throw FilesFailure("source_identity_unknown")
    if (proof.operationId == null) throw FilesFailure("source_identity_unknown")
    try { transfer.status(proof); throw FilesFailure("conflict") }
    catch (error: FilesFailure) { if (error.code != "owner_deleted") throw error }
    journal.markDeleted(prior.id)
    val staged = synchronized(AndroidSyncJournal.sourceLock) {
      checkSource(prior)
      val snapshot = snapshots.stage(prior.treeReference, prior.reference)
      var retained = false
      try {
        if (snapshot.digest.sha256 != prior.sha256 || snapshot.digest.size != prior.size) throw FilesFailure("source_changed")
        val file = QueuedSourceFile(prior.reference, prior.name, "", prior.size)
        val latest = journal.version(prior.recordId, prior.sourceId, file, prior.treeReference, prior.sha256, prior.size)
        if (latest != null && latest.id != prior.id && latest.rebackupOf == proof.operationId) return@synchronized latest
        val job = prior.copy(id = snapshot.id, operationId = null, offset = 0, state = "queued", errorCode = null,
          rebackupOf = proof.operationId)
        journal.insert(job); retained = true
        job
      } finally { if (!retained) snapshots.discard(snapshot) }
    }
    if (staged.state != "completed") sendJob(staged, transfer)
    return journal.find(staged.id)?.takeIf { it.state == "completed" } ?: throw FilesFailure("outcome_unknown")
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
            var completedResource: FilesJob? = null
            var knownDigest: FilesDigest? = null
            var suppressed = false
            val hasCandidate = synchronized(AndroidSyncJournal.sourceLock) {
              checkPaused()
              if (sources()[source] != tree) throw FilesFailure("source_permission_lost")
              journal.hasCandidateVersion(record, file, tree)
            }
            if (!hasCandidate) {
              val snapshot = snapshots.stage(tree, file.reference)
              knownDigest = snapshot.digest
              var insertionAttempted = false
              try {
                synchronized(AndroidSyncJournal.sourceLock) {
                  checkPaused()
                  if (sources()[source] != tree) throw FilesFailure("source_permission_lost")
                  val existing = journal.version(record, source, file, tree, snapshot.digest.sha256, snapshot.digest.size)
                  if (existing == null) {
                    insertionAttempted = true
                    val job = FilesJob(snapshot.id, record, source, file.reference, tree, file.relativePath.substringAfterLast('/'),
                      journal.wireSource(record, file, tree), snapshot.digest.sha256, snapshot.digest.size, null, 0, "queued", null)
                    journal.insert(job)
                    staged = job
                  } else {
                    completedResource = existing.takeIf { it.state == "completed" }
                    suppressed = journal.deleted(existing.id)
                  }
                }
              } finally { if (!insertionAttempted) snapshots.discard(snapshot) }
            } else {
              val current = snapshots.currentDigest(tree, file.reference)
              knownDigest = current
              val prior = if (AndroidPhotosSources.isPhotos(tree)) manifests.completed(record, file, current, transfer) ?:
                journal.version(record, source, file, tree, current.sha256, current.size)
                else journal.version(record, source, file, tree, current.sha256, current.size)
              if (prior?.state == "completed") {
                synchronized(AndroidSyncJournal.sourceLock) { track(prior) }
                checkPaused()
                try {
                  if (transfer.status(prior).state != "completed") throw FilesFailure("outcome_unknown")
                  journal.clearDeleted(prior.id)
                  completedResource = prior
                } catch (error: FilesFailure) {
                  if (error.code != "owner_deleted") throw error
                  journal.markDeleted(prior.id)
                }
              }
              suppressed = prior != null && journal.deleted(prior.id)
              if (prior == null) {
                val snapshot = snapshots.stage(tree, file.reference)
                knownDigest = snapshot.digest
                var insertionAttempted = false
                try {
                  synchronized(AndroidSyncJournal.sourceLock) {
                    checkPaused()
                    if (sources()[source] != tree) throw FilesFailure("source_permission_lost")
                    if (journal.version(record, source, file, tree, snapshot.digest.sha256, snapshot.digest.size) == null) {
                      insertionAttempted = true
                      val job = FilesJob(snapshot.id, record, source, file.reference, tree, file.relativePath.substringAfterLast('/'),
                        journal.wireSource(record, file, tree), snapshot.digest.sha256, snapshot.digest.size, null, 0, "queued", null)
                      journal.insert(job)
                      staged = job
                    }
                  }
                } finally { if (!insertionAttempted) snapshots.discard(snapshot) }
              }
            }
            staged?.let {
              completedResource = sendJob(it, transfer, freshlyStaged = true)
              suppressed = journal.deleted(it.id)
            }
            if (suppressed && !AndroidPhotosSources.isPhotos(tree)) continue
            if (AndroidPhotosSources.isPhotos(tree)) try {
              manifests.publish(record, source, tree, file, transfer, knownDigest = knownDigest, knownResource = completedResource) { resource ->
                rebackupResource(resource, transfer)
              }
            } catch (error: FilesFailure) { if (error.code != "owner_deleted") throw error }
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

  private fun track(job: FilesJob) {
    AndroidScheduleJournal.track(journal.writableDatabase, activeRun ?: throw FilesFailure("queue_unavailable"), job.id, job.recordId)
  }

  private fun sendJob(initial: FilesJob, transfer: AndroidFilesTransfer, freshlyStaged: Boolean = false): FilesJob? {
    try {
    track(initial)
    var job = initial
    snapshots.open(job).use { descriptor ->
      if (!freshlyStaged) {
        snapshots.validate(FilesDigest(job.sha256, job.size), descriptor)
      }
      synchronized(AndroidSyncJournal.sourceLock) {
        checkSource(job)
      }
      var ack = if (job.operationId == null) transfer.create(job) else transfer.status(job)
      fun retain(value: FilesAck) {
        if (value.state == "completed") synchronized(AndroidSyncJournal.sourceLock) {
          checkSource(job)
          journal.update(job.id, "completed", operation = value.id, offset = value.offset)
        }
        val state = when (value.state) { "completed" -> "completed"; "receiving" -> "uploading"; else -> "finalizing" }
        if (state != "completed") journal.update(job.id, state, operation = value.id, offset = value.offset)
        job = job.copy(operationId = value.id, offset = value.offset, state = state, errorCode = null)
        if (state == "completed") snapshots.discard(FilesSnapshot(job.id, FilesDigest(job.sha256, job.size)))
      }
      retain(ack)
      if (ack.state == "completed") return job
      while (ack.state == "receiving" && job.offset < job.size) {
        checkPaused()
        if (sources()[job.sourceId] != job.treeReference) throw FilesFailure("source_permission_lost")
        ack = transfer.chunk(job, descriptor.fd)
        retain(ack)
      }
      if (ack.state == "completed") return job
      synchronized(AndroidSyncJournal.sourceLock) {
        checkSource(job)
        journal.update(job.id, "finalizing")
      }
      val final = transfer.finalize(job)
      if (final.state != "completed") throw FilesFailure("outcome_unknown")
      retain(final)
      return job
    }
    } catch (error: Throwable) {
      val code = failureCode(error)
      if (code == "owner_deleted") { journal.markDeleted(initial.id); return null }
      val blocked = code in setOf("source_changed", "source_permission_lost", "snapshot_unavailable", "denied", "revoked",
        "hash_mismatch", "backup_scope_changed", "backup_path_rejected", "invalid_request", "conflict", "not_found")
      journal.update(initial.id, if (blocked) "blocked" else "paused", code)
      errorCode = code
      if (!blocked) throw FilesFailure(code)
      return null
    }
  }

  private fun failureCode(error: Throwable): String {
    if (stopped.get()) return pauseCode
    if (error is FilesFailure) return error.code
    if (error is SecurityException) return "source_permission_lost"
    if (isLocalStorageFull(error)) return "local_storage_full"
    if (error is SQLiteException) return "storage_failure"
    if (error is UnsatisfiedLinkError) return "native_unsupported"
    return "queue_unavailable"
  }
}
