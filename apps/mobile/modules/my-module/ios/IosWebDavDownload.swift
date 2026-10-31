import Foundation
import Darwin

// Restore authority is this device's immutable Completed receipt, never remote discovery/hash equality.
final class IosWebDavDownload {
  let journal: IosWebDavJournal
  let profile: IosWebDavProfile
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  init(journal: IosWebDavJournal, profile: IosWebDavProfile, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) {
    self.journal = journal; self.profile = profile; self.snapshots = snapshots; self.check = check
  }
  func receipt(_ id: String) throws -> IosWebDavUpload {
    try check()
    guard UUID(uuidString: id) != nil, let value = try journal.find(id),
      try value.target == profile.targetId(), value.phase == "completed", value.issue == nil, !value.skipped,
      ["file", "photo_resource", "photo_manifest"].contains(value.kind ?? ""), value.sourceIdentity != nil else { throw IosWebDavFailure.code("review_required") }
    return value
  }
  func stage(_ id: String) throws -> String {
    let value = try receipt(id), path = try journal.publication(value)
    guard snapshots.isWebDav else { throw IosWebDavFailure.code("snapshot_unavailable") }
    let (name, handle) = try snapshots.createStaging()
    var retained = false
    defer { try? handle.close(); if !retained { try? snapshots.discard(name) } }
    let response = try IosWebDavClient.send(profile: profile, path: path, method: "GET", size: value.size,
      receive: { data in try self.check(); try handle.write(contentsOf: data) }, check: check)
    try IosWebDavClient.require(response, [200])
    guard response.sha256 == value.sha256, response.size == value.size else { throw IosWebDavFailure.code("hash_mismatch") }
    guard fsync(handle.fileDescriptor) == 0, fcntl(handle.fileDescriptor, F_FULLFSYNC) == 0 else { throw IosFilesSource.ioFailure() }
    try check()
    let verified = try snapshots.open(name, sha256: value.sha256, size: value.size, cancelled: { (try? self.check()) == nil })
    try verified.close(); try check(); retained = true
    return name
  }
  func manifest(_ id: String) throws -> IosWebDavPhotoManifest {
    let value = try receipt(id)
    guard value.kind == "photo_manifest", value.size <= 65536 else { throw IosWebDavFailure.code("manifest_invalid") }
    let name = try stage(id); defer { try? snapshots.discard(name) }
    let handle = try snapshots.open(name, sha256: value.sha256, size: value.size, cancelled: { (try? self.check()) == nil })
    defer { try? handle.close() }; try handle.seek(toOffset: 0)
    let result = try IosWebDavPhotoManifestCodec.decode(handle.readToEnd() ?? Data())
    try IosWebDavPhotoManifestCodec.requireReceipts(result, target: value.target, journal: journal)
    guard result.filename == (value.relativePath as NSString).lastPathComponent, value.sourceIdentity == "photos:" + result.sourceDeviceId + ":" + result.assetId + ":manifest" else { throw IosWebDavFailure.code("manifest_invalid") }
    try check(); return result
  }
}
