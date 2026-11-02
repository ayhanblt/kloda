import Foundation

// ADR0027 §4 / ADR0023: explicit opt-in per added DAV destination (the original WebDAV entry keeps KlodaBackup's own
// configure/disable). Disabling or removing one destination ends only its own run and plan.
enum IosWebDavDestinations {
  private static func profile(_ target: String) throws -> (IosWebDavProfile, String) {
    guard let profile = try IosWebDavVault.read(slot: target) else {
      throw IosWebDavFailure.code(try IosOAuthVault.read(slot: target) != nil ? "destination_unsupported" : "not_found")
    }
    guard let kind = profile.provider, IosWebDavJournal.davKinds.contains(kind), try profile.targetId() == target else {
      throw IosWebDavFailure.code("destination_unsupported")
    }
    return (profile, kind)
  }
  static func enabled(_ target: String) throws -> Bool {
    guard let profile = try IosWebDavVault.read(slot: target), let kind = profile.provider else { return false }
    return try IosWebDavJournal.open().enabled(kind: kind, id: target, revision: profile.revision)
  }
  static func setEnabled(_ target: String, enabled: Bool) throws {
    let changed: Bool = try IosWebDavContext.synchronized {
      let (profile, kind) = try profile(target), journal = try IosWebDavJournal.open()
      if try journal.enabled(kind: kind, id: target, revision: profile.revision) == enabled { return false }
      try journal.setEnabled(kind: kind, id: target, enabled: enabled, revision: profile.revision)
      return true
    }
    guard changed else { return }
    if !enabled { try IosWebDavQueue.shared.pauseTarget(target) }
    IosWebDavAutomaticCoordinator.shared.reconcile(allowForeground: false)
  }
  // Before the destination's custody is deleted: its row is disabled and its plan dropped; receipts stay bound to the target.
  static func forget(_ target: String) throws {
    try IosWebDavContext.synchronized {
      guard let profile = try IosWebDavVault.read(slot: target) else { return }
      let journal = try IosWebDavJournal.open()
      if let kind = profile.provider, IosWebDavJournal.davKinds.contains(kind), try journal.enabled(kind: kind, id: target) {
        try journal.setEnabled(kind: kind, id: target, enabled: false, revision: profile.revision)
      }
      try journal.deletePlan(target: target)
    }
    try IosWebDavQueue.shared.pauseTarget(target)
    IosWebDavAutomaticCoordinator.shared.reconcile(allowForeground: false)
  }
}
