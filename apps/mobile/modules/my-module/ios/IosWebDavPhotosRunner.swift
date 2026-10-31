import Foundation
import Photos
import CryptoKit
import Darwin

final class IosWebDavPhotosRunner {
  let publisher: IosWebDavPublisher
  private(set) var errorCode: String?
  init(publisher: IosWebDavPublisher) { self.publisher = publisher }
  func run() throws {
    var seen = Set<String>()
    for selection in try IosPhotosSource.currentSelections() {
      try publisher.check()
      let assets: [PHAsset]
      do { assets = try IosPhotosSource.assets(selection: selection) }
      catch { errorCode = IosWebDavFilesRunner.code(error); continue }
      for asset in assets where seen.insert(asset.localIdentifier).inserted {
        try publisher.check()
        do { try publish(asset, selection: selection) }
        catch {
          let code = IosWebDavFilesRunner.code(error)
          if ["cancelled", "settings_changed", "connection_unavailable", "storage_failure", "local_storage_full"].contains(code) { throw error }
          errorCode = code
        }
      }
    }
  }
  private func publish(_ asset: PHAsset, selection: IosPhotosSelection) throws {
    let journal = publisher.journal
    let database = journal.database
    let stamp = try IosPhotosSource.stamp(asset: asset)
    let device = try database.photoIdentity("installation", "photos-v1")
    let assetId = try database.photoIdentity("asset", asset.localIdentifier)
    let albums = try IosPhotosSource.albums(asset: asset).map { album in
      try IosPhotoAlbum(id: database.photoIdentity("album", album.localIdentifier), name: album.title)
    }
    let target = try publisher.profile.targetId()
    let exported = try IosPhotosSource.export(asset: asset, check: publisher.check, snapshots: publisher.snapshots)
    func path(_ resource: IosPhotosExportedResource) -> String {
      selection.id + "/" + assetId + "/" + resource.role + "/" + resource.sha256 + "/" + resource.name
    }
    defer {
      for resource in exported {
        // On a journal read failure retain bytes; insertion/ACK uncertainty cannot authorize cleanup.
        if let rows = try? journal.candidates(target: target, source: selection.id, reference: path(resource)),
          !rows.contains(where: { $0.snapshot == resource.snapshot }) { try? publisher.snapshots.discard(resource.snapshot) }
      }
    }
    let draftResources = exported.map { resource in
      IosWebDavPhotoResource(relativePath: path(resource), role: resource.role, name: resource.name,
        mimeType: resource.mimeType, sha256: resource.sha256, size: resource.size)
    }
    let draft = IosWebDavPhotoManifest(sourceDeviceId: device, assetId: assetId, revision: 1,
      resources: draftResources, albums: albums, favorite: asset.isFavorite)
    let signature = IosWebDavClient.encode(Data(SHA256.hash(data: try IosWebDavPhotoManifestCodec.encode(draft))))
    // DAV metadata revisions cannot oscillate the PC sidecar's revision history.
    let revision = try database.photoRevision(asset: "webdav:" + target + ":" + assetId, signature: signature)
    var resources: [IosWebDavPhotoResource] = []
    for resource in exported {
      let remote = path(resource)
      let completed = try publisher.publish(source: selection.id, reference: remote, path: remote, revision: String(revision),
        sha256: resource.sha256, size: resource.size, sourceIdentity: "photos:" + device + ":" + assetId + ":" + resource.role, kind: "photo_resource", prepare: { resource.snapshot },
        validate: { try IosPhotosSource.validate(stamp: stamp); try self.publisher.check() })
      resources.append(IosWebDavPhotoResource(relativePath: try journal.publication(completed), role: resource.role, name: resource.name,
        mimeType: resource.mimeType, sha256: resource.sha256, size: resource.size))
    }
    let manifest = IosWebDavPhotoManifest(sourceDeviceId: device, assetId: assetId, revision: revision,
      resources: resources, albums: albums, favorite: asset.isFavorite)
    try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal)
    let bytes = try IosWebDavPhotoManifestCodec.encode(manifest)
    let hash = IosWebDavClient.encode(Data(SHA256.hash(data: bytes)))
    let remote = selection.id + "/" + manifest.filename
    try publisher.publish(source: selection.id, reference: remote, path: remote, revision: String(revision), sha256: hash, size: Int64(bytes.count), sourceIdentity: "photos:" + device + ":" + assetId + ":manifest", kind: "photo_manifest", prepare: {
      let (name, file) = try self.publisher.snapshots.createStaging()
      do {
        try file.write(contentsOf: bytes); try file.synchronize()
        guard fcntl(file.fileDescriptor, F_FULLFSYNC) == 0 else { throw IosFilesSource.ioFailure() }
        try file.close(); return name
      } catch { try? file.close(); try? self.publisher.snapshots.discard(name); throw error }
    }, validate: {
      try IosPhotosSource.validate(stamp: stamp); try self.publisher.check()
      try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal)
      for resource in resources {
        guard let completed = try journal.photoReceipt(target: target, source: selection.id, path: resource.relativePath,
          identity: "photos:" + device + ":" + assetId + ":" + resource.role, hash: resource.sha256, size: resource.size),
          try self.publisher.transport.inspect(resource.relativePath, completed) == "match" else { throw IosWebDavFailure.code("review_required") }
      }
    })
  }
}
