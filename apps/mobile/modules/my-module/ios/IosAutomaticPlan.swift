import Foundation
import SQLite3
import CryptoKit

struct IosAutomaticPlan: Equatable {
  var binding: String
  var recordId: String
  var occurrence: Int64
  var due: Int64

  func validate() throws {
    try IosAutomaticRun(id: "plan", binding: binding, recordId: recordId, occurrence: occurrence).validate()
    guard due >= 0 else { throw IosAutomaticPolicy.error("outcome_unknown") }
  }

  static func binding(_ source: Data, record: String) -> String {
    var data = source; data.append(Data(record.utf8))
    return IosFilesTransfer.encode(Data(SHA256.hash(data: data)))
  }

  func advanced(now: Int64, live: Bool, next: (Int64) throws -> Int64) throws -> IosAutomaticPlan {
    let previous = occurrence.addingReportingOverflow(1)
    guard !previous.overflow else { throw IosAutomaticPolicy.error("retry_clock_unavailable") }
    let value = live ? max(now, previous.partialValue) : try next(max(now, occurrence))
    return IosAutomaticPlan(binding: binding, recordId: recordId, occurrence: value, due: value)
  }

  static func nextOccurrence(now: Int64, intervalHours: Int, localTime: String, calendar: Calendar = .current) throws -> Int64 {
    guard now >= 0, [12, 24].contains(intervalHours),
      localTime.range(of: "^([01]\\d|2[0-3]):[0-5]\\d$", options: .regularExpression) != nil else {
      throw IosAutomaticPolicy.error("outcome_unknown")
    }
    let fields = localTime.split(separator: ":").compactMap { Int($0) }
    let after = Date(timeIntervalSince1970: Double(now) / 1000)
    var candidates: [Date] = []
    for offset in 0...1 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: after)) else { continue }
      for hour in stride(from: fields[0] % intervalHours, to: 24, by: intervalHours) {
        if let value = calendar.nextDate(after: day.addingTimeInterval(-1), matching: DateComponents(hour: hour, minute: fields[1], second: 0),
          matchingPolicy: .nextTime, repeatedTimePolicy: .first, direction: .forward), value > after { candidates.append(value) }
      }
    }
    guard let next = candidates.min() else { throw IosAutomaticPolicy.error("retry_clock_unavailable") }
    let value = next.timeIntervalSince1970 * 1000
    guard value.isFinite, value > Double(now), value < Double(Int64.max) else { throw IosAutomaticPolicy.error("retry_clock_unavailable") }
    return Int64(value)
  }
}

extension IosSyncJournal {
  func createAutomaticPlan() throws {
    try execute("""
      CREATE TABLE IF NOT EXISTS automatic_plan (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL,
        record_id TEXT NOT NULL, occurrence INTEGER NOT NULL CHECK(occurrence>=0), due INTEGER NOT NULL CHECK(due>=0))
      """)
    try execute("CREATE TABLE IF NOT EXISTS automatic_control (id INTEGER PRIMARY KEY CHECK(id=1), record_id TEXT, error_code TEXT)")
    try execute("INSERT OR IGNORE INTO automatic_control(id) VALUES(1)")
    try execute("CREATE TABLE IF NOT EXISTS automatic_context (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL)")
    try execute("INSERT OR IGNORE INTO automatic_context(id,revision) VALUES(1,?)", values: [UUID().uuidString])
  }

  func automaticBinding(_ source: Data, record: String) throws -> String {
    try statement("SELECT revision FROM automatic_context WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW else { throw journalError("storage_failure") }
      let revision = try automaticText(row, 0)
      guard UUID(uuidString: revision) != nil, sqlite3_step(row) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      var context = source; context.append(Data(revision.utf8))
      return IosAutomaticPlan.binding(context, record: record)
    }
  }
  func advanceAutomaticContext() throws {
    try execute("UPDATE automatic_context SET revision=? WHERE id=1", values: [UUID().uuidString])
  }

  func automaticPlan() throws -> IosAutomaticPlan? {
    try statement("SELECT binding,record_id,occurrence,due FROM automatic_plan WHERE id=1") { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW else { throw journalError("storage_failure") }
      let plan = try IosAutomaticPlan(binding: automaticText(row, 0), recordId: automaticText(row, 1),
        occurrence: automaticNumber(row, 2), due: automaticNumber(row, 3))
      try plan.validate()
      guard sqlite3_step(row) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      return plan
    }
  }

  func saveAutomaticPlan(_ value: IosAutomaticPlan?) throws {
    guard let value else { try execute("DELETE FROM automatic_plan WHERE id=1"); return }
    try value.validate()
    try execute("""
      INSERT INTO automatic_plan(id,binding,record_id,occurrence,due) VALUES(1,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET binding=excluded.binding,record_id=excluded.record_id,occurrence=excluded.occurrence,due=excluded.due
      """, values: [value.binding, value.recordId, value.occurrence, value.due])
  }

  func automaticRecord() throws -> String? {
    guard let value = try automaticControl("record_id") else { return nil }
    try IosAutomaticRun(id: "record", binding: "control", recordId: value, occurrence: 0).validate()
    return value
  }
  func setAutomaticRecord(_ value: String?) throws {
    if let value { try IosAutomaticRun(id: "record", binding: "control", recordId: value, occurrence: 0).validate() }
    try execute("UPDATE automatic_control SET record_id=? WHERE id=1", values: [value as Any? ?? NSNull()])
  }
  func automaticError() throws -> String? { try automaticControl("error_code") }
  func setAutomaticError(_ value: String?) throws {
    guard value == nil || (!value!.isEmpty && value!.utf8.count <= 128 && !value!.utf8.contains(0)) else { throw journalError("outcome_unknown") }
    try execute("UPDATE automatic_control SET error_code=? WHERE id=1", values: [value as Any? ?? NSNull()])
  }
  private func automaticControl(_ column: String) throws -> String? {
    try statement("SELECT \(column) FROM automatic_control WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW else { throw journalError("storage_failure") }
      let value = sqlite3_column_type(row, 0) == SQLITE_NULL ? nil : try automaticText(row, 0)
      guard sqlite3_step(row) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      return value
    }
  }
  private func automaticText(_ row: OpaquePointer, _ index: Int32) throws -> String {
    guard sqlite3_column_type(row, index) == SQLITE_TEXT, let pointer = sqlite3_column_text(row, index),
      let value = String(data: Data(bytes: pointer, count: Int(sqlite3_column_bytes(row, index))), encoding: .utf8) else {
      throw journalError("outcome_unknown")
    }
    return value
  }
  private func automaticNumber(_ row: OpaquePointer, _ index: Int32) throws -> Int64 {
    guard sqlite3_column_type(row, index) == SQLITE_INTEGER else { throw journalError("outcome_unknown") }
    return sqlite3_column_int64(row, index)
  }
}
