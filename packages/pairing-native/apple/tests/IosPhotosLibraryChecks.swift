import UIKit
import Photos
import CryptoKit
import Darwin

// Disposable Simulator app only. No native owner, production key or network is opened.
@main final class IosPhotosLibraryChecks: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    window = UIWindow(frame: UIScreen.main.bounds); window?.rootViewController = UIViewController(); window?.makeKeyAndVisible()
    DispatchQueue.global().async {
      let phase = ProcessInfo.processInfo.arguments.contains("video") ? "video" : ProcessInfo.processInfo.arguments.contains("reopen") ? "reopen" : ProcessInfo.processInfo.arguments.contains("pathcheck") ? "pathcheck" : "seed"
      do {
        Self.result(["state": "RUNNING", "phase": phase])
        try Self.run(phase)
        Self.result(["state": "PASS", "phase": phase])
      } catch { Self.result(["state": "FAIL", "phase": phase, "error": String(describing: error), "checkpoint": UserDefaults.standard.string(forKey: "fixture.checkpoint") ?? "start"]) }
    }
    return true
  }
  static func result(_ value: [String: String]) {
    let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("result.json")
    try? JSONSerialization.data(withJSONObject: value, options: .sortedKeys).write(to: url, options: .atomic)
  }
  static func require(_ value: Bool, _ tag: String) throws {
    if !value { throw NSError(domain: "PhotoChecks", code: 1, userInfo: [NSLocalizedDescriptionKey: tag]) }
  }
  static func run(_ phase: String) throws {
    let ready = DispatchSemaphore(value: 0)
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in ready.signal() }
    _ = ready.wait(timeout: .now() + 10)
    let authorization = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    try require(authorization == .authorized, "full permission raw=\(authorization.rawValue)")
    let journal = try IosSyncJournal(), snapshots = try IosFilesSnapshot()
    if phase == "video" { try runVideo(); return }
    let defaults = UserDefaults.standard
    if phase == "pathcheck" {
      let image = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 16)).pngData { context in
        UIColor.blue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 16, height: 16))
      }
      let (name, file) = try snapshots.createStaging(); try file.write(contentsOf: image); try file.synchronize(); try file.close()
      let url = try snapshots.verifiedURL(name, sha256: IosFilesTransfer.encode(Data(SHA256.hash(data: image))), size: Int64(image.count), check: {})
      let named = url.deletingPathExtension().appendingPathExtension("png")
      try image.write(to: named, options: .withoutOverwriting)
      try FileManager.default.setAttributes([.posixPermissions: 0o600, .protectionKey: FileProtectionType.complete], ofItemAtPath: named.path)
      try PHPhotoLibrary.shared().performChangesAndWait {
        let request = PHAssetCreationRequest.forAsset()
        let options = PHAssetResourceCreationOptions(); options.originalFilename = "seed.png"; options.uniformTypeIdentifier = "public.png"
        request.addResource(with: .photo, fileURL: named, options: options)
      }
      try FileManager.default.removeItem(at: named); try snapshots.discard(name)
      return
    }
    if phase == "reopen" {
      let key = defaults.string(forKey: "fixture.import")!
      let intent = try journal.photoImport(key)!
      let before = PHAsset.fetchAssets(with: nil).count
      try IosPhotosImport.verify(intent: intent, journal: journal, check: {})
      let manifest = try IosPhotoManifestCodec.decode(intent.manifest)
      try IosPhotosImport.importManifest(manifest: manifest, stages: [:], journal: journal, check: {})
      try require(PHAsset.fetchAssets(with: nil).count == before, "reopen duplicate")
      try require(try journal.photoImportStatus()["state"] as? String == "review_required", "reopen ambiguity retained")
      let all = try journal.filesJobs()
      let record = defaults.string(forKey: "fixture.record")!
      let pc = FixturePC()
      for job in all where job.recordId == record {
        if let operation = job.operationId {
          pc.operations[operation] = ["id": operation, "requestId": job.requestId, "sourceId": job.wireSourceId,
            "sourceRevision": job.sha256, "name": job.name, "sha256": job.sha256, "size": job.size,
            "offset": job.acknowledged, "state": "completed"]
          if job.state == "owner_deleted" { pc.deleted.insert(operation) }
        }
      }
      let sender = IosPhotosRunner(connection: pc.connection, check: {})
      try sender.run(record: record, rebackup: nil)
      try require(pc.creates == 0 && (try journal.filesJobs()).count == all.count, "reopen canonical revision")
      try require(sender.errorCode != nil, "pending history hidden")
      return
    }
    // A freshly-created Simulator includes six Apple sample photos. Never read or modify them.
    let baseline = PHAsset.fetchAssets(with: nil).count
    defaults.set(baseline, forKey: "fixture.baseline")
    let image = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 16)).pngData { context in
      UIColor.red.setFill(); context.fill(CGRect(x: 0, y: 0, width: 16, height: 16))
    }
    let (seed, file) = try snapshots.createStaging(); try file.write(contentsOf: image); try file.synchronize(); try file.close()
    let hash = IosFilesTransfer.encode(Data(SHA256.hash(data: image)))
    _ = try snapshots.verifiedURL(seed, sha256: hash, size: Int64(image.count), check: {})
    defaults.set("source-create", forKey: "fixture.checkpoint")
    var sourceID = "", sourceAlbum = ""
    try PHPhotoLibrary.shared().performChangesAndWait {
      let asset = PHAssetCreationRequest.forAsset()
      let options = PHAssetResourceCreationOptions(); options.originalFilename = "seed.png"
      options.uniformTypeIdentifier = "public.png"
      asset.addResource(with: .photo, data: image, options: options); asset.isFavorite = true
      sourceID = asset.placeholderForCreatedAsset!.localIdentifier
      let album = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: "Fixture album")
      sourceAlbum = album.placeholderForCreatedAssetCollection.localIdentifier
      album.addAssets([asset.placeholderForCreatedAsset!] as NSArray)
    }
    defaults.set([["id": "fixture-source", "reference": sourceAlbum, "displayName": "Fixture album", "kind": "photos"]], forKey: "kloda.sync.photoSources")
    let source = PHAsset.fetchAssets(withLocalIdentifiers: [sourceID], options: nil).firstObject!
    let stamp = try IosPhotosSource.stamp(asset: source)
    defaults.set("source-export", forKey: "fixture.checkpoint")
    let exported = try IosPhotosSource.export(asset: source, check: {}, snapshots: snapshots)
    try require(exported.count == 1 && exported[0].sha256 == hash && exported[0].size == image.count, "original bytes")
    let record = IosFilesTransfer.identifier(), pc = FixturePC()
    defaults.set(record, forKey: "fixture.record")
    defaults.set("sender-initial", forKey: "fixture.checkpoint")
    pc.loseFinalizeOnce = true
    let sender = IosPhotosRunner(connection: pc.connection, check: {})
    try sender.run(record: record, rebackup: nil)
    try require(sender.errorCode == "outcome_unknown", "lost finalize remains uncertain")
    try require(try journal.filesJobs().filter { $0.recordId == record }.allSatisfy { $0.state != "completed" }, "unknown marked completed")
    try sender.run(record: record, rebackup: nil)
    try require(sender.errorCode == nil, "sender result \(sender.errorCode ?? "none")")
    let firstJobs = try journal.filesJobs().filter { $0.recordId == record }
    try require(firstJobs.count == 2 && firstJobs.allSatisfy { $0.state == "completed" }, "resource and sidecar completed")
    let sidecar = firstJobs.first { $0.name.hasPrefix(IosPhotoManifestCodec.prefix) }!
    let payload = pc.payloads[sidecar.operationId!]!
    let manifest = try IosPhotoManifestCodec.decode(payload)
    try require(manifest.resources.count == 1 && manifest.favorite == true && manifest.albums.count == 1, "manifest metadata")
    // Ordinary repeat uploads neither bytes nor extra operations.
    let initialCreates = pc.creates
    try sender.run(record: record, rebackup: nil)
    try require(pc.creates == initialCreates, "repeat upload")
    // Desktop deletion suppresses only this version; a new explicit attempt may recover it.
    defaults.set("version-delete", forKey: "fixture.checkpoint")
    pc.deleted.insert(sidecar.operationId!)
    try sender.run(record: record, rebackup: nil)
    try require(pc.creates == initialCreates, "deleted version recreated")
    let removed = try journal.fileJob(id: sidecar.id)!
    try require(removed.state == "owner_deleted", "durable tombstone")
    defaults.set("explicit-rebackup", forKey: "fixture.checkpoint")
    try sender.run(record: record, rebackup: removed.id)
    try require(sender.errorCode == nil && pc.creates == initialCreates + 1, "explicit rebackup shared resource")
    // Import never treats source opaque ID as a target asset ID or adopts the equal-title source album.
    let stage = try snapshots.verifiedURL(exported[0].snapshot, sha256: exported[0].sha256, size: exported[0].size, check: {})
    defaults.set("import", forKey: "fixture.checkpoint")
    try IosPhotosImport.importManifest(manifest: manifest, stages: [manifest.resources[0].operationId: stage], journal: journal, check: {})
    let key = try IosSyncJournal.photoKey([manifest.sourceDeviceId, manifest.assetId])
    var intent = try journal.photoImport(key)!
    defaults.set(key, forKey: "fixture.import")
    try require(intent.state == "completed" && intent.target != sourceID, "import receipt")
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 2, "one imported asset")
    let albumKey = try IosSyncJournal.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])
    try require(try journal.photoText("SELECT target FROM photos_album WHERE key=?", [albumKey]) != sourceAlbum, "no title adoption")
    // Lost local success receipt rechecks the known PhotoKit ID instead of creating again.
    defaults.set("lost-import-receipt", forKey: "fixture.checkpoint")
    intent.state = "creating"; try journal.savePhotoImport(intent)
    try IosPhotosImport.importManifest(manifest: manifest, stages: [:], journal: journal, check: {})
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 2, "lost response duplicate")
    try require(try journal.photoImport(key)?.state == "completed", "lost receipt reconciled")
    // A source change is not silently finalized from stale metadata.
    defaults.set("metadata-version", forKey: "fixture.checkpoint")
    try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest(for: source).isFavorite = false }
    do { try IosPhotosSource.validate(stamp: stamp); throw NSError(domain: "PhotoChecks", code: 2) }
    catch IosPairingFailure.native(let code) { try require(code == "source_changed", "changed source error") }
    try sender.run(record: record, rebackup: nil)
    try require(sender.errorCode == nil && pc.creates == initialCreates + 2, "metadata version retains shared resource")
    defaults.set("own-download", forKey: "fixture.checkpoint")
    let live = try journal.filesJobs().first { $0.recordId == record && $0.name == sidecar.name && $0.state == "completed" }!
    func download(all: Bool = false) throws -> Result<[String: Any]?, IosPairingFailure> {
      let ready = DispatchSemaphore(value: 0)
      var result: Result<[String: Any]?, IosPairingFailure>?
      IosPhotosRestore().restore(record: record,
        backup: all ? nil : IosOwnBackup(id: live.operationId!, name: live.name, sha256: live.sha256, size: live.size),
        session: KlodaPairingSession(fixture: pc.connection)) { value in result = value; ready.signal() }
      try require(ready.wait(timeout: .now() + 20) == .success, "own download callback")
      return result!
    }
    pc.loseRestoreOnce = true
    do { _ = try download().get(); throw NSError(domain: "PhotoChecks", code: 5) }
    catch IosPairingFailure.native(let code) { try require(code == "outcome_unknown", "lost restore response") }
    _ = try download().get()
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 2, "own download duplicate")
    let bulkDevice = "bulk-" + IosFilesTransfer.identifier()
    let oldVersion = IosPhotoManifest(sourceDeviceId: bulkDevice, assetId: "asset", revision: 1,
      resources: manifest.resources, albums: [], favorite: false)
    let latestVersion = IosPhotoManifest(sourceDeviceId: bulkDevice, assetId: "asset", revision: 2,
      resources: manifest.resources, albums: [], favorite: true)
    try pc.addCompleted(oldVersion); try pc.addCompleted(latestVersion)
    defaults.set("bulk-latest", forKey: "fixture.checkpoint")
    do { _ = try download(all: true).get(); throw NSError(domain: "PhotoChecks", code: 6) }
    catch IosPairingFailure.native(let code) { try require(code == "review_required", "bulk preserves old-target review") }
    let bulkKey = try IosSyncJournal.photoKey([bulkDevice, "asset"])
    let bulk = try journal.photoImport(bulkKey)!
    let bulkManifest = try IosPhotoManifestCodec.decode(bulk.manifest)
    try require(bulk.state == "completed" && bulkManifest.revision == 2, "bulk latest selection")
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 3, "bulk imported multiple versions")
    defaults.set("ambiguous-result", forKey: "fixture.checkpoint")
    let ambiguous = IosPhotoManifest(sourceDeviceId: manifest.sourceDeviceId, assetId: "ambiguous-" + IosFilesTransfer.identifier(), revision: 1,
      resources: manifest.resources, albums: [], favorite: nil)
    let ambiguousKey = try IosSyncJournal.photoKey([ambiguous.sourceDeviceId, ambiguous.assetId])
    try journal.savePhotoImport(IosPhotoImport(key: ambiguousKey, manifest: IosPhotoManifestCodec.encode(ambiguous), state: "creating"))
    do { try IosPhotosImport.importManifest(manifest: ambiguous, stages: [:], journal: journal, check: {})
      throw NSError(domain: "PhotoChecks", code: 3)
    } catch IosPairingFailure.native(let code) { try require(code == "review_required", "unknown target review") }
    try require(PHAsset.fetchAssets(with: nil).count == baseline + 3, "unknown result duplicate")
    defaults.set("settings-context", forKey: "fixture.checkpoint")
    let originalSelection = defaults.array(forKey: "kloda.sync.photoSources")!
    let contextRecord = IosFilesTransfer.identifier(), contextPC = FixturePC()
    contextPC.loseChunkOnce = true
    let contextSender = IosPhotosRunner(connection: contextPC.connection, check: {})
    try contextSender.run(record: contextRecord, rebackup: nil)
    let oldContext = try journal.filesJobs().first { $0.recordId == contextRecord }!
    try require(oldContext.state == "blocked", "old context interrupted")
    defaults.set([["id": "fixture-reselected", "reference": sourceAlbum, "displayName": "Fixture album", "kind": "photos"]], forKey: "kloda.sync.photoSources")
    defer { defaults.set(originalSelection, forKey: "kloda.sync.photoSources") }
    try contextSender.run(record: contextRecord, rebackup: nil)
    let contextual = try journal.filesJobs().filter { $0.recordId == contextRecord }
    try require(contextual.filter { $0.sourceId == "fixture-reselected" && $0.state == "completed" }.count == 2, "new context blocked by old job")
    let stopped = try journal.fileJob(id: oldContext.id)!
    try require(stopped.state == "paused" && stopped.errorCode == "settings_changed", "old context resumed")
    try require(contextPC.operations[oldContext.operationId!]?["offset"] as? Int64 == 0, "old operation written after settings change")
    defaults.set(originalSelection, forKey: "kloda.sync.photoSources")
    defaults.set("pending-membership", forKey: "fixture.checkpoint")
    for (sourceId, reference) in [("removed-source", "/photos:gone:manifest"), ("fixture-source", "/photos:missing:manifest")] {
      let id = IosFilesTransfer.identifier(), (name, file) = try snapshots.createStaging(); try file.close()
      let pending = IosFilesJob(id: id, sourceId: sourceId, reference: reference, revision: "1", recordId: record,
        wireSourceId: IosFilesTransfer.identifier(), requestId: id, name: "missing.json",
        sha256: IosFilesTransfer.encode(Data(SHA256.hash(data: Data()))), size: 0, snapshot: name, state: "paused", identity: id)
      try journal.saveFileJob(pending)
      try sender.run(record: record, rebackup: nil)
      let value = try journal.fileJob(id: id)!
      try require(value.state == "paused" && value.errorCode == (sourceId == "removed-source" ? "settings_changed" : "source_unavailable"), "pending membership")
      try require(sender.errorCode != nil, "incomplete history hidden")
    }
    for value in exported { try snapshots.discard(value.snapshot) }
    try snapshots.discard(seed)
  }
}

