import Foundation
import SQLite3

struct IosFilesRun: Codable, Equatable {
  var id: String
  var recordId: String
  var binding: String
  var state: String = "running"
  var errorCode: String? = nil
  var attempts: Int = 1

  func validate() throws {
    guard !id.isEmpty, id.utf8.count <= 255, !id.utf8.contains(0),
      !binding.isEmpty, binding.utf8.count <= 4096, !binding.utf8.contains(0),
      ["running", "paused", "finished", "needs_attention", "failed"].contains(state),
      (1...5).contains(attempts),
      errorCode == nil || (!errorCode!.isEmpty && errorCode!.utf8.count <= 128),
      let data = Data(base64Encoded: recordId.replacingOccurrences(of: "-", with: "+")
        .replacingOccurrences(of: "_", with: "/") + "=="), data.count == 16,
      data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") == recordId else {
      throw NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: "outcome_unknown"])
    }
  }
}

extension IosSyncJournal {
  func createFilesRuns() throws {
    try execute("""
      CREATE TABLE IF NOT EXISTS files_run (
        id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL, binding TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('running','paused','finished','needs_attention','failed')),
        error_code TEXT, attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 5)
      )
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS retain_files_run BEFORE DELETE ON files_run
      BEGIN SELECT RAISE(ABORT,'retained'); END
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_files_run BEFORE UPDATE ON files_run
      WHEN NEW.id IS NOT OLD.id OR NEW.record_id IS NOT OLD.record_id OR NEW.binding IS NOT OLD.binding
        OR NEW.attempts IS NOT OLD.attempts
        OR (OLD.state IN ('finished','needs_attention','failed') AND
          (NEW.state IS NOT OLD.state OR NEW.error_code IS NOT OLD.error_code))
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
  }

  func latestFilesRun() throws -> IosFilesRun? {
    try statement("SELECT id,record_id,binding,state,error_code,attempts FROM files_run ORDER BY rowid DESC LIMIT 1") { statement in
      let result = sqlite3_step(statement)
      if result == SQLITE_DONE { return nil }
      guard result == SQLITE_ROW else { throw journalError("storage_failure") }
      func text(_ column: Int32) throws -> String {
        guard sqlite3_column_type(statement, column) == SQLITE_TEXT,
          let bytes = sqlite3_column_text(statement, column) else { throw journalError("outcome_unknown") }
        let data = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, column)))
        guard let value = String(data: data, encoding: .utf8) else { throw journalError("outcome_unknown") }
        return value
      }
      guard sqlite3_column_type(statement, 5) == SQLITE_INTEGER else { throw journalError("outcome_unknown") }
      let errorCode = sqlite3_column_type(statement, 4) == SQLITE_NULL ? nil : try text(4)
      let value = try IosFilesRun(id: text(0), recordId: text(1), binding: text(2), state: text(3),
        errorCode: errorCode, attempts: Int(sqlite3_column_int64(statement, 5)))
      try value.validate()
      guard sqlite3_step(statement) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      return value
    }
  }

  func saveFilesRun(_ value: IosFilesRun) throws {
    try value.validate()
    try execute("""
      INSERT INTO files_run(id,record_id,binding,state,error_code,attempts) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET record_id=excluded.record_id,binding=excluded.binding,
        state=excluded.state,error_code=excluded.error_code,attempts=excluded.attempts
      """, values: [value.id, value.recordId, value.binding, value.state,
        value.errorCode as Any? ?? NSNull(), Int64(value.attempts)])
  }

  func recoverFilesRuns() throws {
    try execute("UPDATE files_run SET state='paused',error_code='interrupted' WHERE state='running'")
  }
}
