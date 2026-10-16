package com.kloda.sync

import android.Manifest
import android.app.Instrumentation
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.system.Os
import android.util.Base64
import java.io.ByteArrayInputStream
import java.io.File
import org.json.JSONObject

internal object AndroidPhotosImportChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    permissionPolicy()
    AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT).forEach {
      instrumentation.uiAutomation.grantRuntimePermission(context.packageName, it)
    }
    if (Build.VERSION.SDK_INT < 29) instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.WRITE_EXTERNAL_STORAGE)
    val bytes = Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", Base64.DEFAULT)
    val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
    val targets = mutableSetOf<Uri>()
    val media = AndroidPhotosMedia(context) {}
    fun manifest(albums: List<PhotoAlbum> = emptyList()) = PhotoManifest("test-device-${AndroidFilesSnapshots.randomId()}",
      "source-local-${AndroidFilesSnapshots.randomId()}", 1L,
      listOf(PhotoResource(AndroidFilesSnapshots.randomId(), "original", "import-${AndroidFilesSnapshots.randomId()}.png", "image/png", digest.sha256, digest.size)), albums, null)
    fun restore(value: PhotoManifest, transferred: ByteArray = bytes): Map<String, Any> {
      val response = AndroidPhotosRestore(context, {}, transport(value.resources.single(), transferred)).restore(value)
      val uri = response["targetAssetId"] as String
      if (uri.isNotEmpty()) targets += Uri.parse(uri)
      return response
    }
    fun fixture(value: PhotoManifest, loseReceipt: Boolean): PhotoImportIntent = AndroidPhotosImportJournal(context).use { journal ->
      val prepared = journal.prepare(value, media.library())
      journal.save(prepared.copy(phase = "creating"))
      val uri = media.insert(prepared); targets += uri
      val created = prepared.copy(uri = uri.toString(), phase = "inserted")
      if (!loseReceipt) journal.save(created)
      val stage = File.createTempFile("photo-check-", ".part", context.cacheDir)
      try { stage.writeBytes(bytes); media.write(created, stage); media.publish(created) } finally { stage.delete() }
      created
    }
    try {
      val album = PhotoAlbum("album-a", "Shared title")
      val first = manifest(listOf(album))
      val imported = restore(first)
      check(imported["itemState"] == "completed" && imported["mediaCompleted"] == true && imported["metadataCompleted"] == true) { imported.toString() }
      check(imported["targetAssetId"] != first.assetId)
      val receipt = AndroidPhotosImportJournal(context).use { it.get(AndroidPhotosImportJournal.identity(first.sourceDeviceId, first.assetId))!! }
      media.verify(first.resources.single(), media.receipt(receipt)!!)
      check(media.markers(receipt).size == 1)
      check(restore(first)["targetAssetId"] == imported["targetAssetId"])
      check(media.markers(receipt).size == 1)
      check(AndroidPhotosImportJournal.folder(first) != AndroidPhotosImportJournal.folder(first.copy(albums = listOf(PhotoAlbum("album-b", "Shared title")))))
      check(AndroidPhotosImportJournal.folder(first) != AndroidPhotosImportJournal.folder(first.copy(sourceDeviceId = "other-device")))
      val changed = first.copy(assetId = "album-change-${AndroidFilesSnapshots.randomId()}", resources = listOf(first.resources.single().copy(
        operationId = AndroidFilesSnapshots.randomId(), name = "album-change-${AndroidFilesSnapshots.randomId()}.png")))
      val originalPlacement = restore(changed)
      val newPlacement = changed.copy(revision = 2, albums = listOf(PhotoAlbum("album-b", "Shared title")))
      val moved = restore(newPlacement)
      check(moved["targetAssetId"] == originalPlacement["targetAssetId"])
      check(moved["itemState"] == if (Build.VERSION.SDK_INT >= 29) "completed" else "organization_review")
      check(restore(newPlacement)["targetAssetId"] == originalPlacement["targetAssetId"])
      val videoBytes = PhotosVideoFixture.bytes
      val videoDigest = AndroidFilesSnapshots.digest(ByteArrayInputStream(videoBytes))
      val video = manifest(listOf(album)).let { it.copy(resources = listOf(it.resources.single().copy(
        name = "clip-${AndroidFilesSnapshots.randomId()}.mp4", mimeType = "video/mp4",
        sha256 = videoDigest.sha256, size = videoDigest.size))) }
      val videoResult = restore(video, videoBytes)
      check(videoResult["itemState"] == "completed")
      val videoReceipt = AndroidPhotosImportJournal(context).use { it.get(AndroidPhotosImportJournal.identity(video.sourceDeviceId, video.assetId))!! }
      media.verify(video.resources.single(), media.receipt(videoReceipt)!!)
      check(restore(video, videoBytes)["targetAssetId"] == videoResult["targetAssetId"])

      val crash = manifest()
      val crashTarget = fixture(crash, false) // Published, but durable completion receipt never written.
      check(restore(crash)["targetAssetId"] == crashTarget.uri)
      check(media.markers(crashTarget).size == 1)
      val lostReceipt = manifest()
      val recovered = fixture(lostReceipt, true) // Actual create and publication occurred before the URI receipt.
      check(restore(lostReceipt)["targetAssetId"] == recovered.uri)
      check(media.markers(recovered).size == 1)

      val unknown = manifest()
      val unknownIntent = AndroidPhotosImportJournal(context).use { journal ->
        journal.prepare(unknown, media.library()).copy(phase = "creating").also(journal::save)
      }
      check(restore(unknown)["itemState"] == "review_required")
      check(media.markers(unknownIntent).isEmpty())
      check(restore(unknown)["itemState"] == "review_required")
      check(media.markers(unknownIntent).isEmpty())

      check(context.contentResolver.delete(Uri.parse(imported["targetAssetId"] as String), null, null) == 1)
      targets.remove(Uri.parse(imported["targetAssetId"] as String))
      val recreated = restore(first)
      check(recreated["itemState"] == "completed" && recreated["targetAssetId"] != imported["targetAssetId"])
      val multi = manifest(listOf(album, PhotoAlbum("album-b", "Shared title")))
      val organized = restore(multi)
      check(organized["itemState"] == "organization_review" && organized["mediaCompleted"] == true && organized["metadataCompleted"] == false)
      check(restore(multi)["targetAssetId"] == organized["targetAssetId"])
      val unsupported = manifest().let { it.copy(resources = listOf(it.resources.single().copy(role = "edited"))) }
      check(AndroidPhotosRestore(context, {}, transport(unsupported.resources.single(), bytes)).restore(unsupported)["itemState"] == "organization_review")

      val bad = manifest()
      val rejected = restore(bad, bytes + byteArrayOf(1))
      check(rejected["itemState"] == "review_required" && rejected["reason"] == "hash_mismatch" && rejected["targetAssetId"] == "")
      expect("hash_mismatch") { media.verify(first.resources.single(), ByteArrayInputStream(bytes + byteArrayOf(1))) }
      expect("hash_mismatch") { media.verify(first.resources.single(), ByteArrayInputStream(bytes.dropLast(1).toByteArray())) }
      val denied = object : ContextWrapper(context) { override fun checkSelfPermission(permission: String) = PackageManager.PERMISSION_DENIED }
      expect("destination_permission_lost") { AndroidPhotosRestore(denied, {}, { _, _ -> error("Denied import reached transport") }).restore(manifest()) }
      val paused = AndroidPhotosRestore(context, {}, { _, _ -> error("Paused import reached transport") })
      paused.pause(); expect("cancelled") { paused.restore(manifest()) }
      val accessible = manifest()
      val resource = accessible.resources.single()
      val existing = context.contentResolver.insert(media.collection(resource), android.content.ContentValues().apply {
        put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, resource.name)
        put(android.provider.MediaStore.MediaColumns.MIME_TYPE, resource.mimeType)
        if (Build.VERSION.SDK_INT >= 29) {
          put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/KlodaCheckExisting/")
          put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1)
        }
      })!!
      targets += existing
      context.contentResolver.openOutputStream(existing, "w")!!.use { it.write(bytes) }
      if (Build.VERSION.SDK_INT >= 29) check(context.contentResolver.update(existing, android.content.ContentValues().apply {
        put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0)
      }, null, null) == 1)
      val adopted = restore(accessible)
      check(adopted["targetAssetId"] == existing.toString() && adopted["itemState"] == "completed")
      check(restore(accessible)["targetAssetId"] == existing.toString())
      val different = accessible.copy(revision = 2, resources = listOf(resource.copy(sha256 = AndroidFilesSnapshots.digest(ByteArrayInputStream(byteArrayOf(9))).sha256, size = 1)))
      check(restore(different, byteArrayOf(9))["itemState"] == "review_required")
      check(context.contentResolver.openInputStream(existing)!!.use { it.readBytes().contentEquals(bytes) })
      val status = AndroidPhotosRestore.status(context)
      check(status["state"] == "review_required")
      check((status["completed"] as String).toLong() + (status["review"] as String).toLong() <= (status["total"] as String).toLong())
    } finally {
      targets.forEach { context.contentResolver.delete(it, null, null) }
      android.database.sqlite.SQLiteDatabase.deleteDatabase(File(context.noBackupFilesDir, "kloda-photos-import.db"))
    }
  }
  private fun transport(resource: PhotoResource, bytes: ByteArray): (String, Int) -> String = { command, fd ->
    val request = JSONObject(command)
    check(request.getString("id") == resource.operationId)
    if (request.getString("kind") == "status") {
      JSONObject().put("status", 200).put("operation", JSONObject().put("id", resource.operationId)
        .put("requestId", resource.operationId).put("sourceId", resource.operationId).put("sourceRevision", "1")
        .put("name", resource.name).put("sha256", resource.sha256).put("size", resource.size)
        .put("offset", resource.size).put("state", "completed")).toString()
    } else {
      check(request.getString("kind") == "restore")
      val offset = request.getLong("offset")
      val count = minOf(65536L, resource.size - offset).toInt()
      ParcelFileDescriptor.fromFd(fd).use { descriptor ->
        check(Os.pwrite(descriptor.fileDescriptor, bytes, offset.toInt(), count, offset) == count)
        if (bytes.size.toLong() > resource.size) check(Os.pwrite(descriptor.fileDescriptor, bytes, resource.size.toInt(), bytes.size - resource.size.toInt(), resource.size) > 0)
      }
      JSONObject().put("status", 200).put("bytes", count).put("offset", offset).put("size", resource.size).toString()
    }
  }
  private fun permissionPolicy() {
    check(!AndroidPhotosMedia.hasAccess(24) { it == Manifest.permission.READ_EXTERNAL_STORAGE })
    check(AndroidPhotosMedia.hasAccess(24) { true })
    check(!AndroidPhotosMedia.hasAccess(34) { it == Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED })
    check(!AndroidPhotosMedia.hasAccess(34) { false })
    check(AndroidPhotosMedia.hasAccess(34) { true })
  }
  private fun expect(code: String, action: () -> Unit) {
    try { action(); error("Expected $code") } catch (failure: FilesFailure) { check(failure.code == code) }
  }
}