private final class FixturePC {
  var operations: [String: [String: Any]] = [:]
  var requests: [String: String] = [:]
  var payloads: [String: Data] = [:]
  var deleted = Set<String>()
  var creates = 0
  var loseFinalizeOnce = false
  var loseRestoreOnce = false
  var loseChunkOnce = false
  var connection: IosFilesConnection { IosFilesConnection(check: {}, send: { try self.send($0, fd: $1) }) }
  func addCompleted(_ manifest: IosPhotoManifest) throws {
    let payload = try IosPhotoManifestCodec.encode(manifest), id = IosFilesTransfer.identifier()
    let hash = IosFilesTransfer.encode(Data(SHA256.hash(data: payload)))
    operations[id] = ["id": id, "requestId": IosFilesTransfer.identifier(), "sourceId": IosFilesTransfer.identifier(),
      "sourceRevision": hash, "name": manifest.filename, "sha256": hash, "size": Int64(payload.count),
      "offset": Int64(payload.count), "state": "completed"]
    payloads[id] = payload
  }
  func send(_ command: [String: Any], fd: Int32) throws -> [String: Any] {
    let kind = command["kind"] as! String
    if kind == "list" {
      let after = command["after"] as? String ?? ""
      return ["status": 200, "photos": operations.keys.sorted().filter { $0 > after && !deleted.contains($0)
        && operations[$0]?["state"] as? String == "completed" }.prefix(32).map { operations[$0]! }]
    }
    if kind == "create" {
      let upload = command["upload"] as! [String: Any], request = upload["requestId"] as! String
      if let id = requests[request] { return ["status": 200, "operation": operations[id]!] }
      var value = upload; value.removeValue(forKey: "rebackupOf")
      let id = IosFilesTransfer.identifier()
      value["id"] = id; value["offset"] = Int64(0); value["state"] = "receiving"
      operations[id] = value; requests[request] = id; payloads[id] = Data(); creates += 1
      return ["status": 200, "operation": value]
    }
    let id = command["id"] as! String
    if deleted.contains(id) { return ["status": 409, "errorCode": "owner_deleted"] }
    guard var value = operations[id] else { return ["status": 404, "errorCode": "not_found"] }
    if kind == "restore" {
      let offset = command["offset"] as! Int64, all = payloads[id]!
      let data = all.subdata(in: Int(offset)..<min(all.count, Int(offset) + 65_536))
      let written = data.withUnsafeBytes { pwrite(fd, $0.baseAddress, $0.count, off_t(offset)) }
      try IosPhotosLibraryChecks.require(written == data.count, "fixture restore exact write")
      if loseRestoreOnce { loseRestoreOnce = false; throw IosPairingFailure.native("outcome_unknown") }
      return ["status": 200, "bytes": Int64(written), "offset": offset, "size": Int64(all.count)]
    }
    if kind == "chunk" {
      if loseChunkOnce { loseChunkOnce = false; throw IosPairingFailure.native("outcome_unknown") }
      let offset = command["offset"] as! Int64, length = command["length"] as! Int64
      var data = Data(count: Int(length))
      let count = data.withUnsafeMutableBytes { pread(fd, $0.baseAddress, $0.count, off_t(offset)) }
      try IosPhotosLibraryChecks.require(count == length, "fixture exact chunk")
      payloads[id]!.append(data); value["offset"] = offset + length
    }
    if kind == "finalize" { value["state"] = "completed" }
    operations[id] = value
    if kind == "finalize" && loseFinalizeOnce { loseFinalizeOnce = false; throw IosPairingFailure.native("outcome_unknown") }
    return ["status": 200, "operation": value]
  }
}
