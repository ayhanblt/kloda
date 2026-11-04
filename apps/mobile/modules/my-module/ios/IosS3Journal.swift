#if KLODA_S3_NATIVE
import Foundation
import SQLite3

struct IosS3Job: Codable, Equatable {
  let id: String
  let installation: String
  let context: String
  let target: IosS3Target
  let source: String
  let reference: String
  let revision: String
  let sourceGeneration: String
  let snapshot: String
  let key: String
  let sha256: String
  let size: Int64
  var name: String? = nil
  var logicalPath: String? = nil
  var kind: String? = nil
  var asset: String? = nil
  var mimeType: String? = nil
  func payload() throws -> String {
    try target.validate()
    guard [id, installation, context, source].allSatisfy({ UUID(uuidString: $0)?.uuidString.lowercased() == $0 }), size >= 0,
      snapshot == id + ".snapshot", key == "objects/" + installation + "/" + id,
      [reference, revision, sourceGeneration].allSatisfy({ !$0.isEmpty && $0.utf8.count <= 4096 && !$0.utf8.contains(0) }),
      (name == nil || (!name!.isEmpty && name!.utf8.count <= 255 && name != "." && name != ".." && !name!.contains("/") && !name!.contains("\\") && !name!.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }))),
      (logicalPath == nil || (!logicalPath!.isEmpty && logicalPath!.utf8.count <= 4096 && !logicalPath!.utf8.contains(0))),
      sha256.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil
      else { throw IosS3Failure(code: "invalid_request") }
    guard kind == nil || ["file", "photo_resource", "photo_manifest"].contains(kind!),
      !["photo_resource", "photo_manifest"].contains(kind ?? "") || asset?.range(of: "\\A[A-Za-z0-9_-]{1,128}\\z", options: .regularExpression) != nil,
      mimeType == nil || (mimeType!.utf8.count <= 127 && mimeType!.range(of: "\\A[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+\\z", options: .regularExpression) != nil)
      else { throw IosS3Failure(code: "invalid_request") }
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(self)
    guard data.count <= 16384, let result = String(data: data, encoding: .utf8) else { throw IosS3Failure(code: "invalid_request") }
    return result
  }
}

