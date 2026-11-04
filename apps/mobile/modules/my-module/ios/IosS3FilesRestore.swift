#if KLODA_S3_NATIVE
import Foundation

final class IosS3FilesRestore {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.s3.restore", attributes: .concurrent)
  private var active: UUID?
  func cancel(_ ticket: UUID? = nil) { lock.lock(); if ticket == nil || ticket == active { active = nil }; lock.unlock() }
  func restore(id: String, destination: String, profiles: IosS3Profiles, ticket: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard active == nil else { lock.unlock(); completion(.failure(IosS3Failure(code: "backup_busy"))); return }
    active = ticket; lock.unlock()
    worker.async {
      let result = Result<[String: Any], Error> {
        let journal = profiles.journal, snapshots = try IosFilesSnapshot.s3(profiles.journal.provider)
        let history = try IosS3RestoreJournal(journal: journal)
        guard let captured = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
        let binding = try IosS3Sources.binding()
        let check = {
          self.lock.lock(); let current = self.active == ticket; self.lock.unlock()
          guard current && visible() else { throw IosS3Failure(code: "cancelled") }
          try IosWebDavContext.synchronized {
            guard try profiles.current(captured), try IosS3Sources.binding() == binding else { throw IosS3Failure(code: "context_changed") }
          }
        }
        let download = try IosS3Download(profiles: profiles, snapshots: snapshots, check: check)
        let receipt = try download.receipt(id)
        let target = try captured.profile.target.archiveId()
        func fresh() throws -> IosS3RestoreIntent {
          let stage = try download.stage(id)
          let result = IosS3RestoreIntent(id: UUID().uuidString.lowercased(), target: target, job: id,
            name: receipt.name ?? (receipt.reference as NSString).lastPathComponent, sha256: receipt.sha256, size: receipt.size,
            staging: stage, offset: receipt.size, destination: destination, state: "verified")
          try check(); try history.saveRestoreIntent(result)
          return result
        }
        let save = { (value: IosS3RestoreIntent) in
          try IosWebDavContext.synchronized {
            self.lock.lock(); defer { self.lock.unlock() }
            try check(); try history.saveRestoreIntent(value)
          }
        }
        var intent: IosS3RestoreIntent
        if let old = try history.restoreIntent(target: target, job: id), IosRestoreDestination.sameLocation(old.destination, destination) {
          guard old.sha256 == receipt.sha256, old.size == receipt.size else { throw IosS3Failure(code: "conflict") }
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
          if intent.state != "completed" { intent.state = "review_required"; intent.errorCode = IosS3FilesRestore.code(error); try history.saveRestoreIntent(intent) }
          throw error
        }
      }
      self.lock.lock(); if self.active == ticket { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
  private static func code(_ error: Error) -> String {
    if let error = error as? IosS3Failure { return error.code }
    return IosFilesQueue.failure(error).code
  }
}
#endif
