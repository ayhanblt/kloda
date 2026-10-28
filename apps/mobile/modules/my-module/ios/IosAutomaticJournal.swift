import Foundation
import SQLite3

extension IosSyncJournal {
  func createAutomatic() throws {
    try execute("CREATE TABLE IF NOT EXISTS automatic_state (id INTEGER PRIMARY KEY CHECK(id=1), paused INTEGER NOT NULL CHECK(paused IN (0,1)))")
    try execute("INSERT OR IGNORE INTO automatic_state(id,paused) VALUES(1,0)")
    try execute("""
      CREATE TABLE IF NOT EXISTS automatic_run (
        id TEXT PRIMARY KEY NOT NULL, binding TEXT NOT NULL, record_id TEXT NOT NULL,
        occurrence INTEGER NOT NULL CHECK(occurrence>=0), phase TEXT NOT NULL CHECK(phase IN ('running','waiting','finished','exhausted','paused')),
        os_attempts INTEGER NOT NULL CHECK(os_attempts BETWEEN 1 AND 5),
        access_attempts INTEGER NOT NULL CHECK(access_attempts BETWEEN 0 AND 5),
        updated INTEGER NOT NULL CHECK(updated IN (0,1)), retry_at INTEGER, error_code TEXT, retry_uptime INTEGER, retry_boot TEXT,
        UNIQUE(binding,record_id,occurrence), CHECK(updated=0 OR (phase='finished' AND error_code IS NULL)),
        CHECK((phase='waiting' AND retry_at IS NOT NULL AND retry_at>=0 AND retry_uptime IS NOT NULL AND retry_uptime>=0
          AND retry_boot IS NOT NULL AND length(retry_boot)>0) OR
          (phase!='waiting' AND retry_at IS NULL AND retry_uptime IS NULL AND retry_boot IS NULL))
      )
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_automatic_run BEFORE UPDATE ON automatic_run
      WHEN NEW.id IS NOT OLD.id OR NEW.binding IS NOT OLD.binding OR NEW.record_id IS NOT OLD.record_id OR NEW.occurrence IS NOT OLD.occurrence
        OR NEW.os_attempts<OLD.os_attempts OR NEW.os_attempts>OLD.os_attempts+1
        OR NEW.access_attempts<OLD.access_attempts OR NEW.access_attempts>OLD.access_attempts+1
        OR ((OLD.phase IN ('finished','exhausted') OR (OLD.phase='paused' AND OLD.error_code='settings_changed')) AND
          (NEW.phase IS NOT OLD.phase OR NEW.error_code IS NOT OLD.error_code OR NEW.updated IS NOT OLD.updated
           OR NEW.os_attempts IS NOT OLD.os_attempts OR NEW.access_attempts IS NOT OLD.access_attempts))
      BEGIN SELECT RAISE(ABORT,'automatic_binding'); END
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS retain_automatic_run BEFORE DELETE ON automatic_run
      BEGIN SELECT RAISE(ABORT,'automatic_retained'); END
      """)
  }

  func automaticPaused() throws -> Bool {
    try statement("SELECT paused FROM automatic_state WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW, sqlite3_column_type(row, 0) == SQLITE_INTEGER else { throw journalError("storage_failure") }
      let value = sqlite3_column_int64(row, 0)
      guard value == 0 || value == 1, sqlite3_step(row) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      return value == 1
    }
  }

  func setAutomaticPaused(_ value: Bool) throws {
    try execute("UPDATE automatic_state SET paused=? WHERE id=1", values: [Int64(value ? 1 : 0)])
    guard try automaticPaused() == value else { throw journalError("storage_failure") }
  }

  func automaticRun(id: String? = nil) throws -> IosAutomaticRun? {
    let query = "SELECT id,binding,record_id,occurrence,phase,os_attempts,access_attempts,updated,retry_at,error_code,retry_uptime,retry_boot FROM automatic_run"
      + (id == nil ? " ORDER BY rowid DESC LIMIT 1" : " WHERE id=?")
    return try statement(query, values: id.map { [$0] } ?? []) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW else { throw journalError("storage_failure") }
      func text(_ index: Int32) throws -> String {
        guard sqlite3_column_type(row, index) == SQLITE_TEXT, let bytes = sqlite3_column_text(row, index),
          let value = String(data: Data(bytes: bytes, count: Int(sqlite3_column_bytes(row, index))), encoding: .utf8) else {
          throw journalError("outcome_unknown")
        }
        return value
      }
      func number(_ index: Int32) throws -> Int64 {
        guard sqlite3_column_type(row, index) == SQLITE_INTEGER else { throw journalError("outcome_unknown") }
        return sqlite3_column_int64(row, index)
      }
      let updated = try number(7)
      guard updated == 0 || updated == 1 else { throw journalError("outcome_unknown") }
      let value = try IosAutomaticRun(id: text(0), binding: text(1), recordId: text(2), occurrence: number(3), phase: text(4),
        osAttempts: Int(number(5)), accessAttempts: Int(number(6)), updated: updated == 1,
        retryAt: sqlite3_column_type(row, 8) == SQLITE_NULL ? nil : number(8),
        errorCode: sqlite3_column_type(row, 9) == SQLITE_NULL ? nil : text(9),
        retryUptime: sqlite3_column_type(row, 10) == SQLITE_NULL ? nil : number(10),
        retryBoot: sqlite3_column_type(row, 11) == SQLITE_NULL ? nil : text(11))
      try value.validate()
      guard sqlite3_step(row) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      return value
    }
  }

  func saveAutomaticRun(_ value: IosAutomaticRun) throws {
    try value.validate()
    try execute("""
      INSERT INTO automatic_run(id,binding,record_id,occurrence,phase,os_attempts,access_attempts,updated,retry_at,error_code,retry_uptime,retry_boot)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET binding=excluded.binding,record_id=excluded.record_id,
        occurrence=excluded.occurrence,phase=excluded.phase,os_attempts=excluded.os_attempts,access_attempts=excluded.access_attempts,
        updated=excluded.updated,retry_at=excluded.retry_at,error_code=excluded.error_code,retry_uptime=excluded.retry_uptime,retry_boot=excluded.retry_boot
      """, values: [value.id, value.binding, value.recordId, value.occurrence, value.phase, Int64(value.osAttempts), Int64(value.accessAttempts),
        Int64(value.updated ? 1 : 0), value.retryAt as Any? ?? NSNull(), value.errorCode as Any? ?? NSNull(),
        value.retryUptime as Any? ?? NSNull(), value.retryBoot as Any? ?? NSNull()])
  }
}
