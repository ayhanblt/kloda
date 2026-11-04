#if KLODA_FTPS_NATIVE
import Foundation
import CryptoKit
import SQLite3

struct IosFtpsCatalogPage { let jobs: [IosFtpsUpload]; let next: String? }
struct IosFtpsFailure: Error { let code: String; var jobId: String? = nil }
struct IosFtpsTarget: Codable, Equatable {
  let address: String
  let port: Int
  let hostname: String
  let root: String
  let username: String
  let profileGeneration: String
  let credentialGeneration: String
  func validate() throws {
    let parts = root.split(separator: "/", omittingEmptySubsequences: false)
    let rootValid = root == "/" || root.hasPrefix("/") && parts.dropFirst().allSatisfy { !$0.isEmpty && $0 != "." && $0 != ".." && $0.utf8.count <= 255 }
    guard !address.isEmpty, !username.isEmpty, username.utf8.count <= 1024, (1...65535).contains(port), rootValid, !root.contains("\\"),
      hostname.utf8.count <= 253, hostname.split(separator: ".", omittingEmptySubsequences: false).allSatisfy({ !$0.isEmpty && $0.utf8.count <= 63 && !$0.hasPrefix("-") && !$0.hasSuffix("-") && $0.range(of: "\\A[A-Za-z0-9-]+\\z", options: .regularExpression) != nil }),
      [address, root, username].allSatisfy({ $0.utf8.count <= 4096 && !$0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }),
      [profileGeneration, credentialGeneration].allSatisfy({ UUID(uuidString: $0)?.uuidString.lowercased() == $0 }) else { throw IosFtpsFailure(code: "invalid_request") }
  }
  func archiveId() throws -> String {
    let data = try JSONSerialization.data(withJSONObject: ["ftps", address, String(port), hostname, root, username])
    return Data(SHA256.hash(data: data)).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  func sameArchive(_ other: IosFtpsTarget) -> Bool {
    address == other.address && port == other.port && hostname == other.hostname && root == other.root && username == other.username
  }
}
struct IosFtpsUpload: Codable, Equatable {
  let id: String
  let installation: String
  let target: IosFtpsTarget
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
  var name: String? = nil
  var logicalPath: String? = nil
  var mimeType: String? = nil

  func payload() throws -> String {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(self)
    guard data.count <= 16384, let text = String(data: data, encoding: .utf8) else { throw IosFtpsFailure(code: "invalid_request") }
    return text
  }
  func validate() throws {
    try target.validate()
    let fields = [installation, context, source, reference, revision, relativePath, snapshot, target.address,
      target.hostname, target.root, target.username, target.profileGeneration, target.credentialGeneration]
    guard UUID(uuidString: id)?.uuidString.lowercased() == id,
      UUID(uuidString: context) != nil, UUID(uuidString: source) != nil,
      !installation.isEmpty, !reference.isEmpty, !revision.isEmpty, !relativePath.isEmpty,
      !target.address.isEmpty, !target.hostname.isEmpty, !target.username.isEmpty,
      !target.profileGeneration.isEmpty, !target.credentialGeneration.isEmpty,
      (1...65535).contains(target.port), size >= 0,
      fields.allSatisfy({ $0.utf8.count <= 4096 && !$0.utf8.contains(0) }),
      ["file", "photo_resource", "photo_manifest"].contains(kind),
      kind == "file" || (asset != nil && !asset!.isEmpty && asset!.utf8.count <= 128),
      sha256.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil,
      (name == nil || (!name!.isEmpty && name!.utf8.count <= 255 && !name!.contains("/") && !name!.contains("\\") && !name!.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }))),
      (logicalPath == nil || (!logicalPath!.isEmpty && logicalPath!.utf8.count <= 4096 && !logicalPath!.utf8.contains(0))),
      (mimeType == nil || (mimeType!.utf8.count <= 127 && mimeType!.range(of: "\\A[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+\\z", options: .regularExpression) != nil)),
      snapshot == id + ".snapshot" else { throw IosFtpsFailure(code: "invalid_request") }
    _ = try payload()
  }
}

