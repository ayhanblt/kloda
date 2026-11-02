import Foundation
import SQLite3

// ADR0027 shared backup_destination kind migration, on disposable databases only.
@main struct IosDestinationMigrationChecks {
  // The exact statement every earlier release ran.
  static let original = """
      CREATE TABLE IF NOT EXISTS backup_destination (
        kind TEXT NOT NULL CHECK(kind IN ('pc','webdav')), id TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), revision TEXT NOT NULL, PRIMARY KEY(kind,id))
      """
  static let pc = "AAAAAAAAAAAAAAAAAAAAAg", dav = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBw"

  static func expect(_ condition: Bool, _ reason: String) { if !condition { fatalError(reason) } }
  static func text(_ row: OpaquePointer, _ column: Int32) -> String { String(cString: sqlite3_column_text(row, column)) }
  static func all(_ database: IosSyncJournal, _ sql: String) throws -> [[String]] {
    try database.statement(sql) { row in
      var result: [[String]] = []
      while sqlite3_step(row) == SQLITE_ROW { result.append((0..<sqlite3_column_count(row)).map { text(row, $0) }) }
      return result
    }
  }
  static func schema(_ database: IosSyncJournal) throws -> [[String]] {
    try all(database, "SELECT name,sql FROM sqlite_master WHERE name LIKE 'backup_destination%' ORDER BY name")
  }
  static func rows(_ database: IosSyncJournal) throws -> [[String]] {
    try all(database, "SELECT kind,id,enabled,revision FROM backup_destination ORDER BY kind,id")
  }
  static func refused(_ database: IosSyncJournal, _ kind: String, _ id: String, enabled: Int64 = 1) {
    expect((try? database.execute("INSERT INTO backup_destination VALUES(?,?,?,?)", values: [kind, id, enabled, "r"])) == nil,
      "constraint not enforced for \(kind)/\(enabled)")
  }

  static func main() throws {
    guard CommandLine.arguments.count == 2 else { fatalError("Expected a disposable directory") }
    let root = URL(fileURLWithPath: CommandLine.arguments[1])
    let database = try IosSyncJournal(databaseURL: root.appendingPathComponent("original.sqlite"))
    try database.execute(original)
    try database.execute("INSERT INTO backup_destination VALUES('pc',?,1,'v1'),('webdav',?,0,'0F8B7A4E-8F5C-4A43-9A52-3D1C6C1E9A10')", values: [pc, dav])
    refused(database, "nextcloud", dav)
    let before = try rows(database)
    let journal = try IosWebDavJournal(database: database)
    let migrated = try schema(database)
    expect(migrated.count == 1 && migrated[0][1].contains(IosWebDavJournal.destinationKinds), "not migrated: \(migrated)")
    expect(try rows(database) == before, "rows changed")
    expect(try journal.enabled(kind: "pc", id: pc, revision: "v1") && !journal.enabled(kind: "webdav", id: dav), "lookups")
    for kind in ["nextcloud", "cloudme", "kolab-now", "smb"] {
      try database.execute("INSERT INTO backup_destination VALUES(?,?,0,'r')", values: [kind, dav])
    }
    refused(database, "dropbox", dav)
    refused(database, "nextcloud", pc, enabled: 2)
    refused(database, "nextcloud", dav)
    // Writing the new kinds through the journal stays closed until the multi-destination queue slice.
    var closed = false
    do { try journal.setEnabled(kind: "nextcloud", id: dav, enabled: true, revision: "r") } catch IosWebDavFailure.code(let code) { closed = code == "invalid_request" }
    expect(closed, "setEnabled widened")
    let after = try rows(database)
    _ = try IosWebDavJournal(database: database)
    expect(try schema(database) == migrated && rows(database) == after, "second open changed the table")
    print("PASS original table rebuilt once: rows kept, new kinds accepted, unknown/duplicate refused, journal writes still closed, idempotent")

    let fresh = try IosSyncJournal(databaseURL: root.appendingPathComponent("fresh.sqlite"))
    _ = try IosWebDavJournal(database: fresh)
    let created = try schema(fresh)
    expect(created.count == 1 && created[0][1].contains(IosWebDavJournal.destinationKinds), "fresh table: \(created)")
    print("PASS fresh database creates the shared kind list directly")

    // A row the new CHECK refuses rolls the whole rebuild back; the original table is left as it was.
    let unknown = try IosSyncJournal(databaseURL: root.appendingPathComponent("unknown.sqlite"))
    try unknown.execute("CREATE TABLE backup_destination (kind TEXT NOT NULL,id TEXT NOT NULL,enabled INTEGER NOT NULL,revision TEXT NOT NULL,PRIMARY KEY(kind,id))")
    try unknown.execute("INSERT INTO backup_destination VALUES('pc',?,1,'v1'),('dropbox',?,1,'r')", values: [pc, dav])
    let kept = (try schema(unknown), try rows(unknown))
    expect((try? IosWebDavJournal(database: unknown)) == nil, "unknown kind migrated")
    expect(try schema(unknown) == kept.0 && rows(unknown) == kept.1, "partial rebuild left behind")
    print("PASS failed rebuild rolls back completely")
  }
}
