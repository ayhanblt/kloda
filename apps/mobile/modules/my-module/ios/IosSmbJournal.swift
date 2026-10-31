import Foundation
import SQLite3

struct IosSmbFailure: Error { let code: String }
struct IosSmbTarget: Codable, Equatable {
  let address: String
  let port: Int
  let share: String
  let root: String
  let username: String
  let domain: String
  let profileGeneration: String
  let credentialGeneration: String
}
struct IosSmbUpload: Codable, Equatable {
  let id: String
  let installation: String
  let target: IosSmbTarget
  let context: String
  let source: String
  let reference: String
  let revision: String
  let relativePath: String
  let snapshot: String
  let sha256: String
  let size: Int64
  let kind: String
  let asset: String?

  func payload() throws -> String {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(self)
    guard data.count <= 16384, let text = String(data: data, encoding: .utf8) else { throw IosSmbFailure(code: "invalid_request") }
    return text
  }
  func validate() throws {
    let fields = [installation, context, source, reference, revision, relativePath, snapshot, target.address,
      target.share, target.root, target.username, target.domain, target.profileGeneration, target.credentialGeneration]
    guard UUID(uuidString: id)?.uuidString.lowercased() == id,
      UUID(uuidString: context) != nil, UUID(uuidString: source) != nil,
      !installation.isEmpty, !reference.isEmpty, !revision.isEmpty, !relativePath.isEmpty,
      !target.address.isEmpty, !target.share.isEmpty, !target.username.isEmpty,
      !target.profileGeneration.isEmpty, !target.credentialGeneration.isEmpty,
      (1...65535).contains(target.port), size >= 0,
      fields.allSatisfy({ $0.utf8.count <= 4096 && !$0.utf8.contains(0) }),
      ["file", "photo_resource", "photo_manifest"].contains(kind),
      kind == "file" || (asset != nil && !asset!.isEmpty && asset!.utf8.count <= 128),
      sha256.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil,
      snapshot == id + ".snapshot" else { throw IosSmbFailure(code: "invalid_request") }
    _ = try payload()
  }
}

