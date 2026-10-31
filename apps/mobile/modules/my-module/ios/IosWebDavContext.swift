import Foundation
import CryptoKit
import SQLite3

// This lock also fences source/program mutations against the final local receipt.
enum IosWebDavContext {
  static let lock = NSRecursiveLock()
  static func synchronized<T>(_ action: () throws -> T) rethrows -> T {
    lock.lock(); defer { lock.unlock() }; return try action()
  }
  private static func initialize(_ journal: IosSyncJournal) throws {
    try journal.execute("CREATE TABLE IF NOT EXISTS backup_context (id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    try journal.execute("INSERT OR IGNORE INTO backup_context(id,revision) VALUES(1,?)", values: [UUID().uuidString])
  }
  static func mutate<T>(_ action: () throws -> T) throws -> T {
    defer { try? IosWebDavQueue.shared.pause(code: "settings_changed"); IosWebDavAutomaticCoordinator.shared.reconcile() }
    return try synchronized {
      let journal = try IosWebDavJournal.open().database; try initialize(journal)
      // Persist the new generation before changing values; away/back cannot reauthorize old work.
      try journal.execute("UPDATE backup_context SET revision=? WHERE id=1", values: [UUID().uuidString])
      return try action()
    }
  }
  static func capture(_ profile: IosWebDavProfile, journal: IosWebDavJournal) throws -> String {
    try synchronized {
      let revision = try journal.database.statement("SELECT revision FROM backup_context WHERE id=1") { row -> String in
        guard sqlite3_step(row) == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
        return String(cString: text)
      }
      let bytes = try JSONSerialization.data(withJSONObject: [revision, profile.revision, profile.targetId(), IosFilesSelection.binding().base64EncodedString()])
      return IosWebDavClient.encode(Data(SHA256.hash(data: bytes)))
    }
  }
  static func check(_ profile: IosWebDavProfile, binding: String, journal: IosWebDavJournal) throws {
    try synchronized {
      guard try IosWebDavVault.read() == profile,
        try journal.enabled(kind: "webdav", id: profile.targetId(), revision: profile.revision),
        try capture(profile, journal: journal) == binding else { throw IosWebDavFailure.code("settings_changed") }
    }
  }
  static func complete(_ value: IosWebDavUpload, profile: IosWebDavProfile, journal: IosWebDavJournal) throws {
    try synchronized {
      try check(profile, binding: value.binding, journal: journal)
      guard try value.target == profile.targetId() else { throw IosWebDavFailure.code("settings_changed") }
      try journal.advance(value, phase: "completed")
    }
  }
}
