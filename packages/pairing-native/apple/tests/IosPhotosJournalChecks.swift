import Foundation
import CryptoKit

@main enum IosPhotosJournalChecks {
  static func ensure(_ value: Bool) { precondition(value) }
  static func main() throws {
    let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    let phase = CommandLine.arguments[2]
    let journal = try IosSyncJournal(databaseURL: root.appendingPathComponent("journal.sqlite"))
    let resource = IosPhotoResource(operationId: String(repeating: "A", count: 22), role: "original", name: "fixture.png",
      mimeType: "image/png", sha256: String(repeating: "A", count: 43), size: 0)
    let manifest = IosPhotoManifest(sourceDeviceId: "source", assetId: "asset", revision: 1, resources: [resource], albums: [], favorite: true)
    let data = try IosPhotoManifestCodec.encode(manifest)
    let identifier = IosFilesTransfer.identifier()
    var typed = IosFilesJob(id: identifier, sourceId: "source", reference: "photo:notes.txt", revision: "revision",
      recordId: identifier, wireSourceId: identifier, requestId: identifier, name: "notes.txt", sha256: resource.sha256,
      size: 0, snapshot: "owned.snapshot", identity: identifier)
    try typed.validate(); ensure(!typed.isPhotos)
    typed.reference = IosFilesJob.photosReferencePrefix + "asset:resource-1"
    try typed.validate(); ensure(typed.isPhotos)
    let identity = try journal.photoIdentity("asset", "opaque-local-asset")
    if phase == "seed" {
      ensure(try journal.photoIdentity("asset", "opaque-local-asset") == identity)
      ensure(try journal.photoIdentity("album", "opaque-local-asset") != identity)
      ensure(try journal.photoRevision(asset: identity, signature: "first") == 1)
      ensure(try journal.photoRevision(asset: identity, signature: "first") == 1)
      ensure(try journal.photoRevision(asset: identity, signature: "changed") == 2)
      try journal.savePhotoImport(IosPhotoImport(key: "known", manifest: data, target: "own-target", state: "creating"))
      try journal.savePhotoImport(IosPhotoImport(key: "unknown", manifest: data, state: "creating"))
      try identity.write(to: root.appendingPathComponent("identity"), atomically: true, encoding: .utf8)
      do {
        try journal.savePhotoImport(IosPhotoImport(key: "invalid-completed", manifest: data, state: "completed"))
        fatalError("completed without target allowed")
      } catch {}
      var current = try journal.photoImport("known")!
      current.target = "other-target"
      do { try journal.savePhotoImport(current); fatalError("retarget allowed") } catch {}
      current = try journal.photoImport("known")!; current.state = "prepared"
      do { try journal.savePhotoImport(current); fatalError("create replay allowed") } catch {}
      let changed = IosPhotoManifest(sourceDeviceId: "source", assetId: "asset", revision: 2, resources: [resource], albums: [], favorite: false)
      let replacement = try IosPhotoImport(key: "known", manifest: IosPhotoManifestCodec.encode(changed), target: "own-target", state: "completed")
      do { try journal.savePhotoImport(replacement); fatalError("manifest replacement allowed") } catch {}
    } else {
      ensure(identity == (try String(contentsOf: root.appendingPathComponent("identity"), encoding: .utf8)))
      ensure(try journal.photoRevision(asset: identity, signature: "changed") == 2)
      ensure(try journal.photoImport("known")?.target == "own-target")
      ensure(try journal.photoImport("unknown")?.target == nil)
    }
    let status = try journal.photoImportStatus()
    precondition(status["state"] as? String == "review_required")
    precondition(status["total"] as? String == "2" && status["completed"] as? String == "0" && status["review"] as? String == "2")
    print("IOS_PHOTOS_JOURNAL_PASS phase=\(phase) retained_identity=true uncertain_not_completed=true")
  }
}