// Separate SMB rows/database; the shared SQLite helper supplies FULL/WAL, no PC/DAV receipts.
final class IosSmbJournal {
  static let ownerLock = NSRecursiveLock()
  let database: IosSyncJournal
  init(databaseURL: URL) throws {
    database = try IosSyncJournal(databaseURL: databaseURL)
    try database.execute("CREATE TABLE IF NOT EXISTS smb_context(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    try database.execute("INSERT OR IGNORE INTO smb_context VALUES(1,?)", values: [UUID().uuidString.lowercased()])
    try database.execute("CREATE TABLE IF NOT EXISTS smb_profile(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN (0,1)))")
    try database.execute("""
      CREATE TABLE IF NOT EXISTS smb_upload(id TEXT PRIMARY KEY,header TEXT NOT NULL,context TEXT NOT NULL,
        size INTEGER NOT NULL CHECK(size>=0),step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 5),
        issue TEXT,completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)))
      """)
    try database.execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_smb_upload BEFORE UPDATE ON smb_upload
      WHEN NEW.id IS NOT OLD.id OR NEW.header IS NOT OLD.header OR NEW.context IS NOT OLD.context
        OR NEW.size IS NOT OLD.size OR (NEW.step IS NOT OLD.step AND NEW.step!=OLD.step+1)
        OR NEW.completed<OLD.completed OR (OLD.issue IS NOT NULL AND NEW.issue IS NOT OLD.issue)
        OR (OLD.completed=1 AND (NEW.step IS NOT OLD.step OR NEW.issue IS NOT OLD.issue))
        OR (NEW.completed=1 AND (NEW.step!=5 OR NEW.issue IS NOT NULL
          OR NEW.context IS NOT (SELECT revision FROM smb_context WHERE id=1)))
      BEGIN SELECT RAISE(ABORT,'smb_binding'); END
      """)
    try database.execute("CREATE TRIGGER IF NOT EXISTS retain_smb_upload BEFORE DELETE ON smb_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  func context() throws -> String {
    try database.statement("SELECT revision FROM smb_context WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosSmbFailure(code: "storage_failure") }
      return String(cString: text)
    }
  }
  func invalidate() throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("UPDATE smb_context SET revision=? WHERE id=1", values: [UUID().uuidString.lowercased()])
  }
  private func profileKey(_ target: IosSmbTarget) throws -> String {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    guard let key = String(data: try encoder.encode(target), encoding: .utf8) else { throw IosSmbFailure(code: "storage_failure") }
    return key
  }
  func hasProfile() throws -> Bool {
    try database.statement("SELECT 1 FROM smb_profile WHERE id=1") { row in
      let result = sqlite3_step(row)
      guard result == SQLITE_ROW || result == SQLITE_DONE else { throw IosSmbFailure(code: "storage_failure") }
      return result == SQLITE_ROW
    }
  }
  func profileCurrent(_ target: IosSmbTarget) throws -> Bool {
    try database.statement("SELECT 1 FROM smb_profile WHERE id=1 AND target=? AND ready=1", values: [try profileKey(target)]) { row in
      let result = sqlite3_step(row)
      guard result == SQLITE_ROW || result == SQLITE_DONE else { throw IosSmbFailure(code: "storage_failure") }
      return result == SQLITE_ROW
    }
  }
  func prepareProfile(_ target: IosSmbTarget) throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    let key = try profileKey(target)
    try database.execute("BEGIN IMMEDIATE")
    do {
      try invalidate()
      try database.execute("INSERT OR REPLACE INTO smb_profile VALUES(1,?,0)", values: [key])
      try database.execute("COMMIT")
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
  func confirmProfile(_ target: IosSmbTarget) throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("UPDATE smb_profile SET ready=1 WHERE id=1 AND target=? AND ready=0", values: [try profileKey(target)])
    guard try profileCurrent(target) else { throw IosSmbFailure(code: "context_changed") }
  }
  func insert(_ job: IosSmbUpload) throws {
    try job.validate()
    guard try context() == job.context else { throw IosSmbFailure(code: "context_changed") }
    try database.execute("INSERT INTO smb_upload(id,header,context,size) VALUES(?,?,?,?)", values: [job.id, try job.payload(), job.context, job.size])
  }
  func state(_ job: IosSmbUpload) throws -> (step: Int, issue: String?, completed: Bool) {
    try database.statement("SELECT header,step,issue,completed FROM smb_upload WHERE id=?", values: [job.id]) { row in
      guard sqlite3_step(row) == SQLITE_ROW, let header = sqlite3_column_text(row, 0),
        String(cString: header) == (try job.payload()) else { throw IosSmbFailure(code: "binding_changed") }
      return (Int(sqlite3_column_int(row, 1)), sqlite3_column_text(row, 2).map { String(cString: $0) }, sqlite3_column_int(row, 3) == 1)
    }
  }
  func record(_ job: IosSmbUpload, event: Int32, bytes: UInt64) throws {
    let old = try state(job)
    guard (1...5).contains(event), old.step + 1 == Int(event), !old.completed,
      (event == 2 ? bytes == UInt64(job.size) : bytes == 0) else { throw IosSmbFailure(code: "outcome_unknown") }
    // ACK persistence deliberately does not check current context or source admission.
    try database.execute("UPDATE smb_upload SET step=? WHERE id=? AND step=?", values: [Int64(event), job.id, Int64(old.step)])
    guard try state(job).step == Int(event) else { throw IosSmbFailure(code: "storage_failure") }
  }
  func markIssue(_ job: IosSmbUpload, code: Int32) throws {
    try database.execute("UPDATE smb_upload SET issue=COALESCE(issue,?) WHERE id=? AND completed=0", values: ["native_" + String(code), job.id])
  }
  func complete(_ job: IosSmbUpload, current: () throws -> Bool) throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("BEGIN IMMEDIATE")
    do {
      let row = try state(job)
      guard row.step == 5, row.issue == nil, !row.completed, try context() == job.context,
        try current() else { throw IosSmbFailure(code: "context_changed") }
      try database.execute("UPDATE smb_upload SET completed=1 WHERE id=?", values: [job.id])
      try database.execute("COMMIT")
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
}
