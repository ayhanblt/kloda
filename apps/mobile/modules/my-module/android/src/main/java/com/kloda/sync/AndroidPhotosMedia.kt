package com.kloda.sync

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import java.io.File
import java.io.FileInputStream
import java.io.FilterInputStream
import java.io.InputStream

internal data class PhotoTarget(val uri: Uri, val name: String, val mime: String, val size: Long,
  val folder: String, val owner: String?, val pending: Boolean, val trashed: Boolean, val favorite: Boolean?)

internal class AndroidPhotosMedia(private val context: Context, private val check: () -> Unit) {
  private val resolver get() = context.contentResolver
  companion object {
    fun hasAccess(sdk: Int, granted: (String) -> Boolean): Boolean =
      AndroidPhotosSources.hasFullAccess(sdk, granted) && (sdk >= 29 || granted(Manifest.permission.WRITE_EXTERNAL_STORAGE))
  }
  fun permission() {
    check()
    if (!hasAccess(Build.VERSION.SDK_INT) { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED })
      throw FilesFailure("destination_permission_lost")
  }
  fun library(target: Uri? = null): String {
    permission()
    if (Environment.getExternalStorageState() != Environment.MEDIA_MOUNTED) throw FilesFailure("destination_unavailable")
    if (Build.VERSION.SDK_INT < 29) return "legacy:${Environment.getExternalStorageDirectory().canonicalPath}"
    val volume = target?.let { MediaStore.getVolumeName(it) } ?: MediaStore.VOLUME_EXTERNAL_PRIMARY
    if (volume !in MediaStore.getExternalVolumeNames(context)) throw FilesFailure("destination_unavailable")
    val version = if (Build.VERSION.SDK_INT >= 30) MediaStore.getVersion(context, volume) else MediaStore.getVersion(context)
    return "$volume:$version"
  }
  fun collection(resource: PhotoMediaResource, volume: String = if (Build.VERSION.SDK_INT >= 29) MediaStore.VOLUME_EXTERNAL_PRIMARY else "external"): Uri =
    if (resource.mimeType.startsWith("image/")) MediaStore.Images.Media.getContentUri(volume)
    else MediaStore.Video.Media.getContentUri(volume)
  private fun path(intent: PhotoMediaIntent) = File(Environment.getExternalStorageDirectory(), intent.folder + intent.name)
  private fun columns(): Array<String> = arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
    MediaStore.MediaColumns.MIME_TYPE, MediaStore.MediaColumns.SIZE,
    if (Build.VERSION.SDK_INT >= 29) MediaStore.MediaColumns.RELATIVE_PATH else MediaStore.MediaColumns.DATA) +
    (if (Build.VERSION.SDK_INT >= 29) arrayOf(MediaStore.MediaColumns.OWNER_PACKAGE_NAME, MediaStore.MediaColumns.IS_PENDING) else emptyArray()) +
    (if (Build.VERSION.SDK_INT >= 30) arrayOf(MediaStore.MediaColumns.IS_TRASHED, MediaStore.MediaColumns.IS_FAVORITE) else emptyArray())

  private fun query(resource: PhotoMediaResource, uri: Uri, selection: String?, args: Array<String>?): List<PhotoTarget> {
    permission()
    val cursor = if (Build.VERSION.SDK_INT >= 30) resolver.query(uri, columns(), Bundle().apply {
      putString(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION, selection)
      putStringArray(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, args)
      putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_INCLUDE)
      putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE)
    }, null) else resolver.query(if (Build.VERSION.SDK_INT == 29) MediaStore.setIncludePending(uri) else uri, columns(), selection, args, null)
    return (cursor ?: throw FilesFailure("destination_unavailable")).use { rows ->
      val result = mutableListOf<PhotoTarget>()
      while (rows.moveToNext()) {
        permission()
        if (result.size >= 32) throw FilesFailure("outcome_unknown")
        result += PhotoTarget(ContentUris.withAppendedId(collection(resource, uri.pathSegments.first()), rows.getLong(0)), rows.getString(1) ?: "",
          rows.getString(2) ?: "", rows.getLong(3), rows.getString(4) ?: "",
          if (Build.VERSION.SDK_INT >= 29) rows.getString(5) else null,
          Build.VERSION.SDK_INT >= 29 && rows.getInt(6) != 0,
          Build.VERSION.SDK_INT >= 30 && rows.getInt(7) != 0,
          if (Build.VERSION.SDK_INT >= 30) rows.getInt(8) != 0 else null)
      }
      permission(); result
    }
  }
  fun receipt(intent: PhotoMediaIntent): PhotoTarget? {
    val uri = Uri.parse(intent.uri ?: return null)
    val volume = uri.pathSegments.firstOrNull() ?: throw FilesFailure("outcome_unknown")
    val volumes = if (Build.VERSION.SDK_INT >= 29) MediaStore.getExternalVolumeNames(context) else setOf("external")
    if (volume !in volumes) throw FilesFailure("destination_unavailable")
    val base = collection(intent.resource, volume)
    if (uri.scheme != "content" || uri.authority != base.authority || uri.query != null || uri.fragment != null ||
      uri.pathSegments.size != base.pathSegments.size + 1 || uri.pathSegments.dropLast(1) != base.pathSegments ||
      uri.lastPathSegment?.toLongOrNull()?.let { it >= 0 } != true) throw FilesFailure("outcome_unknown")
    val rows = query(intent.resource, uri, null, null)
    if (rows.size > 1) throw FilesFailure("outcome_unknown")
    return rows.singleOrNull()
  }
  fun markers(intent: PhotoMediaIntent): List<PhotoTarget> = query(intent.resource, collection(intent.resource),
    "${MediaStore.MediaColumns.DISPLAY_NAME}=?", arrayOf(intent.name))
  fun existing(resource: PhotoMediaResource): List<PhotoTarget> {
    val volumes = if (Build.VERSION.SDK_INT >= 29) MediaStore.getExternalVolumeNames(context) else setOf("external")
    val targets = mutableListOf<PhotoTarget>()
    for (volume in volumes) {
      targets += query(resource, collection(resource, volume),
        "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.MIME_TYPE}=? AND ${MediaStore.MediaColumns.SIZE}=?",
        arrayOf(resource.name, resource.mimeType, resource.size.toString())).filter { !it.pending && !it.trashed }
      if (targets.size > 32) throw FilesFailure("outcome_unknown")
    }
    return targets
  }
  fun owned(intent: PhotoMediaIntent, target: PhotoTarget): Boolean = target.name == intent.name &&
    target.mime == intent.resource.mimeType && !target.trashed && if (Build.VERSION.SDK_INT >= 29)
      target.owner == context.packageName && (target.folder == intent.folder ||
        intent.phase == "organizing" && target.folder == intent.desiredFolder)
      else target.folder == path(intent).absolutePath

  fun insert(intent: PhotoMediaIntent): Uri {
    permission()
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, intent.name); put(MediaStore.MediaColumns.MIME_TYPE, intent.resource.mimeType)
      if (Build.VERSION.SDK_INT >= 29) {
        put(MediaStore.MediaColumns.RELATIVE_PATH, intent.folder); put(MediaStore.MediaColumns.IS_PENDING, 1)
      } else {
        val file = path(intent)
        if (!file.parentFile!!.isDirectory && !file.parentFile!!.mkdirs()) throw FilesFailure("destination_unavailable")
        if (file.exists()) throw FilesFailure("outcome_unknown")
        put(MediaStore.MediaColumns.DATA, file.absolutePath)
      }
    }
    return resolver.insert(collection(intent.resource), values) ?: throw FilesFailure("destination_unavailable")
  }
  fun verify(resource: PhotoMediaResource, input: InputStream) {
    var count = 0L
    val bounded = object : FilterInputStream(input) {
      override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        val remaining = resource.size - count
        val got = super.read(buffer, offset, if (remaining >= length) length else remaining.toInt() + 1)
        if (got > 0) { if (got.toLong() > remaining) throw FilesFailure("hash_mismatch"); count += got }
        return got
      }
    }
    if (AndroidFilesSnapshots.digest(bounded, check) != FilesDigest(resource.sha256, resource.size)) throw FilesFailure("hash_mismatch")
  }
  fun verify(resource: PhotoMediaResource, target: PhotoTarget) {
    permission()
    // Pending MediaStore rows report size=0 until publication; verify size from the bounded original-byte stream.
    if (target.mime != resource.mimeType || target.trashed) throw FilesFailure("hash_mismatch")
    val original = if (Build.VERSION.SDK_INT >= 29) MediaStore.setRequireOriginal(target.uri) else target.uri
    (resolver.openInputStream(original) ?: throw FilesFailure("destination_unavailable")).use { verify(resource, it) }
    permission()
  }
  fun write(intent: PhotoMediaIntent, stage: File) {
    permission()
    val target = receipt(intent) ?: throw FilesFailure("outcome_unknown")
    if (!owned(intent, target) || Build.VERSION.SDK_INT >= 29 && !target.pending) throw FilesFailure("outcome_unknown")
    // Legacy MediaStore has no pending isolation; only this recorded, app-generated path may be written.
    val descriptor = resolver.openFileDescriptor(target.uri, if (Build.VERSION.SDK_INT >= 29) "rwt" else "wa")
      ?: throw FilesFailure("destination_unavailable")
    ParcelFileDescriptor.AutoCloseOutputStream(descriptor).use { output ->
      if (Build.VERSION.SDK_INT < 29 && descriptor.statSize != 0L) throw FilesFailure("outcome_unknown")
      FileInputStream(stage).use { input ->
        val buffer = ByteArray(65536)
        while (true) { permission(); val count = input.read(buffer); if (count < 0) break; output.write(buffer, 0, count) }
      }
      output.flush(); output.fd.sync(); descriptor.checkError()
    }
    verify(intent.resource, receipt(intent) ?: throw FilesFailure("outcome_unknown"))
  }
  fun publish(intent: PhotoMediaIntent) {
    permission()
    val target = receipt(intent) ?: throw FilesFailure("outcome_unknown")
    if (!owned(intent, target)) throw FilesFailure("outcome_unknown")
    verify(intent.resource, target)
    if (Build.VERSION.SDK_INT >= 29 && target.pending && resolver.update(target.uri,
        ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null) != 1) throw FilesFailure("outcome_unknown")
    permission()
  }
  fun metadata(intent: PhotoMediaIntent): Boolean {
    permission()
    val target = receipt(intent) ?: throw FilesFailure("outcome_unknown")
    val favorite = intent.manifest.favorite
    if (intent.manifest.albums.size > 1) return false
    if (!intent.owned) return intent.manifest.albums.isEmpty() && (favorite == null || favorite == target.favorite)
    if (!owned(intent, target)) throw FilesFailure("outcome_unknown")
    val folder = intent.desiredFolder
    if (folder != intent.folder || Build.VERSION.SDK_INT >= 29 && target.folder != folder) {
      if (Build.VERSION.SDK_INT < 29) return false
      if (target.folder != folder && resolver.update(target.uri,
          ContentValues().apply { put(MediaStore.MediaColumns.RELATIVE_PATH, folder) }, null, null) != 1) return false
      if (receipt(intent)?.folder != folder) return false
    }
    if (favorite == null) return true
    if (Build.VERSION.SDK_INT < 30) return false
    if (target.favorite != favorite && resolver.update(target.uri,
        ContentValues().apply { put(MediaStore.MediaColumns.IS_FAVORITE, if (favorite) 1 else 0) }, null, null) != 1) return false
    return receipt(intent)?.favorite == favorite
  }
}
