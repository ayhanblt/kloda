import Foundation
import SQLite3
import Darwin

struct IosWebDavUpload: Codable, Equatable {
  let id: String
  let target: String
  let binding: String
  let source: String
  let reference: String
  let relativePath: String
  let revision: String
  let snapshot: String
  let sha256: String
  let size: Int64
  var phase = "prepared"
  var issue: String? = nil
  var skipped = false
  var kind: String? = nil
  var sourceIdentity: String? = nil

  func validate() throws {
    guard UUID(uuidString: id) != nil, UUID(uuidString: source) != nil, target.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil, !binding.isEmpty, !source.isEmpty,
      !reference.isEmpty, !revision.isEmpty, size >= 0,
      [target, binding, source, reference, relativePath, revision, snapshot, sha256].allSatisfy({ !$0.utf8.contains(0) && $0.utf8.count <= 8192 }),
      sha256.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil,
      snapshot.hasSuffix(".snapshot"), UUID(uuidString: String(snapshot.dropLast(9)))?.uuidString.lowercased() == String(snapshot.dropLast(9)),
      !relativePath.contains("\\"), !relativePath.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }),
      relativePath.hasPrefix(source + "/"), relativePath.components(separatedBy: "/").allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && $0.utf8.count <= 255 }),
      ["prepared", "uploaded", "moving", "moved", "conflict", "completed"].contains(phase),
      issue == nil || (issue!.utf8.count <= 128 && !issue!.utf8.contains(0)),
      sourceIdentity == nil || (!sourceIdentity!.isEmpty && sourceIdentity!.utf8.count <= 255 && !sourceIdentity!.utf8.contains(0)),
      kind == nil || ["file", "photo_resource", "photo_manifest"].contains(kind!),
      !(skipped && phase == "completed") else { throw IosWebDavFailure.code("outcome_unknown") }
  }
}

