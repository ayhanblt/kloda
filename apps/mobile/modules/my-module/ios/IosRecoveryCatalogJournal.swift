import Foundation
import SQLite3

// ADR0029 §3 (29/2): catalog deltas live beside the DAV receipts. A delta row is immutable apart from its phase,
// which follows the upload contract; `catalog_entry` binds each Completed receipt to the delta that lists it in one
// chain, so a new chain (regenerated secret) lists every receipt again. Nothing here is ever deleted.
struct IosCatalogDelta: Equatable {
  let id: String
  let target: String
  let chain: String
  let sequence: Int64
  let payload: Data
  let sha256: String
  var phase = "prepared"
  var issue: String? = nil
}

extension IosWebDavJournal {
  func createCatalog() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS catalog_installation(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)")
    try database.execute("INSERT OR IGNORE INTO catalog_installation(id,value) VALUES(1,?)", values: [UUID().uuidString.lowercased()])
    try database.execute("CREATE TABLE IF NOT EXISTS webdav_completion(job TEXT PRIMARY KEY REFERENCES webdav_upload(id),at INTEGER NOT NULL)")
    try database.execute("""
      CREATE TABLE IF NOT EXISTS catalog_delta(id TEXT PRIMARY KEY,target TEXT NOT NULL,chain TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK(sequence>0),payload TEXT NOT NULL,sha256 TEXT NOT NULL,
        phase TEXT NOT NULL CHECK(phase IN ('prepared','uploaded','moving','moved','completed')),issue TEXT,UNIQUE(target,chain,sequence))
      """)
    try database.execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_catalog_delta BEFORE UPDATE ON catalog_delta
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.chain IS NOT OLD.chain OR NEW.sequence IS NOT OLD.sequence
        OR NEW.payload IS NOT OLD.payload OR NEW.sha256 IS NOT OLD.sha256 OR (NEW.phase IS NOT OLD.phase AND NOT (
          (OLD.phase='prepared' AND NEW.phase='uploaded') OR (OLD.phase='uploaded' AND NEW.phase='moving')
          OR (OLD.phase='moving' AND NEW.phase='moved') OR (OLD.phase='moved' AND NEW.phase='completed')))
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
    try database.execute("""
      CREATE TABLE IF NOT EXISTS catalog_entry(target TEXT NOT NULL,chain TEXT NOT NULL,job TEXT NOT NULL REFERENCES webdav_upload(id),
        delta TEXT NOT NULL REFERENCES catalog_delta(id),PRIMARY KEY(target,chain,job))
      """)
    for table in ["catalog_delta", "catalog_entry", "webdav_completion"] {
      try database.execute("CREATE TRIGGER IF NOT EXISTS retain_\(table) BEFORE DELETE ON \(table) BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
    try database.execute("CREATE TRIGGER IF NOT EXISTS immutable_catalog_entry BEFORE UPDATE ON catalog_entry BEGIN SELECT RAISE(ABORT,'binding'); END")
  }
  func catalogInstallation() throws -> String {
    try database.statement("SELECT value FROM catalog_installation WHERE id=1") { row in
      guard sqlite3_step(row) == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
      let value = String(cString: text)
      guard UUID(uuidString: value)?.uuidString.lowercased() == value else { throw IosWebDavFailure.code("outcome_unknown") }
      return value
    }
  }
  // Completion time is informative only (catalog `completed`); receipts from before 29/2 have none.
  func recordCompletion(_ value: IosWebDavUpload) {
    try? database.execute("INSERT OR IGNORE INTO webdav_completion(job,at) VALUES(?,?)",
      values: [value.id, Int64(Date().timeIntervalSince1970 * 1000)])
  }
  // Completed receipts of this destination that this chain does not list yet, oldest first.
  func uncatalogued(target: String, chain: String) throws -> [IosRecoveryCatalog.Entry] {
    let rows = try database.statement("""
      SELECT u.payload,u.phase,u.issue,u.skipped,c.at FROM webdav_upload u LEFT JOIN webdav_completion c ON c.job=u.id
      WHERE u.target=? AND u.phase='completed' AND u.skipped=0 AND u.issue IS NULL
        AND NOT EXISTS(SELECT 1 FROM catalog_entry e WHERE e.target=u.target AND e.chain=? AND e.job=u.id)
      ORDER BY u.rowid LIMIT 500
      """, values: [target, chain]) { row -> [(IosWebDavUpload, Int64?)] in
      var result: [(IosWebDavUpload, Int64?)] = []
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return result }
        guard step == SQLITE_ROW, let payload = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
        var value = try JSONDecoder().decode(IosWebDavUpload.self, from: Data(String(cString: payload).utf8))
        value.phase = "completed"
        try value.validate()
        result.append((value, sqlite3_column_type(row, 4) == SQLITE_NULL ? nil : sqlite3_column_int64(row, 4)))
      }
    }
    return try rows.map { value, at in
      IosRecoveryCatalog.Entry(job: value.id, path: try publication(value), sha256: value.sha256, size: value.size,
        kind: value.kind ?? "file", identity: value.sourceIdentity, completed: at)
    }
  }
  // The last delta of the chain (sequence and file hash), the `previous` of the next one.
  func catalogHead(target: String, chain: String) throws -> (sequence: Int64, sha256: String)? {
    try database.statement("SELECT sequence,sha256 FROM catalog_delta WHERE target=? AND chain=? ORDER BY sequence DESC LIMIT 1",
      values: [target, chain]) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let sha256 = sqlite3_column_text(row, 1) else { throw IosWebDavFailure.code("storage_failure") }
      return (sqlite3_column_int64(row, 0), String(cString: sha256))
    }
  }
  func pendingCatalog(target: String, chain: String) throws -> [IosCatalogDelta] {
    try database.statement("SELECT id,sequence,payload,sha256,phase,issue FROM catalog_delta WHERE target=? AND chain=? AND phase!='completed' ORDER BY sequence",
      values: [target, chain]) { row in
      var result: [IosCatalogDelta] = []
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return result }
        guard step == SQLITE_ROW, let id = sqlite3_column_text(row, 0), let payload = sqlite3_column_text(row, 2),
          let sha256 = sqlite3_column_text(row, 3), let phase = sqlite3_column_text(row, 4) else { throw IosWebDavFailure.code("storage_failure") }
        let value = IosCatalogDelta(id: String(cString: id), target: target, chain: chain, sequence: sqlite3_column_int64(row, 1),
          payload: Data(String(cString: payload).utf8), sha256: String(cString: sha256), phase: String(cString: phase),
          issue: sqlite3_column_text(row, 5).map { String(cString: $0) })
        guard IosRecoveryCatalog.digest(value.payload) == value.sha256 else { throw IosWebDavFailure.code("outcome_unknown") }
        result.append(value)
      }
    }
  }
  // One transaction: the delta and the receipts it lists; it must extend the chain head the caller read.
  func insertCatalog(_ value: IosCatalogDelta, jobs: [String]) throws {
    guard value.phase == "prepared", value.issue == nil, !jobs.isEmpty, UUID(uuidString: value.id) != nil,
      let payload = String(data: value.payload, encoding: .utf8), IosRecoveryCatalog.digest(value.payload) == value.sha256 else {
      throw IosWebDavFailure.code("invalid_request")
    }
    try database.execute("BEGIN IMMEDIATE")
    do {
      let head = try database.statement("SELECT COALESCE(MAX(sequence),0) FROM catalog_delta WHERE target=? AND chain=?",
        values: [value.target, value.chain]) { row -> Int64 in
        guard sqlite3_step(row) == SQLITE_ROW else { throw IosWebDavFailure.code("storage_failure") }
        return sqlite3_column_int64(row, 0)
      }
      guard head + 1 == value.sequence else { throw IosWebDavFailure.code("outcome_unknown") }
      try database.execute("INSERT INTO catalog_delta(id,target,chain,sequence,payload,sha256,phase) VALUES(?,?,?,?,?,?,'prepared')",
        values: [value.id, value.target, value.chain, value.sequence, payload, value.sha256])
      for job in jobs {
        try database.execute("INSERT INTO catalog_entry(target,chain,job,delta) VALUES(?,?,?,?)", values: [value.target, value.chain, job, value.id])
      }
      try database.execute("COMMIT")
    } catch {
      try? database.execute("ROLLBACK")
      throw error
    }
  }
  func advanceCatalog(_ value: IosCatalogDelta, phase: String) throws -> IosCatalogDelta {
    try database.statement("UPDATE catalog_delta SET phase=? WHERE id=? AND phase=? AND issue IS NULL RETURNING id",
      values: [phase, value.id, value.phase]) { row in
      guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosWebDavFailure.code("outcome_unknown") }
    }
    var next = value; next.phase = phase; return next
  }
  func issueCatalog(_ value: IosCatalogDelta, code: String) throws {
    try database.statement("UPDATE catalog_delta SET issue=? WHERE id=? AND phase=? AND phase!='completed' RETURNING id",
      values: [code, value.id, value.phase]) { row in
      guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosWebDavFailure.code("outcome_unknown") }
    }
  }
}
