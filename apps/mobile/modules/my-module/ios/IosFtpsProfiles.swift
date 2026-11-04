#if KLODA_FTPS_NATIVE
import Foundation
import Darwin

struct IosFtpsProfileCapture {
  let profile: IosFtpsProfile
  let context: String
}

// Native custody owner only; it cannot supply OS-route or selected-source authority.
final class IosFtpsProfiles {
  let journal: IosFtpsJournal
  init(journal: IosFtpsJournal) { self.journal = journal }
  func save(target: IosFtpsTarget, password: String) throws -> IosFtpsProfile {
    IosFtpsJournal.ownerLock.lock(); defer { IosFtpsJournal.ownerLock.unlock() }
    let current = IosFtpsTarget(address: target.address, port: target.port, hostname: target.hostname, root: target.root,
      username: target.username, profileGeneration: UUID().uuidString.lowercased(),
      credentialGeneration: UUID().uuidString.lowercased())
    let profile = IosFtpsProfile(target: current, password: password)
    try profile.validate()
    _ = try IosFtpsVault.read()
    try journal.prepareProfile(profile.target)
    try IosFtpsVault.write(profile)
    try journal.confirmProfile(profile.target)
    return profile
  }
  func capture() throws -> IosFtpsProfileCapture? {
    IosFtpsJournal.ownerLock.lock(); defer { IosFtpsJournal.ownerLock.unlock() }
    guard let profile = try IosFtpsVault.read() else {
      guard try !journal.hasProfile() else { throw IosFtpsFailure(code: "storage_failure") }
      return nil
    }
    guard try journal.profileCurrent(profile.target) else { throw IosFtpsFailure(code: "context_changed") }
    return IosFtpsProfileCapture(profile: profile, context: try journal.context())
  }
  func current(_ value: IosFtpsProfileCapture) throws -> Bool {
    IosFtpsJournal.ownerLock.lock(); defer { IosFtpsJournal.ownerLock.unlock() }
    return try journal.context() == value.context && journal.profileCurrent(value.profile.target) && IosFtpsVault.read() == value.profile
  }
#if KLODA_FTPS_NATIVE
  func publishBound(job: IosFtpsUpload, snapshot: Int32, socket: Int32, connect: @escaping (String, UInt16) -> Int32,
    currentSourceAndRoute: @escaping () throws -> Bool, completedSource: (() throws -> Bool)? = nil) throws {
    var ownedSocket: Int32? = socket
    defer { if let fd = ownedSocket, fd >= 0 { Darwin.close(fd) } }
    guard let captured = try capture(), job.target == captured.profile.target, job.context == captured.context
      else { throw IosFtpsFailure(code: "context_changed") }
    ownedSocket = nil
    try IosFtpsPublication.runBound(journal: journal, job: job, snapshot: snapshot,
      password: captured.profile.password, socket: socket, connect: connect, current: {
        try self.current(captured) && currentSourceAndRoute()
      }, completed: {
        try self.current(captured) && (completedSource ?? currentSourceAndRoute)()
      })
  }
#endif
}

#endif
