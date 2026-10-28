import Foundation
import Photos
import CryptoKit
import Darwin

final class IosPhotosRunner {
  let connection: IosFilesConnection
  let check: () throws -> Void
  private(set) var errorCode: String?
  private var visited = Set<String>()
  init(connection: IosFilesConnection, check: @escaping () throws -> Void) { self.connection = connection; self.check = check }

  func run(record: String, rebackup: String?) throws {
    visited.removeAll(); errorCode = nil
    let journal = try IosSyncJournal(), snapshots = try IosFilesSnapshot()
    let selections = try IosPhotosSource.currentSelections()
    let selected = try rebackup.map { id -> IosFilesJob in
      guard let value = try journal.fileJob(id: id), value.isPhotos,
        value.state == "owner_deleted", value.operationId != nil else {
        throw IosPairingFailure.native("invalid_request")
      }
      return value
    }
    var seen = Set<String>(), found = false
    for selection in selections {
      let assets: [PHAsset]
      do { assets = try IosPhotosSource.assets(selection: selection) }
      catch { errorCode = IosFilesQueue.failure(error).code; continue }
      for asset in assets where seen.insert(asset.localIdentifier).inserted {
        try check()
        if let selected, !selected.reference.hasPrefix(IosFilesJob.photosReferencePrefix + asset.localIdentifier + ":") { continue }
        found = true
        do { try publish(asset, selection: selection, record: record, selected: selected, journal: journal, snapshots: snapshots) }
        catch {
          let code = IosFilesQueue.failure(error).code; errorCode = code
          if ["cancelled", "candidate_stale", "settings_changed", "storage_failure"].contains(code) { throw error }
        }
      }
    }
    if rebackup == nil {
      for var job in try journal.filesJobs() where job.recordId == record && job.isPhotos
        && !["completed", "owner_deleted"].contains(job.state) && !visited.contains(job.id) {
        let activeSelection = selections.contains { $0.id == job.sourceId }
        let currentAsset = seen.contains { job.reference.hasPrefix(IosFilesJob.photosReferencePrefix + $0 + ":") }
        let code = !activeSelection ? "settings_changed" : currentAsset ? "source_changed" : "source_unavailable"
        job.state = "paused"; job.errorCode = code; try journal.saveFileJob(job)
        errorCode = errorCode ?? code
      }
    }
    if selected != nil && !found { throw IosPairingFailure.native("source_unavailable") }
  }

