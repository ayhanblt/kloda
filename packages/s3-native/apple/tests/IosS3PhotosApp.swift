import UIKit
import Photos
import Security
import SQLite3
import Darwin

// Separate D7 runtime approval required. Native sources/receipts/LAN/importer, no fabricated Completed.
@main final class S3LoopbackPhotosApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private var started = false
  let restore = IosS3PhotosRestore()
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  var nonce: String { Bundle.main.object(forInfoDictionaryKey: "FixtureNonce") as! String }
  let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=")!
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    return true
  }
  func applicationDidBecomeActive(_ application: UIApplication) {
    guard !started else { return }; started = true
    DispatchQueue.global().async {
      var result: [String: Any] = ["mode": self.mode]
      do { result.merge(try self.run()) { _, new in new }; result["status"] = "PASS"; result["phase"] = "finished" }
      catch { result["status"] = "FAIL"; result["code"] = (error as? IosS3Failure)?.code ?? (error as? IosPairingFailure)?.code ?? "fixture_error" }
      do { try JSONSerialization.data(withJSONObject: result, options: .sortedKeys).write(to: self.root.appendingPathComponent(self.mode + "-result.json"), options: .atomic) }
      catch { print("Owned fixture result write failed") }
    }
  }
  func require(_ condition: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    guard try condition() else { throw IosS3Failure(code: "fixture_assertion_\(line)") }
  }
  func save(_ value: [String: String], name: String) throws {
    try JSONSerialization.data(withJSONObject: value, options: .sortedKeys).write(to: root.appendingPathComponent(name), options: .atomic)
  }
  func load(_ name: String) throws -> [String: String] {
    guard let value = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent(name))) as? [String: String] else { throw IosS3Failure(code: "fixture_ownership") }
    return value
  }
  func permission() throws {
    if PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized { return }
    let done = DispatchSemaphore(value: 0)
    DispatchQueue.main.async { PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in done.signal() } }
    try require(done.wait(timeout: .now() + 45) == .success)
    try require(PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized)
  }
  func createSource() throws {
    try require(!FileManager.default.fileExists(atPath: root.appendingPathComponent("source-ids.json").path))
    try save(["state": "creating"], name: "source-ids.json")
    var recorded: [String: String] = [:], persistenceFailed = false
    try PHPhotoLibrary.shared().performChangesAndWait {
      let request = PHAssetCreationRequest.forAsset()
      let options = PHAssetResourceCreationOptions(); options.originalFilename = "KlodaOwnedS3Photos17-" + self.nonce + ".png"; options.uniformTypeIdentifier = "public.png"
      request.addResource(with: .photo, data: self.png, options: options); request.isFavorite = true
      let album = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: "KlodaOwnedS3Photos17-" + self.nonce)
      guard let asset = request.placeholderForCreatedAsset else { persistenceFailed = true; return }
      let collection = album.placeholderForCreatedAssetCollection
      album.addAssets([asset] as NSArray)
      recorded = ["state": "creating", "asset": asset.localIdentifier, "album": collection.localIdentifier]
      do { try self.save(recorded, name: "source-ids.json") } catch { persistenceFailed = true }
    }
    try require(!persistenceFailed && recorded["asset"] != nil && recorded["album"] != nil)
    recorded["state"] = "created"; try save(recorded, name: "source-ids.json")
  }
  func verify(_ ids: [String: String]) throws {
    guard let assetId = ids["asset"], let albumId = ids["album"],
      let asset = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject,
      let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject else { throw IosS3Failure(code: "fixture_ownership") }
    let containing = PHAssetCollection.fetchAssetCollectionsContaining(asset, with: .album, options: nil)
    var membership = (try? load("membership.json")) ?? [:]
    membership[assetId] = String(containing.count); try save(membership, name: "membership.json")
    try require(containing.count == 1 && containing.firstObject?.localIdentifier == albumId)
    let members = PHAsset.fetchAssets(in: album, options: nil)
    try require(album.localizedTitle == "KlodaOwnedS3Photos17-" + nonce && asset.isFavorite)
    try require(members.count == 1 && members.firstObject?.localIdentifier == assetId)
    let resources = PHAssetResource.assetResources(for: asset); try require(resources.count == 1)
    try require(resources[0].originalFilename == "KlodaOwnedS3Photos17-" + nonce + ".png" && resources[0].uniformTypeIdentifier == "public.png")
    let done = DispatchSemaphore(value: 0); var bytes = Data(), failed = false
    let options = PHAssetResourceRequestOptions(); options.isNetworkAccessAllowed = false
    PHAssetResourceManager.default().requestData(for: resources[0], options: options, dataReceivedHandler: { data in
      if bytes.count + data.count > 4096 { failed = true } else { bytes.append(data) }
    }, completionHandler: { error in if error != nil { failed = true }; done.signal() })
    try require(done.wait(timeout: .now() + 15) == .success && !failed && bytes == png)
  }
  func imported(_ manifest: IosS3PhotoManifest, state: IosS3PhotosJournal) throws -> [String: String] {
    guard let intent = try state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId])), intent.state == "completed", let asset = intent.target,
      let album = try state.photoText("SELECT target FROM s3_photo_album WHERE key=?", [state.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])]) else { throw IosS3Failure(code: "fixture_import_receipt") }
    try IosS3PhotosImport.verify(intent: intent, journal: state, check: {})
    return ["asset": asset, "album": album]
  }
  func restoreOnce(_ id: String, profiles: IosS3Profiles) throws {
    let done = DispatchSemaphore(value: 0); var outcome: Result<[String: Any], Error>?
    restore.restore(id: id, profiles: profiles, ticket: UUID(), visible: { true }) { outcome = $0; done.signal() }
    try require(done.wait(timeout: .now() + 45) == .success)
    guard let outcome else { throw IosS3Failure(code: "fixture_restore_timeout") }
    try require(outcome.get()["state"] as? String == "completed")
  }
  func ownJobs(_ journal: IosS3Journal, target: IosS3Target) throws -> [IosS3Job] {
    try journal.database.statement("SELECT j.id FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.archive=? AND l.installation=? AND j.state='completed' ORDER BY l.rowid LIMIT 100", values: [target.archiveId(), journal.installation()]) { row in
      var jobs: [IosS3Job] = []; var step = sqlite3_step(row)
      while step == SQLITE_ROW {
        guard let raw = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "fixture_catalog") }
        jobs.append(try journal.receipt(String(cString: raw), target: target)); step = sqlite3_step(row)
      }
      try require(step == SQLITE_DONE); return jobs
    }
  }
  func cleanupOwned() throws -> [String: Any] {
    var assetIds = Set<String>(), albumIds = Set<String>()
    for name in ["source-ids.json", "restore-ids.json"] where FileManager.default.fileExists(atPath: root.appendingPathComponent(name).path) {
      let ids = try load(name); if let id = ids["asset"] { assetIds.insert(id) }; if let id = ids["album"] { albumIds.insert(id) }
    }
    if FileManager.default.fileExists(atPath: root.appendingPathComponent("s3-photos.sqlite").path) {
      let journal = try IosS3Journal(url: root.appendingPathComponent("s3-photos.sqlite"), provider: "s3-compatible")
      for (table, albums) in [("s3_photo_import", false), ("s3_photo_album", true)] {
        let exists = try journal.database.statement("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", values: [table]) { sqlite3_step($0) == SQLITE_ROW }
        if exists {
          try journal.database.statement("SELECT target FROM " + table + " WHERE target IS NOT NULL") { row in
            var step = sqlite3_step(row)
            while step == SQLITE_ROW {
              guard let raw = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "fixture_ownership") }
              let id = String(cString: raw); if albums { albumIds.insert(id) } else { assetIds.insert(id) }; step = sqlite3_step(row)
            }
            try require(step == SQLITE_DONE)
          }
        }
      }
    }
    try require(assetIds.count <= 2 && albumIds.count <= 2)
    let assets = PHAsset.fetchAssets(withLocalIdentifiers: Array(assetIds), options: nil)
    let albums = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: Array(albumIds), options: nil)
    for index in 0..<assets.count {
      let resources = PHAssetResource.assetResources(for: assets.object(at: index))
      try require(resources.count == 1 && resources[0].originalFilename == "KlodaOwnedS3Photos17-" + nonce + ".png")
    }
    for index in 0..<albums.count { try require(albums.object(at: index).localizedTitle == "KlodaOwnedS3Photos17-" + nonce) }
    try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest.deleteAssets(assets); PHAssetCollectionChangeRequest.deleteAssetCollections(albums) }
    try require(PHAsset.fetchAssets(withLocalIdentifiers: Array(assetIds), options: nil).count == 0 && PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: Array(albumIds), options: nil).count == 0)
    let service = Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1"
    let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
    try require(status == errSecSuccess || status == errSecItemNotFound); try require(IosS3Vault.read("s3-compatible") == nil)
    return ["deletedOwnedAssets": assets.count, "deletedOwnedAlbums": albums.count, "fakeKeychainCleaned": true]
  }
  func run() throws -> [String: Any] {
    try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
    try require(Bundle.main.bundleIdentifier?.hasPrefix("com.kloda.fixture.s3photos17.") == true)
    // Runtime flag stays false in build-only artifacts until the exact D7 fixture is approved.
    try require(Bundle.main.object(forInfoDictionaryKey: "FixtureMediaEnabled") as? Bool == true)
    guard let ca = Bundle.main.url(forResource: "owned-ca", withExtension: "der") else { throw IosS3Failure(code: "fixture_ca") }
    setenv("KLODA_S3_FIXTURE_CA_DER", ca.path, 1)
    try require(["seed", "reopen", "cleanup", "cleanup-source"].contains(mode)); try permission()
    if mode == "cleanup" { return try cleanupOwned() }
    if mode == "cleanup-source" {
      try require(!FileManager.default.fileExists(atPath: root.appendingPathComponent("restore-ids.json").path))
      let source = try load("source-ids.json"); try verify(source)
      let asset = PHAsset.fetchAssets(withLocalIdentifiers: [source["asset"]!], options: nil).firstObject!
      let stamp = try IosPhotosSource.stamp(asset: asset)
      try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest(for: asset).isFavorite = false }
      var rejected = false; do { try IosPhotosSource.validate(stamp: stamp) } catch { rejected = true }
      try require(rejected)
      let changed = PHAsset.fetchAssets(withLocalIdentifiers: [source["asset"]!], options: nil).firstObject!
      try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest(for: changed).isFavorite = true }
      try verify(source)
      let assets = PHAsset.fetchAssets(withLocalIdentifiers: [source["asset"]!], options: nil)
      let albums = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [source["album"]!], options: nil)
      try require(assets.count == 1 && albums.count == 1)
      try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest.deleteAssets(assets); PHAssetCollectionChangeRequest.deleteAssetCollections(albums) }
      try require(PHAsset.fetchAssets(withLocalIdentifiers: [source["asset"]!], options: nil).count == 0 && PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [source["album"]!], options: nil).count == 0)
      return ["deletedOwnedSourceAssets": 1, "deletedOwnedSourceAlbums": 1]
    }
    let journal = try IosS3Journal(url: root.appendingPathComponent("s3-photos.sqlite"), provider: "s3-compatible"), profiles = IosS3Profiles(journal: journal)
    if mode == "seed" {
      try require(profiles.capture() == nil); try createSource()
      let source = try load("source-ids.json"); try verify(source)
      try IosWebDavContext.mutate { UserDefaults.standard.set([["id": self.nonce, "kind": "photos", "reference": source["album"]!]], forKey: "kloda.sync.photoSources") }
      let endpoint = Bundle.main.object(forInfoDictionaryKey: "NativeWireEndpoint") as! String
      let generation = UUID().uuidString.lowercased()
      try profiles.save(IosS3Target(provider: "s3-compatible", endpoint: endpoint, region: "us-east-1", bucket: "owned-bucket", prefix: "photos-" + nonce, pathStyle: true, accountBinding: IosS3Target.hash(Data("kloda17fixture".utf8)), profileGeneration: generation, credentialGeneration: generation), accessKey: "kloda17fixture", secret: "synthetic-only-kloda17-fixture", token: nil, check: {})
      try journal.setEnabled(true)

    }
    let source = try load("source-ids.json"); try require(source["state"] == "created"); try verify(source)
    try require(IosFilesSelection.current().isEmpty)
    let selections = try IosPhotosSource.currentSelections(); try require(selections.count == 1 && selections[0].reference == source["album"])
    let snapshots = try IosFilesSnapshot.s3(journal.provider)
    var captured = try profiles.capture()!
    try require(captured.profile.target.provider == "s3-compatible" && captured.profile.target.prefix == "photos-" + nonce)
    let state = try IosS3PhotosJournal(database: journal.database, target: captured.profile.target.archiveId(), provider: journal.provider, commit: { try $0() })
    if mode == "cleanup" {
      let page = try ownJobs(journal, target: captured.profile.target)
      guard let job = page.first(where: { $0.kind == "photo_manifest" }) else { throw IosS3Failure(code: "fixture_missing_manifest") }
      let download = try IosS3Download(profiles: profiles, snapshots: snapshots, check: { try self.require(profiles.current(captured)) })
      let manifest = try download.manifest(job.id), restored = try load("restore-ids.json")
      try require(imported(manifest, state: state) == restored); try verify(restored)
      let assets = [source["asset"]!, restored["asset"]!], albums = [source["album"]!, restored["album"]!]
      try require(Set(assets).count == 2 && Set(albums).count == 2)
      let a = PHAsset.fetchAssets(withLocalIdentifiers: assets, options: nil), b = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: albums, options: nil)
      try require(a.count == 2 && b.count == 2)
      try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest.deleteAssets(a); PHAssetCollectionChangeRequest.deleteAssetCollections(b) }
      try require(PHAsset.fetchAssets(withLocalIdentifiers: assets, options: nil).count == 0 && PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: albums, options: nil).count == 0)
      let service = Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1"
      let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
      try require(status == errSecSuccess || status == errSecItemNotFound); try require(IosS3Vault.read("s3-compatible") == nil)
      return ["deletedOwnedAssets": 2, "deletedOwnedAlbums": 2, "fakeKeychainCleaned": true]
    }
    var tracked: [IosS3Job] = []
    let photos = try IosS3Photos(profiles: profiles, snapshots: snapshots, track: { tracked.append($0) })
    try photos.run(cancelled: { false }); try require(tracked.count == 2)
    captured = try profiles.capture()!
    let ids = Set(tracked.map { $0.id }); try photos.run(cancelled: { false }); try require(tracked.count == 4 && Set(tracked.map { $0.id }) == ids)
    let page = try ownJobs(journal, target: captured.profile.target)
    try require(page.count == 2)
    guard let job = page.first(where: { $0.kind == "photo_manifest" }) else { throw IosS3Failure(code: "fixture_missing_manifest") }
    let download = try IosS3Download(profiles: profiles, snapshots: snapshots, check: { try self.require(profiles.current(captured)) })
    let manifest = try download.manifest(job.id); try require(manifest.resources.count == 1 && manifest.albums.count == 1 && manifest.favorite == true)
    if mode == "seed" {
      try restoreOnce(job.id, profiles: profiles); let first = try imported(manifest, state: state); try save(first, name: "restore-ids.json"); try verify(first)
      try require(first["asset"] != source["asset"] && first["album"] != source["album"])
      try restoreOnce(job.id, profiles: profiles); try require(imported(manifest, state: state) == first)
      UserDefaults.standard.set(job.id, forKey: "fixture.manifest")
    } else {
      try require(UserDefaults.standard.string(forKey: "fixture.manifest") == job.id)
      let first = try load("restore-ids.json"); try require(imported(manifest, state: state) == first)
      try restoreOnce(job.id, profiles: profiles); try require(imported(manifest, state: state) == first)
    }
    try verify(source); try verify(load("restore-ids.json"))
    return ["manifest": job.id, "remotePrefix": captured.profile.target.prefix, "resourceCount": 1, "manifestCount": 1, "unchangedReuse": true, "restoreNoDuplicate": true, "sourceAndImportedAssets": 2]
  }
}
