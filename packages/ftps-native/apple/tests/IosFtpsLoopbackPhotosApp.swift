import UIKit
import Photos

// Separate D7 runtime approval required. Native sources/receipts/LAN/importer, no fabricated Completed.
@main final class FtpsLoopbackPhotosApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private var started = false
  let restore = IosFtpsPhotosRestore()
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
      do { result.merge(try self.run()) { _, new in new }; result["status"] = "PASS" }
      catch { result["status"] = "FAIL"; result["code"] = (error as? IosFtpsFailure)?.code ?? (error as? IosPairingFailure)?.code ?? "fixture_error" }
      do { try JSONSerialization.data(withJSONObject: result, options: .sortedKeys).write(to: self.root.appendingPathComponent(self.mode + "-result.json"), options: .atomic) }
      catch { print("Owned fixture result write failed") }
    }
  }
  func require(_ condition: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    guard try condition() else { throw IosFtpsFailure(code: "fixture_assertion_\(line)") }
  }
  func save(_ value: [String: String], name: String) throws {
    try JSONSerialization.data(withJSONObject: value, options: .sortedKeys).write(to: root.appendingPathComponent(name), options: .atomic)
  }
  func load(_ name: String) throws -> [String: String] {
    guard let value = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent(name))) as? [String: String] else { throw IosFtpsFailure(code: "fixture_ownership") }
    return value
  }
  func permission() throws {
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
      let options = PHAssetResourceCreationOptions(); options.originalFilename = "KlodaOwnedLoopback-" + self.nonce + ".png"; options.uniformTypeIdentifier = "public.png"
      request.addResource(with: .photo, data: self.png, options: options); request.isFavorite = true
      let album = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: "KlodaOwnedLoopback-" + self.nonce)
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
      let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject else { throw IosFtpsFailure(code: "fixture_ownership") }
    let containing = PHAssetCollection.fetchAssetCollectionsContaining(asset, with: .album, options: nil)
    var membership = (try? load("membership.json")) ?? [:]
    membership[assetId] = String(containing.count); try save(membership, name: "membership.json")
    try require(containing.count == 1 && containing.firstObject?.localIdentifier == albumId)
    let members = PHAsset.fetchAssets(in: album, options: nil)
    try require(album.localizedTitle == "KlodaOwnedLoopback-" + nonce && asset.isFavorite)
    try require(members.count == 1 && members.firstObject?.localIdentifier == assetId)
    let resources = PHAssetResource.assetResources(for: asset); try require(resources.count == 1)
    try require(resources[0].originalFilename == "KlodaOwnedLoopback-" + nonce + ".png" && resources[0].uniformTypeIdentifier == "public.png")
    let done = DispatchSemaphore(value: 0); var bytes = Data(), failed = false
    let options = PHAssetResourceRequestOptions(); options.isNetworkAccessAllowed = false
    PHAssetResourceManager.default().requestData(for: resources[0], options: options, dataReceivedHandler: { data in
      if bytes.count + data.count > 4096 { failed = true } else { bytes.append(data) }
    }, completionHandler: { error in if error != nil { failed = true }; done.signal() })
    try require(done.wait(timeout: .now() + 15) == .success && !failed && bytes == png)
  }
  func imported(_ manifest: IosFtpsPhotoManifest, state: IosFtpsPhotosJournal) throws -> [String: String] {
    guard let intent = try state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId])), intent.state == "completed", let asset = intent.target,
      let album = try state.photoText("SELECT target FROM ftps_photo_album WHERE key=?", [state.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])]) else { throw IosFtpsFailure(code: "fixture_import_receipt") }
    try IosFtpsPhotosImport.verify(intent: intent, journal: state, check: {})
    return ["asset": asset, "album": album]
  }
  func restoreOnce(_ id: String, profiles: IosFtpsProfiles) throws {
    let done = DispatchSemaphore(value: 0); var outcome: Result<[String: Any], Error>?
    restore.restore(id: id, profiles: profiles, ticket: UUID(), visible: { true }) { outcome = $0; done.signal() }
    try require(done.wait(timeout: .now() + 45) == .success)
    guard let outcome else { throw IosFtpsFailure(code: "fixture_restore_timeout") }
    try require(outcome.get()["state"] as? String == "completed")
  }
  func run() throws -> [String: Any] {
    try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
    try require(Bundle.main.bundleIdentifier?.hasPrefix("com.kloda.fixture.ftps16c.photos.") == true)
    // Runtime flag stays false in build-only artifacts until the exact D7 fixture is approved.
    try require(Bundle.main.object(forInfoDictionaryKey: "FixtureMediaEnabled") as? Bool == true)
    try require(["seed", "reopen", "cleanup", "cleanup-source"].contains(mode)); try permission()
    if mode == "cleanup-source" {
      try require(!FileManager.default.fileExists(atPath: root.appendingPathComponent("restore-ids.json").path))
      let source = try load("source-ids.json"); try verify(source)
      let assets = PHAsset.fetchAssets(withLocalIdentifiers: [source["asset"]!], options: nil)
      let albums = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [source["album"]!], options: nil)
      try require(assets.count == 1 && albums.count == 1)
      try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest.deleteAssets(assets); PHAssetCollectionChangeRequest.deleteAssetCollections(albums) }
      try require(PHAsset.fetchAssets(withLocalIdentifiers: [source["asset"]!], options: nil).count == 0 && PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [source["album"]!], options: nil).count == 0)
      return ["deletedOwnedSourceAssets": 1, "deletedOwnedSourceAlbums": 1]
    }
    let journal = try IosFtpsQueue.shared.journal(), profiles = IosFtpsProfiles(journal: journal)
    if mode == "seed" {
      try require(profiles.capture() == nil); try createSource()
      let source = try load("source-ids.json"); try verify(source)
      try IosWebDavContext.mutate { UserDefaults.standard.set([["id": self.nonce, "kind": "photos", "reference": source["album"]!]], forKey: "kloda.sync.photoSources") }
      let secret = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fixture-password")
      let password = try String(contentsOf: secret, encoding: .utf8); defer { try? FileManager.default.removeItem(at: secret) }
      _ = try profiles.save(target: IosFtpsTarget(address: "127.0.0.1", port: 27449, hostname: "localhost", root: "/", username: "probe", profileGeneration: "native", credentialGeneration: "native"), password: password)
    }
    let source = try load("source-ids.json"); try require(source["state"] == "created"); try verify(source)
    try require(IosFilesSelection.current().isEmpty)
    let selections = try IosPhotosSource.currentSelections(); try require(selections.count == 1 && selections[0].reference == source["album"])
    let snapshots = try IosFilesSnapshot.ftps()
    var captured = try profiles.capture()!
    try require(captured.profile.target.root == "/" && captured.profile.target.hostname == "localhost")
    let state = try IosFtpsPhotosJournal(database: journal.database, target: captured.profile.target.archiveId(), commit: { try $0() })
    if mode == "cleanup" {
      let page = try journal.catalog(target: captured.profile.target, after: nil)
      guard let job = page.jobs.first(where: { $0.kind == "photo_manifest" }) else { throw IosFtpsFailure(code: "fixture_missing_manifest") }
      let download = try IosFtpsDownload(profiles: profiles, snapshots: snapshots, check: { try self.require(profiles.current(captured)) })
      let manifest = try download.manifest(job.id), restored = try load("restore-ids.json")
      try require(imported(manifest, state: state) == restored); try verify(restored)
      let assets = [source["asset"]!, restored["asset"]!], albums = [source["album"]!, restored["album"]!]
      try require(Set(assets).count == 2 && Set(albums).count == 2)
      let a = PHAsset.fetchAssets(withLocalIdentifiers: assets, options: nil), b = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: albums, options: nil)
      try require(a.count == 2 && b.count == 2)
      try PHPhotoLibrary.shared().performChangesAndWait { PHAssetChangeRequest.deleteAssets(a); PHAssetCollectionChangeRequest.deleteAssetCollections(b) }
      try require(PHAsset.fetchAssets(withLocalIdentifiers: assets, options: nil).count == 0 && PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: albums, options: nil).count == 0)
      return ["deletedOwnedAssets": 2, "deletedOwnedAlbums": 2]
    }
    var tracked: [IosFtpsUpload] = []
    let photos = try IosFtpsPhotos(profiles: profiles, snapshots: snapshots, track: { tracked.append($0) })
    try photos.run(cancelled: { false }); try require(tracked.count == 2)
    captured = try profiles.capture()!
    let ids = Set(tracked.map { $0.id }); try photos.run(cancelled: { false }); try require(tracked.count == 4 && Set(tracked.map { $0.id }) == ids)
    let page = try journal.catalog(target: captured.profile.target, after: nil)
    try require(page.jobs.count == 2 && page.next == nil)
    guard let job = page.jobs.first(where: { $0.kind == "photo_manifest" }) else { throw IosFtpsFailure(code: "fixture_missing_manifest") }
    let download = try IosFtpsDownload(profiles: profiles, snapshots: snapshots, check: { try self.require(profiles.current(captured)) })
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
    return ["manifest": job.id, "remoteRoot": captured.profile.target.root, "resourceCount": 1, "manifestCount": 1, "unchangedReuse": true, "restoreNoDuplicate": true, "sourceAndImportedAssets": 2]
  }
}
