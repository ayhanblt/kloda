import Foundation

// ADR0029 29/4: imported receipts through the production download (restore authority, staging, Kloda's SHA-256)
// against the old device's catalog and files in the in-memory destination. The 29/3 delta cases are not repeated;
// these are their restore consequences plus altered/injected remote files, wrong code and interruption.
enum IosRecoveryRestoreChecks {
  static func run(url: URL, origin: IosWebDavJournal, remote: MemoryDestination, old: IosRecoveryCatalog.Keys, target: String, source: String) throws {
    let base = url.deletingLastPathComponent()
    let snapshots = try IosFilesSnapshot(directoryURL: base.appendingPathComponent("kloda-webdav-snapshots", isDirectory: true))
    func count() -> Int { (try? FileManager.default.contentsOfDirectory(atPath: base.appendingPathComponent("kloda-webdav-snapshots").path).count) ?? -1 }
    let baseline = count()
    func staged() -> Int { count() - baseline }
    func journal() throws -> IosWebDavJournal {
      try IosWebDavJournal(database: IosSyncJournal(databaseURL: base.appendingPathComponent("restore-\(UUID().uuidString).sqlite")))
    }
    let fresh = IosRecoveryCatalogChecks.sha("restore-device-target"), installation = try origin.catalogInstallation()
    let folder = IosRecoveryCatalog.folder(installation: installation, chain: old.chain, target: target)
    let twinFolder = IosRecoveryCatalog.folder(installation: installation, chain: old.chain, target: IosRecoveryCatalogChecks.sha("twin-target"))

    // The old device's files beside its chain (a.txt, b.txt; c.txt), plus an authentic photo delta 3.
    let files = MemoryDestination()
    files.files = remote.files.filter { $0.key.hasPrefix(folder + "/") }
    for name in ["a.txt", "b.txt", "c.txt"] { files.files[source + "/" + name] = Data(name.utf8) }
    let photo = Data("photo-bytes".utf8), photoPath = source + "/photos/p.jpg"
    let resource = IosWebDavPhotoResource(relativePath: photoPath, role: "original", name: "p.jpg", mimeType: "image/jpeg",
      sha256: IosRecoveryCatalog.digest(photo), size: Int64(photo.count))
    let manifest = IosWebDavPhotoManifest(sourceDeviceId: "old-device", assetId: "asset1", revision: 1, resources: [resource], albums: [], favorite: nil)
    let manifestBytes = try IosWebDavPhotoManifestCodec.encode(manifest), manifestPath = source + "/photos/" + manifest.filename
    files.files[photoPath] = photo; files.files[manifestPath] = manifestBytes
    let resourceEntry = IosRecoveryCatalog.Entry(job: "", path: photoPath, sha256: resource.sha256, size: resource.size, kind: "photo_resource",
      identity: "photos:old-device:asset1:original", completed: nil)
    let manifestEntry = IosRecoveryCatalog.Entry(job: "", path: manifestPath, sha256: IosRecoveryCatalog.digest(manifestBytes),
      size: Int64(manifestBytes.count), kind: "photo_manifest", identity: "photos:old-device:asset1:manifest", completed: nil)
    func delta3(_ entries: [IosRecoveryCatalog.Entry], into copy: MemoryDestination) throws {
      copy.files[folder + "/3.json"] = try IosRecoveryCatalog.encode(keys: old, installation: installation, target: target, sequence: 3,
        previous: IosRecoveryCatalog.digest(copy.files[folder + "/2.json"]!), entries: entries)
    }
    try delta3([resourceEntry, manifestEntry], into: files)
    func copy(_ change: (MemoryDestination) throws -> Void = { _ in }) throws -> MemoryDestination {
      let value = MemoryDestination(); value.files = files.files; try change(value); return value
    }
    func imported(_ destination: MemoryDestination, keys: IosRecoveryCatalog.Keys = old, check: @escaping () throws -> Void = {},
      into device: IosWebDavJournal? = nil) throws -> (IosWebDavJournal, IosRecoveryImport.Summary) {
      let device = try device ?? journal()
      return (device, try IosRecoveryImport(journal: device, target: fresh, keys: keys, transport: destination, check: check).run())
    }
    func listed(_ device: IosWebDavJournal) throws -> [String] {
      try IosWebDavBackups.merged(device.uploads(target: fresh), device.importedReceipts(target: fresh, after: "")).rows
        .filter { ["file", "photo_manifest"].contains($0.kind ?? "") }.map { ($0.relativePath as NSString).lastPathComponent }.sorted()
    }
    func id(_ device: IosWebDavJournal, _ name: String) throws -> String {
      try device.importedReceipts(target: fresh, after: "").first { $0.relativePath.hasSuffix("/" + name) }!.id
    }
    func download(_ device: IosWebDavJournal, _ destination: MemoryDestination, target: String? = nil,
      check: @escaping () throws -> Void = {}) -> IosWebDavDownload {
      IosWebDavDownload(journal: device, target: target ?? fresh, transport: destination, snapshots: snapshots, check: check)
    }
    func bytes(_ name: String, _ size: Int64, _ hash: String) throws -> Data {
      let handle = try snapshots.open(name, sha256: hash, size: size); defer { try? handle.close() }
      try handle.seek(toOffset: 0); return try handle.readToEnd() ?? Data()
    }

    let (device, summary) = try imported(files)
    precondition(summary.deltas == 3 && summary.entries == 5 && summary.unverified == 0, "\(summary)")
    let names = try listed(device)
    precondition(names == ["a.txt", "b.txt", "c.txt", manifest.filename].sorted(), "restore list shows imported files and manifests: \(names)")
    for name in ["a.txt", "b.txt", "c.txt"] {
      let value = try download(device, files).receipt(id(device, name))
      let stage = try download(device, files).stage(value.id)
      let restored = try bytes(stage, value.size, value.sha256)
      precondition(restored == Data(name.utf8), name)
      try snapshots.discard(stage)
    }
    let photos = download(device, files), manifestId = try id(device, manifest.filename)
    let decoded = try photos.manifest(manifestId)
    let resolved = try photos.resource(decoded, decoded.resources[0], of: photos.receipt(manifestId))
    precondition(decoded == manifest && resolved?.relativePath == photoPath && staged() == 0, "manifest and its resource of the same origin")
    print("PASS restore: imported files and photo manifest download, verify by SHA-256 and stage; nothing retained")

    let a = try id(device, "a.txt")
    IosRecoveryCatalogChecks.fails("review_required") { _ = try download(device, files, target: target).receipt(a) }
    let projection = try download(device, files).receipt(a)
    let row = try device.find(a)
    precondition(row == nil && projection.binding == IosWebDavJournal.importedBinding, "not an upload row")
    IosRecoveryCatalogChecks.fails("outcome_unknown") { try device.insert(projection) }
    var intent = IosWebDavRestoreIntent(id: UUID().uuidString.lowercased(), target: fresh, job: a, name: "a.txt", sha256: projection.sha256,
      size: projection.size, staging: "x.snapshot", offset: projection.size, destination: Data("folder".utf8).base64EncodedString(), state: "verified")
    try device.saveRestoreIntent(intent, table: "imported_restore")
    let saved = try device.restoreIntent(target: fresh, job: a, table: "imported_restore")
    precondition(saved == intent, "imported restore intent")
    intent.id = UUID().uuidString.lowercased()
    do { try device.saveRestoreIntent(intent); fatalError("imported receipt accepted as an upload job") } catch {}
    print("PASS bound: other destination refused; never an upload row; restore intents only in imported_restore")

    let alteredFile = try copy { $0.files[source + "/a.txt"] = Data("A.txt".utf8) }
    IosRecoveryCatalogChecks.fails("hash_mismatch") { _ = try download(device, alteredFile).stage(a) }
    let grown = try copy { $0.files[source + "/a.txt"] = Data("a.txt+".utf8) }
    IosRecoveryCatalogChecks.fails("review_required") { _ = try download(device, grown).stage(a) }
    let swapped = try copy { $0.files[manifestPath] = try IosWebDavPhotoManifestCodec.encode(IosWebDavPhotoManifest(sourceDeviceId: "old-device",
      assetId: "asset1", revision: 1, resources: [IosWebDavPhotoResource(relativePath: source + "/photos/x.jpg", role: "original", name: "x.jpg",
        mimeType: "image/jpeg", sha256: resource.sha256, size: resource.size)], albums: [], favorite: nil)) }
    IosRecoveryCatalogChecks.fails("hash_mismatch") { _ = try download(device, swapped).manifest(manifestId) }
    precondition(staged() == 0, "rejected downloads leave no staging")
    print("PASS altered file: changed bytes hash_mismatch, longer body refused, swapped manifest hash_mismatch; no staging kept")

    let injected = try copy { $0.files[source + "/injected.txt"] = Data("injected".utf8) }
    let (injectedDevice, _) = try imported(injected)
    let injectedNames = try listed(injectedDevice)
    precondition(injectedNames == names, "a remote file without an authentic entry is never listed")
    let split = try copy { copy in
      try delta3([manifestEntry], into: copy)
      copy.files[twinFolder + "/1.json"] = try IosRecoveryCatalog.encode(keys: old, installation: installation,
        target: IosRecoveryCatalogChecks.sha("twin-target"), sequence: 1, previous: nil, entries: [resourceEntry])
    }
    let (splitDevice, splitSummary) = try imported(split)
    precondition(splitSummary.chains == 2 && splitSummary.entries == 5, "\(splitSummary)")
    IosRecoveryCatalogChecks.fails("manifest_invalid") { _ = try download(splitDevice, split).manifest(id(splitDevice, manifest.filename)) }
    print("PASS injected: unlisted remote file never offered; a resource from another catalog origin never completes a manifest")

    let (gapDevice, gap) = try imported(try copy { $0.files[folder + "/2.json"] = nil })
    let gapNames = try listed(gapDevice)
    precondition(gap.deltas == 1 && gap.unverified == 1 && gapNames == ["a.txt", "b.txt"], "\(gap)")
    let (replayDevice, replay) = try imported(try copy { $0.files[folder + "/3.json"] = $0.files[folder + "/1.json"] })
    let replayNames = try listed(replayDevice)
    precondition(replay.deltas == 2 && replay.unverified == 1 && replayNames == ["a.txt", "b.txt", "c.txt"], "\(replay)")
    let (stranger, wrong) = try imported(files, keys: IosRecoveryCatalog.keys(Data(repeating: 9, count: 32)))
    let strangerNames = try listed(stranger)
    precondition(wrong.chains == 0 && strangerNames.isEmpty, "wrong code")
    IosRecoveryCatalogChecks.fails("review_required") { _ = try download(stranger, files).receipt(a) }
    print("PASS deleted/replayed delta: later entries never restorable, no duplicates; wrong code leaves nothing to restore")

    let resumed = try journal()
    var limit = 1, attempts = 0, before: Int64 = 0
    while true {
      var calls = 0
      do {
        _ = try imported(files, check: { calls += 1; if calls == limit { throw IosWebDavFailure.code("cancelled") } }, into: resumed)
        break
      } catch IosWebDavFailure.code("cancelled") {
        let now = try resumed.importedCount(target: fresh)
        precondition(now >= before && now <= 5, "interrupted import keeps a verified prefix"); before = now
      }
      limit += 1; attempts += 1
    }
    let again = try imported(files, into: resumed).1
    let total = try resumed.importedCount(target: fresh)
    precondition(attempts > 3 && total == 5 && again.deltas == 3, "resumed import")
    var reads = 0
    IosRecoveryCatalogChecks.fails("cancelled") {
      _ = try download(device, files, check: { reads += 1; if reads == 3 { throw IosWebDavFailure.code("cancelled") } }).stage(a)
    }
    precondition(staged() == 0, "interrupted download leaves no staging")
    try snapshots.discard(try download(device, files).stage(a))
    let all = (0..<450).map { index in IosWebDavUpload(id: UUID().uuidString.lowercased(), target: fresh, binding: index % 3 == 0 ? "b" : "imported",
      source: source, reference: "r", relativePath: source + "/r", revision: "1", snapshot: "", sha256: projection.sha256, size: 1) }
    func page(_ rows: [IosWebDavUpload], _ after: String) -> [IosWebDavUpload] { Array(rows.filter { $0.id > after }.sorted { $0.id < $1.id }.prefix(100)) }
    var seen: [String] = [], cursor: String? = ""
    while let after = cursor {
      let result = IosWebDavBackups.merged(page(all.filter { $0.binding == "b" }, after), page(all.filter { $0.binding != "b" }, after))
      precondition(result.rows.count <= 100); seen += result.rows.map(\.id); cursor = result.cursor
    }
    precondition(seen == all.map(\.id).sorted(), "merged pages cover both lists once, in order")
    print("PASS restore list: local and imported receipts merged into pages of at most 100 without gaps or repeats")
    print("PASS interruption: import resumes to the same 5 receipts after \(attempts) cuts; interrupted download retried cleanly")
  }
}
