package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal data class WebDavPlan(val target: String, val binding: String, val occurrence: Long, val due: Long, val run: String? = null) {
  fun validate() {
    WebDavRun(run ?: "00000000-0000-4000-8000-000000000000", target, binding, true, occurrence).validate()
    if (due < 0) throw FilesFailure("outcome_unknown")
  }
}
// ADR0027 §4: one automatic opportunity per DAV destination. The former single-row webdav_plan is moved once into
// webdav_target_plan (same transaction) and left empty, so an older build simply plans again.
internal class AndroidWebDavSchedule(private val database: SQLiteDatabase) {
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_plan(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_target_plan(target TEXT PRIMARY KEY NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
    database.beginTransaction()
    try {
      database.execSQL("INSERT OR IGNORE INTO webdav_target_plan(target,binding,occurrence,due,run) SELECT target,binding,occurrence,due,run FROM webdav_plan WHERE id=1")
      database.execSQL("DELETE FROM webdav_plan")
      database.setTransactionSuccessful()
    } finally { database.endTransaction() }
  }
  private fun row(it: android.database.Cursor) =
    WebDavPlan(it.getString(0), it.getString(1), it.getLong(2), it.getLong(3), if (it.isNull(4)) null else it.getString(4)).also { value -> value.validate() }
  fun read(target: String): WebDavPlan? =
    database.rawQuery("SELECT target,binding,occurrence,due,run FROM webdav_target_plan WHERE target=?", arrayOf(target)).use {
      if (!it.moveToFirst()) null else row(it)
    }
  fun all(): List<WebDavPlan> = database.rawQuery("SELECT target,binding,occurrence,due,run FROM webdav_target_plan ORDER BY target", null).use {
    buildList { while (it.moveToNext()) add(row(it)) }
  }
  fun delete(target: String) { database.delete("webdav_target_plan", "target=?", arrayOf(target)) }
  fun save(value: WebDavPlan, expected: WebDavPlan? = null) {
    value.validate()
    val values = ContentValues().apply {
      put("binding", value.binding); put("occurrence", value.occurrence); put("due", value.due); put("run", value.run)
    }
    if (expected != null) {
      if (expected.target != value.target) throw FilesFailure("invalid_request")
      val runClause = if (expected.run == null) "run IS NULL" else "run=?"
      val args = listOf(expected.target, expected.binding, expected.occurrence.toString(), expected.due.toString()) + listOfNotNull(expected.run)
      if (database.update("webdav_target_plan", values, "target=? AND binding=? AND occurrence=? AND due=? AND $runClause", args.toTypedArray()) != 1) throw FilesFailure("settings_changed")
    } else {
      if (database.update("webdav_target_plan", values, "target=?", arrayOf(value.target)) == 0) {
        values.put("target", value.target); database.insertOrThrow("webdav_target_plan", null, values)
      }
    }
  }
}
