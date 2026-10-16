package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase

internal object AndroidPhotosCatalogChecks {
  fun run(context: Context) {
    val requests = PhotosRestoreRequests()
    val cancelled = requests.reserve()
    check(requests.active)
    requests.cancel()
    try { requests.check(cancelled); error("Permission wait survived cancellation") }
    catch (failure: FilesFailure) { check(failure.code == "cancelled") }
    val current = requests.reserve()
    requests.release(cancelled)
    requests.check(current)
    try { requests.reserve(); error("Concurrent import reservation accepted") }
    catch (failure: FilesFailure) { check(failure.code == "backup_busy") }
    requests.release(current)
    check(!requests.active)
    val device = AndroidFilesSnapshots.randomId()
    val asset = AndroidFilesSnapshots.randomId()
    val original = PhotoResource(AndroidFilesSnapshots.randomId(), "original", "original.png", "image/png", "A".repeat(43), 4)
    val first = PhotoManifest(device, asset, 1, listOf(original), emptyList(), null)
    val old = OwnBackup(AndroidFilesSnapshots.randomId(), "kloda-photo-v1-old.json", "A".repeat(43), 10)
    val latest = old.copy(id = AndroidFilesSnapshots.randomId(), sha256 = "B".repeat(42) + "A")
    val catalog = AndroidPhotosCatalog(context, {}, { _, _ -> error("No network during selection checks") }, { first })
    SQLiteDatabase.create(null).use { database ->
      database.execSQL("CREATE TABLE assets(device TEXT,asset TEXT,revision INTEGER,id TEXT,name TEXT,sha256 TEXT,size INTEGER,PRIMARY KEY(device,asset))")
      catalog.retain(database, latest, first.copy(revision = 3))
      catalog.retain(database, old, first)
      database.rawQuery("SELECT revision,id FROM assets WHERE device=? AND asset=?", arrayOf(device, asset)).use {
        check(it.moveToFirst() && it.getLong(0) == 3L && it.getString(1) == latest.id)
      }
      try {
        catalog.retain(database, old, first.copy(revision = 3))
        error("Accepted conflicting same-revision manifest")
      } catch (failure: FilesFailure) { check(failure.code == "manifest_invalid") }
      catalog.retain(database, old, first.copy(sourceDeviceId = AndroidFilesSnapshots.randomId()))
      database.rawQuery("SELECT COUNT(*) FROM assets", null).use { check(it.moveToFirst() && it.getInt(0) == 2) }
    }
  }
}
