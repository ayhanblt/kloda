package com.kloda.sync

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.util.Size
import java.io.ByteArrayOutputStream

internal class AndroidGallery(private val context: Context) {
  private val resolver get() = context.contentResolver
  private val photos get() = AndroidPhotosSources(context)
  private fun granted(name: String) = context.checkSelfPermission(name) == PackageManager.PERMISSION_GRANTED
  fun permission(): String {
    if (Build.VERSION.SDK_INT < 33) return if (granted(Manifest.permission.READ_EXTERNAL_STORAGE)) "granted" else "denied"
    if (granted(Manifest.permission.READ_MEDIA_IMAGES) && granted(Manifest.permission.READ_MEDIA_VIDEO)) return "granted"
    return if (granted(Manifest.permission.READ_MEDIA_IMAGES) || granted(Manifest.permission.READ_MEDIA_VIDEO) ||
      (Build.VERSION.SDK_INT >= 34 && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED))) "limited" else "denied"
  }
  private fun selection(source: String): Map<String, String> = photos.load().singleOrNull { it["id"] == source }
    ?: throw FilesFailure("source_changed")
  private fun scope(source: String): Pair<String, Array<String>> {
    val selected = selection(source)
    if (permission() == "denied") throw FilesFailure("source_permission_lost")
    val (filter, args) = photos.albumScope(selected.getValue("reference"))
    val visible = "${MediaStore.Files.FileColumns.MEDIA_TYPE} IN (1,3)" +
      if (Build.VERSION.SDK_INT >= 29) " AND ${MediaStore.MediaColumns.IS_PENDING}=0" else ""
    val live = visible + if (Build.VERSION.SDK_INT >= 30) " AND ${MediaStore.MediaColumns.IS_TRASHED}=0" else ""
    return (if (filter == null) live else "($live) AND ($filter)") to (args ?: emptyArray())
  }
  private fun collection() = MediaStore.Files.getContentUri("external")
  private fun uri(id: Long, video: Boolean) = ContentUris.withAppendedId(
    if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
  fun page(source: String, offset: Int): Map<String, Any> {
    if (offset < 0 || offset > Int.MAX_VALUE - 24) throw FilesFailure("invalid_request")
    val selected = selection(source); val access = permission()
    if (access == "denied") return mapOf("permission" to access, "items" to emptyList<Any>(), "hasMore" to false)
    val (filter, args) = scope(source)
    val projection = arrayOf("_id", "_display_name", "width", "height", "media_type", "datetaken") +
      if (Build.VERSION.SDK_INT >= 30) arrayOf("is_favorite") else emptyArray()
    val items = mutableListOf<Map<String, Any>>()
    var more = false
    resolver.query(collection(), projection, filter, args, "_id DESC")?.use { cursor ->
      if (cursor.moveToPosition(offset)) {
        do {
          if (items.size == 24) { more = true; break }
          val video = cursor.getInt(4) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
          val row = mutableMapOf<String, Any>("id" to uri(cursor.getLong(0), video).toString(),
            "name" to (cursor.getString(1) ?: cursor.getLong(0).toString()),
            "width" to cursor.getInt(2).coerceAtLeast(0), "height" to cursor.getInt(3).coerceAtLeast(0), "video" to video)
          if (!cursor.isNull(5) && cursor.getLong(5) > 0) row["created"] = cursor.getLong(5).toString()
          if (Build.VERSION.SDK_INT >= 30) row["favorite"] = cursor.getInt(6) == 1
          items.add(row)
        } while (cursor.moveToNext())
      }
    } ?: throw FilesFailure("source_unavailable")
    if (selection(source) != selected || permission() != access) throw FilesFailure("source_changed")
    return mapOf("permission" to access, "items" to items, "hasMore" to more)
  }
  private fun checked(source: String, asset: String): Uri {
    val match = Regex("content://media/external/(images|video)/media/([0-9]+)").matchEntire(asset)
      ?: throw FilesFailure("invalid_request")
    val (filter, args) = scope(source)
    val id = match.groupValues[2].toLongOrNull() ?: throw FilesFailure("invalid_request")
    val kind = if (match.groupValues[1] == "video") 3 else 1
    resolver.query(collection(), arrayOf("_id"), "($filter) AND _id=? AND media_type=?",
      args + arrayOf(id.toString(), kind.toString()), null)?.use {
      if (!it.moveToFirst()) throw FilesFailure("source_changed")
    } ?: throw FilesFailure("source_unavailable")
    return uri(id, kind == 3)
  }
  fun preview(source: String, asset: String, detail: Boolean): String? {
    val selected = selection(source); val target = checked(source, asset)
    val edge = if (detail) 1024 else 256
    val bitmap = try {
      if (Build.VERSION.SDK_INT >= 29) resolver.loadThumbnail(target, Size(edge, edge), null)
      else if (asset.contains("/video/")) {
        // shortcut: API24–26 video posters are unavailable; add a bounded decoder if those OS targets need posters.
        if (Build.VERSION.SDK_INT < 27) null else {
          val retriever = MediaMetadataRetriever()
          try { retriever.setDataSource(context, target); retriever.getScaledFrameAtTime(-1, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, edge, edge) }
          finally { retriever.release() }
        }
      } else resolver.openFileDescriptor(target, "r")?.use { fd ->
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFileDescriptor(fd.fileDescriptor, null, options)
        if (options.outWidth <= 0 || options.outHeight <= 0) null else {
          options.inJustDecodeBounds = false
          while (maxOf(options.outWidth, options.outHeight) / options.inSampleSize > edge) options.inSampleSize *= 2
          BitmapFactory.decodeFileDescriptor(fd.fileDescriptor, null, options)
        }
      }
    } catch (_: java.io.IOException) { null }
    checked(source, asset)
    if (selection(source) != selected) { bitmap?.recycle(); throw FilesFailure("source_changed") }
    if (bitmap == null) return null
    try {
      val bytes = ByteArrayOutputStream()
      if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 75, bytes) || bytes.size() > 1048576) return null
      return "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
    } finally { bitmap.recycle() }
  }
  fun history(source: String, asset: String): List<Map<String, String>> {
    checked(source, asset)
    val selected = selection(source)
    val file = context.getDatabasePath("kloda-sync.sqlite")
    if (!file.exists()) return emptyList()
    val rows = mutableListOf<Map<String, String>>()
    SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
      db.rawQuery("""SELECT record_id,CASE WHEN EXISTS(SELECT 1 FROM owner_deleted d WHERE d.job=j.id)
        THEN 'owner_deleted' ELSE state END FROM files_job j WHERE source_id=? AND reference=? AND tree_reference=?
        ORDER BY rowid DESC LIMIT 16""", arrayOf(source, asset, selected.getValue("reference"))).use {
        while (it.moveToNext()) rows.add(mapOf("recordId" to it.getString(0), "state" to it.getString(1), "kind" to "media"))
      }
    }
    checked(source, asset)
    if (selection(source) != selected) throw FilesFailure("source_changed")
    return rows
  }
}
