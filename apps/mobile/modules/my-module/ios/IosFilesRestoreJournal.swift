import Foundation
import SQLite3

struct IosRestoreIntent: Codable, Equatable {
  var id: String
  var recordId: String
  var operationId: String
  var name: String
  var sha256: String
  var size: Int64
  var staging: String
  var offset: Int64 = 0
  var destination: String? = nil
  var device: UInt64? = nil
  var inode: UInt64? = nil
  var state: String = "downloading"
  var errorCode: String? = nil

  func validate() throws {
    guard Self.canonical(id, bytes: 16), Self.canonical(recordId, bytes: 16),
      Self.canonical(operationId, bytes: 16), Self.canonical(sha256, bytes: 32),
      Self.filename(name), Self.filename(staging), size >= 0, offset >= 0, offset <= size,
      ["downloading", "verified", "publishing", "completed", "review_required"].contains(state),
      (device == nil) == (inode == nil),
      destination == nil || (destination!.utf8.count <= 1_048_576 && !(Data(base64Encoded: destination!)?.isEmpty ?? true)),
      device == nil || destination != nil,
      state != "verified" || offset == size,
      state != "publishing" || (offset == size && destination != nil),
      state != "completed" || (offset == size && destination != nil && device != nil && inode != nil),
      errorCode == nil || (!errorCode!.isEmpty && errorCode!.utf8.count <= 128) else {
      throw NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: "outcome_unknown"])
    }
  }

  private static func canonical(_ text: String, bytes: Int) -> Bool {
    let padded = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
      + String(repeating: "=", count: (4 - text.count % 4) % 4)
    guard let data = Data(base64Encoded: padded), data.count == bytes else { return false }
    return data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") == text
  }

  private static func filename(_ text: String) -> Bool {
    !text.isEmpty && text.utf8.count <= 255 && text != "." && text != ".."
      && !text.contains("/") && !text.contains("\\")
      && text.unicodeScalars.allSatisfy { $0.value >= 32 && $0.value != 127 }
  }
}

extension IosSyncJournal {
  func createRestoreIntents() throws {
    try execute("""
      CREATE TABLE IF NOT EXISTS files_restore (
        id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL, operation_id TEXT NOT NULL,
        name TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes>=0),
        staging TEXT NOT NULL, offset_bytes INTEGER NOT NULL CHECK(offset_bytes>=0 AND offset_bytes<=size_bytes),
        destination TEXT, device TEXT, inode TEXT,
        state TEXT NOT NULL CHECK(state IN ('downloading','verified','publishing','completed','review_required')),
        error_code TEXT,
        CHECK((device IS NULL)=(inode IS NULL)), CHECK(device IS NULL OR destination IS NOT NULL),
        CHECK(state!='verified' OR offset_bytes=size_bytes),
        CHECK(state!='publishing' OR (offset_bytes=size_bytes AND destination IS NOT NULL)),
        CHECK(state!='completed' OR (offset_bytes=size_bytes AND destination IS NOT NULL AND device IS NOT NULL AND inode IS NOT NULL))
      )
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS retain_files_restore BEFORE DELETE ON files_restore
      BEGIN SELECT RAISE(ABORT,'retained'); END
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_files_restore BEFORE UPDATE ON files_restore
      WHEN NEW.id IS NOT OLD.id OR NEW.record_id IS NOT OLD.record_id OR NEW.operation_id IS NOT OLD.operation_id
        OR NEW.name IS NOT OLD.name OR NEW.sha256 IS NOT OLD.sha256 OR NEW.size_bytes IS NOT OLD.size_bytes
        OR NEW.staging IS NOT OLD.staging OR NEW.offset_bytes<OLD.offset_bytes
        OR (OLD.destination IS NOT NULL AND NEW.destination IS NOT OLD.destination)
        OR (OLD.device IS NOT NULL AND NEW.device IS NOT OLD.device)
        OR (OLD.inode IS NOT NULL AND NEW.inode IS NOT OLD.inode)
        OR (OLD.state='completed' AND NEW.state!='completed')
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
  }

  func restoreIntent(record: String, operation: String) throws -> IosRestoreIntent? {
    try statement("SELECT * FROM files_restore WHERE record_id=? AND operation_id=? ORDER BY rowid DESC LIMIT 1", values: [record, operation]) { statement in
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
      func optionalText(_ column: Int32) throws -> String? {
        sqlite3_column_type(statement, column) == SQLITE_NULL ? nil : try text(column)
      }
      func unsigned(_ column: Int32) throws -> UInt64? {
        guard let value = try optionalText(column) else { return nil }
        guard let parsed = UInt64(value), String(parsed) == value else { throw journalError("outcome_unknown") }
        return parsed
      }
      guard sqlite3_column_type(statement, 5) == SQLITE_INTEGER,
        sqlite3_column_type(statement, 7) == SQLITE_INTEGER else { throw journalError("outcome_unknown") }
      let value = try IosRestoreIntent(id: text(0), recordId: text(1), operationId: text(2), name: text(3),
        sha256: text(4), size: sqlite3_column_int64(statement, 5), staging: text(6),
        offset: sqlite3_column_int64(statement, 7), destination: optionalText(8), device: unsigned(9),
        inode: unsigned(10), state: text(11), errorCode: optionalText(12))
      try value.validate()
      guard sqlite3_step(statement) == SQLITE_DONE else { throw journalError("outcome_unknown") }
      return value
    }
  }

  func saveRestoreIntent(_ value: IosRestoreIntent) throws {
    try value.validate()
    let fields: [Any] = [value.id, value.recordId, value.operationId, value.name, value.sha256, value.size,
      value.staging, value.offset, value.destination as Any? ?? NSNull(),
      value.device.map(String.init) as Any? ?? NSNull(), value.inode.map(String.init) as Any? ?? NSNull(),
      value.state, value.errorCode as Any? ?? NSNull()]
    try execute("""
      INSERT INTO files_restore (id,record_id,operation_id,name,sha256,size_bytes,staging,offset_bytes,destination,device,inode,state,error_code)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET record_id=excluded.record_id,operation_id=excluded.operation_id,
        name=excluded.name,sha256=excluded.sha256,size_bytes=excluded.size_bytes,staging=excluded.staging,
        offset_bytes=excluded.offset_bytes,destination=excluded.destination,device=excluded.device,inode=excluded.inode,
        state=excluded.state,error_code=excluded.error_code
      """, values: fields)
  }
}
