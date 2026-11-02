import Foundation
import Darwin

struct IosSmbProfileCapture {
  let profile: IosSmbProfile
  let context: String
}

// Native custody owner only; it cannot supply OS-route or selected-source authority.
final class IosSmbProfiles {
  let journal: IosSmbJournal
  init(journal: IosSmbJournal) { self.journal = journal }
  func save(target: IosSmbTarget, password: String) throws -> IosSmbProfile {
    IosSmbJournal.ownerLock.lock(); defer { IosSmbJournal.ownerLock.unlock() }
    let current = IosSmbTarget(address: target.address, port: target.port, share: target.share, root: target.root,
      username: target.username, domain: target.domain, profileGeneration: UUID().uuidString.lowercased(),
      credentialGeneration: UUID().uuidString.lowercased())
    let profile = IosSmbProfile(target: current, password: password)
    try profile.validate()
    _ = try IosSmbVault.read()
    try journal.prepareProfile(profile.target)
    try IosSmbVault.write(profile)
    try journal.confirmProfile(profile.target)
    return profile
  }
  func capture() throws -> IosSmbProfileCapture? {
    IosSmbJournal.ownerLock.lock(); defer { IosSmbJournal.ownerLock.unlock() }
    guard let profile = try IosSmbVault.read() else {
      guard try !journal.hasProfile() else { throw IosSmbFailure(code: "storage_failure") }
      return nil
    }
    guard try journal.profileCurrent(profile.target) else { throw IosSmbFailure(code: "context_changed") }
    return IosSmbProfileCapture(profile: profile, context: try journal.context())
  }
  func current(_ value: IosSmbProfileCapture) throws -> Bool {
    IosSmbJournal.ownerLock.lock(); defer { IosSmbJournal.ownerLock.unlock() }
    return try journal.context() == value.context && journal.profileCurrent(value.profile.target) && IosSmbVault.read() == value.profile
  }
#if KLODA_SMB_NATIVE
  func publishBound(job: IosSmbUpload, snapshot: Int32, socket: Int32,
    currentSourceAndRoute: @escaping () throws -> Bool, completedSource: (() throws -> Bool)? = nil) throws {
    var ownedSocket: Int32? = socket
    defer { if let fd = ownedSocket, fd >= 0 { Darwin.close(fd) } }
    guard let captured = try capture(), job.target == captured.profile.target, job.context == captured.context
      else { throw IosSmbFailure(code: "context_changed") }
    ownedSocket = nil
    try IosSmbPublication.runBound(journal: journal, job: job, snapshot: snapshot,
      password: captured.profile.password, socket: socket, current: {
        try self.current(captured) && currentSourceAndRoute()
      }, completed: {
        try self.current(captured) && (completedSource ?? currentSourceAndRoute)()
      })
  }
#endif
}