  private func publish(_ asset: PHAsset, selection: IosPhotosSelection, record: String, selected: IosFilesJob?,
    journal: IosSyncJournal, snapshots: IosFilesSnapshot) throws {
    let stamp = try IosPhotosSource.stamp(asset: asset)
    let device = try journal.photoIdentity("installation", "photos-v1")
    let assetId = try journal.photoIdentity("asset", asset.localIdentifier)
    let albums = try IosPhotosSource.albums(asset: asset).map { album in
      try IosPhotoAlbum(id: journal.photoIdentity("album", album.localIdentifier), name: album.title)
    }
    let exported = try IosPhotosSource.export(asset: asset, check: check, snapshots: snapshots)
    defer {
      // A failed upload retains its immutable snapshot for status/resume after process restart.
      let retained = Set((try? journal.filesJobs())?.filter { !["completed", "owner_deleted"].contains($0.state) }.map(\.snapshot) ?? exported.map(\.snapshot))
      for resource in exported where !retained.contains(resource.snapshot) { try? snapshots.discard(resource.snapshot) }
    }
    let normalized = exported.map { IosPhotoResource(operationId: String(repeating: "A", count: 22), role: $0.role,
      name: $0.name, mimeType: $0.mimeType, sha256: $0.sha256, size: $0.size) }
    // Operation IDs are receipts, not source revisions; metadata-only changes retain media.
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let signatureData = try encoder.encode(IosPhotoManifest(sourceDeviceId: device, assetId: assetId, revision: 1,
      resources: normalized, albums: albums, favorite: asset.isFavorite))
    let signature = IosFilesTransfer.encode(Data(SHA256.hash(data: signatureData)))
    let revision = try journal.photoRevision(asset: assetId, signature: signature)
    let reference = IosFilesJob.photosReferencePrefix + asset.localIdentifier + ":manifest"
    let wire = try journal.photoIdentity("wire", assetId + ":manifest")
    let prior = try journal.readFileJobs("SELECT * FROM files_job WHERE record_id=? AND wire_source_id=? AND revision=? ORDER BY rowid DESC", values: [record, wire, String(revision)])
    // Reconcile the sidecar first: deleting a selected version must not recreate its resources.
    var previous = prior.first(where: { $0.state == "completed" })
      ?? prior.first(where: { $0.state != "owner_deleted" && $0.sourceId == selection.id })
      ?? prior.first(where: { $0.state == "owner_deleted" })
    if var old = previous, old.state == "completed" {
      do { _ = try IosFilesTransfer.ack(connection.send(["kind": "status", "id": old.operationId!], -1), job: old) }
      catch IosPairingFailure.native(let code) {
        guard code == "owner_deleted" else { throw IosPairingFailure.native(code) }
        old.state = "owner_deleted"; old.errorCode = code; try journal.saveFileJob(old); previous = old
      }
    }
    if previous?.state == "owner_deleted" && selected == nil { return }
    if let selected {
      guard selected.revision == String(revision) else { throw IosPairingFailure.native("source_changed") }
      if selected.reference.hasSuffix(":manifest") {
        guard selected.wireSourceId == wire else { throw IosPairingFailure.native("source_changed") }
      } else {
        guard let resource = exported.first(where: {
          selected.reference == IosFilesJob.photosReferencePrefix + asset.localIdentifier + ":" + $0.role
            && selected.sha256 == $0.sha256 && selected.size == $0.size
        }), selected.wireSourceId == (try journal.photoIdentity("wire", assetId + ":" + resource.role)) else {
          throw IosPairingFailure.native("source_changed")
        }
      }
      do { _ = try IosFilesTransfer.ack(connection.send(["kind": "status", "id": selected.operationId!], -1), job: selected)
        throw IosPairingFailure.native("conflict")
      } catch IosPairingFailure.native(let code) { guard code == "owner_deleted" else { throw IosPairingFailure.native(code) } }
    }
    var resources: [IosPhotoResource] = []
    for resource in exported {
      let resourceWire = try journal.photoIdentity("wire", assetId + ":" + resource.role)
      let candidates = try journal.matchingFilesJobs(record: record, wireSource: resourceWire, hash: resource.sha256, size: resource.size)
      var job = candidates.first(where: { $0.state == "completed" })
        ?? candidates.first(where: { $0.state != "owner_deleted" && $0.sourceId == selection.id })
        ?? candidates.first(where: { $0.state == "owner_deleted" })
      if var old = job, old.state == "completed" {
        do { _ = try IosFilesTransfer.ack(connection.send(["kind": "status", "id": old.operationId!], -1), job: old) }
        catch IosPairingFailure.native(let code) {
          guard code == "owner_deleted" else { throw IosPairingFailure.native(code) }
          old.state = "owner_deleted"; old.errorCode = code; try journal.saveFileJob(old); job = old
        }
      }
      if job == nil || job!.state == "owner_deleted" {
        // A changed manifest is a new version; explicit rebackup is the other permitted recovery path.
        if job?.state == "owner_deleted" && previous != nil && selected == nil { throw IosPairingFailure.native("owner_deleted") }
        let id = IosFilesTransfer.identifier()
        job = IosFilesJob(id: id, sourceId: selection.id, reference: IosFilesJob.photosReferencePrefix + asset.localIdentifier + ":" + resource.role,
          revision: String(revision), recordId: record, wireSourceId: resourceWire, requestId: id,
          name: resource.name, sha256: resource.sha256, size: resource.size, snapshot: resource.snapshot,
          rebackupOf: job?.operationId, identity: id)
        try journal.saveFileJob(job!)
      }
      var current = job!
      if current.state != "completed" && current.sourceId != selection.id {
        current.state = "paused"; current.errorCode = "settings_changed"; try journal.saveFileJob(current)
        throw IosPairingFailure.native("settings_changed")
      }
      try upload(&current, journal: journal, snapshots: snapshots, validate: { try IosPhotosSource.validate(stamp: stamp); try self.check() })
      guard let operation = current.operationId else { throw IosPairingFailure.native("outcome_unknown") }
      resources.append(IosPhotoResource(operationId: operation, role: resource.role, name: resource.name,
        mimeType: resource.mimeType, sha256: resource.sha256, size: resource.size))
    }
    let manifest = IosPhotoManifest(sourceDeviceId: device, assetId: assetId, revision: revision,
      resources: resources, albums: albums, favorite: asset.isFavorite)
    let payload = try IosPhotoManifestCodec.encode(manifest)
    let hash = IosFilesTransfer.encode(Data(SHA256.hash(data: payload)))
    var publication: IosFilesJob
    if let previous, previous.state != "owner_deleted" { publication = previous }
    else {
      let (name, file) = try snapshots.createStaging()
      do { try file.write(contentsOf: payload); try file.synchronize()
        guard fcntl(file.fileDescriptor, F_FULLFSYNC) == 0 else { throw IosFilesSource.ioFailure() }
        try file.close() }
      catch { try? file.close(); try? snapshots.discard(name); throw error }
      let id = IosFilesTransfer.identifier()
      publication = IosFilesJob(id: id, sourceId: selection.id, reference: reference, revision: String(revision),
        recordId: record, wireSourceId: wire, requestId: id, name: manifest.filename, sha256: hash,
        size: Int64(payload.count), snapshot: name,
        rebackupOf: previous?.state == "owner_deleted" ? previous?.operationId : (selected?.reference.hasSuffix(":manifest") == true ? selected?.operationId : nil), identity: id)
      try journal.saveFileJob(publication)
    }
    guard publication.state == "completed" || publication.sourceId == selection.id else {
      publication.state = "paused"; publication.errorCode = "settings_changed"; try journal.saveFileJob(publication)
      throw IosPairingFailure.native("settings_changed")
    }
    guard publication.sha256 == hash, publication.size == payload.count else { throw IosPairingFailure.native("outcome_unknown") }
    try upload(&publication, journal: journal, snapshots: snapshots, validate: {
      try IosPhotosSource.validate(stamp: stamp); try self.check()
      for resource in resources {
        let current = try IosOwnBackups.status(self.connection, id: resource.operationId)
        guard current.name == resource.name, current.sha256 == resource.sha256, current.size == resource.size else { throw IosPairingFailure.invalidReply }
      }
    })
  }

  private func upload(_ job: inout IosFilesJob, journal: IosSyncJournal, snapshots: IosFilesSnapshot,
    validate: () throws -> Void) throws {
    visited.insert(job.id)
    do {
      try check(); try validate()
      if job.state == "completed" {
        let ack = try IosFilesTransfer.ack(connection.send(["kind": "status", "id": job.operationId!], -1), job: job)
        guard ack.state == "completed" else { throw IosPairingFailure.native("outcome_unknown") }
        return
      }
      let file = try snapshots.open(job.snapshot, sha256: job.sha256, size: job.size, cancelled: { (try? self.check()) == nil })
      defer { try? file.close() }
      try IosFilesUpload.send(&job, journal: journal, descriptor: file.fileDescriptor, connection: connection, check: check, validateSource: validate)
      try snapshots.discard(job.snapshot)
    } catch {
      let code = IosFilesQueue.failure(error).code
      job.errorCode = code
      if code == "owner_deleted" { job.state = "owner_deleted" }
      else if job.state != "completed" { job.state = ["cancelled", "settings_changed", "candidate_stale"].contains(code) ? "paused" : "blocked" }
      try journal.saveFileJob(job); throw error
    }
  }
}
