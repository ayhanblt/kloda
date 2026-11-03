import Foundation
import CryptoKit
import SQLite3

// This lock also fences source/program mutations against the final local receipt.
enum IosWebDavContext {
  // Share the selected-source mutation fence with SMB final completion.
  static let lock = IosSmbJournal.ownerLock
  static func synchronized<T>(_ action: () throws -> T) rethrows -> T {
    lock.lock(); defer { lock.unlock() }; return try action()
  }
  private static func initialize(_ journal: IosSyncJournal) throws {
    try journal.execute("CREATE TABLE IF NOT EXISTS backup_context (id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL)")
    try journal.execute("INSERT OR IGNORE INTO backup_context(id,revision) VALUES(1,?)", values: [UUID().uuidString])
  }
  static func mutate<T>(_ action: () throws -> T) throws -> T {
    defer {
      try? IosWebDavQueue.shared.pause(code: "settings_changed"); IosWebDavAutomaticCoordinator.shared.reconcile()
#if KLODA_SMB_NATIVE
      try? IosSmbQueue.shared.pause(code: "settings_changed"); IosSmbAutomaticCoordinator.shared.reconcile()
#endif
#if KLODA_SFTP_NATIVE
      try? IosSftpQueue.shared.pause(code: "settings_changed"); IosSftpAutomaticCoordinator.shared.reconcile()
#endif
    }
    return try synchronized {
      let journal = try IosWebDavJournal.open().database; try initialize(journal)
      // Persist the new generation before changing values; away/back cannot reauthorize old work.
      try journal.execute("UPDATE backup_context SET revision=? WHERE id=1", values: [UUID().uuidString])
      return try action()
    }
  }
  static func capture(_ profile: IosWebDavProfile, journal: IosWebDavJournal) throws -> String {
    try capture(.dav(profile), journal: journal)
  }
  static func capture(_ destination: IosCloudTarget, journal: IosWebDavJournal) throws -> String {
    try synchronized {
      let revision = try journal.database.statement("SELECT revision FROM backup_context WHERE id=1") { row -> String in
        guard sqlite3_step(row) == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
        return String(cString: text)
      }
      let bytes = try JSONSerialization.data(withJSONObject: [revision, destination.revision, destination.targetId(), IosFilesSelection.binding().base64EncodedString()])
      return IosWebDavClient.encode(Data(SHA256.hash(data: bytes)))
    }
  }
  // The original WebDAV entry or the destination's own Keychain slot (ADR0027 §3, ADR0028 §2); a slot must hold the
  // same provider and target. OAuth slots count only for providers with an upload adapter.
  static func stored(kind: String, target: String) throws -> IosCloudTarget? {
    if kind == "webdav" { return try IosWebDavVault.read().map { .dav($0) } }
    if IosCloudTarget.oauthKinds.contains(kind) {
      guard let profile = try IosOAuthVault.read(slot: target), profile.provider == kind, try profile.targetId() == target else { return nil }
      return .oauth(profile)
    }
    guard let profile = try IosWebDavVault.read(slot: target), profile.provider == kind, try profile.targetId() == target else { return nil }
    return .dav(profile)
  }
  // Restore and the backups list (18B/5r): "" is the original WebDAV entry, otherwise the added destination
  // (DAV slot or OAuth slot with a transport). Receipts stay bound to this targetId.
  static func restoreTarget(_ target: String) throws -> IosCloudTarget {
    let original = try IosWebDavVault.read()
    if target.isEmpty {
      guard let original else { throw IosWebDavFailure.code("webdav_missing") }
      return .dav(original)
    }
    do { try IosFilesTransfer.fixed(target, bytes: 32) } catch { throw IosWebDavFailure.code("invalid_request") }
    if let original, try original.targetId() == target { return .dav(original) }
    guard let destination = try IosWebDavDestinations.added(target) else { throw IosWebDavFailure.code("not_found") }
    return destination
  }
  static func check(_ profile: IosWebDavProfile, binding: String, journal: IosWebDavJournal) throws {
    try check(.dav(profile), binding: binding, journal: journal)
  }
  static func check(_ destination: IosCloudTarget, binding: String, journal: IosWebDavJournal) throws {
    try synchronized {
      let target = try destination.targetId()
      guard try stored(kind: destination.kind, target: target) == destination,
        try journal.enabled(kind: destination.kind, id: target, revision: destination.revision),
        try capture(destination, journal: journal) == binding else { throw IosWebDavFailure.code("settings_changed") }
    }
  }
  static func complete(_ value: IosWebDavUpload, profile: IosWebDavProfile, journal: IosWebDavJournal) throws {
    try complete(value, destination: .dav(profile), journal: journal)
  }
  static func complete(_ value: IosWebDavUpload, destination: IosCloudTarget, journal: IosWebDavJournal) throws {
    try synchronized {
      try check(destination, binding: value.binding, journal: journal)
      guard try value.target == destination.targetId() else { throw IosWebDavFailure.code("settings_changed") }
      try journal.advance(value, phase: "completed")
    }
  }
}
