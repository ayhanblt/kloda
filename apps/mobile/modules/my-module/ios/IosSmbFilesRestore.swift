#if KLODA_SMB_NATIVE
import Foundation

final class IosSmbFilesRestore {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.smb.restore", attributes: .concurrent)
  private var active: UUID?
  func cancel(_ ticket: UUID? = nil) { lock.lock(); if ticket == nil || ticket == active { active = nil }; lock.unlock() }
  func restore(id: String, destination: String, profiles: IosSmbProfiles, ticket: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard active == nil else { lock.unlock(); completion(.failure(IosSmbFailure(code: "backup_busy"))); return }
    active = ticket; lock.unlock()
    worker.async {
      let result = Result<[String: Any], Error> {
        let journal = profiles.journal, snapshots = try IosFilesSnapshot.smb()
        let history = try IosSmbRestoreJournal(journal: journal)
        guard let captured = try profiles.capture() else { throw IosSmbFailure(code: "profile_missing") }
        let binding = try IosSmbSources.binding()
        let check = {
          self.lock.lock(); let current = self.active == ticket; self.lock.unlock()
          guard current && visible() else { throw IosSmbFailure(code: "cancelled") }
          try IosWebDavContext.synchronized {
            guard try profiles.current(captured), try IosSmbSources.binding() == binding else { throw IosSmbFailure(code: "context_changed") }
          }
        }
        let download = try IosSmbDownload(profiles: profiles, snapshots: snapshots, check: check)
        let receipt = try download.receipt(id)
        guard receipt.kind == "file" else { throw IosSmbFailure(code: "manifest_invalid") }
        let target = try captured.profile.target.archiveId()
        func fresh() throws -> IosSmbRestoreIntent {
          let stage = try download.stage(id)
          let result = IosSmbRestoreIntent(id: UUID().uuidString.lowercased(), target: target, job: id,
            name: receipt.name ?? (receipt.relativePath as NSString).lastPathComponent, sha256: receipt.sha256, size: receipt.size,
            staging: stage, offset: receipt.size, destination: destination, state: "verified")
          try check(); try history.saveRestoreIntent(result)
          return result
        }
        let save = { (value: IosSmbRestoreIntent) in
          try IosWebDavContext.synchronized {
            self.lock.lock(); defer { self.lock.unlock() }
            try check(); try history.saveRestoreIntent(value)
          }
        }
        var intent: IosSmbRestoreIntent
        if let old = try history.restoreIntent(target: target, job: id), IosRestoreDestination.sameLocation(old.destination, destination) {
          guard old.sha256 == receipt.sha256, old.size == receipt.size else { throw IosSmbFailure(code: "conflict") }
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
          if intent.state != "completed" { intent.state = "review_required"; intent.errorCode = IosSmbFilesRestore.code(error); try history.saveRestoreIntent(intent) }
          throw error
        }
      }
      self.lock.lock(); if self.active == ticket { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
  private static func code(_ error: Error) -> String {
    if let error = error as? IosSmbFailure { return error.code }
    return IosFilesQueue.failure(error).code
  }
}
#endif
