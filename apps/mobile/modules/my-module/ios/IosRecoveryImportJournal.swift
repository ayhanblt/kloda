import Foundation
import SQLite3

// ADR0029 §4 (29/3): imported receipts are restore-only and bound to the destination they were read from (`target`).
// They live in their own tables, never in `webdav_upload`, so nothing that completes, skips, settles or authorizes an
// upload can see them. A verified delta and its entries are stored in one transaction; nothing is updated or deleted.
extension IosWebDavJournal {
  func createImports() throws {
    try database.execute("""
      CREATE TABLE IF NOT EXISTS imported_delta(target TEXT NOT NULL,installation TEXT NOT NULL,chain TEXT NOT NULL,source TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK(sequence>0),sha256 TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(target,installation,chain,source,sequence))
      """)
    try database.execute("""
      CREATE TABLE IF NOT EXISTS imported_receipt(id TEXT PRIMARY KEY,target TEXT NOT NULL,installation TEXT NOT NULL,chain TEXT NOT NULL,
        source TEXT NOT NULL,sequence INTEGER NOT NULL,position INTEGER NOT NULL CHECK(position>=0),path TEXT NOT NULL,sha256 TEXT NOT NULL,
        size INTEGER NOT NULL CHECK(size>=0),kind TEXT NOT NULL CHECK(kind IN ('file','photo_resource','photo_manifest')),identity TEXT,completed INTEGER,
        UNIQUE(target,installation,chain,source,sequence,position),
        FOREIGN KEY(target,installation,chain,source,sequence) REFERENCES imported_delta(target,installation,chain,source,sequence))
      """)
    for table in ["imported_delta", "imported_receipt"] {
      try database.execute("CREATE TRIGGER IF NOT EXISTS immutable_\(table) BEFORE UPDATE ON \(table) BEGIN SELECT RAISE(ABORT,'binding'); END")
      try database.execute("CREATE TRIGGER IF NOT EXISTS retain_\(table) BEFORE DELETE ON \(table) BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
    try createWebDavRestores("imported_restore", receipts: "imported_receipt")
  }
  // True when the delta is stored now or was stored before with the same bytes; false when this position of the chain
  // was imported earlier with other bytes (kept as it was; the caller counts the rest as unverified).
  func importDelta(target: String, installation: String, chain: String, source: String, sequence: Int64, sha256: String,
    entries: [IosRecoveryCatalog.Entry]) throws -> Bool {
    let key: [Any] = [target, installation, chain, source, sequence]
    try database.execute("BEGIN IMMEDIATE")
    do {
      let existing = try database.statement(
        "SELECT sha256 FROM imported_delta WHERE target=? AND installation=? AND chain=? AND source=? AND sequence=?", values: key) { row -> String? in
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return nil }
        guard step == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
        return String(cString: text)
      }
      if let existing {
        try database.execute("COMMIT")
        return existing == sha256
      }
      try database.execute("INSERT INTO imported_delta(target,installation,chain,source,sequence,sha256,at) VALUES(?,?,?,?,?,?,?)",
        values: key + [sha256, Int64(Date().timeIntervalSince1970 * 1000)])
      for (position, entry) in entries.enumerated() {
        try database.execute("""
          INSERT INTO imported_receipt(id,target,installation,chain,source,sequence,position,path,sha256,size,kind,identity,completed)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
          """, values: [UUID().uuidString.lowercased()] + key + [Int64(position), entry.path, entry.sha256, entry.size, entry.kind,
            entry.identity.map { $0 as Any } ?? NSNull(), entry.completed.map { $0 as Any } ?? NSNull()])
      }
      try database.execute("COMMIT")
      return true
    } catch {
      try? database.execute("ROLLBACK")
      throw error
    }
  }
  func importedCount(target: String) throws -> Int64 {
    try database.statement("SELECT COUNT(*) FROM imported_receipt WHERE target=?", values: [target]) { row in
      guard sqlite3_step(row) == SQLITE_ROW else { throw IosWebDavFailure.code("storage_failure") }
      return sqlite3_column_int64(row, 0)
    }
  }
  // 29/4 (ADR0029 §5): restore reads an imported receipt only through the destination it is bound to, as a projection
  // with the `imported` binding and no snapshot. It is never stored: `insert` refuses it (no snapshot, not `prepared`).
  static let importedBinding = "imported"
  private static let importedColumns = "r.id,r.target,r.path,r.sha256,r.size,r.kind,r.identity"
  func imported(_ id: String, target: String) throws -> IosWebDavUpload? {
    try importedRows("SELECT \(Self.importedColumns) FROM imported_receipt r WHERE r.id=? AND r.target=?", [id, target]).first
  }
  func importedReceipts(target: String, after: String) throws -> [IosWebDavUpload] {
    try importedRows("SELECT \(Self.importedColumns) FROM imported_receipt r WHERE r.target=? AND r.id>? ORDER BY r.id LIMIT 100", [target, after])
  }
  // A photo resource of an imported manifest must come from the same catalog origin (installation, chain, old destination).
  func importedResource(of manifest: String, target: String, path: String, identity: String, hash: String, size: Int64) throws -> IosWebDavUpload? {
    try importedRows("""
      SELECT \(Self.importedColumns) FROM imported_receipt r JOIN imported_receipt m ON m.id=? AND m.target=r.target
        AND m.installation=r.installation AND m.chain=r.chain AND m.source=r.source AND m.kind='photo_manifest'
      WHERE r.target=? AND r.path=? AND r.kind='photo_resource' AND r.identity=? AND r.sha256=? AND r.size=? ORDER BY r.rowid DESC LIMIT 1
      """, [manifest, target, path, identity, hash, size]).first
  }
  private func importedRows(_ sql: String, _ values: [Any]) throws -> [IosWebDavUpload] {
    try database.statement(sql, values: values) { row in
      var result: [IosWebDavUpload] = []
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return result }
        guard step == SQLITE_ROW else { throw IosWebDavFailure.code("storage_failure") }
        func text(_ column: Int32) -> String? { sqlite3_column_text(row, column).map { String(cString: $0) } }
        guard let id = text(0), let target = text(1), let path = text(2), let sha256 = text(3), let kind = text(5) else {
          throw IosWebDavFailure.code("outcome_unknown")
        }
        // The restore list and photo identities need the old device's source folder (first path part) to be a UUID.
        let source = path.split(separator: "/", maxSplits: 1).first.map(String.init) ?? ""
        guard UUID(uuidString: source)?.uuidString.lowercased() == source, let identity = text(6) else { continue }
        result.append(IosWebDavUpload(id: id, target: target, binding: Self.importedBinding, source: source, reference: path,
          relativePath: path, revision: Self.importedBinding, snapshot: "", sha256: sha256, size: sqlite3_column_int64(row, 4),
          phase: "completed", kind: kind, sourceIdentity: identity))
      }
    }
  }
}
