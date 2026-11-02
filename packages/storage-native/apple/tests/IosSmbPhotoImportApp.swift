import UIKit
import Photos
import CryptoKit

// Component fixture only: no SMB upload receipts or LAN success are fabricated.
@main final class SmbPhotoImportApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  static let simulator = "497AAA0F-967E-4781-9468-3F05CA2D3D5A"
  static let bundlePrefix = "com.kloda.fixture.smb16.import."
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController()
    window.makeKeyAndVisible(); self.window = window
    DispatchQueue.global().async {
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let mode = CommandLine.arguments.last ?? "local"
      var result: [String: Any] = ["mode": mode, "sourceHash": Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureSourceHash") as? String ?? ""]
      do { try Self.run(mode, root: root); result["status"] = "PASS" }
      catch { result["status"] = "FAIL"; result["code"] = (error as? IosPairingFailure)?.code ?? (error as? IosSmbFailure)?.code ?? "fixture_error" }
      do { try JSONSerialization.data(withJSONObject: result, options: .sortedKeys).write(to: root.appendingPathComponent(mode + "-result.json"), options: .atomic) }
      catch { print("Fixture result persistence failed") }
    }
    return true
  }
  static func require(_ value: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    guard try value() else { throw IosSmbFailure(code: "fixture_assertion_\(line)") }
  }
  static func rejected(_ expected: String, _ action: () throws -> Void) throws {
    do { try action() } catch {
      let code = (error as? IosPairingFailure)?.code ?? (error as? IosSmbFailure)?.code
      try require(code == expected); return
    }
    throw IosSmbFailure(code: "fixture_expected_rejection")
  }
  static func digest(_ data: Data) -> String {
    Data(SHA256.hash(data: data)).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  static func run(_ mode: String, root: URL) throws {
    try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == simulator)
    try require(Bundle.main.bundleIdentifier?.hasPrefix(bundlePrefix) == true)
    try require(["local", "seed", "reopen", "cleanup"].contains(mode))
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let journal = try IosSmbJournal(databaseURL: root.appendingPathComponent("owned-import.sqlite"))
    let state = try IosSmbPhotosJournal(database: journal.database, target: digest(Data("owned-local-import-component".utf8)), commit: { try $0() })
    let saved = root.appendingPathComponent("manifest.json"), stage = root.appendingPathComponent("owned.snapshot")
    let manifest: IosSmbPhotoManifest
    if mode == "local" || mode == "seed" {
      try require(!FileManager.default.fileExists(atPath: saved.path))
      let token = UUID().uuidString.lowercased()
      let bytes = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=")!
      try bytes.write(to: stage, options: .withoutOverwriting)
      try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: stage.path)
      let resource = IosSmbPhotoResource(relativePath: token + "/media/owned.png", role: "original", name: "KlodaOwnedSmb-" + token + ".png", mimeType: "image/png", sha256: digest(bytes), size: Int64(bytes.count))
      manifest = IosSmbPhotoManifest(sourceDeviceId: token, assetId: token, revision: 1, resources: [resource], albums: [IosPhotoAlbum(id: token, name: "KlodaOwnedSmb-" + token)], favorite: true)
      try IosSmbPhotoManifestCodec.encode(manifest).write(to: saved, options: .withoutOverwriting)
    } else { manifest = try IosSmbPhotoManifestCodec.decode(Data(contentsOf: saved)) }
    try require(IosSmbPhotoManifestCodec.decode(IosSmbPhotoManifestCodec.encode(manifest)) == manifest)
    let key = try state.photoKey([manifest.sourceDeviceId, manifest.assetId])
    if mode == "local" {
      try IosPhotosImportMedia.verifyStage(stage, resource: manifest.resources[0], check: {})
      let intent = IosSmbPhotoImport(key: key, manifest: try IosSmbPhotoManifestCodec.encode(manifest))
      try state.savePhotoImport(intent); try require(state.photoImport(key) == intent)
      try rejected("cancelled") { try IosPhotosImportMedia.verifyStage(stage, resource: manifest.resources[0], check: { throw IosSmbFailure(code: "cancelled") }) }
      return // No authorization request or PhotoKit mutation is reachable in local mode.
    }
    try require(Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureMediaEnabled") as? Bool == true)
    let permission = DispatchSemaphore(value: 0)
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in permission.signal() }
    guard permission.wait(timeout: .now() + 30) == .success,
      PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else {
      throw IosSmbFailure(code: "fixture_photos_permission")
    }
    let stages = [manifest.resources[0].relativePath: stage]
    if mode == "seed" {
      try require(state.photoImport(key) == nil)
      try IosSmbPhotosImport.importManifest(manifest: manifest, stages: stages, journal: state, check: {})
      try recordOwnership(manifest, state: state, root: root)
      let first = try state.photoImport(key)
      try require(first?.state == "completed" && first?.target != nil)
      try IosSmbPhotosImport.importManifest(manifest: manifest, stages: stages, journal: state, check: {})
      try require(state.photoImport(key) == first)
      let stale = IosSmbPhotoManifest(sourceDeviceId: manifest.sourceDeviceId, assetId: "stale", revision: 1, resources: manifest.resources, albums: manifest.albums, favorite: true)
      try rejected("context_changed") { try IosSmbPhotosImport.importManifest(manifest: stale, stages: stages, journal: state, check: { throw IosSmbFailure(code: "context_changed") }) }
      let unknown = IosSmbPhotoManifest(sourceDeviceId: manifest.sourceDeviceId, assetId: "unknown", revision: 1, resources: manifest.resources, albums: manifest.albums, favorite: true)
      let unknownKey = try state.photoKey([unknown.sourceDeviceId, unknown.assetId])
      try state.savePhotoImport(IosSmbPhotoImport(key: unknownKey, manifest: IosSmbPhotoManifestCodec.encode(unknown), state: "creating"))
      try rejected("review_required") { try IosSmbPhotosImport.importManifest(manifest: unknown, stages: stages, journal: state, check: {}) }
      try require(state.photoImport(unknownKey)?.target == nil)
      try verifyOwned(manifest, state: state, root: root)
    } else if mode == "reopen" {
      let before = try state.photoImport(key); try require(before?.state == "completed")
      try IosSmbPhotosImport.verify(intent: before!, journal: state, check: {})
      try require(state.photoImport(key) == before); try verifyOwned(manifest, state: state, root: root)
    } else {
      try verifyOwned(manifest, state: state, root: root)
      let ids = try ownership(root)
      let assets = PHAsset.fetchAssets(withLocalIdentifiers: [ids["asset"]!], options: nil)
      let albums = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [ids["album"]!], options: nil)
      try require(assets.count == 1 && albums.count == 1)
      try PHPhotoLibrary.shared().performChangesAndWait {
        PHAssetChangeRequest.deleteAssets(assets); PHAssetCollectionChangeRequest.deleteAssetCollections(albums)
      }
      try require(PHAsset.fetchAssets(withLocalIdentifiers: [ids["asset"]!], options: nil).count == 0)
      try require(PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [ids["album"]!], options: nil).count == 0)
    }
  }
  static func ownership(_ root: URL) throws -> [String: String] {
    guard let row = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("owned-ids.json"))) as? [String: String], Set(row.keys) == ["asset", "album"] else { throw IosSmbFailure(code: "fixture_ownership") }
    return row
  }
  static func recordOwnership(_ manifest: IosSmbPhotoManifest, state: IosSmbPhotosJournal, root: URL) throws {
    guard let asset = try state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId]))?.target,
      let album = try state.photoText("SELECT target FROM smb_photo_album WHERE key=?", [state.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])]) else { throw IosSmbFailure(code: "fixture_ownership") }
    try JSONSerialization.data(withJSONObject: ["asset": asset, "album": album], options: .sortedKeys).write(to: root.appendingPathComponent("owned-ids.json"), options: .atomic)
  }
  static func verifyOwned(_ manifest: IosSmbPhotoManifest, state: IosSmbPhotosJournal, root: URL) throws {
    let ids = try ownership(root)
    try require(state.photoImport(state.photoKey([manifest.sourceDeviceId, manifest.assetId]))?.target == ids["asset"])
    try require(state.photoText("SELECT target FROM smb_photo_album WHERE key=?", [state.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])]) == ids["album"])
    guard let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [ids["album"]!], options: nil).firstObject,
      let asset = PHAsset.fetchAssets(withLocalIdentifiers: [ids["asset"]!], options: nil).firstObject else { throw IosSmbFailure(code: "fixture_ownership") }
    try require(album.localizedTitle == manifest.albums[0].name && asset.isFavorite)
    let members = PHAsset.fetchAssets(in: album, options: nil)
    try require(members.count == 1 && members.firstObject?.localIdentifier == ids["asset"])
  }
}
