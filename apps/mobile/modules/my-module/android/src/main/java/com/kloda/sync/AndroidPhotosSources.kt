package com.kloda.sync

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal data class PhotoSourceMetadata(val sourceDeviceId: String, val assetId: String, val name: String,
  val mimeType: String, val albums: List<PhotoAlbum>, val favorite: Boolean?)

internal class AndroidPhotosSources(private val context: Context) {
  companion object {
    const val library = "photos:library"
    private const val albumPrefix = "photos:album:"
    fun isPhotos(reference: String): Boolean = reference.startsWith("photos:")
    fun requiredPermissions(sdk: Int): Array<String> = buildList {
      if (sdk >= 33) {
        add(Manifest.permission.READ_MEDIA_IMAGES); add(Manifest.permission.READ_MEDIA_VIDEO)
      } else add(Manifest.permission.READ_EXTERNAL_STORAGE)
      if (sdk >= 29) add(Manifest.permission.ACCESS_MEDIA_LOCATION)
    }.toTypedArray()
    fun requestPermissions(sdk: Int): Array<String> = requiredPermissions(sdk) +
      if (sdk >= 34) arrayOf(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) else emptyArray()
    // Selected-only access cannot prove a complete library or album; never turn it into one.
    inline fun hasFullAccess(sdk: Int, granted: (String) -> Boolean): Boolean {
      val media = if (sdk >= 33) granted(Manifest.permission.READ_MEDIA_IMAGES) && granted(Manifest.permission.READ_MEDIA_VIDEO)
        else granted(Manifest.permission.READ_EXTERNAL_STORAGE)
      return media && (sdk < 29 || granted(Manifest.permission.ACCESS_MEDIA_LOCATION))
    }
    private fun albumReference(id: String): String {
      val fields = id.split(':', limit = 2)
      if (fields.size != 2 || fields.any { it.isEmpty() }) throw FilesFailure("source_changed")
      return "$albumPrefix$id"
    }
  }

