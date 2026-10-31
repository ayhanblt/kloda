import Foundation
import Photos

// Review reads the currently selected native source; an old snapshot alone is not current source proof.
final class IosWebDavSourceValidation {
  let journal: IosWebDavJournal
  let snapshots: IosFilesSnapshot
  let transport: IosWebDavTransport
  let check: () throws -> Void
  init(journal: IosWebDavJournal, snapshots: IosFilesSnapshot, transport: IosWebDavTransport, check: @escaping () throws -> Void) {
    self.journal = journal; self.snapshots = snapshots; self.transport = transport; self.check = check
  }
  func validate(_ value: IosWebDavUpload) throws {
    try check()
    if value.kind == "file" { try file(value); return }
    guard ["photo_resource", "photo_manifest"].contains(value.kind ?? ""), let identity = value.sourceIdentity else { throw IosWebDavFailure.code("source_identity_unknown") }
    let parts = identity.components(separatedBy: ":")
    guard parts.count == 4, parts[0] == "photos", try journal.database.photoIdentity("installation", "photos-v1") == parts[1],
      let selection = try IosPhotosSource.currentSelections().first(where: { $0.id == value.source }) else { throw IosWebDavFailure.code("source_changed") }
    var selected: PHAsset?
    for asset in try IosPhotosSource.assets(selection: selection) {
      try check()
      if try journal.database.photoIdentity("asset", asset.localIdentifier) == parts[2] { selected = asset; break }
    }
    guard let asset = selected else { throw IosWebDavFailure.code("source_changed") }
    let stamp = try IosPhotosSource.stamp(asset: asset)
    let exported = try IosPhotosSource.export(asset: asset, check: check, snapshots: snapshots)
    defer { exported.forEach { try? snapshots.discard($0.snapshot) } }
    if value.kind == "photo_resource" {
      guard exported.contains(where: { $0.role == parts[3] && $0.sha256 == value.sha256 && $0.size == value.size &&
        $0.name == (value.relativePath as NSString).lastPathComponent }) else { throw IosWebDavFailure.code("source_changed") }
    } else {
      guard parts[3] == "manifest", value.size <= 65536 else { throw IosWebDavFailure.code("manifest_invalid") }
      let file = try snapshots.open(value.snapshot, sha256: value.sha256, size: value.size, cancelled: { (try? self.check()) == nil })
      defer { try? file.close() }; try file.seek(toOffset: 0)
      let manifest = try IosWebDavPhotoManifestCodec.decode(file.readToEnd() ?? Data())
      let albums = try IosPhotosSource.albums(asset: asset).map { IosPhotoAlbum(id: try journal.database.photoIdentity("album", $0.localIdentifier), name: $0.title) }
      guard manifest.sourceDeviceId == parts[1], manifest.assetId == parts[2], manifest.favorite == asset.isFavorite,
        manifest.albums.sorted(by: { $0.id < $1.id }) == albums.sorted(by: { $0.id < $1.id }), manifest.resources.count == exported.count,
        manifest.resources.allSatisfy({ expected in exported.contains { $0.role == expected.role && $0.name == expected.name &&
          $0.mimeType == expected.mimeType && $0.sha256 == expected.sha256 && $0.size == expected.size } }) else { throw IosWebDavFailure.code("source_changed") }
      try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: value.target, journal: journal)
      for resource in manifest.resources {
        guard let receipt = try journal.photoReceipt(target: value.target, source: value.source, path: resource.relativePath,
          identity: "photos:" + parts[1] + ":" + parts[2] + ":" + resource.role, hash: resource.sha256, size: resource.size),
          try transport.inspect(resource.relativePath, receipt) == "match" else { throw IosWebDavFailure.code("review_required") }
      }
    }
    try IosPhotosSource.validate(stamp: stamp); try check()
  }
  private func file(_ value: IosWebDavUpload) throws {
    guard let source = try IosFilesSelection.current().first(where: { $0.id == value.source }),
      let file = try IosSourceScanner().scanDirectory(bookmark: source.bookmark).first(where: { $0.reference == value.reference }),
      value.relativePath == source.id + "/" + file.relativePath else { throw IosWebDavFailure.code("source_changed") }
    let cancelled = { (try? self.check()) == nil }
    try IosFilesSource.read(bookmark: source.bookmark, file: file, cancelled: cancelled) { descriptor, _, wire in
      guard value.sourceIdentity == "files:" + wire else { throw IosWebDavFailure.code("source_identity_unknown") }
      let (hash, size) = try IosFilesSource.hash(descriptor, maxBytes: value.size, cancelled: cancelled)
      guard hash == value.sha256, size == value.size else { throw IosWebDavFailure.code("source_changed") }
    }
    try check()
  }
}
