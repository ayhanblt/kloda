package com.kloda.sync

import java.util.UUID

// Immutable request-to-copy binding survives a lost UI result or process interruption.
internal class AndroidSmbCopyRequests(private val journal: AndroidSmbJournal) {
  init {
    journal.database.execSQL("CREATE TABLE IF NOT EXISTS smb_copy_request(request TEXT PRIMARY KEY,original TEXT NOT NULL,job TEXT NOT NULL UNIQUE)")
    journal.database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_smb_copy_request BEFORE UPDATE ON smb_copy_request BEGIN SELECT RAISE(ABORT,'binding'); END")
    journal.database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_smb_copy_request BEFORE DELETE ON smb_copy_request BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun result(request: UUID, original: String, target: SmbTarget): SmbUpload? = journal.database.rawQuery(
    "SELECT original,job FROM smb_copy_request WHERE request=?", arrayOf(request.toString())).use {
    if (!it.moveToFirst()) return@use null
    if (it.getString(0) != original) throw SmbFailure("binding_changed")
    val id = it.getString(1)
    try { journal.ownReceipt(id, target) } catch (_: Exception) { throw SmbFailure("review_required", id) }
  }
  fun reserve(request: UUID, original: String, job: SmbUpload) {
    job.validate()
    val old = journal.reviewJob(original, job.target)
    if (job.installation != journal.installation() || job.context != journal.context() || old.kind != "file" || job.kind != "file" ||
      old.source != job.source || old.reference != job.reference) throw SmbFailure("binding_changed")
    journal.database.execSQL("INSERT INTO smb_copy_request VALUES(?,?,?)", arrayOf(request.toString(), original, job.id))
  }
  companion object {
    fun path(path: String, hash: String, id: String): String {
      val name = path.substringAfterLast('/')
      val split = name.lastIndexOf('.').takeIf { it > 0 } ?: name.length
      val clock = java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.ROOT).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
      val suffix = " (Kloda ${clock.format(java.util.Date())} ${hash.take(8)} ${id.take(8)})" + name.substring(split)
      val short = StringBuilder()
      for (point in name.substring(0, split).codePoints().toArray()) {
        val char = String(Character.toChars(point))
        if (short.toString().toByteArray().size + char.toByteArray().size > 255 - suffix.toByteArray().size) break
        short.append(char)
      }
      if (short.isEmpty()) throw SmbFailure("review_required")
      return path.substringBeforeLast('/') + "/" + short + suffix
    }
  }
}
