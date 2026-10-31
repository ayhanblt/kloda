import UIKit
import Photos

// User-approved exception: only a new synthetic asset/album in this exact owned Simulator/bundle.
enum IosWebDavPhotosAppChecks {
  static func run() throws {
    guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "497AAA0F-967E-4781-9468-3F05CA2D3D5A" else { throw IosWebDavFailure.code("fixture_simulator") }
    guard Bundle.main.bundleIdentifier == "com.kloda.fixture.webdav15" else { throw IosWebDavFailure.code("fixture_bundle") }
    let permission = DispatchSemaphore(value: 0)
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in permission.signal() }
    guard permission.wait(timeout: .now() + 45) == .success,
      PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else { throw IosWebDavFailure.code("fixture_photos_permission") }
    guard try IosFilesSelection.current().isEmpty else { throw IosWebDavFailure.code("fixture_existing_files_source") }
    let previousSources = UserDefaults.standard.object(forKey: "kloda.sync.photoSources")
    let library = PHPhotoLibrary.shared(), title = "KlodaOwnedDAV-" + UUID().uuidString
    let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=")!
    var assetId: String?, albumId: String?
    try library.performChangesAndWait {
      let create = PHAssetCreationRequest.forAsset()
      let options = PHAssetResourceCreationOptions(); options.originalFilename = title + ".png"
      create.addResource(with: .photo, data: png, options: options)
      let album = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: title)
      guard let asset = create.placeholderForCreatedAsset else { return }
      album.addAssets([asset] as NSArray); assetId = asset.localIdentifier
      albumId = album.placeholderForCreatedAssetCollection.localIdentifier
    }
    guard let assetId, let albumId,
      let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject,
      album.localizedTitle == title,
      let asset = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject,
      !asset.isFavorite, PHAsset.fetchAssets(in: album, options: nil).count == 1 else { throw IosWebDavFailure.code("fixture_ownership") }
    let ownershipRoot = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let ledger = ownershipRoot.appendingPathComponent("webdav-photos-owned-" + UUID().uuidString.lowercased() + ".json")
    try JSONSerialization.data(withJSONObject: ["asset": assetId, "album": albumId, "title": title], options: [.sortedKeys]).write(to: ledger, options: .atomic)
    let source = UUID().uuidString.lowercased(), journal = try IosWebDavJournal.open(), snapshots = try IosFilesSnapshot.webdav()
    let profile = IosWebDavProfile(revision: UUID().uuidString, endpoint: "https://127.0.0.1:26443/dav", targetPath: "ios-photos-" + UUID().uuidString, username: "owned", password: "disposable-https-fixture")
    defer {
      // No existing asset, album, identity or personal key is removed. Leave the synthetic PNG as evidence.
      if let owned = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject, owned.localizedTitle == title {
        try? library.performChangesAndWait { PHAssetCollectionChangeRequest.deleteAssetCollections([owned] as NSArray) }
      }
      try? IosWebDavContext.mutate {
        if let previousSources { UserDefaults.standard.set(previousSources, forKey: "kloda.sync.photoSources") }
        else { UserDefaults.standard.removeObject(forKey: "kloda.sync.photoSources") }
      }
      try? journal.setEnabled(kind: "webdav", id: profile.targetId(), enabled: false, revision: profile.revision)
    }
    try IosWebDavContext.mutate { UserDefaults.standard.set([["id": source, "reference": albumId]], forKey: "kloda.sync.photoSources") }
    try IosWebDavVault.write(profile)
    try journal.setEnabled(kind: "webdav", id: profile.targetId(), enabled: true, revision: profile.revision)
    let binding = try IosWebDavContext.capture(profile, journal: journal)
    let check = { try IosWebDavContext.check(profile, binding: binding, journal: journal) }
    let first = IosWebDavPhotosRunner(publisher: IosWebDavPublisher(profile: profile, binding: binding, journal: journal, snapshots: snapshots, check: check,
      settle: { try IosWebDavContext.complete($0, profile: profile, journal: journal) }, track: { _ in }))
    try first.run()
    guard first.errorCode == nil else { throw IosWebDavFailure.code(first.errorCode!) }
    let baseline = try journal.uploads(target: profile.targetId())
    guard baseline.count == 2, baseline.allSatisfy({ $0.phase == "completed" }), baseline.filter({ $0.kind == "photo_resource" }).count == 1 else { throw IosWebDavFailure.code("fixture_initial_backup") }
    let media = baseline.first { $0.kind == "photo_resource" }!
    let transport = IosWebDavTransport(profile: profile, snapshots: snapshots, check: check)
    try IosWebDavSourceValidation(journal: journal, snapshots: snapshots, transport: transport, check: check).validate(media)
    try library.performChangesAndWait { PHAssetChangeRequest(for: asset).isFavorite = true }
    guard PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject?.isFavorite == true else { throw IosWebDavFailure.code("fixture_favorite") }
    let interrupted = IosWebDavPhotosRunner(publisher: IosWebDavPublisher(profile: profile, binding: binding, journal: journal, snapshots: snapshots, check: check,
      settle: { value in
        if value.kind == "photo_manifest" { try IosWebDavContext.mutate {} }
        try IosWebDavContext.complete(value, profile: profile, journal: journal)
      }, track: { _ in }))
    try WebDavChecksApp.rejects("settings_changed") { try interrupted.run() }
    let pending = try journal.uploads(target: profile.targetId()).filter { $0.phase != "completed" }
    guard pending.count == 1, pending[0].phase == "moved", pending[0].kind == "photo_manifest", pending[0].binding == binding else { throw IosWebDavFailure.code("fixture_ack_fence") }
    let actor = IosWebDavReview()
    let visible = { DispatchQueue.main.sync { UIApplication.shared.applicationState == .active } }
    func review(_ action: String) throws -> [String: Any] {
      let signal = DispatchSemaphore(value: 0); var result: Result<[String: Any], Error>?
      actor.perform(id: pending[0].id, action: action, request: UUID(), visible: visible) { result = $0; signal.signal() }
      guard signal.wait(timeout: .now() + 30) == .success, let result else { actor.cancel(); throw IosWebDavFailure.code("fixture_wait") }
      return try result.get()
    }
    try WebDavChecksApp.rejects("settings_changed") { _ = try review("recheck") }
    guard try review("authorize_recheck")["state"] as? String == "completed" else { throw IosWebDavFailure.code("fixture_review") }
    let final = try journal.uploads(target: profile.targetId())
    guard final.count == 3, final.allSatisfy({ $0.phase == "completed" }), final.filter({ $0.kind == "photo_resource" }).count == 1,
      final.first(where: { $0.id == pending[0].id })?.binding == binding else { throw IosWebDavFailure.code("fixture_metadata_reuploaded") }
    let manifests = try final.filter { $0.kind == "photo_manifest" }.map { row -> IosWebDavPhotoManifest in
      var bytes = Data()
      let response = try IosWebDavClient.send(profile: profile, path: journal.publication(row), method: "GET", size: row.size, receive: { bytes.append($0) }, check: {})
      guard response.status == 200, response.sha256 == row.sha256, response.size == row.size else { throw IosWebDavFailure.code("fixture_sidecar_hash") }
      let manifest = try IosWebDavPhotoManifestCodec.decode(bytes)
      try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: profile.targetId(), journal: journal)
      return manifest
    }.sorted { $0.revision < $1.revision }
    guard manifests.count == 2, manifests[0].favorite == false, manifests[1].favorite == true, manifests[1].revision > manifests[0].revision,
      manifests[0].resources == manifests[1].resources, manifests.allSatisfy({ $0.albums.count == 1 }) else { throw IosWebDavFailure.code("fixture_metadata") }
    if Bundle.main.object(forInfoDictionaryKey: "KLODAFixturePhotosRestore") as? Bool == true {
      try IosWebDavPhotosRestoreAppChecks.run(profile: profile, manifestId: pending[0].id,
        manifest: manifests[1], sourceAsset: assetId, sourceAlbum: albumId, visible: visible)
    }
    let report: [String: Any] = ["status": "PASS", "asset": assetId, "album": albumId, "albumTitle": title, "mediaOperations": 1, "manifestOperations": 2,
      "scope": "owned PhotoKit source/vault/HTTPS metadata-only, source validator and explicit current-context review after received MOVE ACK; synthetic PNG retained, owned album cleanup attempted; BG/physical NOT_RUN"]
    let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("webdav-photos-result.json")
    try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]).write(to: output, options: .atomic)
  }
}
