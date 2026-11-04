#if KLODA_S3_NATIVE
import Foundation

final class IosS3Runtime {
  static let shared = IosS3Runtime()
  private let state = NSLock()
  private var foregroundOwners = Set<UUID>()
  private var protectedData = false
  private var lease: IosBackgroundLease?
  private var instance: IosS3Queue?
  func queue() throws -> IosS3Queue {
    try IosWebDavContext.synchronized {
      if let instance { return instance }
      let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let profiles = IosS3Profiles(journal: try IosS3Journal(url: root.appendingPathComponent("kloda-amazon-s3.sqlite"), provider: "amazon-s3"))
      let value = try IosS3Queue(profiles: profiles, mayRunAutomatic: { self.allowed(true) }, mayRun: { self.allowed(false) })
      state.lock(); instance = value; state.unlock(); return value
    }
  }
  private func allowed(_ automatic: Bool) -> Bool {
    state.lock(); let visible = !foregroundOwners.isEmpty, protected = protectedData, lease = self.lease; state.unlock()
    guard protected else { return false }
    if !automatic { return visible }
    guard !IosAutomaticPause.requested, (try? IosSyncJournal().automaticPaused()) == false else { return false }
    return visible || (lease != nil && (try? lease!.check()) != nil)
  }
  func foreground(_ owner: UUID, active: Bool, protected: Bool) {
    state.lock(); protectedData = protected
    if active { foregroundOwners.insert(owner) } else { foregroundOwners.remove(owner) }; state.unlock()
    if !active { state.lock(); let queue = instance; state.unlock(); try? queue?.pauseForeground() }
  }
  func setProtected(_ value: Bool) {
    state.lock(); protectedData = value; let lease = self.lease, queue = instance; state.unlock()
    if !value { lease?.cancel(); IosS3Queue.cancelAllInMemory(); try? queue?.pause(code: "credential_locked") }
  }
  func begin(_ lease: IosBackgroundLease) -> Bool { state.lock(); defer { state.unlock() }; guard self.lease == nil else { return false }; self.lease = lease; return true }
  func end(_ lease: IosBackgroundLease) { state.lock(); if self.lease === lease { self.lease = nil }; state.unlock(); lease.cancel() }
}
#endif
