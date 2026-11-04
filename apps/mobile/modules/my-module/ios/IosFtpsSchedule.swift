#if KLODA_FTPS_NATIVE
import Foundation
import SQLite3

struct IosFtpsPlan: Equatable {
  let target: String
  let binding: String
  var occurrence: Int64
  var due: Int64
  var run: String?
  func validate() throws {
    try IosFtpsRun(id: run ?? "00000000-0000-4000-8000-000000000000", target: target, binding: binding, automatic: true, occurrence: occurrence).validate()
    guard due >= 0 else { throw IosFtpsFailure(code: "outcome_unknown") }
  }
}

extension IosFtpsJournal {
  func createPlan() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS ftps_plan(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
  }
  func plan() throws -> IosFtpsPlan? {
    try database.statement("SELECT target,binding,occurrence,due,run FROM ftps_plan WHERE id=1") { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let target = sqlite3_column_text(row, 0), let binding = sqlite3_column_text(row, 1) else { throw IosFtpsFailure(code: "storage_failure") }
      let run = sqlite3_column_text(row, 4).map { String(cString: $0) }
      let value = IosFtpsPlan(target: String(cString: target), binding: String(cString: binding), occurrence: sqlite3_column_int64(row, 2), due: sqlite3_column_int64(row, 3), run: run)
      try value.validate(); return value
    }
  }
  func savePlan(_ value: IosFtpsPlan, expected: IosFtpsPlan? = nil) throws {
    try value.validate()
    let values: [Any] = [value.target, value.binding, value.occurrence, value.due, value.run as Any? ?? NSNull()]
    if let expected {
      try database.statement("UPDATE ftps_plan SET target=?,binding=?,occurrence=?,due=?,run=? WHERE id=1 AND target=? AND binding=? AND occurrence=? AND due=? AND run IS ? RETURNING id",
        values: values + [expected.target, expected.binding, expected.occurrence, expected.due, expected.run as Any? ?? NSNull()]) { row in
        guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosFtpsFailure(code: "settings_changed") }
      }
    } else {
      try database.execute("INSERT INTO ftps_plan(id,target,binding,occurrence,due,run) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET target=excluded.target,binding=excluded.binding,occurrence=excluded.occurrence,due=excluded.due,run=excluded.run", values: values)
    }
  }
}

#endif
