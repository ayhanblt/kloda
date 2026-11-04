#if KLODA_S3_NATIVE
import Foundation
import Photos
import CryptoKit

final class IosS3Photos {
  let profiles: IosS3Profiles
  let snapshots: IosFilesSnapshot
  let track: (IosS3Job) throws -> Void
  init(profiles: IosS3Profiles, snapshots: IosFilesSnapshot, track: @escaping (IosS3Job) throws -> Void) throws {
    guard snapshots.isS3(profiles.journal.provider) else { throw IosS3Failure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.track = track
  }
  func run(cancelled: @escaping () -> Bool) throws {
    guard !Thread.isMainThread else { throw IosS3Failure(code: "worker_required") }
    let sources = try IosS3Sources.capture(journal: profiles.journal)
    guard let captured = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
    let check = {
      guard !cancelled(), try self.profiles.current(captured) else { throw IosS3Failure(code: "context_changed") }
      try sources.check(journal: self.profiles.journal)
    }
    let selections = try IosPhotosSource.currentSelections()
    guard Set(selections.map { $0.id.lowercased() }).count == selections.count,
      selections.allSatisfy({ UUID(uuidString: $0.id) != nil }) else { throw IosS3Failure(code: "source_unavailable") }
    var seen = Set<String>()
    for selection in selections {
      try check()
      for asset in try IosPhotosSource.assets(selection: selection) where seen.insert(asset.localIdentifier).inserted {
        try publish(asset, selection: selection, captured: captured, sources: sources, check: check)
      }
    }
  }
  private func publish(_ asset: PHAsset, selection: IosPhotosSelection, captured: IosS3Capture, sources: IosS3Sources, check: @escaping () throws -> Void) throws {
    let journal = profiles.journal, device = try journal.installation()
    let assetId = try journal.photoIdentity("asset", asset.localIdentifier), stamp = try IosPhotosSource.stamp(asset: asset)
    let albums = try stamp.albums.map { try IosPhotoAlbum(id: journal.photoIdentity("album", $0.localIdentifier), name: $0.title) }
    let validate = { try check(); try IosPhotosSource.validate(stamp: stamp); try check(); return true }
    func publishStage(_ job: IosS3Job, validateBytes: @escaping () throws -> Void) throws -> IosS3Job {
      if let known = try journal.known(job) {
        let reader = try IosS3Download(profiles: profiles, snapshots: snapshots, check: check)
        let stage = try reader.stage(known.id); try snapshots.discard(stage); try validateBytes(); try track(known); return known
      }
      guard try !journal.unresolved(job) else { throw IosS3Failure(code: "review_required") }
      try snapshots.sealStaging(job.snapshot, sha256: job.sha256, size: job.size, cancelled: { (try? check()) == nil })
      let file = try snapshots.open(job.snapshot, sha256: job.sha256, size: job.size, cancelled: { (try? check()) == nil }); defer { try? file.close() }
      try journal.insert(job)
      try IosS3Publisher(profiles: profiles).publish(job, snapshot: file.fileDescriptor, currentSource: validate, completedSource: validateBytes)
      try track(job); return job
    }
    let exported = try IosPhotosSource.export(asset: asset, check: check, snapshots: snapshots)
    var resources: [IosS3PhotoResource] = []
    for resource in exported {
      let id = String(resource.snapshot.dropLast(9))
      let job = IosS3Job(id: id, installation: device, context: captured.context, target: captured.profile.target, source: selection.id.lowercased(),
        reference: assetId + ":" + resource.role, revision: resource.sha256, sourceGeneration: sources.binding, snapshot: resource.snapshot,
        key: "objects/" + device + "/" + id, sha256: resource.sha256, size: resource.size, name: resource.name,
        logicalPath: assetId + "/" + resource.role, kind: "photo_resource", asset: assetId, mimeType: resource.mimeType)
      let completed = try publishStage(job, validateBytes: { _ = try validate() })
      resources.append(IosS3PhotoResource(relativePath: completed.key, role: resource.role, name: resource.name, mimeType: resource.mimeType, sha256: resource.sha256, size: resource.size))
      try snapshots.discard(resource.snapshot)
    }
    let draft = IosS3PhotoManifest(sourceDeviceId: device, assetId: assetId, revision: 1, resources: resources, albums: albums, favorite: stamp.favorite)
    let signature = Data(SHA256.hash(data: try IosS3PhotoManifestCodec.encode(draft))).base64EncodedString()
    let revision = try journal.photoRevision(asset: captured.profile.target.archiveId() + ":" + assetId, signature: signature)
    let manifest = IosS3PhotoManifest(sourceDeviceId: device, assetId: assetId, revision: revision, resources: resources, albums: albums, favorite: stamp.favorite)
    try IosS3PhotoManifestCodec.requireReceipts(manifest, target: captured.profile.target, journal: journal)
    let bytes = try IosS3PhotoManifestCodec.encode(manifest)
    let (snapshot, metadataFile) = try snapshots.createStaging(); defer { try? metadataFile.close() }
    try metadataFile.write(contentsOf: bytes); try metadataFile.synchronize(); try metadataFile.close()
    let id = String(snapshot.dropLast(9))
    let job = IosS3Job(id: id, installation: device, context: captured.context, target: captured.profile.target, source: selection.id.lowercased(),
      reference: assetId + ":manifest", revision: String(revision), sourceGeneration: sources.binding, snapshot: snapshot, key: "objects/" + device + "/" + id,
      sha256: IosS3Target.hash(bytes), size: Int64(bytes.count), name: manifest.filename, logicalPath: assetId + "/" + manifest.filename, kind: "photo_manifest", asset: assetId, mimeType: "application/json")
    _ = try publishStage(job, validateBytes: {
      _ = try validate(); try IosS3PhotoManifestCodec.requireReceipts(manifest, target: captured.profile.target, journal: journal)
      let reader = try IosS3Download(profiles: self.profiles, snapshots: self.snapshots, check: check)
      for resource in resources {
        guard let own = try journal.catalogResource(resource, manifest: manifest, target: captured.profile.target) else { throw IosS3Failure(code: "manifest_invalid") }
        let stage = try reader.stage(own.id); try self.snapshots.discard(stage)
      }
      _ = try validate()
    })
    try snapshots.discard(snapshot)
  }
}
#endif
