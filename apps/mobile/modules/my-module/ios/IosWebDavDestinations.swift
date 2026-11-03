import Foundation

// ADR0027 §4 / ADR0023: explicit opt-in per added destination (the original WebDAV entry keeps KlodaBackup's own
// configure/disable). Disabling or removing one destination ends only its own run and plan. OAuth destinations
// join only once their provider has an upload adapter (ADR0028 §5; Dropbox first, user decision 2026-11-03).
enum IosWebDavDestinations {
  // Added custody only: a DAV slot of a queue kind, or an OAuth slot whose provider has an upload adapter.
  static func added(_ target: String) throws -> IosCloudTarget? {
    if let profile = try IosWebDavVault.read(slot: target) {
      guard let kind = profile.provider, IosWebDavJournal.davKinds.contains(kind), try profile.targetId() == target else { return nil }
      return .dav(profile)
    }
    guard let profile = try IosOAuthVault.read(slot: target), IosCloudTarget.oauthKinds.contains(profile.provider) else { return nil }
    return .oauth(profile)
  }
  private static func destination(_ target: String) throws -> IosCloudTarget {
    if let destination = try added(target) { return destination }
    let stored = try IosWebDavVault.read(slot: target) != nil || IosOAuthVault.read(slot: target) != nil
    throw IosWebDavFailure.code(stored ? "destination_unsupported" : "not_found")
  }
  static func enabled(_ target: String) throws -> Bool {
    guard let destination = try added(target) else { return false }
    return try IosWebDavJournal.open().enabled(kind: destination.kind, id: target, revision: destination.revision)
  }
  static func setEnabled(_ target: String, enabled: Bool) throws {
    let changed: Bool = try IosWebDavContext.synchronized {
      let destination = try destination(target), journal = try IosWebDavJournal.open()
      if try journal.enabled(kind: destination.kind, id: target, revision: destination.revision) == enabled { return false }
      try journal.setEnabled(kind: destination.kind, id: target, enabled: enabled, revision: destination.revision)
      return true
    }
    guard changed else { return }
    if !enabled { try IosWebDavQueue.shared.pauseTarget(target) }
    IosWebDavAutomaticCoordinator.shared.reconcile(allowForeground: false)
  }
  // Before the destination's custody is deleted: its row is disabled and its plan dropped; receipts stay bound to the target.
  static func forget(_ target: String) throws {
    try IosWebDavContext.synchronized {
      guard let destination = try added(target) else { return }
      let journal = try IosWebDavJournal.open()
      if try journal.enabled(kind: destination.kind, id: target) {
        try journal.setEnabled(kind: destination.kind, id: target, enabled: false, revision: destination.revision)
      }
      try journal.deletePlan(target: target)
    }
    try IosWebDavQueue.shared.pauseTarget(target)
    IosWebDavAutomaticCoordinator.shared.reconcile(allowForeground: false)
  }
}
