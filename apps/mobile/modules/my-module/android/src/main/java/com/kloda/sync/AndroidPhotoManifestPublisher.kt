package com.kloda.sync

import android.content.Context
import java.io.Closeable

internal class AndroidPhotoManifestPublisher(context: Context, private val files: AndroidSyncJournal,
  private val resources: AndroidFilesSnapshots, private val check: () -> Unit,
  private val selections: () -> Map<String, String>) : Closeable {
  private val journal = AndroidPhotoManifestJournal(context)
  private val photos = AndroidPhotosSources(context)
  private val snapshots = AndroidPhotoManifestSnapshots(context)

  fun status() = journal.status()
  fun count() = journal.count()

  fun rebackup(record: String, id: String, transfer: AndroidFilesTransfer, recoverResource: (FilesJob) -> FilesJob) {
    check()
    val selected = journal.find(id) ?: throw FilesFailure("not_found")
    val recent = journal.currentAttempt(record, selected) ?: journal.latest(selected)
    val prior = if (recent.job.operationId != null || recent.job.rebackupOf != null) recent
      else journal.parent(recent) ?: throw FilesFailure("source_identity_unknown")
    var pending = prior.job.rebackupOf != null && prior.job.state != "completed" && !journal.deleted(prior.job.id)
    if (!pending) {
      if (prior.job.operationId == null) throw FilesFailure("denied")
      try {
        val ack = transfer.status(prior.job)
        check()
        if (ack.state == "completed") {
          journal.retain(prior.job, ack); journal.clearDeleted(prior.job.id); snapshots.discard(prior); return
        }
        throw FilesFailure("outcome_unknown")
      } catch (error: FilesFailure) { if (error.code != "owner_deleted") throw error }
      journal.markDeleted(prior.job.id)
    } else if (prior.job.operationId != null) {
      try {
        val ack = transfer.status(prior.job)
        check()
        if (ack.state == "completed") {
          journal.retain(prior.job, ack); journal.clearDeleted(prior.job.id); snapshots.discard(prior); return
        }
      } catch (error: FilesFailure) {
        if (error.code != "owner_deleted") throw error
        journal.markDeleted(prior.job.id); pending = false
      }
    }
    val currentResources = prior.manifest.resources.map { resource ->
      check()
      val job = files.readableDatabase.rawQuery("SELECT * FROM files_job WHERE record_id=? AND operation_id=?",
        arrayOf(prior.job.recordId, resource.operationId)).use { if (it.moveToFirst()) files.decode(it) else null } ?: throw FilesFailure("outcome_unknown")
      checkSelection(job.sourceId, job.treeReference)
      val retained = try {
        if (transfer.status(job).state != "completed") throw FilesFailure("outcome_unknown")
        job
      } catch (error: FilesFailure) {
        if (error.code != "owner_deleted" || pending) throw error
        recoverResource(job)
      }
      resource.copy(operationId = retained.operationId ?: throw FilesFailure("outcome_unknown"))
    }
    fun current() {
      check()
      currentResources.forEach { resource ->
        val job = files.readableDatabase.rawQuery("SELECT * FROM files_job WHERE operation_id=?",
          arrayOf(resource.operationId)).use { if (it.moveToFirst()) files.decode(it) else null } ?: throw FilesFailure("outcome_unknown")
        checkSelection(job.sourceId, job.treeReference)
        if (transfer.status(job).state != "completed") throw FilesFailure("outcome_unknown")
      }
    }
    current()
    val publication = if (pending) prior else journal.attempt(prior, prior.manifest.copy(resources = currentResources), record)
    upload(publication, transfer, ::current)
  }

  fun recover() { check(); snapshots.recover() }
  override fun close() { journal.close() }

  fun completed(record: String, file: QueuedSourceFile, digest: FilesDigest, transfer: AndroidFilesTransfer,
    preferredOperation: String? = null): FilesJob? {
    val job = files.readableDatabase.rawQuery("""SELECT * FROM files_job WHERE record_id=? AND reference=? AND name=?
      AND sha256=? AND size_bytes=? AND state='completed' AND tree_reference LIKE 'photos:%'
      ORDER BY (operation_id=?) DESC,rowid DESC LIMIT 1""",
      arrayOf(record, file.reference, file.relativePath.substringAfterLast('/'), digest.sha256, digest.size.toString(), preferredOperation.orEmpty())).use { cursor ->
      if (!cursor.moveToFirst()) return null
      fun text(key: String): String = cursor.getString(cursor.getColumnIndexOrThrow(key))
      FilesJob(text("id"), text("record_id"), text("source_id"), text("reference"), text("tree_reference"), text("name"),
        text("wire_source_id"), text("sha256"), cursor.getLong(cursor.getColumnIndexOrThrow("size_bytes")),
        cursor.getString(cursor.getColumnIndexOrThrow("operation_id")), cursor.getLong(cursor.getColumnIndexOrThrow("acknowledged_bytes")),
        text("state"), null)
    }
    check()
    if (!AndroidPhotosSources.isPhotos(job.treeReference) || job.operationId == null) throw FilesFailure("outcome_unknown")
    val state = try { transfer.status(job).state } catch (error: FilesFailure) {
      if (error.code != "owner_deleted") throw error
      files.markDeleted(job.id)
      return job
    }
    if (state != "completed") {
      throw FilesFailure("outcome_unknown")
    }
    files.clearDeleted(job.id)
    return job
  }

  fun publish(record: String, source: String, tree: String, file: QueuedSourceFile, transfer: AndroidFilesTransfer,
    recoverResource: (FilesJob) -> FilesJob = { throw FilesFailure("owner_deleted") }) =
    synchronized(AndroidSyncJournal.sourceLock) {
      checkSelection(source, tree)
      val metadata = photos.metadata(tree, file.reference, journal)
      val digest = resources.currentDigest(tree, file.reference)
      if (metadata.name != file.relativePath || digest.size != file.size) throw FilesFailure("source_changed")
      val preferred = journal.preferredOperation(record, metadata.assetId, metadata.name, digest)
      var resource = completed(record, file, digest, transfer, preferred) ?: throw FilesFailure("outcome_unknown")
      var draft = PhotoManifest(metadata.sourceDeviceId, metadata.assetId, 1,
        listOf(PhotoResource(resource.operationId!!, "original", metadata.name, metadata.mimeType, digest.sha256, digest.size)),
        metadata.albums, metadata.favorite)
      fun sourceCurrent() {
        checkSelection(source, tree)
        if (!files.sourceAvailable(resource.copy(sourceId = source, treeReference = tree)) ||
          photos.metadata(tree, file.reference, journal) != metadata || resources.currentDigest(tree, file.reference) != digest) {
          throw FilesFailure("source_changed")
        }
        checkSelection(source, tree)
      }
      sourceCurrent()
      if (files.deleted(resource.id)) {
        if (!journal.metadataChanged(record, draft)) throw FilesFailure("owner_deleted")
        resource = recoverResource(resource)
        sourceCurrent()
        draft = draft.copy(resources = draft.resources.map { it.copy(operationId = resource.operationId!!) })
      }
      fun current() {
        sourceCurrent()
        if (transfer.status(resource).state != "completed") throw FilesFailure("outcome_unknown")
        sourceCurrent()
      }
      current()
      val publication = journal.prepare(record, draft)
      try { upload(publication, transfer, ::current) }
      catch (error: FilesFailure) {
        if (error.code == "owner_deleted") journal.markDeleted(publication.job.id)
        throw error
      }
    }

  private fun checkSelection(source: String, tree: String) {
    check()
    if (selections()[source] != tree) throw FilesFailure("source_permission_lost")
  }

  internal fun upload(publication: PhotoPublication, transfer: AndroidFilesTransfer, current: () -> Unit) {
    var job = publication.job
    current()
    if (job.operationId != null) {
      val ack = transfer.status(job)
      current()
      if (job.state == "completed" && ack.state != "completed") throw FilesFailure("outcome_unknown")
      job = journal.retain(job, ack)
      if (ack.state == "completed") { journal.clearDeleted(job.id); snapshots.discard(publication); return }
    } else if (job.state == "completed") throw FilesFailure("outcome_unknown")
    snapshots.open(publication).use { descriptor ->
      current()
      var ack = if (job.operationId == null) transfer.create(job) else transfer.status(job)
      current()
      job = journal.retain(job, ack)
      while (ack.state == "receiving" && job.offset < job.size) {
        current()
        ack = transfer.chunk(job, descriptor.fd)
        job = journal.retain(job, ack)
      }
      current()
      if (ack.state != "completed") {
        ack = transfer.finalize(job)
        current()
        if (ack.state != "completed") throw FilesFailure("outcome_unknown")
        job = journal.retain(job, ack)
      }
      if (job.state != "completed") throw FilesFailure("outcome_unknown")
    }
    journal.clearDeleted(job.id)
    snapshots.discard(publication)
  }
}
