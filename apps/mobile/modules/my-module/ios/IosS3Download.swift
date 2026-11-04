#if KLODA_S3_NATIVE
import Foundation
import Darwin

final class IosS3Download {
  let profiles: IosS3Profiles
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  init(profiles: IosS3Profiles, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) throws {
    guard snapshots.isS3(profiles.journal.provider) else { throw IosS3Failure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.check = check
  }
  func receipt(_ id: String) throws -> IosS3Job {
    try check()
    guard let capture = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
    return try profiles.journal.receipt(id, target: capture.profile.target)
  }
  func manifest(_ id: String) throws -> IosS3PhotoManifest {
    let job = try receipt(id)
    guard job.kind == "photo_manifest", job.size <= 65536 else { throw IosS3Failure(code: "manifest_invalid") }
    let stage = try self.stage(id); defer { try? snapshots.discard(stage) }
    let url = try snapshots.verifiedURL(stage, sha256: job.sha256, size: job.size, check: check)
    let manifest = try IosS3PhotoManifestCodec.decode(Data(contentsOf: url))
    guard manifest.assetId == job.asset, manifest.sourceDeviceId == job.installation, String(manifest.revision) == job.revision else { throw IosS3Failure(code: "manifest_invalid") }
    try IosS3PhotoManifestCodec.requireReceipts(manifest, target: job.target, journal: profiles.journal); return manifest
  }
  func stage(_ id: String) throws -> String {
    try check()
    guard let capture = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
    let job = try profiles.journal.receipt(id, target: capture.profile.target)
    let acks = try profiles.journal.events(job, kind: "complete-ack")
    guard acks.count == 1 else { throw IosS3Failure(code: "receipt_missing") }
    var operation: [String: Any] = ["kind": "get", "version": NSNull()]
    if let version = acks[0]["version"] as? String { operation["version"] = version }
    func current() throws { try check(); guard try profiles.current(capture) else { throw IosS3Failure(code: "context_changed") } }
    let (name, file) = try snapshots.createStaging(); defer { try? file.close() }
    var retained = false
    defer { if !retained { try? snapshots.discard(name) } }
    let reply = try IosS3Client.send(profile: capture.profile, key: job.key, operation: operation, maximum: job.size, receive: { data in
      try current(); try file.write(contentsOf: data)
    }, check: current)
    guard reply.status == 200, reply.size == job.size, reply.sha256 == job.sha256 else { throw IosS3Failure(code: "verification_failed") }
    try current(); try file.synchronize(); try snapshots.sealStaging(name, sha256: job.sha256, size: job.size, cancelled: { (try? current()) == nil })
    retained = true; return name
  }
}
#endif
