import UIKit
import Photos

// Separate D7 runtime approval required. Native sources/receipts/LAN/importer, no fabricated Completed.
@main final class SmbWindowsPhotosApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  let restore = IosSmbPhotosRestore()
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  var nonce: String { Bundle.main.object(forInfoDictionaryKey: "FixtureNonce") as! String }
  let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=")!
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    DispatchQueue.global().async {
      var result: [String: Any] = ["mode": self.mode]
      do { result.merge(try self.run()) { _, new in new }; result["status"] = "PASS" }
      catch { result["status"] = "FAIL"; result["code"] = (error as? IosSmbFailure)?.code ?? (error as? IosPairingFailure)?.code ?? "fixture_error" }
      do { try JSONSerialization.data(withJSONObject: result, options: .sortedKeys).write(to: self.root.appendingPathComponent(self.mode + "-result.json"), options: .atomic) }
      catch { print("Owned fixture result write failed") }
    }
    return true
  }
  func require(_ condition: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    guard try condition() else { throw IosSmbFailure(code: "fixture_assertion_\(line)") }
  }
  func save(_ value: [String: String], name: String) throws {
    try JSONSerialization.data(withJSONObject: value, options: .sortedKeys).write(to: root.appendingPathComponent(name), options: .atomic)
  }
  func load(_ name: String) throws -> [String: String] {
    guard let value = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent(name))) as? [String: String] else { throw IosSmbFailure(code: "fixture_ownership") }
    return value
  }
  func permission() throws {
    let done = DispatchSemaphore(value: 0)
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in done.signal() }
    try require(done.wait(timeout: .now() + 45) == .success)
    try require(PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized)
  }
  func createSource() throws {
    try require(!FileManager.default.fileExists(atPath: root.appendingPathComponent("source-ids.json").path))
    try save(["state": "creating"], name: "source-ids.json")
    var recorded: [String: String] = [:], persistenceFailed = false
    try PHPhotoLibrary.shared().performChangesAndWait {
      let request = PHAssetCreationRequest.forAsset()
      let options = PHAssetResourceCreationOptions(); options.originalFilename = "KlodaOwnedWindows-" + self.nonce + ".png"; options.uniformTypeIdentifier = "public.png"
      request.addResource(with: .photo, data: self.png, options: options); request.isFavorite = true
      let album = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: "KlodaOwnedWindows-" + self.nonce)
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
      let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject else { throw IosSmbFailure(code: "fixture_ownership") }
    let containing = PHAssetCollection.fetchAssetCollectionsContaining(asset, with: .album, options: nil)
    var membership = (try? load("membership.json")) ?? [:]
    membership[assetId] = String(containing.count); try save(membership, name: "membership.json")
    try require(containing.count == 1 && containing.firstObject?.localIdentifier == albumId)
    let members = PHAsset.fetchAssets(in: album, options: nil)
    try require(album.localizedTitle == "KlodaOwnedWindows-" + nonce && asset.isFavorite)
    try require(members.count == 1 && members.firstObject?.localIdentifier == assetId)
    let resources = PHAssetResource.assetResources(for: asset); try require(resources.count == 1)
    try require(resources[0].originalFilename == "KlodaOwnedWindows-" + nonce + ".png" && resources[0].uniformTypeIdentifier == "public.png")
    let done = DispatchSemaphore(value: 0); var bytes = Data(), failed = false
    let options = PHAssetResourceRequestOptions(); options.isNetworkAccessAllowed = false
    PHAssetResourceManager.default().requestData(for: resources[0], options: options, dataReceivedHandler: { data in
      if bytes.count + data.count > 4096 { failed = true } else { bytes.append(data) }
    }, completionHandler: { error in if error != nil { failed = true }; done.signal() })
    try require(done.wait(timeout: .now() + 15) == .success && !failed && bytes == png)
  }
  func imported(_ manifest: IosSmbPhotoManifest, state: IosSmbPhotosJournal) throws -> [String: String] {
    guard let intent = try state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId])), intent.state == "completed", let asset = intent.target,
      let album = try state.photoText("SELECT target FROM smb_photo_album WHERE key=?", [state.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])]) else { throw IosSmbFailure(code: "fixture_import_receipt") }
    try IosSmbPhotosImport.verify(intent: intent, journal: state, check: {})
    return ["asset": asset, "album": album]
  }
  func restoreOnce(_ id: String, profiles: IosSmbProfiles) throws {
    let done = DispatchSemaphore(value: 0); var outcome: Result<[String: Any], Error>?
    restore.restore(id: id, profiles: profiles, ticket: UUID(), visible: { true }) { outcome = $0; done.signal() }
    try require(done.wait(timeout: .now() + 45) == .success)
    guard let outcome else { throw IosSmbFailure(code: "fixture_restore_timeout") }
    try require(outcome.get()["state"] as? String == "completed")
  }
  func run() throws -> [String: Any] {
    try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "497AAA0F-967E-4781-9468-3F05CA2D3D5A")
    try require(Bundle.main.bundleIdentifier?.hasPrefix("com.kloda.fixture.smb16.windowsphotos.") == true)
    // Runtime flag stays false in build-only artifacts until the exact D7 fixture is approved.
    try require(Bundle.main.object(forInfoDictionaryKey: "FixtureMediaEnabled") as? Bool == true)
    try require(["seed", "reopen", "cleanup"].contains(mode)); try permission()
    let journal = try IosSmbQueue.shared.journal(), profiles = IosSmbProfiles(journal: journal)
    if mode == "seed" {
      try require(profiles.capture() == nil); try createSource()
      let source = try load("source-ids.json"); try verify(source)
      try IosWebDavContext.mutate { UserDefaults.standard.set([["id": self.nonce, "kind": "photos", "reference": source["album"]!]], forKey: "kloda.sync.photoSources") }
      let secret = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fixture-password")
      let password = try String(contentsOf: secret, encoding: .utf8); defer { try? FileManager.default.removeItem(at: secret) }
      _ = try profiles.save(target: IosSmbTarget(address: "192.168.1.54", port: 445, share: "KlodaTest16a", root: "kloda16a-photos-" + nonce, username: "kloda16a", domain: "MMHA", profileGeneration: "native", credentialGeneration: "native"), password: password)
    }
    let source = try load("source-ids.json"); try require(source["state"] == "created"); try verify(source)
    try require(IosFilesSelection.current().isEmpty)
    let selections = try IosPhotosSource.currentSelections(); try require(selections.count == 1 && selections[0].reference == source["album"])
    let snapshots = try IosFilesSnapshot.smb()
    var captured = try profiles.capture()!
    try require(captured.profile.target.root == "kloda16a-photos-" + nonce && captured.profile.target.share == "KlodaTest16a")
    let state = try IosSmbPhotosJournal(database: journal.database, target: captured.profile.target.archiveId(), commit: { try $0() })
    if mode == "cleanup" {
      let page = try journal.catalog(target: captured.profile.target, after: nil)
      guard let job = page.jobs.first(where: { $0.kind == "photo_manifest" }) else { throw IosSmbFailure(code: "fixture_missing_manifest") }
      let download = try IosSmbDownload(profiles: profiles, snapshots: snapshots, check: { try self.require(profiles.current(captured)) })
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
    var tracked: [IosSmbUpload] = []
    let photos = try IosSmbPhotos(profiles: profiles, snapshots: snapshots, track: { tracked.append($0) })
    try photos.run(cancelled: { false }); try require(tracked.count == 2)
    captured = try profiles.capture()!
    let ids = Set(tracked.map { $0.id }); try photos.run(cancelled: { false }); try require(tracked.count == 4 && Set(tracked.map { $0.id }) == ids)
    let page = try journal.catalog(target: captured.profile.target, after: nil)
    try require(page.jobs.count == 2 && page.next == nil)
    guard let job = page.jobs.first(where: { $0.kind == "photo_manifest" }) else { throw IosSmbFailure(code: "fixture_missing_manifest") }
    let download = try IosSmbDownload(profiles: profiles, snapshots: snapshots, check: { try self.require(profiles.current(captured)) })
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
