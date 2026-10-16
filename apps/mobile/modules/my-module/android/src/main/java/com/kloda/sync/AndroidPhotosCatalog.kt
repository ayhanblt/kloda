package com.kloda.sync

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.system.Os
import org.json.JSONObject
import java.io.File

internal class AndroidPhotosCatalog(
  private val context: Context,
  private val check: () -> Unit,
  private val send: (String, Int) -> String,
  private val manifest: (OwnBackup) -> PhotoManifest
) {
  fun restoreAll(): Map<String, Any> {
    check()
    val file = File.createTempFile("photo-catalog-", ".sqlite", context.cacheDir)
    Os.chmod(file.path, 384)
    try {
      SQLiteDatabase.openOrCreateDatabase(file, null).use { database ->
        database.execSQL("CREATE TABLE assets(device TEXT,asset TEXT,revision INTEGER,id TEXT,name TEXT,sha256 TEXT,size INTEGER,PRIMARY KEY(device,asset))")
        var after: String? = null
        while (true) {
          check()
          val command = JSONObject().put("kind", "list").apply { after?.let { put("after", it) } }
          val page = AndroidOwnBackups.response(send(command.toString(), -1), setOf("photos"), 262144).getJSONArray("photos")
          if (page.length() > 32) throw FilesFailure("outcome_unknown")
          repeat(page.length()) { index ->
            val backup = AndroidOwnBackups.operation(page.getJSONObject(index))
            if (after != null && backup.id <= after!!) throw FilesFailure("outcome_unknown")
            after = backup.id
            if (backup.name.startsWith(PhotoManifestCodec.prefix) && backup.name.endsWith(".json")) {
              val value = manifest(backup)
              retain(database, backup, value)
            }
          }
          if (page.length() < 32) break
        }
        database.rawQuery("SELECT id,name,sha256,size FROM assets ORDER BY device,asset", null).use { cursor ->
          while (cursor.moveToNext()) {
            check()
            val backup = OwnBackup(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getLong(3))
            AndroidPhotosRestore(context, check, send).restore(manifest(backup))
          }
        }
      }
      return AndroidPhotosRestore.status(context)
    } finally { SQLiteDatabase.deleteDatabase(file) }
  }
  internal fun retain(database: SQLiteDatabase, backup: OwnBackup, value: PhotoManifest) {
    database.rawQuery("SELECT revision,sha256 FROM assets WHERE device=? AND asset=?", arrayOf(value.sourceDeviceId, value.assetId)).use {
      if (it.moveToFirst()) {
        if (it.getLong(0) > value.revision) return
        if (it.getLong(0) == value.revision) {
          if (it.getString(1) != backup.sha256) throw FilesFailure("manifest_invalid")
          return
        }
      }
    }
    database.insertWithOnConflict("assets", null, ContentValues().apply {
      put("device", value.sourceDeviceId); put("asset", value.assetId); put("revision", value.revision)
      put("id", backup.id); put("name", backup.name); put("sha256", backup.sha256); put("size", backup.size)
    }, SQLiteDatabase.CONFLICT_REPLACE).also { if (it == -1L) throw FilesFailure("queue_unavailable") }
  }
}
