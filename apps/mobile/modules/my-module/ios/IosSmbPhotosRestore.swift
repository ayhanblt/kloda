#if KLODA_SMB_NATIVE
import Foundation

final class IosSmbPhotosRestore {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.smb.photos.restore", attributes: .concurrent)
  private var active: UUID?
  private var cancelled = Set<UUID>()
  func cancel(_ ticket: UUID? = nil) {
    lock.lock(); defer { lock.unlock() }
    if let ticket { cancelled.insert(ticket) }
    if ticket == nil || active == ticket { if let active { cancelled.insert(active) }; active = nil }
  }
  func restore(id: String, profiles: IosSmbProfiles, ticket: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard !cancelled.contains(ticket), active == nil else { lock.unlock(); completion(.failure(IosSmbFailure(code: "cancelled"))); return }
    active = ticket; lock.unlock()
    worker.async {
      let result = Result<[String: Any], Error> {
        let journal = profiles.journal, snapshots = try IosFilesSnapshot.smb()
        guard let captured = try profiles.capture() else { throw IosSmbFailure(code: "profile_missing") }
        let binding = try IosSmbSources.binding()
        let check = {
          self.lock.lock(); let current = self.active == ticket; self.lock.unlock()
          guard current && visible() else { throw IosSmbFailure(code: "cancelled") }
          try IosWebDavContext.synchronized {
            guard try profiles.current(captured), try IosSmbSources.binding() == binding else { throw IosSmbFailure(code: "settings_changed") }
          }
        }
        let download = try IosSmbDownload(profiles: profiles, snapshots: snapshots, check: check)
        let manifest = try download.manifest(id)
        var stages: [String: URL] = [:], retained: [String] = []
        // Retain private downloads on uncertainty; an import intent is never blindly recreated.
        for resource in manifest.resources {
            try check()
            guard let value = try journal.catalogResource(resource, manifest: manifest, target: captured.profile.target) else { throw IosSmbFailure(code: "manifest_invalid") }
            let stage = try download.stage(value.id); retained.append(stage)
            stages[resource.relativePath] = try snapshots.verifiedURL(stage, sha256: resource.sha256, size: resource.size, check: check)
          }
          let state = try IosSmbPhotosJournal(database: journal.database, target: try captured.profile.target.archiveId(), commit: { action in
            try IosWebDavContext.synchronized {
              self.lock.lock(); defer { self.lock.unlock() }
              try check(); try action()
            }
          })
          // Every reference was downloaded through its own target-bound local Completed receipt.
          try check(); try IosSmbPhotoManifestCodec.requireReceipts(manifest, target: captured.profile.target, journal: journal)
          try IosSmbPhotosImport.importManifest(manifest: manifest, stages: stages, journal: state, check: check)
          try check()
          guard let saved = try state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId])), saved.state == "completed" else { throw IosSmbFailure(code: "review_required") }
          for stage in retained { try snapshots.discard(stage) }
          return ["state": "completed", "id": id, "name": manifest.filename]
      }
      self.lock.lock(); if self.active == ticket { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
}
#endif
