package com.kloda.sync

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.provider.MediaStore
import java.io.ByteArrayInputStream

/** Real MediaStore/SQLite/publisher, simulated PC replies; run after Photos permission checks. */
internal object AndroidPhotoRebackupChecks {
  fun run(context: Context) {
    check(Build.VERSION.SDK_INT >= 29)
    val photos = AndroidPhotosSources(context)
    check(photos.hasAccess()) { "Photos fixture permissions must already be granted" }
    val resolver = context.contentResolver
    val folder = "KlodaRebackup-${AndroidFilesSnapshots.randomId()}"
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, "photo.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
    }) ?: error("MediaStore fixture unavailable")
    val bytes = android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", 0)
    var selected: String? = null
    try {
      resolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
      check(resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val source = photos.selectLibrary(); selected = source.getValue("id")
      val tree = source.getValue("reference"); val id = source.getValue("id")
      val file = photos.scan(tree).single { it.reference == uri.toString() }
      val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
      val record = AndroidFilesSnapshots.randomId()
      val resource = FilesJob(AndroidFilesSnapshots.randomId(), record, id, file.reference, tree, file.relativePath,
        AndroidFilesSnapshots.randomId(), digest.sha256, digest.size, AndroidFilesSnapshots.randomId(), digest.size, "completed", null)
      val native = AndroidPhotoManifestChecks.NativeFixture().apply {
        operations[resource.operationId!!] = AndroidPhotoManifestChecks.operation(resource)
        requests[resource.id] = resource.operationId
      }
      val transfer = AndroidFilesTransfer(native::send)
      AndroidSyncJournal(context).use { files ->
        files.reconcileSourceFiles(id, tree, sequenceOf(file))
        files.insert(resource); files.update(resource.id, "completed", operation = resource.operationId, offset = resource.size)
        fun publisher(action: (AndroidPhotoManifestPublisher) -> Unit) {
          AndroidPhotoManifestPublisher(context, files, AndroidFilesSnapshots(context) {}, {},
            { photos.load().associate { it.getValue("id") to it.getValue("reference") } }).use(action)
        }
        publisher { it.publish(record, id, tree, file, transfer) }
        val original = latest(context, record)
        check(original.job.state == "completed" && original.job.operationId != null)
        val resourceReceipt = files.find(resource.id)!!
        val before = native.creates
        native.deletedOps.add(original.job.operationId!!)
        publisher { current -> expect("owner_deleted") { current.publish(record, id, tree, file, transfer) } }
        check(native.creates == before && latest(context, record).job == original.job)
        AndroidPhotoManifestJournal(context).use { check(it.deleted(original.job.id)) }

        native.lose = "finalize"
        publisher { current -> expect("connection_closed") {
          current.rebackup(record, original.job.id, transfer) { error("Retained shared resource must not be reuploaded") }
        } }
        val uncertain = latest(context, record)
        check(uncertain.job.id != original.job.id && uncertain.job.rebackupOf == original.job.operationId)
        check(uncertain.job.state != "completed" && uncertain.job.offset == uncertain.job.size)
        check(native.rebackupRequests[uncertain.job.id] == original.job.operationId)
        val afterLostReply = native.creates
        // A fresh publisher opens the durable journal; this is not Android process-kill acceptance.
        publisher { current -> current.rebackup(record, original.job.id, transfer) { error("Retained resource must stay shared") } }
        val recovered = latest(context, record)
        check(recovered.job.id == uncertain.job.id && recovered.job.state == "completed")
        check(native.creates == afterLostReply && files.find(resource.id) == resourceReceipt)
        AndroidPhotoManifestJournal(context).use { check(it.find(original.job.id)!!.job == original.job) }

        native.deletedOps.add(recovered.job.operationId!!)
        native.deletedOps.add(resource.operationId!!)
        var resourceRecoveries = 0
        publisher { current -> expect("owner_deleted") {
          current.publish(record, id, tree, file, transfer) { error("Unchanged automatic source must remain suppressed") }
        } }
        check(native.creates == afterLostReply && resourceRecoveries == 0)
        // Only this explicit callback simulates a newly completed resource; it is not the real Files sender.
        publisher { current -> current.rebackup(record, original.job.id, transfer) { old ->
          resourceRecoveries++
          val replacement = old.copy(id = AndroidFilesSnapshots.randomId(), operationId = AndroidFilesSnapshots.randomId(),
            state = "completed", rebackupOf = old.operationId)
          files.insert(replacement); files.update(replacement.id, "completed", operation = replacement.operationId, offset = replacement.size)
          native.operations[replacement.operationId!!] = AndroidPhotoManifestChecks.operation(replacement)
          replacement
        } }
        val rebuilt = latest(context, record)
        check(resourceRecoveries == 1 && rebuilt.job.state == "completed")
        check(rebuilt.job.rebackupOf == recovered.job.operationId && rebuilt.manifest.revision == original.manifest.revision)
        check(rebuilt.manifest.resources.single().operationId != resource.operationId)
        check(files.find(resource.id) == resourceReceipt)
        val done = native.creates
        publisher { it.publish(record, id, tree, file, transfer) }
        check(native.creates == done)
      }
    } finally {
      selected?.let { photos.remove(it) }
      resolver.delete(uri, null, null)
    }
  }

  private fun latest(context: Context, record: String): PhotoPublication = AndroidPhotoManifestJournal(context).use { journal ->
    journal.readableDatabase.rawQuery("SELECT request FROM publication WHERE record=? ORDER BY rowid DESC LIMIT 1", arrayOf(record)).use {
      check(it.moveToFirst()); journal.find(it.getString(0))!!
    }
  }

  private fun expect(code: String, action: () -> Unit) {
    try { action(); error("Expected $code") } catch (failure: FilesFailure) { check(failure.code == code) }
  }
}
