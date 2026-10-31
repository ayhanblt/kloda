import Foundation

final class IosWebDavFilesRestore {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.webdav.restore", attributes: .concurrent)
  private var active: UUID?
  func cancel(_ ticket: UUID? = nil) { lock.lock(); if ticket == nil || ticket == active { active = nil }; lock.unlock() }
  func restore(id: String, destination: String, profile: IosWebDavProfile, binding: String, ticket: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard active == nil else { lock.unlock(); completion(.failure(IosWebDavFailure.code("backup_busy"))); return }
    active = ticket; lock.unlock()
    worker.async {
      let result = Result<[String: Any], Error> {
        let journal = try IosWebDavJournal.open(), snapshots = try IosFilesSnapshot.webdav()
        let check = {
          self.lock.lock(); let current = self.active == ticket; self.lock.unlock()
          guard current && visible() else { throw IosWebDavFailure.code("cancelled") }
          try IosWebDavContext.synchronized {
            guard try IosWebDavVault.read() == profile, try IosWebDavContext.capture(profile, journal: journal) == binding else { throw IosWebDavFailure.code("settings_changed") }
          }
        }
        let download = IosWebDavDownload(journal: journal, profile: profile, snapshots: snapshots, check: check)
        let receipt = try download.receipt(id)
        guard receipt.kind == "file" else { throw IosWebDavFailure.code("manifest_invalid") }
        let target = try profile.targetId()
        func fresh() throws -> IosWebDavRestoreIntent {
          let stage = try download.stage(id)
          let result = IosWebDavRestoreIntent(id: UUID().uuidString.lowercased(), target: target, job: id,
            name: (receipt.relativePath as NSString).lastPathComponent, sha256: receipt.sha256, size: receipt.size,
            staging: stage, offset: receipt.size, destination: destination, state: "verified")
          try check(); try journal.saveRestoreIntent(result)
          return result
        }
        let save = { (value: IosWebDavRestoreIntent) in
          try IosWebDavContext.synchronized {
            self.lock.lock(); defer { self.lock.unlock() }
            try check(); try journal.saveRestoreIntent(value)
          }
        }
        var intent: IosWebDavRestoreIntent
        if let old = try journal.restoreIntent(target: target, job: id), IosRestoreDestination.sameLocation(old.destination, destination) {
          guard old.sha256 == receipt.sha256, old.size == receipt.size else { throw IosWebDavFailure.code("conflict") }
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
          if intent.state != "completed" { intent.state = "review_required"; intent.errorCode = IosWebDavFilesRunner.code(error); try journal.saveRestoreIntent(intent) }
          throw error
        }
      }
      self.lock.lock(); if self.active == ticket { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
}
