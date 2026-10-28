package com.kloda.sync

import android.app.Instrumentation
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.system.Os
import android.system.OsConstants
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream

internal object AndroidPhotoManifestChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    codec()
    recovery(context)
    media(instrumentation, context)
  }
  private fun draft(device: String = "source", asset: String = "asset"): PhotoManifest = PhotoManifest(device, asset, 1,
    listOf(PhotoResource(AndroidFilesSnapshots.randomId(), "original", "photo.png", "image/png",
      AndroidFilesSnapshots.digest(ByteArrayInputStream(byteArrayOf(1, 2, 3))).sha256, 3)), listOf(PhotoAlbum("album", "Pictures")), true)

  private fun codec() {
    val value = draft().copy(revision = Long.MAX_VALUE, resources = draft().resources.map { it.copy(size = Long.MAX_VALUE) })
    val bytes = PhotoManifestCodec.encode(value)
    check(PhotoManifestCodec.decode(bytes) == value)
    // Verify the Android implementation, rather than assuming desktop org.json rejects duplicate keys.
    check(JSONObject("{\"key\":1,\"key\":2}").getInt("key") == 2)
    val text = bytes.toString(Charsets.UTF_8)
    val invalid = listOf(text.dropLast(1), text + "{}", "{\"version\":1," + text.drop(1),
      text.replace("\"revision\":\"${Long.MAX_VALUE}\"", "\"revision\":1"),
      text.replace("\"version\":1", "\"version\":1.0"), text.replace("\"assetId\":\"asset\"", "\"assetId\":\"a\\q\""),
      text.replace("photo.png", "../photo.png"), text.replace("photo.png", "photo\\u0000.png"),
      text.replace("\"favorite\":true", "\"favorite\":\"true\""))
    invalid.forEach { expect("invalid_request") { PhotoManifestCodec.decode(it.toByteArray()) } }
    expect("invalid_request") { PhotoManifestCodec.decode(ByteArray(PhotoManifestCodec.maxBytes + 1)) }
    expect("invalid_request") { PhotoManifestCodec.decode(byteArrayOf(0xc3.toByte(), 0x28)) }
    expect("invalid_request") { PhotoManifestCodec.encode(value.copy(resources = value.resources + value.resources)) }
    expect("invalid_request") { PhotoManifestCodec.encode(value.copy(albums = value.albums + value.albums)) }
    expect("invalid_request") { PhotoManifestCodec.encode(value.copy(resources = value.resources.map { it.copy(operationId = "AAAAAAAAAAAAAAAAAAAAAB") })) }
    val nested = JSONObject(text)
    nested.put("resources", JSONArray().apply { repeat(9) { put(JSONObject(text).getJSONArray("resources").getJSONObject(0)) } })
    expect("invalid_request") { PhotoManifestCodec.decode(nested.toString().toByteArray()) }
    val duplicate = text.replace("\"role\":\"original\"", "\"role\":\"original\",\"role\":\"original\"")
    expect("invalid_request") { PhotoManifestCodec.decode(duplicate.toByteArray()) }
  }

  private fun recovery(context: Context) {
    val record = AndroidFilesSnapshots.randomId()
    val source = AndroidPhotoManifestJournal(context).use { journal ->
      draft(journal.sourceDeviceId(), journal.identity("asset", "recovery"))
    }
    fun prepare(value: PhotoManifest = source): PhotoPublication = AndroidPhotoManifestJournal(context).use { it.prepare(record, value) }
    val initial = prepare()
    AndroidPhotoManifestJournal(context).use { journal ->
      check(!journal.metadataChanged(record, source))
      check(!journal.metadataChanged(record, source.copy(resources = source.resources.map { it.copy(operationId = AndroidFilesSnapshots.randomId()) })))
      check(journal.metadataChanged(record, source.copy(favorite = false)))
      check(!journal.metadataChanged(AndroidFilesSnapshots.randomId(), source.copy(favorite = false)))
    }
    val native = NativeFixture()
    fun resume(publication: PhotoPublication, current: () -> Unit = {}) {
      AndroidSyncJournal(context).use { files ->
        AndroidPhotoManifestPublisher(context, files, AndroidFilesSnapshots(context) {}, {}, { emptyMap() }).use {
          it.upload(publication, AndroidFilesTransfer(native::send), current)
        }
      }
    }
    native.lose = "create"
    expect("connection_closed") { resume(initial) }
    check(prepare().job.id == initial.job.id && prepare().job.operationId == null)
    native.lose = "chunk"
    expect("connection_closed") { resume(prepare()) }
    val afterChunk = prepare()
    check(afterChunk.job.operationId != null && afterChunk.job.offset == 0L)
    native.lose = "finalize"
    expect("connection_closed") { resume(afterChunk) }
    check(prepare().job.offset == initial.job.size && prepare().job.state != "completed")
    resume(prepare())
    check(prepare().job.state == "completed" && native.operations.size == 1)
    val counts = native.chunks to native.finalizes
    resume(prepare())
    check((native.chunks to native.finalizes) == counts && native.creates == 2)
    val completedId = prepare().job.operationId!!
    native.operations[completedId]!!.put("state", "receiving")
    expect("outcome_unknown") { resume(prepare()) }
    check(prepare().job.state == "completed" && native.creates == 2)
    native.operations[completedId]!!.put("state", "completed")
    val changed = prepare(source.copy(albums = listOf(PhotoAlbum("album", "Renamed"))))
    check(changed.manifest.revision == 2L && changed.manifest.resources == initial.manifest.resources)
    check(prepare(source.copy(albums = changed.manifest.albums)).job.id == changed.job.id)
    expect("source_changed") { resume(changed) { throw FilesFailure("source_changed") } }
    check(native.operations.size == 1)
    val snapshots = AndroidPhotoManifestSnapshots(context)
    snapshots.open(changed).close()
    val staged = File(context.noBackupFilesDir, "kloda-photo-manifests/${changed.job.id}.snapshot")
    Os.chmod(staged.path, 384)
    FileOutputStream(staged).use { it.write(ByteArray(changed.bytes.size)); it.fd.sync() }
    Os.chmod(staged.path, 256)
    expect("snapshot_unavailable") { resume(changed) }
    snapshots.discard(changed)
    resume(changed)
    check(prepare(source.copy(albums = changed.manifest.albums)).job.state == "completed")
    check(native.operations.size == 2)
  }

  private fun media(instrumentation: Instrumentation, context: Context) {
    if (Build.VERSION.SDK_INT < 29) return
    AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT).forEach {
      instrumentation.uiAutomation.grantRuntimePermission(context.packageName, it)
    }
    val resolver = context.contentResolver
    val folder = "KlodaManifest-${AndroidFilesSnapshots.randomId()}"
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, "photo.png"); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
    }) ?: error("MediaStore fixture unavailable")
    val bytes = android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", 0)
    val photos = AndroidPhotosSources(context)
    var albumSource: String? = null
    var librarySource: String? = null
    try {
      resolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
      check(resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      val album = photos.selectAlbum(photos.albums().single { it["displayName"] == folder }.getValue("id"))!!
      albumSource = album.getValue("id")
      val library = photos.selectLibrary(); librarySource = library.getValue("id")
      AndroidPhotoManifestJournal(context).use { journal ->
        val a = photos.metadata(album.getValue("reference"), uri.toString(), journal)
        val b = photos.metadata(AndroidPhotosSources.library, uri.toString(), journal)
        check(a == b && a.name == "photo.png" && a.mimeType == "image/png" && a.albums.single().name == folder)
        check(a.favorite == if (Build.VERSION.SDK_INT >= 30) false else null)
        val reopened = AndroidPhotoManifestJournal(context).use { photos.metadata(AndroidPhotosSources.library, uri.toString(), it) }
        check(reopened == a)
        AndroidSyncJournal(context).use { files ->
          val source = album.getValue("id"); val tree = album.getValue("reference")
          val file = photos.scan(tree).single { it.reference == uri.toString() }
          files.reconcileSourceFiles(source, tree, sequenceOf(file))
          val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
          val job = FilesJob(AndroidFilesSnapshots.randomId(), AndroidFilesSnapshots.randomId(), source, file.reference,
            tree, file.relativePath, AndroidFilesSnapshots.randomId(), digest.sha256, digest.size, AndroidFilesSnapshots.randomId(),
            digest.size, "completed", null)
          files.insert(job); files.update(job.id, "completed", operation = job.operationId, offset = job.size)
          val operationId = job.operationId!!
          val native = NativeFixture().apply { operations[operationId] = operation(job); requests[job.id] = operationId }
          AndroidPhotoManifestPublisher(context, files, AndroidFilesSnapshots(context) {}, {},
            { photos.load().associate { it.getValue("id") to it.getValue("reference") } }).use { publisher ->
            val transfer = AndroidFilesTransfer(native::send)
            publisher.publish(job.recordId, source, tree, file, transfer)
            val creates = native.creates
            publisher.publish(job.recordId, source, tree, file, transfer)
            check(native.creates == creates)
            files.reconcileSourceFiles(library.getValue("id"), AndroidPhotosSources.library, sequenceOf(file))
            publisher.publish(job.recordId, library.getValue("id"), AndroidPhotosSources.library, file, transfer)
            check(native.creates == creates && native.operations.size == 2)
            native.operations[operationId]!!.put("state", "receiving")
            expect("outcome_unknown") { publisher.publish(job.recordId, source, tree, file, transfer) }
            native.operations[operationId]!!.put("state", "completed")
            native.staleScope = true
            expect("backup_scope_changed") { publisher.publish(job.recordId, source, tree, file, transfer) }
            native.staleScope = false
            native.operations[operationId]!!.put("name", "wrong.png")
            expect("outcome_unknown") { publisher.publish(job.recordId, source, tree, file, transfer) }
            native.operations[operationId]!!.put("name", job.name)
            check(resolver.update(uri, ContentValues().apply {
              put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder-renamed/")
              if (Build.VERSION.SDK_INT >= 30) put(MediaStore.MediaColumns.IS_FAVORITE, 1)
            }, null, null) == 1)
            val moved = photos.metadata(AndroidPhotosSources.library, uri.toString(), journal)
            check(moved.assetId == a.assetId && moved.albums.single().id != a.albums.single().id)
            check(moved.albums.single().name == "$folder-renamed" && moved.favorite == if (Build.VERSION.SDK_INT >= 30) true else null)
            publisher.publish(job.recordId, library.getValue("id"), AndroidPhotosSources.library, file, transfer)
            check(native.creates == creates + 1 && native.operations.size == 3)
            resolver.openOutputStream(uri, "wt")!!.use { it.write(bytes + byteArrayOf(1)) }
            expect("source_changed") { publisher.publish(job.recordId, library.getValue("id"), AndroidPhotosSources.library, file, transfer) }
            check(native.creates == creates + 1)
            photos.remove(source); albumSource = null
            expect("source_permission_lost") { publisher.publish(job.recordId, source, tree, file, transfer) }
          }
        }
      }
    } finally {
      albumSource?.let { photos.remove(it) }; librarySource?.let { photos.remove(it) }
      resolver.delete(uri, null, null)
    }
  }

  internal fun operation(job: FilesJob): JSONObject = JSONObject().put("id", job.operationId).put("requestId", job.id)
    .put("sourceId", job.wireSourceId).put("sourceRevision", job.sha256).put("name", job.name)
    .put("sha256", job.sha256).put("size", job.size).put("offset", job.size).put("state", "completed")

  internal class NativeFixture {
    val operations = linkedMapOf<String, JSONObject>()
    val requests = linkedMapOf<String, String>()
    val deletedOps = mutableSetOf<String>()
    val rebackupRequests = linkedMapOf<String, String>()
    var lose: String? = null
    var staleScope = false
    var creates = 0; var chunks = 0; var finalizes = 0
    fun send(raw: String, descriptor: Int): String {
      val command = JSONObject(raw); val kind = command.getString("kind")
      if (staleScope && kind == "status") return "{\"status\":409,\"errorCode\":\"backup_scope_changed\"}"
      val operation = if (kind == "create") {
        creates++
        val upload = command.getJSONObject("upload")
        check(upload.getString("name").startsWith(PhotoManifestCodec.prefix))
        val request = upload.getString("requestId")
        upload.optString("rebackupOf").takeIf { it.isNotEmpty() }?.let { rebackupRequests[request] = it }
        val id = requests.getOrPut(request) { AndroidFilesSnapshots.randomId() }
        operations.getOrPut(id) { JSONObject(upload.toString()).apply { remove("rebackupOf") }.put("id", id).put("offset", 0).put("state", "receiving") }
      } else operations[command.getString("id")] ?: return "{\"status\":404,\"errorCode\":\"not_found\"}"
      if (kind != "create" && operation.getString("id") in deletedOps) return "{\"status\":410,\"errorCode\":\"owner_deleted\"}"
      if (kind == "chunk") {
        chunks++
        val length = command.getLong("length"); val offset = command.getLong("offset")
        check(length in 1..65536 && offset == operation.getLong("offset"))
        ParcelFileDescriptor.fromFd(descriptor).use { fd ->
          Os.lseek(fd.fileDescriptor, offset, OsConstants.SEEK_SET)
          val bytes = ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.dup(fd.fileDescriptor)).use { it.readBytes() }
          check(bytes.size.toLong() == length && offset == 0L)
          check(AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes)).sha256 == operation.getString("sha256"))
        }
        operation.put("offset", offset + length)
      }
      if (kind == "finalize") { finalizes++; check(operation.getLong("offset") == operation.getLong("size")); operation.put("state", "completed") }
      if (lose == kind) { lose = null; throw FilesFailure("connection_closed") }
      return JSONObject().put("status", 200).put("operation", operation).toString()
    }
  }
  private fun expect(code: String, action: () -> Unit) {
    try { action(); error("Expected $code") } catch (error: FilesFailure) { check(error.code == code) }
  }
}
