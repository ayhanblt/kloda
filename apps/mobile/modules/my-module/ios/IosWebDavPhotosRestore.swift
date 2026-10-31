import Foundation

final class IosWebDavPhotosRestore {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.webdav.photos.restore", attributes: .concurrent)
  private var active: UUID?
  private var cancelled = Set<UUID>()
  func cancel(_ ticket: UUID? = nil) {
    lock.lock(); defer { lock.unlock() }
    if let ticket { cancelled.insert(ticket) }
    if ticket == nil || active == ticket { if let active { cancelled.insert(active) }; active = nil }
  }
  func restore(id: String, profile: IosWebDavProfile, binding: String, ticket: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard !cancelled.contains(ticket), active == nil else { lock.unlock(); completion(.failure(IosWebDavFailure.code("cancelled"))); return }
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
        let receipt = try download.receipt(id), manifest = try download.manifest(id)
        var stages: [String: URL] = [:], retained: [String] = []
        // Retain private downloads on uncertainty; an import intent is never blindly recreated.
        for resource in manifest.resources {
            try check()
            guard let value = try journal.photoReceipt(target: receipt.target, source: receipt.source, path: resource.relativePath,
              identity: "photos:" + manifest.sourceDeviceId + ":" + manifest.assetId + ":" + resource.role, hash: resource.sha256, size: resource.size) else { throw IosWebDavFailure.code("manifest_invalid") }
            let stage = try download.stage(value.id); retained.append(stage)
            stages[resource.relativePath] = try snapshots.verifiedURL(stage, sha256: resource.sha256, size: resource.size, check: check)
          }
          let state = try IosWebDavPhotosJournal(database: journal.database, target: receipt.target, commit: { action in
            try IosWebDavContext.synchronized {
              self.lock.lock(); defer { self.lock.unlock() }
              try check(); try action()
            }
          })
          // Every reference was downloaded through its own target-bound local Completed receipt.
          try check(); try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: receipt.target, journal: journal)
          try IosWebDavPhotosImport.importManifest(manifest: manifest, stages: stages, journal: state, check: check)
          try check()
          guard let saved = try state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId])), saved.state == "completed" else { throw IosWebDavFailure.code("review_required") }
          for stage in retained { try snapshots.discard(stage) }
          return ["state": "completed", "id": id, "name": manifest.filename]
      }
      self.lock.lock(); if self.active == ticket { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
}
