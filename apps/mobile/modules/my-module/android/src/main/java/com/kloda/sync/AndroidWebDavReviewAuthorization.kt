package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import java.util.UUID

// Audit is never loaded as reusable authority: the live actor separately checks foreground/context.
internal class AndroidWebDavReviewAuthorization(private val database: SQLiteDatabase) {
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_review_authorization(request TEXT PRIMARY KEY,job TEXT NOT NULL REFERENCES webdav_upload(id),target TEXT NOT NULL,source TEXT NOT NULL,original_binding TEXT NOT NULL,current_binding TEXT NOT NULL)")
    for (operation in listOf("UPDATE", "DELETE")) database.execSQL("CREATE TRIGGER IF NOT EXISTS immutable_webdav_review_${operation.lowercase()} BEFORE $operation ON webdav_review_authorization BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun authorize(value: WebDavUpload, request: UUID, binding: String, journal: AndroidWebDavJournal) {
    val current = journal.find(value.id) ?: throw FilesFailure("outcome_unknown")
    if (binding.isEmpty() || binding.toByteArray().size > 8192 || binding.contains('\u0000') || current.binding != value.binding || current.skipped ||
      current.phase !in setOf("uploaded", "moving", "moved") || current.kind == null || current.sourceIdentity == null) throw FilesFailure("review_required")
    database.insertOrThrow("webdav_review_authorization", null, ContentValues().apply {
      put("request", request.toString()); put("job", value.id); put("target", value.target); put("source", value.source)
      put("original_binding", value.binding); put("current_binding", binding)
    })
  }
  fun require(value: WebDavUpload, request: UUID, binding: String) {
    database.rawQuery("SELECT 1 FROM webdav_review_authorization WHERE request=? AND job=? AND target=? AND source=? AND original_binding=? AND current_binding=?",
      arrayOf(request.toString(), value.id, value.target, value.source, value.binding, binding)).use {
      if (!it.moveToFirst()) throw FilesFailure("settings_changed")
    }
  }
}