// Separate FTPS rows/database; the shared SQLite helper supplies FULL/WAL, no PC/DAV receipts.
final class IosFtpsJournal {
  static let ownerLock = IosWebDavContext.lock
  let database: IosSyncJournal
  init(databaseURL: URL) throws {
    database = try IosSyncJournal(databaseURL: databaseURL)
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("CREATE TABLE IF NOT EXISTS ftps_installation(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)")
    try database.execute("INSERT OR IGNORE INTO ftps_installation VALUES(1,?)", values: [UUID().uuidString.lowercased()])
    try database.execute("CREATE TABLE IF NOT EXISTS ftps_context(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    try database.execute("INSERT OR IGNORE INTO ftps_context VALUES(1,?)", values: [UUID().uuidString.lowercased()])
    try database.execute("CREATE TABLE IF NOT EXISTS ftps_sources(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL)")
    try database.execute("CREATE TABLE IF NOT EXISTS ftps_profile(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN (0,1)))")
    try database.execute("""
      CREATE TABLE IF NOT EXISTS ftps_upload(id TEXT PRIMARY KEY,header TEXT NOT NULL,context TEXT NOT NULL,
        size INTEGER NOT NULL CHECK(size>=0),step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 3),
        issue TEXT,completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)))
      """)
    try database.execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_ftps_upload BEFORE UPDATE ON ftps_upload
      WHEN NEW.id IS NOT OLD.id OR NEW.header IS NOT OLD.header OR NEW.context IS NOT OLD.context
        OR NEW.size IS NOT OLD.size OR (NEW.step IS NOT OLD.step AND NEW.step!=OLD.step+1)
        OR NEW.completed<OLD.completed OR (OLD.issue IS NOT NULL AND NEW.issue IS NOT OLD.issue)
        OR (OLD.completed=1 AND (NEW.step IS NOT OLD.step OR NEW.issue IS NOT OLD.issue))
        OR (NEW.completed=1 AND (NEW.step!=3 OR NEW.issue IS NOT NULL
          OR NEW.context IS NOT (SELECT revision FROM ftps_context WHERE id=1)))
      BEGIN SELECT RAISE(ABORT,'ftps_binding'); END
      """)
    let columns = try database.statement("PRAGMA table_info(ftps_upload)") { row -> Set<String> in
      var result = Set<String>()
      while sqlite3_step(row) == SQLITE_ROW { if let raw = sqlite3_column_text(row, 1) { result.insert(String(cString: raw)) } }
      return result
    }
    for column in ["locator_source", "locator_reference", "locator_archive", "locator_installation", "locator_hash"] where !columns.contains(column) {
      try database.execute("ALTER TABLE ftps_upload ADD COLUMN \(column) TEXT")
    }
    try database.execute("CREATE INDEX IF NOT EXISTS ftps_completed_locator ON ftps_upload(locator_archive,locator_installation,locator_source,locator_reference,locator_hash) WHERE completed=1 AND issue IS NULL")
    try database.execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_ftps_locator BEFORE UPDATE ON ftps_upload
      WHEN NEW.locator_source IS NOT OLD.locator_source OR NEW.locator_reference IS NOT OLD.locator_reference
        OR NEW.locator_archive IS NOT OLD.locator_archive OR NEW.locator_installation IS NOT OLD.locator_installation OR NEW.locator_hash IS NOT OLD.locator_hash
      BEGIN SELECT RAISE(ABORT,'ftps_binding'); END
      """)
    try database.execute("CREATE TRIGGER IF NOT EXISTS retain_ftps_upload BEFORE DELETE ON ftps_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  func installation() throws -> String {
    try database.statement("SELECT value FROM ftps_installation WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosFtpsFailure(code: "storage_failure") }
      let value = String(cString: raw)
      guard UUID(uuidString: value)?.uuidString.lowercased() == value else { throw IosFtpsFailure(code: "storage_failure") }
      return value
    }
  }
  // Local catalog only. Remote bytes are always reverified by a separate restore operation.
  func catalog(target: IosFtpsTarget, after: String? = nil) throws -> IosFtpsCatalogPage {
    if let after, UUID(uuidString: after)?.uuidString.lowercased() != after { throw IosFtpsFailure(code: "invalid_request") }
    let own = try installation()
    return try database.statement("SELECT header FROM ftps_upload WHERE completed=1 AND issue IS NULL AND id>? ORDER BY id LIMIT 101", values: [after ?? ""]) { row in
      var jobs = [IosFtpsUpload](), cursor: String?, count = 0
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return IosFtpsCatalogPage(jobs: jobs, next: nil) }
        guard step == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosFtpsFailure(code: "storage_failure") }
        if count == 100 { return IosFtpsCatalogPage(jobs: jobs, next: cursor) }
        let header = String(cString: raw)
        let job = try JSONDecoder().decode(IosFtpsUpload.self, from: Data(header.utf8))
        try job.validate()
        guard try job.payload() == header else { throw IosFtpsFailure(code: "binding_changed") }
        count += 1; cursor = job.id
        if job.installation == own && job.target.sameArchive(target) { jobs.append(job) }
      }
    }
  }
  func knownCompleted(_ wanted: IosFtpsUpload) throws -> IosFtpsUpload? { try candidate(wanted, completed: true, exactPath: false) }
  func unresolved(_ wanted: IosFtpsUpload) throws -> IosFtpsUpload? { try candidate(wanted, completed: false, exactPath: false) }
  func resourceReceipt(_ wanted: IosFtpsUpload) throws -> IosFtpsUpload? { try candidate(wanted, completed: true, exactPath: true) }
  private func candidate(_ wanted: IosFtpsUpload, completed: Bool, exactPath: Bool) throws -> IosFtpsUpload? {
    try wanted.validate()
    let own = try installation()
    guard wanted.installation == own else { throw IosFtpsFailure(code: "binding_changed") }
    let outcome = completed ? "completed=1 AND issue IS NULL" : "completed=0"
    return try database.statement("SELECT header FROM ftps_upload WHERE \(outcome) AND ((locator_archive=? AND locator_installation=? AND locator_source=? AND locator_reference=? AND locator_hash=?) OR locator_source IS NULL) ORDER BY rowid DESC",
      values: [try wanted.target.archiveId(), own, wanted.source, wanted.reference, wanted.sha256]) { row in
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return nil }
        guard step == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosFtpsFailure(code: "storage_failure") }
        let header = String(cString: raw)
        let value = try JSONDecoder().decode(IosFtpsUpload.self, from: Data(header.utf8)); try value.validate()
        guard try value.payload() == header else { throw IosFtpsFailure(code: "binding_changed") }
        if value.installation == own && value.target.sameArchive(wanted.target) && value.source == wanted.source && value.reference == wanted.reference &&
          value.sha256 == wanted.sha256 && value.size == wanted.size && value.kind == wanted.kind && value.asset == wanted.asset && value.logicalPath == wanted.logicalPath && value.name == wanted.name && value.mimeType == wanted.mimeType && (!exactPath || value.relativePath == wanted.relativePath) { return value }
      }
    }
  }
  func ownReceipt(id: String, target: IosFtpsTarget) throws -> IosFtpsUpload {
    let job = try reviewJob(id: id, target: target)
    guard try state(job).completed, try state(job).issue == nil else { throw IosFtpsFailure(code: "receipt_missing") }
    return job
  }
  func reviewJob(id: String, target: IosFtpsTarget) throws -> IosFtpsUpload {
    guard UUID(uuidString: id)?.uuidString.lowercased() == id else { throw IosFtpsFailure(code: "invalid_request") }
    let job = try database.statement("SELECT header FROM ftps_upload WHERE id=?", values: [id]) { row -> IosFtpsUpload in
      guard sqlite3_step(row) == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosFtpsFailure(code: "receipt_missing") }
      let header = String(cString: raw)
      let value = try JSONDecoder().decode(IosFtpsUpload.self, from: Data(header.utf8)); try value.validate()
      guard try value.payload() == header else { throw IosFtpsFailure(code: "binding_changed") }; return value
    }
    guard try job.installation == installation(), job.id == id, job.target.sameArchive(target) else { throw IosFtpsFailure(code: "binding_changed") }
    return job
  }
  func context() throws -> String {
    try database.statement("SELECT revision FROM ftps_context WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosFtpsFailure(code: "storage_failure") }
      return String(cString: text)
    }
  }
  // Native owner startup only, before admitting workers; never infer an unknown remote outcome.
  func recoverInterrupted() throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("BEGIN IMMEDIATE")
    do {
      try invalidate()
      try database.execute("UPDATE ftps_upload SET issue=COALESCE(issue,'restart_review_required') WHERE completed=0")
      try database.execute("COMMIT")
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
  func invalidate() throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("UPDATE ftps_context SET revision=? WHERE id=1", values: [UUID().uuidString.lowercased()])
  }
  // Persist the complete source-generation binding before issuing new work.
  func bindSources(_ binding: String) throws -> String {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    guard binding.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil
      else { throw IosFtpsFailure(code: "invalid_request") }
    try database.execute("BEGIN IMMEDIATE")
    do {
      let same = try database.statement("SELECT binding FROM ftps_sources WHERE id=1") { row -> Bool in
        let step = sqlite3_step(row)
        guard step == SQLITE_ROW || step == SQLITE_DONE else { throw IosFtpsFailure(code: "storage_failure") }
        return step == SQLITE_ROW && sqlite3_column_text(row, 0).map { String(cString: $0) == binding } == true
      }
      if !same {
        try invalidate()
        try database.execute("INSERT OR REPLACE INTO ftps_sources VALUES(1,?)", values: [binding])
      }
      let value = try context()
      try database.execute("COMMIT")
      return value
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
  private func profileKey(_ target: IosFtpsTarget) throws -> String {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    guard let key = String(data: try encoder.encode(target), encoding: .utf8) else { throw IosFtpsFailure(code: "storage_failure") }
    return key
  }
  func hasProfile() throws -> Bool {
    try database.statement("SELECT 1 FROM ftps_profile WHERE id=1") { row in
      let result = sqlite3_step(row)
      guard result == SQLITE_ROW || result == SQLITE_DONE else { throw IosFtpsFailure(code: "storage_failure") }
      return result == SQLITE_ROW
    }
  }
  func profileCurrent(_ target: IosFtpsTarget) throws -> Bool {
    try database.statement("SELECT 1 FROM ftps_profile WHERE id=1 AND target=? AND ready=1", values: [try profileKey(target)]) { row in
      let result = sqlite3_step(row)
      guard result == SQLITE_ROW || result == SQLITE_DONE else { throw IosFtpsFailure(code: "storage_failure") }
      return result == SQLITE_ROW
    }
  }
  func prepareProfile(_ target: IosFtpsTarget) throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    let key = try profileKey(target)
    try database.execute("BEGIN IMMEDIATE")
    do {
      try invalidate()
      try database.execute("INSERT OR REPLACE INTO ftps_profile VALUES(1,?,0)", values: [key])
      try database.execute("COMMIT")
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
  func confirmProfile(_ target: IosFtpsTarget) throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("UPDATE ftps_profile SET ready=1 WHERE id=1 AND target=? AND ready=0", values: [try profileKey(target)])
    guard try profileCurrent(target) else { throw IosFtpsFailure(code: "context_changed") }
  }
  func insert(_ job: IosFtpsUpload) throws {
    try job.validate()
    guard try context() == job.context else { throw IosFtpsFailure(code: "context_changed") }
    try database.execute("INSERT INTO ftps_upload(id,header,context,size,locator_source,locator_reference,locator_archive,locator_installation,locator_hash) VALUES(?,?,?,?,?,?,?,?,?)",
      values: [job.id, try job.payload(), job.context, job.size, job.source, job.reference, try job.target.archiveId(), job.installation, job.sha256])
  }
  func state(_ job: IosFtpsUpload) throws -> (step: Int, issue: String?, completed: Bool) {
    try database.statement("SELECT header,step,issue,completed FROM ftps_upload WHERE id=?", values: [job.id]) { row in
      guard sqlite3_step(row) == SQLITE_ROW, let header = sqlite3_column_text(row, 0),
        String(cString: header) == (try job.payload()) else { throw IosFtpsFailure(code: "binding_changed") }
      return (Int(sqlite3_column_int(row, 1)), sqlite3_column_text(row, 2).map { String(cString: $0) }, sqlite3_column_int(row, 3) == 1)
    }
  }
  func record(_ job: IosFtpsUpload, event: Int32, bytes: UInt64) throws {
    let old = try state(job)
    guard (1...3).contains(event), old.step + 1 == Int(event), !old.completed,
      (event == 2 ? bytes == UInt64(job.size) : bytes == 0) else { throw IosFtpsFailure(code: "outcome_unknown") }
    // ACK persistence deliberately does not check current context or source admission.
    try database.execute("UPDATE ftps_upload SET step=? WHERE id=? AND step=?", values: [Int64(event), job.id, Int64(old.step)])
    guard try state(job).step == Int(event) else { throw IosFtpsFailure(code: "storage_failure") }
  }
  func markIssue(_ job: IosFtpsUpload, code: Int32) throws {
    try database.execute("UPDATE ftps_upload SET issue=COALESCE(issue,?) WHERE id=? AND completed=0", values: ["native_" + String(code), job.id])
  }
  func complete(_ job: IosFtpsUpload, current: () throws -> Bool) throws {
    Self.ownerLock.lock(); defer { Self.ownerLock.unlock() }
    try database.execute("BEGIN IMMEDIATE")
    do {
      let row = try state(job)
      guard row.step == 3, row.issue == nil, !row.completed, try context() == job.context,
        try current() else { throw IosFtpsFailure(code: "context_changed") }
      try database.execute("UPDATE ftps_upload SET completed=1 WHERE id=?", values: [job.id])
      try database.execute("COMMIT")
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
}

#endif
