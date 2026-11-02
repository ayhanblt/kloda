#if KLODA_SFTP_NATIVE
import Foundation
import SQLite3

struct IosSftpPlan: Equatable {
  let target: String
  let binding: String
  var occurrence: Int64
  var due: Int64
  var run: String?
  func validate() throws {
    try IosSftpRun(id: run ?? "00000000-0000-4000-8000-000000000000", target: target, binding: binding, automatic: true, occurrence: occurrence).validate()
    guard due >= 0 else { throw IosSftpFailure(code: "outcome_unknown") }
  }
}

extension IosSftpJournal {
  func createPlan() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS sftp_plan(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
  }
  func plan() throws -> IosSftpPlan? {
    try database.statement("SELECT target,binding,occurrence,due,run FROM sftp_plan WHERE id=1") { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let target = sqlite3_column_text(row, 0), let binding = sqlite3_column_text(row, 1) else { throw IosSftpFailure(code: "storage_failure") }
      let run = sqlite3_column_text(row, 4).map { String(cString: $0) }
      let value = IosSftpPlan(target: String(cString: target), binding: String(cString: binding), occurrence: sqlite3_column_int64(row, 2), due: sqlite3_column_int64(row, 3), run: run)
      try value.validate(); return value
    }
  }
  func savePlan(_ value: IosSftpPlan, expected: IosSftpPlan? = nil) throws {
    try value.validate()
    let values: [Any] = [value.target, value.binding, value.occurrence, value.due, value.run as Any? ?? NSNull()]
    if let expected {
      try database.statement("UPDATE sftp_plan SET target=?,binding=?,occurrence=?,due=?,run=? WHERE id=1 AND target=? AND binding=? AND occurrence=? AND due=? AND run IS ? RETURNING id",
        values: values + [expected.target, expected.binding, expected.occurrence, expected.due, expected.run as Any? ?? NSNull()]) { row in
        guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosSftpFailure(code: "settings_changed") }
      }
    } else {
      try database.execute("INSERT INTO sftp_plan(id,target,binding,occurrence,due,run) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET target=excluded.target,binding=excluded.binding,occurrence=excluded.occurrence,due=excluded.due,run=excluded.run", values: values)
    }
  }
}

#endif
