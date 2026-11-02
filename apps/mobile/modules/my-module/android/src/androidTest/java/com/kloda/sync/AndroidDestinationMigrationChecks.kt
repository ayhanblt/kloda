package com.kloda.sync

import android.database.sqlite.SQLiteConstraintException
import android.database.sqlite.SQLiteDatabase
import java.io.File

// ADR0027 shared backup_destination kind migration, on scratch databases only.
internal object AndroidDestinationMigrationChecks {
  // The exact statement every earlier release ran.
  private const val ORIGINAL = """CREATE TABLE IF NOT EXISTS backup_destination (
      kind TEXT NOT NULL CHECK(kind IN ('pc','webdav')),id TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),revision TEXT NOT NULL,PRIMARY KEY(kind,id))"""
  private const val PC = "AAAAAAAAAAAAAAAAAAAAAg"
  private const val DAV = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBw"

  private fun schema(database: SQLiteDatabase) = database.rawQuery(
    "SELECT name,sql FROM sqlite_master WHERE name LIKE 'backup_destination%' ORDER BY name", null
  ).use { buildList { while (it.moveToNext()) add(it.getString(0) to it.getString(1)) } }
  private fun rows(database: SQLiteDatabase) = database.rawQuery(
    "SELECT kind,id,enabled,revision FROM backup_destination ORDER BY kind,id", null
  ).use { buildList { while (it.moveToNext()) add(listOf(it.getString(0), it.getString(1), it.getInt(2).toString(), it.getString(3))) } }
  private fun refused(database: SQLiteDatabase, kind: String, id: String, enabled: Int = 1) {
    var observed = false
    try { database.execSQL("INSERT INTO backup_destination VALUES(?,?,?,?)", arrayOf(kind, id, enabled, "r")) } catch (_: SQLiteConstraintException) { observed = true }
    check(observed) { "constraint not enforced for $kind/$enabled" }
  }
  private fun open(root: File, name: String) = SQLiteDatabase.openOrCreateDatabase(File(root, name), null)

  fun run(root: File) {
    open(root, "destination-original.sqlite").use { database ->
      database.execSQL(ORIGINAL)
      database.execSQL("INSERT INTO backup_destination VALUES('pc',?,1,'v1'),('webdav',?,0,'0f8b7a4e-8f5c-4a43-9a52-3d1c6c1e9a10')", arrayOf(PC, DAV))
      refused(database, "nextcloud", DAV)
      val before = rows(database)
      val journal = AndroidWebDavJournal(database)
      val migrated = schema(database)
      check(migrated.size == 1 && migrated[0].second.contains(AndroidWebDavJournal.DESTINATION_KINDS)) { "not migrated: $migrated" }
      check(rows(database) == before) { "rows changed" }
      check(journal.enabled("pc", PC, "v1") && !journal.enabled("webdav", DAV))
      listOf("nextcloud", "cloudme", "kolab-now", "smb").forEach {
        database.execSQL("INSERT INTO backup_destination VALUES(?,?,0,'r')", arrayOf(it, DAV))
      }
      refused(database, "dropbox", DAV)
      refused(database, "nextcloud", PC, enabled = 2)
      refused(database, "nextcloud", DAV)
      // Writing the new kinds through the journal stays closed until the multi-destination queue slice.
      var closed = false
      try { journal.setEnabled("nextcloud", DAV, true, "r") } catch (error: FilesFailure) { closed = error.code == "invalid_request" }
      check(closed) { "setEnabled widened" }
      val after = rows(database)
      AndroidWebDavJournal(database)
      check(schema(database) == migrated && rows(database) == after) { "second open changed the table" }
    }
    open(root, "destination-fresh.sqlite").use { database ->
      AndroidWebDavJournal(database)
      val fresh = schema(database)
      check(fresh.size == 1 && fresh[0].second.contains(AndroidWebDavJournal.DESTINATION_KINDS)) { "fresh table: $fresh" }
    }
    // A row the new CHECK refuses rolls the whole rebuild back; the original table is left as it was.
    open(root, "destination-unknown.sqlite").use { database ->
      database.execSQL("CREATE TABLE backup_destination (kind TEXT NOT NULL,id TEXT NOT NULL,enabled INTEGER NOT NULL,revision TEXT NOT NULL,PRIMARY KEY(kind,id))")
      database.execSQL("INSERT INTO backup_destination VALUES('pc',?,1,'v1'),('dropbox',?,1,'r')", arrayOf(PC, DAV))
      val before = schema(database) to rows(database)
      var failed = false
      try { AndroidWebDavJournal(database) } catch (_: SQLiteConstraintException) { failed = true }
      check(failed && (schema(database) to rows(database)) == before) { "partial rebuild left behind" }
    }
  }
}
