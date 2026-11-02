import Foundation
import SQLite3

struct IosWebDavPlan: Equatable {
  let target: String
  let binding: String
  var occurrence: Int64
  var due: Int64
  var run: String?
  func validate() throws {
    try IosWebDavRun(id: run ?? "00000000-0000-4000-8000-000000000000", target: target, binding: binding, automatic: true, occurrence: occurrence).validate()
    guard due >= 0 else { throw IosWebDavFailure.code("outcome_unknown") }
  }
}

// ADR0027 §4: one automatic opportunity per DAV destination. The former single-row webdav_plan is moved once into
// webdav_target_plan (same transaction) and left empty, so an older build simply plans again.
extension IosWebDavJournal {
  func createPlan() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS webdav_plan(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
    try database.execute("CREATE TABLE IF NOT EXISTS webdav_target_plan(target TEXT PRIMARY KEY NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
    try database.execute("BEGIN IMMEDIATE")
    do {
      try database.execute("INSERT OR IGNORE INTO webdav_target_plan(target,binding,occurrence,due,run) SELECT target,binding,occurrence,due,run FROM webdav_plan WHERE id=1")
      try database.execute("DELETE FROM webdav_plan")
      try database.execute("COMMIT")
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
  private func plans(_ sql: String, _ values: [Any]) throws -> [IosWebDavPlan] {
    try database.statement(sql, values: values) { row in
      var result: [IosWebDavPlan] = []
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return result }
        guard step == SQLITE_ROW, let target = sqlite3_column_text(row, 0), let binding = sqlite3_column_text(row, 1) else { throw IosWebDavFailure.code("storage_failure") }
        let run = sqlite3_column_text(row, 4).map { String(cString: $0) }
        let value = IosWebDavPlan(target: String(cString: target), binding: String(cString: binding), occurrence: sqlite3_column_int64(row, 2), due: sqlite3_column_int64(row, 3), run: run)
        try value.validate(); result.append(value)
      }
    }
  }
  func plan(target: String) throws -> IosWebDavPlan? {
    try plans("SELECT target,binding,occurrence,due,run FROM webdav_target_plan WHERE target=?", [target]).first
  }
  func plans() throws -> [IosWebDavPlan] { try plans("SELECT target,binding,occurrence,due,run FROM webdav_target_plan ORDER BY target", []) }
  func deletePlan(target: String) throws { try database.execute("DELETE FROM webdav_target_plan WHERE target=?", values: [target]) }
  func savePlan(_ value: IosWebDavPlan, expected: IosWebDavPlan? = nil) throws {
    try value.validate()
    let values: [Any] = [value.binding, value.occurrence, value.due, value.run as Any? ?? NSNull()]
    if let expected {
      guard expected.target == value.target else { throw IosWebDavFailure.code("invalid_request") }
      try database.statement("UPDATE webdav_target_plan SET binding=?,occurrence=?,due=?,run=? WHERE target=? AND binding=? AND occurrence=? AND due=? AND run IS ? RETURNING target",
        values: values + [expected.target, expected.binding, expected.occurrence, expected.due, expected.run as Any? ?? NSNull()]) { row in
        guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosWebDavFailure.code("settings_changed") }
      }
    } else {
      try database.execute("INSERT INTO webdav_target_plan(target,binding,occurrence,due,run) VALUES(?,?,?,?,?) ON CONFLICT(target) DO UPDATE SET binding=excluded.binding,occurrence=excluded.occurrence,due=excluded.due,run=excluded.run",
        values: [value.target] + values)
    }
  }
}