// Shared FULL/WAL implementation, separate device-local state and no PC authority row.
final class IosWebDavJournal {
  let database: IosSyncJournal
  static func open() throws -> IosWebDavJournal {
    let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    var root = support.appendingPathComponent("kloda-webdav-state", isDirectory: true)
    if mkdir(root.path, 0o700) != 0 && errno != EEXIST { throw IosWebDavFailure.code("storage_failure") }
    let descriptor = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard descriptor >= 0 else { throw IosWebDavFailure.code("storage_failure") }
    defer { Darwin.close(descriptor) }
    var info = stat()
    guard fstat(descriptor, &info) == 0, info.st_uid == geteuid(), info.st_mode & S_IFMT == S_IFDIR,
      info.st_mode & 0o077 == 0 else { throw IosWebDavFailure.code("storage_failure") }
    var values = URLResourceValues(); values.isExcludedFromBackup = true; try root.setResourceValues(values)
    #if os(iOS)
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: root.path)
    #endif
    // New device-local DAV state; no migration/reset of the existing PC journal or authority.
    return try IosWebDavJournal(database: IosSyncJournal(databaseURL: root.appendingPathComponent("journal.sqlite")))
  }
  init(database: IosSyncJournal) throws {
    self.database = database
    try database.execute("CREATE TABLE IF NOT EXISTS backup_context (id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    try database.execute("INSERT OR IGNORE INTO backup_context(id,revision) VALUES(1,?)", values: [UUID().uuidString])
    try database.execute("""
      CREATE TABLE IF NOT EXISTS webdav_upload (
        id TEXT PRIMARY KEY, target TEXT NOT NULL, source TEXT NOT NULL, reference TEXT NOT NULL,
        payload TEXT NOT NULL, phase TEXT NOT NULL, issue TEXT, skipped INTEGER NOT NULL DEFAULT 0 CHECK(skipped IN (0,1)))
      """)
    try database.execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_webdav_upload BEFORE UPDATE ON webdav_upload
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.source IS NOT OLD.source
        OR NEW.reference IS NOT OLD.reference OR NEW.payload IS NOT OLD.payload
        OR (NEW.phase IS NOT OLD.phase AND NOT (
          (OLD.phase='prepared' AND NEW.phase='uploaded') OR (OLD.phase='uploaded' AND NEW.phase IN ('moving','conflict'))
          OR (OLD.phase='moving' AND NEW.phase IN ('moved','conflict')) OR (OLD.phase='moved' AND NEW.phase='completed')))
        OR (NEW.phase='completed' AND NEW.skipped!=0)
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
    try database.execute("CREATE TRIGGER IF NOT EXISTS retain_webdav_upload BEFORE DELETE ON webdav_upload BEGIN SELECT RAISE(ABORT,'retained'); END")
    try database.execute("CREATE INDEX IF NOT EXISTS webdav_upload_locator ON webdav_upload(target,source,reference)")
    try database.execute("CREATE INDEX IF NOT EXISTS webdav_upload_unfinished ON webdav_upload(id) WHERE phase!='completed'")
    try migrateDestinations()
    try createRuns(); try createPlan(); try createPublicationPaths(); try createWebDavRestores()
  }
  // ADR0028 adds the OAuth kinds; they stay disabled until their upload adapters exist (user decision 2026-11-02).
  static let destinationKinds = "'pc','webdav','nextcloud','cloudme','kolab-now','smb','dropbox','onedrive','yandex','google-drive'"
  // DAV kinds the WebDAV queue uploads to; CloudMe stays blocked (Digest only).
  static let davKinds = ["webdav", "nextcloud", "kolab-now"]
  static func destinationTable(_ name: String) -> String {
    """
    CREATE TABLE \(name) (
      kind TEXT NOT NULL CHECK(kind IN (\(destinationKinds))), id TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), revision TEXT NOT NULL, PRIMARY KEY(kind,id))
    """
  }
  // ADR0027: one shared kind list; an existing table with the original CHECK is rebuilt once, rows unchanged, all or nothing.
  private func destinationSql() throws -> String? {
    try database.statement("SELECT sql FROM sqlite_master WHERE type='table' AND name='backup_destination'") { row -> String? in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
      return String(cString: text)
    }
  }
  private func migrateDestinations() throws {
    if try destinationSql()?.contains(Self.destinationKinds) == true { return }
    try database.execute("BEGIN IMMEDIATE")
    do {
      // Re-read under the write lock: another opener may have created or rebuilt the table meanwhile.
      if let sql = try destinationSql() {
        if !sql.contains(Self.destinationKinds) {
          try database.execute(Self.destinationTable("backup_destination_next"))
          try database.execute("INSERT INTO backup_destination_next(kind,id,enabled,revision) SELECT kind,id,enabled,revision FROM backup_destination")
          try database.execute("DROP TABLE backup_destination")
          try database.execute("ALTER TABLE backup_destination_next RENAME TO backup_destination")
        }
      } else {
        try database.execute(Self.destinationTable("backup_destination"))
      }
      try database.execute("COMMIT")
    } catch {
      try? database.execute("ROLLBACK")
      throw error
    }
  }
  func setEnabled(kind: String, id: String, enabled: Bool, revision: String) throws {
    let pattern = kind == "pc" ? "\\A[A-Za-z0-9_-]{21}[AQgw]\\z" : "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z"
    guard kind == "pc" || Self.davKinds.contains(kind), id.range(of: pattern, options: .regularExpression) != nil,
      !revision.isEmpty, revision.utf8.count <= 128, !revision.utf8.contains(0) else { throw IosWebDavFailure.code("invalid_request") }
    try database.execute("""
      INSERT INTO backup_destination(kind,id,enabled,revision) VALUES(?,?,?,?)
      ON CONFLICT(kind,id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision
      """, values: [kind, id, Int64(enabled ? 1 : 0), revision])
  }
  struct Header: Equatable { let target: String; let revision: String; let kind: String }
  // ADR0027 §4: every enabled DAV destination, each with its own opportunity; at most one original WebDAV row.
  func destinations() throws -> [Header] {
    let kinds = Self.davKinds.map { "'\($0)'" }.joined(separator: ",")
    let values = try database.statement("SELECT id,revision,kind FROM backup_destination WHERE kind IN (\(kinds)) AND enabled=1 ORDER BY kind,id") { row -> [Header] in
      var result: [Header] = []
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return result }
        guard step == SQLITE_ROW, let id = sqlite3_column_text(row, 0), let revision = sqlite3_column_text(row, 1), let kind = sqlite3_column_text(row, 2)
        else { throw IosWebDavFailure.code("storage_failure") }
        result.append(Header(target: String(cString: id), revision: String(cString: revision), kind: String(cString: kind)))
      }
    }
    // The vault enforces the destination limit; the journal stays independent of Keychain code.
    guard values.filter({ $0.kind == "webdav" }).count <= 1, values.allSatisfy({
      $0.target.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil && UUID(uuidString: $0.revision) != nil
    }) else { throw IosWebDavFailure.code("outcome_unknown") }
    return values
  }
  func destination(target: String) throws -> Header? { try destinations().first { $0.target == target } }
  func hasEnabledPc() throws -> Bool {
    try database.statement("SELECT 1 FROM backup_destination WHERE kind='pc' AND enabled=1 LIMIT 1") { row in
      let step = sqlite3_step(row)
      guard step == SQLITE_ROW || step == SQLITE_DONE else { throw IosWebDavFailure.code("storage_failure") }
      return step == SQLITE_ROW
    }
  }
  func enabled(kind: String, id: String, revision: String? = nil) throws -> Bool {
    try database.statement("SELECT enabled,revision FROM backup_destination WHERE kind=? AND id=?", values: [kind, id]) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return false }
      guard step == SQLITE_ROW, let text = sqlite3_column_text(row, 1) else { throw IosWebDavFailure.code("storage_failure") }
      return sqlite3_column_int(row, 0) == 1 && (revision == nil || String(cString: text) == revision)
    }
  }
  func insert(_ value: IosWebDavUpload) throws {
    try value.validate()
    guard value.phase == "prepared", value.issue == nil, !value.skipped else { throw IosWebDavFailure.code("invalid_request") }
    let data = try JSONEncoder().encode(value)
    guard data.count <= 65536, let payload = String(data: data, encoding: .utf8) else { throw IosWebDavFailure.code("invalid_request") }
    try database.execute("INSERT INTO webdav_upload(id,target,source,reference,payload,phase) VALUES(?,?,?,?,?,'prepared')",
      values: [value.id, value.target, value.source, value.reference, payload])
  }
  func find(_ id: String) throws -> IosWebDavUpload? {
    try read("SELECT payload,phase,issue,skipped FROM webdav_upload WHERE id=?", values: [id]).first
  }
  func uploads(target: String, after: String = "") throws -> [IosWebDavUpload] {
    try read("SELECT payload,phase,issue,skipped FROM webdav_upload WHERE target=? AND id>? ORDER BY id LIMIT 100", values: [target, after])
  }
  func photoReceipt(target: String, source: String, path: String, identity: String, hash: String, size: Int64) throws -> IosWebDavUpload? {
    let rows = try read("SELECT u.payload,u.phase,u.issue,u.skipped FROM webdav_upload u LEFT JOIN webdav_publication p ON p.job=u.id WHERE u.target=? AND u.source=? AND COALESCE(p.path,u.reference)=? ORDER BY u.rowid DESC LIMIT 101", values: [target, source, path])
    guard rows.count <= 100 else { throw IosWebDavFailure.code("review_required") }
    return try rows.first {
      guard $0.kind == "photo_resource", $0.sourceIdentity == identity, $0.phase == "completed", $0.issue == nil, !$0.skipped, $0.sha256 == hash, $0.size == size else { return false }
      return try publication($0) == path
    }
  }
  func unfinished(after: String) throws -> [IosWebDavUpload] {
    guard after.isEmpty || UUID(uuidString: after) != nil else { throw IosWebDavFailure.code("invalid_request") }
    return try read("SELECT payload,phase,issue,skipped FROM webdav_upload WHERE phase!='completed' AND id>? ORDER BY id LIMIT 101", values: [after])
  }
  func candidates(target: String, source: String, reference: String) throws -> [IosWebDavUpload] {
    let rows = try read("SELECT payload,phase,issue,skipped FROM webdav_upload WHERE target=? AND source=? AND reference=? ORDER BY rowid DESC LIMIT 101", values: [target, source, reference])
    guard rows.count <= 100 else { throw IosWebDavFailure.code("review_required") }
    return rows
  }
  private func read(_ sql: String, values: [Any]) throws -> [IosWebDavUpload] {
    try database.statement(sql, values: values) { row in
      var result: [IosWebDavUpload] = []
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return result }
        guard step == SQLITE_ROW, let payload = sqlite3_column_text(row, 0), let phase = sqlite3_column_text(row, 1) else {
          throw IosWebDavFailure.code("storage_failure")
        }
        var value = try JSONDecoder().decode(IosWebDavUpload.self, from: Data(String(cString: payload).utf8))
        value.phase = String(cString: phase)
        value.issue = sqlite3_column_text(row, 2).map { String(cString: $0) }
        value.skipped = sqlite3_column_int(row, 3) == 1
        try value.validate(); result.append(value)
      }
    }
  }
  func advance(_ value: IosWebDavUpload, phase: String) throws {
    var next = value; next.phase = phase; try next.validate()
    try mutate("UPDATE webdav_upload SET phase=?,issue=NULL WHERE id=? AND target=? AND phase=? AND skipped=0 RETURNING id",
      values: [phase, value.id, value.target, value.phase])
  }
  func issue(_ value: IosWebDavUpload, code: String, skipped: Bool = false) throws {
    guard !code.isEmpty, code.utf8.count <= 128, !code.utf8.contains(0), value.phase != "completed" else { throw IosWebDavFailure.code("invalid_request") }
    try mutate("UPDATE webdav_upload SET issue=?,skipped=? WHERE id=? AND target=? AND phase=? RETURNING id",
      values: [code, Int64(skipped ? 1 : 0), value.id, value.target, value.phase])
  }
  private func mutate(_ sql: String, values: [Any]) throws {
    // RETURNING keeps CAS evidence in this statement, isolated from other connection writes.
    try database.statement(sql, values: values) { row in
      guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosWebDavFailure.code("outcome_unknown") }
    }
  }
}