  private val preferences get() = context.getSharedPreferences("kloda-sync", 0)
  private val collections = listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
  fun hasAccess(): Boolean = hasFullAccess(Build.VERSION.SDK_INT) { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
  private fun checkPermission() { if (!hasAccess()) throw FilesFailure("source_permission_lost") }
  private fun albumScope(source: String): Pair<String?, Array<String>?> {
    if (source == library) return null to null
    if (!source.startsWith(albumPrefix)) throw FilesFailure("source_permission_lost")
    val id = source.removePrefix(albumPrefix)
    albumReference(id)
    val (volume, folder) = id.split(':', limit = 2).map(Uri::decode)
    return if (Build.VERSION.SDK_INT >= 29) {
      "${MediaStore.MediaColumns.VOLUME_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?" to arrayOf(volume, folder)
    } else {
      if (volume != "legacy") throw FilesFailure("source_permission_lost")
      val escaped = folder.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
      "${MediaStore.MediaColumns.DATA} LIKE ? ESCAPE '\\' AND ${MediaStore.MediaColumns.DATA} NOT LIKE ? ESCAPE '\\'" to
        arrayOf("$escaped/%", "$escaped/%/%")
    }
  }

  private fun folderColumns(): Array<String> = if (Build.VERSION.SDK_INT >= 29)
    arrayOf(MediaStore.MediaColumns.VOLUME_NAME, MediaStore.MediaColumns.RELATIVE_PATH)
  else arrayOf(MediaStore.MediaColumns.DATA)

  private fun albumId(cursor: Cursor): String? {
    val volume = if (Build.VERSION.SDK_INT >= 29) cursor.getString(0) else "legacy"
    val folder = if (Build.VERSION.SDK_INT >= 29) cursor.getString(1) else cursor.getString(0)?.substringBeforeLast('/', "")
    if (volume.isNullOrEmpty() || folder.isNullOrEmpty()) return null
    return "${Uri.encode(volume)}:${Uri.encode(folder)}"
  }

  fun load(): List<Map<String, String>> = synchronized(AndroidSyncJournal.sourceLock) {
    val sources = JSONArray(preferences.getString("photoSources", "[]"))
    List(sources.length()) { index ->
      val source = sources.getJSONObject(index)
      mapOf("displayName" to source.getString("displayName"), "id" to source.getString("id"),
        "kind" to "photos", "reference" to source.getString("reference"))
    }
  }

  fun selectLibrary(): Map<String, String> = save(library, "Photos")
  fun selectAlbum(id: String): Map<String, String>? {
    val reference = albumReference(id)
    val album = albums().firstOrNull { it["id"] == id } ?: return null
    return save(reference, album.getValue("displayName"))
  }

  private fun save(reference: String, name: String): Map<String, String> = synchronized(AndroidSyncJournal.sourceLock) {
    checkPermission()
    val sources = load()
    sources.firstOrNull { it["reference"] == reference } ?: run {
      val source = mapOf("displayName" to name, "id" to UUID.randomUUID().toString(), "kind" to "photos", "reference" to reference)
      val values = JSONArray().apply { sources.forEach { put(JSONObject(it)) }; put(JSONObject(source)) }
      if (!preferences.edit().putString("photoSources", values.toString()).commit()) throw FilesFailure("storage_failure")
      source
    }
  }

  fun remove(id: String) = synchronized(AndroidSyncJournal.sourceLock) {
    val remaining = JSONArray().apply { load().filter { it["id"] != id }.forEach { put(JSONObject(it)) } }
    if (!preferences.edit().putString("photoSources", remaining.toString()).commit()) throw FilesFailure("storage_failure")
    AndroidSyncJournal(context).use { it.removeSource(id) }
  }

  fun albums(): List<Map<String, String>> {
    checkPermission()
    val albums = linkedMapOf<String, String>()
    for (collection in collections) {
      query(collection, folderColumns() + MediaStore.Images.Media.BUCKET_DISPLAY_NAME, null, null, null).use { cursor ->
        while (cursor.moveToNext()) {
          checkPermission()
          val id = albumId(cursor)
          val name = cursor.getString(cursor.columnCount - 1)
          if (id != null && !name.isNullOrBlank()) albums[id] = name
        }
      }
    }
    checkPermission()
    return albums.map { (id, name) -> mapOf("id" to id, "displayName" to name) }.sortedBy { it.getValue("displayName") }
  }

  fun scan(source: String, cancellation: CancellationSignal? = null): Sequence<QueuedSourceFile> = sequence {
    checkPermission()
    val (selection, args) = albumScope(source)
    for (collection in collections) {
      query(collection, arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
        MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED),
        selection, args, cancellation).use { cursor ->
        while (cursor.moveToNext()) {
          cancellation?.throwIfCanceled(); checkPermission()
          val name = cursor.getString(1)
          if (name.isNullOrEmpty() || name == "." || name == ".." || name.any { it == '/' || it == '\\' || it.isISOControl() }) {
            throw FilesFailure("backup_path_rejected")
          }
          val size = cursor.getLong(2)
          if (size < 0) throw FilesFailure("source_changed")
          yield(QueuedSourceFile(ContentUris.withAppendedId(collection, cursor.getLong(0)).toString(), name,
            "$size:${cursor.getLong(3)}", size))
        }
      }
    }
    checkPermission()
  }

