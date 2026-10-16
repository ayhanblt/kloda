package com.kloda.sync

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.Closeable
import java.security.MessageDigest
import java.util.UUID
import java.io.File

internal data class PhotoImportIntent(
  val key: String, val manifest: PhotoManifest, val token: String, val folder: String,
  val library: String, val phase: String = "prepared", val uri: String? = null,
  val owned: Boolean = true, val reason: String = ""
) {
  val resource get() = manifest.resources.single()
  val name: String = manifest.resources.singleOrNull()?.let { resource ->
    var start = maxOf(0, resource.name.length - 45)
    if (start > 0 && Character.isLowSurrogate(resource.name[start])) start++
    "kloda-$token-${resource.name.substring(start)}"
  } ?: ""
}

internal class AndroidPhotosImportJournal(context: Context) : Closeable {
  companion object {
    val lock = Any()
    fun identity(device: String, id: String): String {
      val digest = MessageDigest.getInstance("SHA-256").digest("${device.length}:$device$id".toByteArray(Charsets.UTF_8))
      val hex = "0123456789abcdef"
      return String(CharArray(digest.size * 2) { index ->
        val byte = digest[index / 2].toInt() and 255
        hex[if (index % 2 == 0) byte ushr 4 else byte and 15]
      })
    }
    fun folder(manifest: PhotoManifest): String {
      val album = manifest.albums.singleOrNull() ?: return "DCIM/Kloda/Library/"
      val safe = buildString {
        for (character in album.name) {
          if (length == 45) break
          append(if (character.isLetterOrDigit() || character == ' ' || character == '-' || character == '_') character else '_')
        }
      }.trim().ifEmpty { "Album" }
      return "DCIM/Kloda/$safe [${identity(manifest.sourceDeviceId, album.id)}]/"
    }
  }
  private val database = File(context.noBackupFilesDir, "kloda-photos-import.db").let { file ->
    if (!file.parentFile!!.isDirectory && !file.parentFile!!.mkdirs()) throw FilesFailure("storage_failure")
    SQLiteDatabase.openOrCreateDatabase(file, null)
  }
  init {
    database.execSQL("PRAGMA synchronous=FULL")
    database.execSQL("CREATE TABLE IF NOT EXISTS imports (key TEXT PRIMARY KEY, manifest TEXT NOT NULL, token TEXT NOT NULL, folder TEXT NOT NULL, library TEXT NOT NULL, phase TEXT NOT NULL, uri TEXT, owned INTEGER NOT NULL, reason TEXT NOT NULL)")
  }
  fun get(key: String): PhotoImportIntent? = database.query("imports", null, "key=?", arrayOf(key), null, null, null).use { cursor ->
    if (!cursor.moveToFirst()) null else PhotoImportIntent(cursor.getString(0),
      PhotoManifestCodec.decode(cursor.getString(1).toByteArray(Charsets.UTF_8)), cursor.getString(2), cursor.getString(3),
      cursor.getString(4), cursor.getString(5), if (cursor.isNull(6)) null else cursor.getString(6), cursor.getInt(7) == 1, cursor.getString(8))
  }
  fun prepare(manifest: PhotoManifest, library: String): PhotoImportIntent {
    val key = identity(manifest.sourceDeviceId, manifest.assetId)
    return get(key) ?: PhotoImportIntent(key, manifest, UUID.randomUUID().toString().replace("-", ""), folder(manifest), library).also(::save)
  }
  fun save(intent: PhotoImportIntent) {
    val values = ContentValues().apply {
      put("key", intent.key); put("manifest", String(PhotoManifestCodec.encode(intent.manifest), Charsets.UTF_8))
      put("token", intent.token); put("folder", intent.folder); put("library", intent.library)
      put("phase", intent.phase); put("uri", intent.uri); put("owned", if (intent.owned) 1 else 0); put("reason", intent.reason)
    }
    if (database.insertWithOnConflict("imports", null, values, SQLiteDatabase.CONFLICT_REPLACE) < 0) throw FilesFailure("storage_failure")
  }
  fun status(): Map<String, Any> {
    var total = 0L; var completed = 0L; var review = 0L; var organization = false; var hardReview = false
    database.rawQuery("SELECT phase, COUNT(*) FROM imports GROUP BY phase", null).use { cursor ->
      while (cursor.moveToNext()) {
        val phase = cursor.getString(0); val count = cursor.getLong(1); total += count
        when (phase) {
          "completed" -> completed += count
          "organization_review" -> { review += count; organization = true }
          "review_required", "creating" -> { review += count; hardReview = true }
        }
      }
    }
    val state = when {
      total == 0L -> "idle"
      hardReview -> "review_required"
      organization -> "organization_review"
      completed == total -> "completed"
      else -> "pending"
    }
    return mapOf("state" to state, "total" to total.toString(), "completed" to completed.toString(), "review" to review.toString())
  }
  override fun close() = database.close()
}
