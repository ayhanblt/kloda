package com.kloda.sync

import android.Manifest
import android.app.Instrumentation
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import java.io.ByteArrayInputStream

internal object AndroidPhotosSourceChecks {
  fun run(instrumentation: Instrumentation, context: Context) {
    permissionPolicy()
    // MediaStore fixture creation needs no write permission on API29+; API24 gets the policy checks.
    if (Build.VERSION.SDK_INT < 29) return
    AndroidPhotosSources.requiredPermissions(Build.VERSION.SDK_INT).forEach {
      instrumentation.uiAutomation.grantRuntimePermission(context.packageName, it)
    }
    val resolver = context.contentResolver
    val name = "KlodaCheck-${AndroidFilesSnapshots.randomId()}"
    val first = insert(context, "$name-a", "original.png")
    var other: Uri? = null
    var firstDeleted = false
    val bytes = Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=", Base64.DEFAULT)
    val snapshots = AndroidFilesSnapshots(context) {}
    var snapshot: FilesSnapshot? = null
    try {
      val second = insert(context, "$name-b", "other.png")
      other = second
      for (uri in listOf(first, second)) {
        resolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
        check(resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) == 1)
      }
      val photos = AndroidPhotosSources(context)
      check(photos.hasAccess())
      val album = photos.albums().single { it["displayName"] == "$name-a" }
      val selected = photos.selectAlbum(album.getValue("id"))!!
      val source = selected.getValue("id")
      val reference = selected.getValue("reference")
      check(AndroidPhotosSources(context).load().single() == selected)
      check(photos.selectAlbum(album.getValue("id")) == selected)
      val files = photos.scan(reference).toList()
      val file = files.single()
      check(file.reference == first.toString() && file.relativePath == "original.png")
      check(photos.scan(AndroidPhotosSources.library).any { it.reference == second.toString() })
      expect("source_changed") { photos.checkedMedia(reference, second.toString()) }
      expect("source_permission_lost") { photos.checkedMedia(reference, "content://wrong/external/images/media/1") }
      val staged = snapshots.stage(reference, file.reference)
      snapshot = staged
      check(staged.digest == AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes)))
      val job = FilesJob(staged.id, AndroidFilesSnapshots.randomId(), source, file.reference, reference, "original.png",
        AndroidFilesSnapshots.randomId(), staged.digest.sha256, staged.digest.size, null, 0, "queued", null)
      AndroidSyncJournal(context).use { journal ->
        journal.reconcileSourceFiles(source, reference, files.asSequence())
        journal.insert(job)
        snapshots.open(job).use { snapshots.validate(job, it) }
        val operation = AndroidFilesSnapshots.randomId()
        journal.update(job.id, "uploading", operation = operation, offset = 1)
        val retained = journal.jobs(job.recordId, source, null).single()
        check(retained.treeReference == reference && retained.reference == first.toString() && retained.offset == 1L && retained.operationId == operation)
        if (Build.VERSION.SDK_INT >= 30) {
          check(resolver.update(first, ContentValues().apply { put(MediaStore.MediaColumns.IS_TRASHED, 1) }, null, null) == 1)
          expect("source_changed") { snapshots.checkAccess(reference, file.reference) }
          check(resolver.update(first, ContentValues().apply { put(MediaStore.MediaColumns.IS_TRASHED, 0) }, null, null) == 1)
        }
        resolver.openOutputStream(first, "wt")!!.use { it.write(bytes + byteArrayOf(1)) }
        expect("source_changed") { snapshots.validateSource(retained) }
        check(journal.jobs(job.recordId, source, null).single().state == "uploading")
        check(resolver.delete(first, null, null) == 1)
        firstDeleted = true
        expect("source_changed") { snapshots.checkAccess(reference, file.reference) }
        journal.reconcileSourceFiles(source, reference, photos.scan(reference))
        check(journal.jobs(job.recordId, source, null).single().errorCode == "source_changed")
        photos.remove(source)
        val removed = journal.jobs(job.recordId, source, null).single()
        check(photos.load().isEmpty() && removed.state == "blocked" && removed.errorCode == "source_permission_lost")
        check(removed.offset == 1L && removed.operationId == operation && !journal.snapshotCompleted(job.id))
        val library = photos.selectLibrary()
        check(AndroidPhotosSources(context).load().single() == library)
        check(photos.scan(library.getValue("reference")).any { it.reference == second.toString() })
        photos.remove(library.getValue("id"))
      }
    } finally {
      if (!firstDeleted) resolver.delete(first, null, null)
      other?.let { resolver.delete(it, null, null) }
      snapshot?.let { snapshots.discard(it) }
      context.getSharedPreferences("kloda-sync", 0).edit().remove("photoSources").commit()
      context.deleteDatabase("kloda-sync.sqlite")
    }
  }

  private fun insert(context: Context, folder: String, name: String): Uri = context.contentResolver.insert(
    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, name); put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/$folder/"); put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
  ) ?: error("Could not create real MediaStore fixture")

  private fun permissionPolicy() {
    check(AndroidPhotosSources.hasFullAccess(24) { it == Manifest.permission.READ_EXTERNAL_STORAGE })
    check(!AndroidPhotosSources.hasFullAccess(29) { it == Manifest.permission.READ_EXTERNAL_STORAGE })
    check(!AndroidPhotosSources.hasFullAccess(34) { it == Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED })
    check(!AndroidPhotosSources.hasFullAccess(34) { it != Manifest.permission.READ_MEDIA_VIDEO })
    check(!AndroidPhotosSources.hasFullAccess(34) { it != Manifest.permission.ACCESS_MEDIA_LOCATION })
    check(AndroidPhotosSources.hasFullAccess(34) { true })
    check(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED in AndroidPhotosSources.requestPermissions(34))
    check(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED !in AndroidPhotosSources.requestPermissions(33))
  }

  private fun expect(code: String, action: () -> Unit) {
    try { action(); error("Expected $code") } catch (error: FilesFailure) { check(error.code == code) }
  }
}
