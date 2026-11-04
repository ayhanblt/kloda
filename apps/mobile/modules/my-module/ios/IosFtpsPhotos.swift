#if KLODA_FTPS_NATIVE
import Foundation
import Photos
import CryptoKit

final class IosFtpsPhotos {
  let profiles: IosFtpsProfiles
  let snapshots: IosFilesSnapshot
  let track: (IosFtpsUpload) throws -> Void
  init(profiles: IosFtpsProfiles, snapshots: IosFilesSnapshot, track: @escaping (IosFtpsUpload) throws -> Void = { _ in }) throws {
    guard snapshots.isFtps else { throw IosFtpsFailure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.track = track
  }
  func run(cancelled: @escaping () -> Bool) throws {
    guard !Thread.isMainThread else { throw IosFtpsFailure(code: "worker_required") }
    let sources = try IosFtpsSources.capture(journal: profiles.journal)
    guard let captured = try profiles.capture() else { throw IosFtpsFailure(code: "profile_missing") }
    let check = {
      guard !cancelled(), try self.profiles.current(captured) else { throw IosFtpsFailure(code: "context_changed") }
      try sources.check(journal: self.profiles.journal)
    }
    var seen = Set<String>()
    let selections = try IosPhotosSource.currentSelections()
    guard Set(selections.map { $0.id.lowercased() }).count == selections.count,
      selections.allSatisfy({ UUID(uuidString: $0.id) != nil }) else { throw IosFtpsFailure(code: "source_unavailable") }
    for selection in selections {
      try check()
      for asset in try IosPhotosSource.assets(selection: selection) where seen.insert(asset.localIdentifier).inserted {
        try publish(asset, selection: selection, captured: captured, check: check)
      }
    }
  }
  private func publish(_ asset: PHAsset, selection: IosPhotosSelection, captured: IosFtpsProfileCapture,
    check: @escaping () throws -> Void) throws {
    let journal = profiles.journal
    let device = try journal.installation()
    let assetId = try journal.photoIdentity("asset", asset.localIdentifier)
    let stamp = try IosPhotosSource.stamp(asset: asset)
    let albums = try stamp.albums.map { try IosPhotoAlbum(id: journal.photoIdentity("album", $0.localIdentifier), name: $0.title) }
    let validate = { try check(); try IosPhotosSource.validate(stamp: stamp); try check(); return true }
    let exported = try IosPhotosSource.export(asset: asset, check: check, snapshots: snapshots)
    let publisher = IosFtpsPublisher(profiles: profiles, snapshots: snapshots, check: check)
    var resources: [IosFtpsPhotoResource] = []
    for resource in exported {
      let path = selection.id + "/media/" + assetId + "/" + resource.role + "/" + resource.sha256 + ".bin"
      let job = IosFtpsUpload(id: String(resource.snapshot.dropLast(9)), installation: device, target: captured.profile.target,
        context: captured.context, source: selection.id, reference: assetId + ":" + resource.role, revision: resource.sha256,
        relativePath: path, snapshot: resource.snapshot, sha256: resource.sha256, size: resource.size, kind: "photo_resource", asset: assetId,
        name: resource.name, logicalPath: assetId + "/" + resource.role, mimeType: resource.mimeType)
      try snapshots.sealStaging(resource.snapshot, sha256: resource.sha256, size: resource.size, cancelled: { (try? check()) == nil })
      let file = try snapshots.open(resource.snapshot, sha256: resource.sha256, size: resource.size, cancelled: { (try? check()) == nil })
      defer { try? file.close() }
      let completed = try publisher.publish(job: job, snapshot: file.fileDescriptor, currentSource: validate, completedSource: validate)
      try track(completed)
      resources.append(IosFtpsPhotoResource(relativePath: completed.relativePath, role: resource.role, name: resource.name,
        mimeType: resource.mimeType, sha256: resource.sha256, size: resource.size))
      try snapshots.discard(resource.snapshot)
    }
    let draft = IosFtpsPhotoManifest(sourceDeviceId: device, assetId: assetId, revision: 1, resources: resources, albums: albums, favorite: stamp.favorite)
    let signature = Data(SHA256.hash(data: try IosFtpsPhotoManifestCodec.encode(draft))).base64EncodedString()
    let revision = try journal.photoRevision(asset: captured.profile.target.archiveId() + ":" + assetId, signature: signature)
    let manifest = IosFtpsPhotoManifest(sourceDeviceId: device, assetId: assetId, revision: revision, resources: resources, albums: albums, favorite: stamp.favorite)
    try IosFtpsPhotoManifestCodec.requireReceipts(manifest, target: captured.profile.target, journal: journal)
    let bytes = try IosFtpsPhotoManifestCodec.encode(manifest)
    let hash = Data(SHA256.hash(data: bytes)).base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    let (snapshot, file) = try snapshots.createStaging()
    defer { try? file.close() }
    try file.write(contentsOf: bytes); try file.synchronize(); try file.close()
    try snapshots.sealStaging(snapshot, sha256: hash, size: Int64(bytes.count), cancelled: { (try? check()) == nil })
    let job = IosFtpsUpload(id: String(snapshot.dropLast(9)), installation: device, target: captured.profile.target, context: captured.context,
      source: selection.id, reference: assetId + ":manifest", revision: String(revision), relativePath: selection.id + "/" + manifest.filename,
      snapshot: snapshot, sha256: hash, size: Int64(bytes.count), kind: "photo_manifest", asset: assetId)
    let descriptor = try snapshots.open(snapshot, sha256: hash, size: Int64(bytes.count), cancelled: { (try? check()) == nil })
    defer { try? descriptor.close() }
    let manifestReceipt = try publisher.publish(job: job, snapshot: descriptor.fileDescriptor, currentSource: validate, completedSource: {
      _ = try validate()
      try IosFtpsPhotoManifestCodec.requireReceipts(manifest, target: captured.profile.target, journal: journal)
      let download = try IosFtpsDownload(profiles: self.profiles, snapshots: self.snapshots, check: { _ = try validate() })
      for resource in resources {
        guard let receipt = try journal.catalogResource(resource, manifest: manifest, target: captured.profile.target) else { throw IosFtpsFailure(code: "manifest_invalid") }
        let staged = try download.stage(receipt.id); try self.snapshots.discard(staged)
      }
      return try validate()
    })
    try track(manifestReceipt)
    try snapshots.discard(snapshot)
  }
}
#endif