// Separate per-provider database; ACK history never becomes permission for another context.
final class IosS3Journal {
  static let lock = IosWebDavContext.lock
  let database: IosSyncJournal
  let provider: String
  init(url: URL, provider: String) throws {
    guard ["amazon-s3", "s3-compatible"].contains(provider) else { throw IosS3Failure(code: "invalid_request") }
    self.provider = provider; database = try IosSyncJournal(databaseURL: url)
    try database.execute("CREATE TABLE IF NOT EXISTS s3_identity(id INTEGER PRIMARY KEY CHECK(id=1),installation TEXT NOT NULL,context TEXT NOT NULL,provider TEXT NOT NULL)")
    try database.execute("INSERT OR IGNORE INTO s3_identity VALUES(1,?,?,?)", values: [UUID().uuidString.lowercased(), UUID().uuidString.lowercased(), provider])
    guard try string("SELECT provider FROM s3_identity WHERE id=1") == provider else { throw IosS3Failure(code: "storage_failure") }
    try database.execute("CREATE TABLE IF NOT EXISTS s3_profile(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,ready INTEGER NOT NULL CHECK(ready IN(0,1)))")
    try database.execute("CREATE TABLE IF NOT EXISTS s3_enabled(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL CHECK(value IN(0,1)))")
    try database.execute("INSERT OR IGNORE INTO s3_enabled VALUES(1,0)")
    try database.execute("CREATE TABLE IF NOT EXISTS s3_job(id TEXT PRIMARY KEY,header TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'prepared')")
    try database.execute("CREATE TABLE IF NOT EXISTS s3_event(sequence INTEGER PRIMARY KEY AUTOINCREMENT,job TEXT NOT NULL REFERENCES s3_job(id),kind TEXT NOT NULL,payload TEXT NOT NULL)")
    try database.execute("CREATE TRIGGER IF NOT EXISTS immutable_s3_job BEFORE UPDATE ON s3_job WHEN NEW.id IS NOT OLD.id OR NEW.header IS NOT OLD.header OR OLD.state IN('completed','aborted','review') BEGIN SELECT RAISE(ABORT,'s3_binding'); END")
    for table in ["s3_job", "s3_event"] {
      try database.execute("CREATE TRIGGER IF NOT EXISTS retain_\(table) BEFORE DELETE ON \(table) BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
    try database.execute("CREATE TABLE IF NOT EXISTS s3_automatic(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL CHECK(value IN(0,1)))")
    try database.execute("INSERT OR IGNORE INTO s3_automatic VALUES(1,0)")
    try createCatalog()
    try database.execute("CREATE TRIGGER IF NOT EXISTS immutable_s3_event BEFORE UPDATE ON s3_event BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  func automatic() throws -> Bool { try string("SELECT value FROM s3_automatic WHERE id=1") == "1" }
  func setAutomatic(_ value: Bool) throws {
    try transaction {
      guard try !value || enabled() else { throw IosS3Failure(code: "target_pause") }
      try invalidate(); try database.execute("UPDATE s3_automatic SET value=? WHERE id=1", values: [Int64(value ? 1 : 0)])
    }
  }
  private func string(_ sql: String, _ values: [Any] = []) throws -> String {
    try database.statement(sql, values: values) { row in
      guard sqlite3_step(row) == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "storage_failure") }
      return String(cString: text)
    }
  }
  func transaction<T>(_ body: () throws -> T) throws -> T {
    Self.lock.lock(); defer { Self.lock.unlock() }
    try database.execute("BEGIN IMMEDIATE")
    do { let result = try body(); try database.execute("COMMIT"); return result }
    catch { try? database.execute("ROLLBACK"); throw error }
  }
  func context() throws -> String { try string("SELECT context FROM s3_identity WHERE id=1") }
  func installation() throws -> String { try string("SELECT installation FROM s3_identity WHERE id=1") }
  func invalidate() throws { try database.execute("UPDATE s3_identity SET context=? WHERE id=1", values: [UUID().uuidString.lowercased()]) }
  func targetJSON(_ target: IosS3Target) throws -> String {
    try target.validate(); guard target.provider == provider else { throw IosS3Failure(code: "invalid_request") }
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; return String(decoding: try encoder.encode(target), as: UTF8.self)
  }
  func hasProfile() throws -> Bool { try string("SELECT CAST(COUNT(*) AS TEXT) FROM s3_profile") == "1" }
  func profileCurrent(_ target: IosS3Target) throws -> Bool {
    try string("SELECT CAST(COUNT(*) AS TEXT) FROM s3_profile WHERE id=1 AND ready=1 AND target=?", [try targetJSON(target)]) == "1"
  }
  func prepareProfile(_ target: IosS3Target) throws {
    try transaction {
      try invalidate(); try database.execute("UPDATE s3_enabled SET value=0 WHERE id=1"); try database.execute("UPDATE s3_automatic SET value=0 WHERE id=1")
      try database.execute("INSERT OR REPLACE INTO s3_profile VALUES(1,?,0)", values: [try targetJSON(target)])
    }
  }
  func confirmProfile(_ target: IosS3Target) throws {
    try database.execute("UPDATE s3_profile SET ready=1 WHERE id=1 AND ready=0 AND target=?", values: [try targetJSON(target)])
    guard try profileCurrent(target) else { throw IosS3Failure(code: "context_changed") }
  }
  func enabled() throws -> Bool { try string("SELECT CAST(value AS TEXT) FROM s3_enabled WHERE id=1") == "1" }
  func setEnabled(_ value: Bool) throws {
    try transaction {
      if value { guard try string("SELECT CAST(COUNT(*) AS TEXT) FROM s3_profile WHERE id=1 AND ready=1") == "1" else { throw IosS3Failure(code: "profile_missing") } }
      try invalidate(); try database.execute("UPDATE s3_enabled SET value=? WHERE id=1", values: [Int64(value ? 1 : 0)])
    }
  }
  func insert(_ job: IosS3Job) throws {
    try transaction {
      guard try job.installation == installation(), try job.context == context(), try profileCurrent(job.target), try enabled() else { throw IosS3Failure(code: "context_changed") }
      try database.execute("INSERT INTO s3_job(id,header) VALUES(?,?)", values: [job.id, try job.payload()])
      try index(job)
    }
  }
  func state(_ job: IosS3Job) throws -> String {
    try string("SELECT state FROM s3_job WHERE id=? AND header=?", [job.id, try job.payload()])
  }
  func events(_ job: IosS3Job, kind: String) throws -> [[String: Any]] {
    _ = try state(job)
    return try database.statement("SELECT payload FROM s3_event WHERE job=? AND kind=? ORDER BY sequence", values: [job.id, kind]) { row in
      var result: [[String: Any]] = []
      var step = sqlite3_step(row)
      while step == SQLITE_ROW {
        guard result.count < 10000, let text = sqlite3_column_text(row, 0), let value = try JSONSerialization.jsonObject(with: Data(String(cString: text).utf8)) as? [String: Any] else { throw IosS3Failure(code: "storage_failure") }
        result.append(value); step = sqlite3_step(row)
      }
      guard step == SQLITE_DONE else { throw IosS3Failure(code: "storage_failure") }
      return result
    }
  }
  func record(_ job: IosS3Job, from: String, to: String, payload: [String: Any] = [:], current: () throws -> Bool) throws {
    let allowed = ["prepared": ["creating"], "creating": ["created"], "created": ["part-intent", "aborting"],
      "part-intent": ["part-ack"], "part-ack": ["part-intent", "completing", "aborting"],
      "completing": ["complete-ack"], "complete-ack": ["completed"], "aborting": ["aborted"]]
    guard allowed[from]?.contains(to) == true || (to == "review" && !["completed", "aborted", "review"].contains(from)) else { throw IosS3Failure(code: "outcome_unknown") }
    let needsCurrent = ["creating", "part-intent", "completing", "completed", "aborting"].contains(to)
    try transaction {
      guard try state(job) == from else { throw IosS3Failure(code: "binding_changed") }
      if needsCurrent { guard try context() == job.context, try profileCurrent(job.target), try enabled(), try current() else { throw IosS3Failure(code: "context_changed") } }
      if to == "completed" {
        guard payload["sha256"] as? String == job.sha256, payload["size"] as? String == String(job.size) else { throw IosS3Failure(code: "outcome_unknown") }
      }
      let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
      guard data.count <= 65536 else { throw IosS3Failure(code: "invalid_request") }
      try database.execute("UPDATE s3_job SET state=? WHERE id=? AND state=? AND header=?", values: [to, job.id, from, try job.payload()])
      guard try state(job) == to else { throw IosS3Failure(code: "storage_failure") }
      try database.execute("INSERT INTO s3_event(job,kind,payload) VALUES(?,?,?)", values: [job.id, to, String(decoding: data, as: UTF8.self)])
    }
  }
  func bindSources(_ binding: String) throws -> String {
    guard binding.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil else { throw IosS3Failure(code: "invalid_request") }
    return try transaction {
      try database.execute("CREATE TABLE IF NOT EXISTS s3_sources(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL)")
      let previous = try database.statement("SELECT binding FROM s3_sources WHERE id=1") { row -> String? in
        let step = sqlite3_step(row); if step == SQLITE_DONE { return nil }
        guard step == SQLITE_ROW, let value = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "storage_failure") }; return String(cString: value)
      }
      if previous != binding { try invalidate(); try database.execute("INSERT OR REPLACE INTO s3_sources VALUES(1,?)", values: [binding]) }
      return try context()
    }
  }
  func recoverInterrupted(_ after: () throws -> Void = {}) throws {
    try transaction {
      try invalidate()
      try database.execute("UPDATE s3_job SET state='review' WHERE state NOT IN('completed','review','aborted')")
      try after()
    }
  }
}
#endif
