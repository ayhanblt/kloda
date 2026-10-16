package com.kloda.sync

import android.content.Context
import android.content.Intent
import java.io.ByteArrayInputStream
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

internal object AndroidOwnRestoreChecks {
  fun run(context: Context) {
    val bytes = byteArrayOf(1, 2, 3, 4)
    val digest = AndroidFilesSnapshots.digest(ByteArrayInputStream(bytes))
    val id = AndroidFilesSnapshots.randomId()
    val operation = JSONObject().put("id", id).put("requestId", AndroidFilesSnapshots.randomId())
      .put("sourceId", AndroidFilesSnapshots.randomId()).put("sourceRevision", "original-revision")
      .put("name", "original.jpg").put("sha256", digest.sha256).put("size", digest.size)
      .put("offset", digest.size).put("state", "completed")
    val backup = AndroidOwnBackups.operation(operation)
    val page = JSONObject().put("status", 200).put("photos", JSONArray().put(operation)).toString()
    check((AndroidOwnBackups.list(page, null)["items"] as List<*>).size == 1)
    expect("outcome_unknown") { AndroidOwnBackups.list(page, id) }
    expect("outcome_unknown") { AndroidOwnBackups.operation(JSONObject(operation.toString()).put("state", "publishing")) }
    expect("outcome_unknown") { AndroidOwnBackups.operation(JSONObject(operation.toString()).put("offset", 3)) }
    expect("outcome_unknown") { AndroidOwnBackups.operation(JSONObject(operation.toString()).put("name", "../original.jpg")) }
    expect("outcome_unknown") { AndroidOwnBackups.operation(JSONObject(operation.toString()).put("sha256", digest.sha256 + "=")) }
    expect("denied") { AndroidOwnBackups.response("{\"status\":403,\"errorCode\":\"denied\"}", setOf("operation")) }
    val chunk = JSONObject().put("status", 200).put("bytes", 4).put("offset", 0).put("size", 4)
    check(AndroidOwnBackups.chunk(chunk.toString(), 0, 4) == 4L)
    expect("outcome_unknown") { AndroidOwnBackups.chunk(JSONObject(chunk.toString()).put("offset", 1).toString(), 0, 4) }
    expect("local_storage_full") { AndroidOwnBackups.chunk("{\"status\":0,\"errorCode\":\"backup_full\"}", 0, 4) }
    expect("backup_full") { AndroidOwnBackups.chunk("{\"status\":507,\"errorCode\":\"backup_full\"}", 0, 4) }
    expect("outcome_unknown") { AndroidOwnBackups.chunk(JSONObject(chunk.toString()).put("bytes", 0).toString(), 0, 4) }
    expect("outcome_unknown") { AndroidOwnBackups.chunk(JSONObject(chunk.toString()).put("size", 5).toString(), 0, 4) }
    var checks = 0
    val restore = AndroidOwnRestore(context, backup, { checks += 1 }, { _, _ -> error("No transport in boundary checks") })
    restore.verify(ByteArrayInputStream(bytes))
    check(checks > 0)
    expect("hash_mismatch") { restore.verify(ByteArrayInputStream(byteArrayOf(1, 2, 3, 9))) }
    expect("hash_mismatch") { restore.verify(ByteArrayInputStream(byteArrayOf(1, 2, 3))) }
    expect("hash_mismatch") { restore.verify(ByteArrayInputStream(byteArrayOf(1, 2, 3, 4, 5))) }
    restore.pause(false)
    restore.verify(ByteArrayInputStream(bytes)) // The OS picker background transition is not a network resume.
    restore.choosing = false
    restore.pause(false)
    expect("cancelled") { restore.verify(ByteArrayInputStream(bytes)) }
    val intent = RestoreDestinationContract().createIntent(context, RestoreDestinationInput(backup.name))
    check(intent.action == Intent.ACTION_CREATE_DOCUMENT && intent.hasCategory(Intent.CATEGORY_OPENABLE))
    check(intent.getStringExtra(Intent.EXTRA_TITLE) == backup.name)
    check(RestoreDestinationContract().parseResult(RestoreDestinationInput(backup.name), 0, null) == null)
    val directory = File(context.cacheDir, "kloda-own-restore")
    check(directory.isDirectory || directory.mkdirs())
    val stale = File.createTempFile("restore-check-", ".part", directory)
    AndroidOwnRestore.cleanup(context)
    check(!stale.exists())
  }
  private fun expect(code: String, action: () -> Unit) {
    try { action(); error("Accepted invalid restore evidence: $code") }
    catch (failure: FilesFailure) { check(failure.code == code) }
  }
}
