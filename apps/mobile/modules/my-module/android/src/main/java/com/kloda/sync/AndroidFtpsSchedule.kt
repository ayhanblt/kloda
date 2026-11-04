package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal data class FtpsPlan(val target: String, val binding: String, val occurrence: Long, val due: Long, val run: String? = null) {
  fun validate() {
    FtpsRun(run ?: "00000000-0000-4000-8000-000000000000", target, binding, true, occurrence).validate()
    if (due < 0) throw FilesFailure("outcome_unknown")
  }
}
internal class AndroidFtpsSchedule(private val database: SQLiteDatabase) {
  init { database.execSQL("CREATE TABLE IF NOT EXISTS ftps_plan(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)") }
  fun read(): FtpsPlan? = database.rawQuery("SELECT target,binding,occurrence,due,run FROM ftps_plan WHERE id=1", null).use {
    if (!it.moveToFirst()) null else FtpsPlan(it.getString(0), it.getString(1), it.getLong(2), it.getLong(3), if (it.isNull(4)) null else it.getString(4)).also { value -> value.validate() }
  }
  fun save(value: FtpsPlan, expected: FtpsPlan? = null) {
    value.validate()
    val values = ContentValues().apply {
      put("target", value.target); put("binding", value.binding); put("occurrence", value.occurrence); put("due", value.due); put("run", value.run)
    }
    if (expected != null) {
      val runClause = if (expected.run == null) "run IS NULL" else "run=?"
      val args = listOf(expected.target, expected.binding, expected.occurrence.toString(), expected.due.toString()) + listOfNotNull(expected.run)
      if (database.update("ftps_plan", values, "id=1 AND target=? AND binding=? AND occurrence=? AND due=? AND $runClause", args.toTypedArray()) != 1) throw FilesFailure("settings_changed")
    } else {
      if (database.update("ftps_plan", values, "id=1", emptyArray()) == 0) {
        values.put("id", 1); database.insertOrThrow("ftps_plan", null, values)
      }
    }
  }
}
