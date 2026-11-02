import Foundation
import SQLite3

// ADR0027/0028 shared backup_destination kind migration and the per-destination plan move (18A/3), on disposable databases only.
@main struct IosDestinationMigrationChecks {
  // The exact statement every earlier release ran.
  static let original = """
      CREATE TABLE IF NOT EXISTS backup_destination (
        kind TEXT NOT NULL CHECK(kind IN ('pc','webdav')), id TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), revision TEXT NOT NULL, PRIMARY KEY(kind,id))
      """
  // The 18A/2 table (DAV kinds and SMB, before the OAuth kinds).
  static let davEra = """
      CREATE TABLE backup_destination (
        kind TEXT NOT NULL CHECK(kind IN ('pc','webdav','nextcloud','cloudme','kolab-now','smb')), id TEXT NOT NULL,
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
    for kind in ["nextcloud", "cloudme", "kolab-now", "smb", "dropbox", "onedrive", "yandex", "google-drive"] {
      try database.execute("INSERT INTO backup_destination VALUES(?,?,0,'r')", values: [kind, dav])
    }
    refused(database, "box", dav)
    refused(database, "nextcloud", pc, enabled: 2)
    refused(database, "nextcloud", dav)
    // The journal enables only the DAV kinds the queue uploads to (18A/3); CloudMe and the OAuth kinds stay closed.
    try journal.setEnabled(kind: "nextcloud", id: dav, enabled: true, revision: "r")
    expect(try journal.enabled(kind: "nextcloud", id: dav, revision: "r"), "nextcloud enable")
    for kind in ["cloudme", "dropbox", "google-drive"] {
      var closed = false
      do { try journal.setEnabled(kind: kind, id: dav, enabled: true, revision: "r") } catch IosWebDavFailure.code(let code) { closed = code == "invalid_request" }
      expect(closed, "setEnabled widened to \(kind)")
    }
    try journal.setEnabled(kind: "nextcloud", id: dav, enabled: false, revision: "r")
    let after = try rows(database)
    _ = try IosWebDavJournal(database: database)
    expect(try schema(database) == migrated && rows(database) == after, "second open changed the table")
    print("PASS original table rebuilt once: rows kept, DAV+OAuth kinds accepted, unknown/duplicate refused, only DAV kinds enable, idempotent")

    let era = try IosSyncJournal(databaseURL: root.appendingPathComponent("dav-era.sqlite"))
    try era.execute(davEra)
    try era.execute("INSERT INTO backup_destination VALUES('pc',?,1,'v1'),('nextcloud',?,1,'r'),('smb',?,0,'s')", values: [pc, dav, dav])
    let eraRows = try rows(era)
    _ = try IosWebDavJournal(database: era)
    let eraSchema = try schema(era)
    let eraAfter = try rows(era)
    expect(eraSchema.count == 1 && eraSchema[0][1].contains(IosWebDavJournal.destinationKinds) && eraAfter == eraRows, "18A/2 table: \(eraSchema)")
    print("PASS 18A/2 table gains the OAuth kinds, rows kept")

    // The former single plan row moves once into the per-destination table; an older build finds webdav_plan empty.
    let plans = try IosSyncJournal(databaseURL: root.appendingPathComponent("plans.sqlite"))
    try plans.execute("CREATE TABLE webdav_plan(id INTEGER PRIMARY KEY CHECK(id=1),target TEXT NOT NULL,binding TEXT NOT NULL,occurrence INTEGER NOT NULL,due INTEGER NOT NULL,run TEXT)")
    try plans.execute("INSERT INTO webdav_plan VALUES(1,?,'owned-binding',1000,2000,NULL)", values: [dav])
    let planJournal = try IosWebDavJournal(database: plans)
    let moved = IosWebDavPlan(target: dav, binding: "owned-binding", occurrence: 1000, due: 2000, run: nil)
    expect(try planJournal.plans() == [moved], "plan not moved")
    expect(try all(plans, "SELECT COUNT(*) FROM webdav_plan") == [["0"]], "singleton kept")
    let other = String(dav.dropLast()) + "A"
    try planJournal.savePlan(IosWebDavPlan(target: other, binding: "other-binding", occurrence: 5, due: 6, run: nil))
    _ = try IosWebDavJournal(database: plans)
    expect(try planJournal.plan(target: dav) == moved && planJournal.plans().count == 2, "reopen changed plans")
    var crossed = false
    do { try planJournal.savePlan(IosWebDavPlan(target: other, binding: "x", occurrence: 7, due: 8, run: nil), expected: moved) }
    catch IosWebDavFailure.code(let code) { crossed = code == "invalid_request" }
    expect(crossed, "plan CAS crossed targets")
    var stale = false
    do { try planJournal.savePlan(IosWebDavPlan(target: dav, binding: "x", occurrence: 7, due: 8, run: nil), expected: IosWebDavPlan(target: dav, binding: "owned-binding", occurrence: 1, due: 2, run: nil)) }
    catch IosWebDavFailure.code(let code) { stale = code == "settings_changed" }
    expect(stale, "stale plan CAS accepted")
    try planJournal.deletePlan(target: other)
    expect(try planJournal.plans() == [moved], "delete")
    // Enabled DAV destinations are listed per target; at most one original WebDAV row.
    try planJournal.setEnabled(kind: "webdav", id: dav, enabled: true, revision: "0F8B7A4E-8F5C-4A43-9A52-3D1C6C1E9A10")
    try planJournal.setEnabled(kind: "kolab-now", id: other, enabled: true, revision: "1F8B7A4E-8F5C-4A43-9A52-3D1C6C1E9A10")
    expect(try planJournal.destinations().map(\.kind) == ["kolab-now", "webdav"] && planJournal.destination(target: other)?.kind == "kolab-now", "destinations")
    print("PASS per-destination plans: singleton moved once, CAS per target, delete, destinations listed")

    let fresh = try IosSyncJournal(databaseURL: root.appendingPathComponent("fresh.sqlite"))
    _ = try IosWebDavJournal(database: fresh)
    let created = try schema(fresh)
    expect(created.count == 1 && created[0][1].contains(IosWebDavJournal.destinationKinds), "fresh table: \(created)")
    print("PASS fresh database creates the shared kind list directly")

    // A row the new CHECK refuses rolls the whole rebuild back; the original table is left as it was.
    let unknown = try IosSyncJournal(databaseURL: root.appendingPathComponent("unknown.sqlite"))
    try unknown.execute("CREATE TABLE backup_destination (kind TEXT NOT NULL,id TEXT NOT NULL,enabled INTEGER NOT NULL,revision TEXT NOT NULL,PRIMARY KEY(kind,id))")
    try unknown.execute("INSERT INTO backup_destination VALUES('pc',?,1,'v1'),('box',?,1,'r')", values: [pc, dav])
    let kept = (try schema(unknown), try rows(unknown))
    expect((try? IosWebDavJournal(database: unknown)) == nil, "unknown kind migrated")
    expect(try schema(unknown) == kept.0 && rows(unknown) == kept.1, "partial rebuild left behind")
    print("PASS failed rebuild rolls back completely")
  }
}
