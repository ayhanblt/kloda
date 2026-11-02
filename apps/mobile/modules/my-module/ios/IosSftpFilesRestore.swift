#if KLODA_SFTP_NATIVE
import Foundation

final class IosSftpFilesRestore {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.sftp.restore", attributes: .concurrent)
  private var active: UUID?
  func cancel(_ ticket: UUID? = nil) { lock.lock(); if ticket == nil || ticket == active { active = nil }; lock.unlock() }
  func restore(id: String, destination: String, profiles: IosSftpProfiles, ticket: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard active == nil else { lock.unlock(); completion(.failure(IosSftpFailure(code: "backup_busy"))); return }
    active = ticket; lock.unlock()
    worker.async {
      let result = Result<[String: Any], Error> {
        let journal = profiles.journal, snapshots = try IosFilesSnapshot.sftp()
        let history = try IosSftpRestoreJournal(journal: journal)
        guard let captured = try profiles.capture() else { throw IosSftpFailure(code: "profile_missing") }
        let binding = try IosSftpSources.binding()
        let check = {
          self.lock.lock(); let current = self.active == ticket; self.lock.unlock()
          guard current && visible() else { throw IosSftpFailure(code: "cancelled") }
          try IosWebDavContext.synchronized {
            guard try profiles.current(captured), try IosSftpSources.binding() == binding else { throw IosSftpFailure(code: "context_changed") }
          }
        }
        let download = try IosSftpDownload(profiles: profiles, snapshots: snapshots, check: check)
        let receipt = try download.receipt(id)
        guard receipt.kind == "file" else { throw IosSftpFailure(code: "manifest_invalid") }
        let target = try captured.profile.target.archiveId()
        func fresh() throws -> IosSftpRestoreIntent {
          let stage = try download.stage(id)
          let result = IosSftpRestoreIntent(id: UUID().uuidString.lowercased(), target: target, job: id,
            name: receipt.name ?? (receipt.relativePath as NSString).lastPathComponent, sha256: receipt.sha256, size: receipt.size,
            staging: stage, offset: receipt.size, destination: destination, state: "verified")
          try check(); try history.saveRestoreIntent(result)
          return result
        }
        let save = { (value: IosSftpRestoreIntent) in
          try IosWebDavContext.synchronized {
            self.lock.lock(); defer { self.lock.unlock() }
            try check(); try history.saveRestoreIntent(value)
          }
        }
        var intent: IosSftpRestoreIntent
        if let old = try history.restoreIntent(target: target, job: id), IosRestoreDestination.sameLocation(old.destination, destination) {
          guard old.sha256 == receipt.sha256, old.size == receipt.size else { throw IosSftpFailure(code: "conflict") }
          intent = old
        } else { intent = try fresh() }
        do {
          try check()
          do { try IosRestoreDestination.publish(&intent, snapshots: snapshots, check: check, save: save) }
          catch IosPairingFailure.native(let code) {
            guard intent.state == "completed", code == "not_found" else { throw IosPairingFailure.native(code) }
            intent = try fresh()
            try IosRestoreDestination.publish(&intent, snapshots: snapshots, check: check, save: save)
          }
          try check(); try snapshots.discard(intent.staging)
          return ["state": "completed", "id": id, "name": intent.name]
        } catch {
          if intent.state != "completed" { intent.state = "review_required"; intent.errorCode = IosSftpFilesRestore.code(error); try history.saveRestoreIntent(intent) }
          throw error
        }
      }
      self.lock.lock(); if self.active == ticket { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
  private static func code(_ error: Error) -> String {
    if let error = error as? IosSftpFailure { return error.code }
    return IosFilesQueue.failure(error).code
  }
}
#endif
