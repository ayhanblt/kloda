#if KLODA_SFTP_NATIVE
import Foundation
import Darwin

struct IosSftpProfileCapture {
  let profile: IosSftpProfile
  let context: String
}

// Native custody owner only; it cannot supply OS-route or selected-source authority.
final class IosSftpProfiles {
  let journal: IosSftpJournal
  init(journal: IosSftpJournal) { self.journal = journal }
  func save(target: IosSftpTarget, password: String) throws -> IosSftpProfile {
    IosSftpJournal.ownerLock.lock(); defer { IosSftpJournal.ownerLock.unlock() }
    let current = IosSftpTarget(address: target.address, port: target.port, fingerprint: target.fingerprint, root: target.root,
      username: target.username, profileGeneration: UUID().uuidString.lowercased(),
      credentialGeneration: UUID().uuidString.lowercased())
    let profile = IosSftpProfile(target: current, password: password)
    try profile.validate()
    _ = try IosSftpVault.read()
    try journal.prepareProfile(profile.target)
    try IosSftpVault.write(profile)
    try journal.confirmProfile(profile.target)
    return profile
  }
  func capture() throws -> IosSftpProfileCapture? {
    IosSftpJournal.ownerLock.lock(); defer { IosSftpJournal.ownerLock.unlock() }
    guard let profile = try IosSftpVault.read() else {
      guard try !journal.hasProfile() else { throw IosSftpFailure(code: "storage_failure") }
      return nil
    }
    guard try journal.profileCurrent(profile.target) else { throw IosSftpFailure(code: "context_changed") }
    return IosSftpProfileCapture(profile: profile, context: try journal.context())
  }
  func current(_ value: IosSftpProfileCapture) throws -> Bool {
    IosSftpJournal.ownerLock.lock(); defer { IosSftpJournal.ownerLock.unlock() }
    return try journal.context() == value.context && journal.profileCurrent(value.profile.target) && IosSftpVault.read() == value.profile
  }
#if KLODA_SFTP_NATIVE
  func publishBound(job: IosSftpUpload, snapshot: Int32, socket: Int32,
    currentSourceAndRoute: @escaping () throws -> Bool, completedSource: (() throws -> Bool)? = nil) throws {
    var ownedSocket: Int32? = socket
    defer { if let fd = ownedSocket, fd >= 0 { Darwin.close(fd) } }
    guard let captured = try capture(), job.target == captured.profile.target, job.context == captured.context
      else { throw IosSftpFailure(code: "context_changed") }
    ownedSocket = nil
    try IosSftpPublication.runBound(journal: journal, job: job, snapshot: snapshot,
      password: captured.profile.password, socket: socket, current: {
        try self.current(captured) && currentSourceAndRoute()
      }, completed: {
        try self.current(captured) && (completedSource ?? currentSourceAndRoute)()
      })
  }
#endif
}

#endif
