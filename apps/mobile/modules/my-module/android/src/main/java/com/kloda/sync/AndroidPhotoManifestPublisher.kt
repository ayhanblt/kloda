package com.kloda.sync

import android.content.Context
import java.io.Closeable

internal class AndroidPhotoManifestPublisher(context: Context, private val files: AndroidSyncJournal,
  private val resources: AndroidFilesSnapshots, private val check: () -> Unit,
  private val selections: () -> Map<String, String>) : Closeable {
  private val journal = AndroidPhotoManifestJournal(context)
  private val photos = AndroidPhotosSources(context)
  private val snapshots = AndroidPhotoManifestSnapshots(context)

  fun recover() { check(); snapshots.recover() }
  override fun close() { journal.close() }

  fun completed(record: String, file: QueuedSourceFile, digest: FilesDigest, transfer: AndroidFilesTransfer,
    preferredOperation: String? = null): FilesJob? {
    val job = files.readableDatabase.rawQuery("""SELECT * FROM files_job WHERE record_id=? AND reference=? AND name=?
      AND sha256=? AND size_bytes=? AND state='completed' AND tree_reference LIKE 'photos:%'
      ORDER BY (operation_id=?) DESC,rowid ASC LIMIT 1""",
      arrayOf(record, file.reference, file.relativePath.substringAfterLast('/'), digest.sha256, digest.size.toString(), preferredOperation.orEmpty())).use { cursor ->
      if (!cursor.moveToFirst()) return null
      fun text(key: String): String = cursor.getString(cursor.getColumnIndexOrThrow(key))
      FilesJob(text("id"), text("record_id"), text("source_id"), text("reference"), text("tree_reference"), text("name"),
        text("wire_source_id"), text("sha256"), cursor.getLong(cursor.getColumnIndexOrThrow("size_bytes")),
        cursor.getString(cursor.getColumnIndexOrThrow("operation_id")), cursor.getLong(cursor.getColumnIndexOrThrow("acknowledged_bytes")),
        text("state"), null)
    }
    check()
    if (!AndroidPhotosSources.isPhotos(job.treeReference) || job.operationId == null || transfer.status(job).state != "completed") {
      throw FilesFailure("outcome_unknown")
    }
    return job
  }

  fun publish(record: String, source: String, tree: String, file: QueuedSourceFile, transfer: AndroidFilesTransfer) =
    synchronized(AndroidSyncJournal.sourceLock) {
      checkSelection(source, tree)
      val metadata = photos.metadata(tree, file.reference, journal)
      val digest = resources.currentDigest(tree, file.reference)
      if (metadata.name != file.relativePath || digest.size != file.size) throw FilesFailure("source_changed")
      val preferred = journal.preferredOperation(record, metadata.assetId, metadata.name, digest)
      val resource = completed(record, file, digest, transfer, preferred) ?: throw FilesFailure("outcome_unknown")
      val draft = PhotoManifest(metadata.sourceDeviceId, metadata.assetId, 1,
        listOf(PhotoResource(resource.operationId!!, "original", metadata.name, metadata.mimeType, digest.sha256, digest.size)),
        metadata.albums, metadata.favorite)
      fun current() {
        checkSelection(source, tree)
        if (!files.sourceAvailable(resource.copy(sourceId = source, treeReference = tree)) ||
          photos.metadata(tree, file.reference, journal) != metadata || resources.currentDigest(tree, file.reference) != digest) {
          throw FilesFailure("source_changed")
        }
        if (transfer.status(resource).state != "completed") throw FilesFailure("outcome_unknown")
        checkSelection(source, tree)
      }
      current()
      val publication = journal.prepare(record, draft)
      upload(publication, transfer, ::current)
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
      if (ack.state == "completed") { snapshots.discard(publication); return }
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
    snapshots.discard(publication)
  }
}