  fun metadata(source: String, reference: String, journal: AndroidPhotoManifestJournal): PhotoSourceMetadata {
    checkedMedia(source, reference)
    val projection = folderColumns() + arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.MIME_TYPE,
      MediaStore.Images.Media.BUCKET_DISPLAY_NAME, MediaStore.MediaColumns.DATE_ADDED) +
      if (Build.VERSION.SDK_INT >= 30) arrayOf(MediaStore.MediaColumns.GENERATION_ADDED, MediaStore.MediaColumns.IS_FAVORITE) else emptyArray()
    val result = query(Uri.parse(reference), projection, null, null, null).use { cursor ->
      if (!cursor.moveToFirst()) throw FilesFailure("source_changed")
      fun text(column: String): String? = cursor.getString(cursor.getColumnIndexOrThrow(column))
      fun number(column: String): Long = cursor.getLong(cursor.getColumnIndexOrThrow(column))
      val name = text(MediaStore.MediaColumns.DISPLAY_NAME) ?: throw FilesFailure("source_changed")
      val mime = text(MediaStore.MediaColumns.MIME_TYPE) ?: throw FilesFailure("source_changed")
      if (!PhotoManifestCodec.validName(name)) throw FilesFailure("backup_path_rejected")
      val folder = albumId(cursor)
      val albums = if (folder == null) emptyList() else {
        val title = text(MediaStore.Images.Media.BUCKET_DISPLAY_NAME) ?: throw FilesFailure("source_changed")
        if (!PhotoManifestCodec.validName(title)) throw FilesFailure("backup_path_rejected")
        listOf(PhotoAlbum(journal.identity("album", folder), title))
      }
      val birth = number(MediaStore.MediaColumns.DATE_ADDED).toString() +
        if (Build.VERSION.SDK_INT >= 30) ":${number(MediaStore.MediaColumns.GENERATION_ADDED)}" else ""
      val volume = if (Build.VERSION.SDK_INT >= 29) text(MediaStore.MediaColumns.VOLUME_NAME) ?: throw FilesFailure("source_changed") else "legacy"
      val version = if (Build.VERSION.SDK_INT >= 29) MediaStore.getVersion(context, volume) else MediaStore.getVersion(context)
      val favorite = if (Build.VERSION.SDK_INT >= 30) when (number(MediaStore.MediaColumns.IS_FAVORITE)) {
        0L -> false; 1L -> true; else -> throw FilesFailure("source_changed")
      } else null
      // Local database birth/version avoids treating a reused MediaStore row ID as a portable identity.
      PhotoSourceMetadata(journal.sourceDeviceId(), journal.identity("asset", "$version|$volume|$reference|$birth"),
        name, mime, albums, favorite)
    }
    checkedMedia(source, reference)
    return result
  }

  fun checkedMedia(source: String, reference: String): Uri {
    checkPermission()
    val (scope, scopeArgs) = albumScope(source)
    val uri = Uri.parse(reference)
    val collection = collections.firstOrNull { candidate ->
      uri.scheme == "content" && uri.authority == candidate.authority && uri.query == null && uri.fragment == null &&
        uri.pathSegments.size == candidate.pathSegments.size + 1 && candidate.pathSegments.indices.all { uri.pathSegments[it] == candidate.pathSegments[it] } &&
        uri.lastPathSegment?.toLongOrNull()?.let { it >= 0 } == true
    } ?: throw FilesFailure("source_permission_lost")
    val selection = "${MediaStore.MediaColumns._ID}=?" + if (scope != null) " AND ($scope)" else ""
    val args = arrayOf(uri.lastPathSegment!!) + (scopeArgs ?: emptyArray())
    query(collection, arrayOf(MediaStore.MediaColumns._ID), selection, args, null).use {
      if (!it.moveToFirst()) throw FilesFailure("source_changed")
    }
    checkPermission()
    return if (Build.VERSION.SDK_INT >= 29) MediaStore.setRequireOriginal(uri) else uri
  }

  private fun query(uri: Uri, projection: Array<String>, selection: String?, args: Array<String>?, cancellation: CancellationSignal?): Cursor {
    val visible = buildString {
      selection?.let { append("($it)") }
      if (Build.VERSION.SDK_INT >= 29) {
        if (isNotEmpty()) append(" AND ")
        append("${MediaStore.MediaColumns.IS_PENDING}=0")
      }
      if (Build.VERSION.SDK_INT >= 30) {
        if (isNotEmpty()) append(" AND ")
        append("${MediaStore.MediaColumns.IS_TRASHED}=0")
      }
    }.ifEmpty { null }
    try {
      return context.contentResolver.query(uri, projection, visible, args, null, cancellation) ?: throw FilesFailure("source_changed")
    } catch (_: SecurityException) { throw FilesFailure("source_permission_lost") }
  }
}
