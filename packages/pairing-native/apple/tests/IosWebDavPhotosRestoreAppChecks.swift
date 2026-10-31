import UIKit
import Photos

// Separate approved exception: only this run's new receipt-bound restore copy, never existing media.
enum IosWebDavPhotosRestoreAppChecks {
  static func run(profile: IosWebDavProfile, manifestId: String, manifest: IosWebDavPhotoManifest,
    sourceAsset: String, sourceAlbum: String, visible: @escaping () -> Bool) throws {
    guard Bundle.main.object(forInfoDictionaryKey: "KLODAFixturePhotosRestore") as? Bool == true,
      Bundle.main.bundleIdentifier == "com.kloda.fixture.webdav15",
      ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "497AAA0F-967E-4781-9468-3F05CA2D3D5A",
      manifest.albums.count == 1, manifest.favorite == true else { throw fail("fixture_restore_scope") }
    let journal = try IosWebDavJournal.open(), target = try profile.targetId()
    let state = try IosWebDavPhotosJournal(database: journal.database, target: target, commit: { try $0() })
    let key = try state.photoKey([manifest.sourceDeviceId, manifest.assetId])
    let albumKey = try state.photoKey([manifest.sourceDeviceId, manifest.albums[0].id])
    guard try state.photoImport(key) == nil,
      try state.photoText("SELECT target FROM webdav_photo_album WHERE key=?", [albumKey]) == nil else { throw fail("fixture_existing_restore") }
    // Explicit restore is independent of automatic backup opt-in; capture the new binding afterward.
    try journal.setEnabled(kind: "webdav", id: target, enabled: false, revision: profile.revision)
    let binding = try IosWebDavContext.capture(profile, journal: journal)
    let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let report = root.appendingPathComponent("webdav-photos-restore-result.json")
    var record: [String: Any] = ["status": "RUNNING", "sourceAsset": sourceAsset, "sourceAlbum": sourceAlbum,
      "target": target, "manifest": manifestId,
      "sourceHash": Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureSourceHash") as? String ?? "missing"]
    func save() throws { try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]).write(to: report, options: .atomic) }
    try save()
    func restore() throws {
      let actor = IosWebDavPhotosRestore(), ticket = UUID(), signal = DispatchSemaphore(value: 0)
      var result: Result<[String: Any], Error>?
      actor.restore(id: manifestId, profile: profile, binding: binding, ticket: ticket, visible: visible) {
        result = $0; signal.signal()
      }
      guard signal.wait(timeout: .now() + 45) == .success, let result else {
        actor.cancel(ticket); throw fail("fixture_restore_wait")
      }
      guard try result.get()["state"] as? String == "completed" else { throw fail("fixture_restore_result") }
    }
    do {
      try restore()
      // Reopen a real database connection; this is same-process recovery, not a process-death claim.
      let reopened = try IosWebDavJournal.open()
      let saved = try IosWebDavPhotosJournal(database: reopened.database, target: target, commit: { try $0() })
      guard let intent = try saved.photoImport(key), intent.state == "completed", let assetId = intent.target,
        let albumId = try saved.photoText("SELECT target FROM webdav_photo_album WHERE key=?", [albumKey]),
        assetId != sourceAsset, albumId != sourceAlbum,
        intent.manifest == (try IosWebDavPhotoManifestCodec.encode(manifest)) else { throw fail("fixture_restore_receipt") }
      record["restoredAsset"] = assetId; record["restoredAlbum"] = albumId; try save()
      func verify() throws {
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject, asset.isFavorite,
          let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject,
          album.localizedTitle == manifest.albums[0].name else { throw fail("fixture_restore_metadata") }
        let members = PHAsset.fetchAssets(in: album, options: nil)
        guard members.count == 1, members.firstObject?.localIdentifier == assetId else { throw fail("fixture_restore_duplicate") }
        try IosWebDavPhotosImport.verify(intent: intent, journal: saved, check: {
          try IosWebDavContext.synchronized {
            guard try IosWebDavVault.read() == profile,
              try IosWebDavContext.capture(profile, journal: reopened) == binding else { throw fail("settings_changed") }
          }
        })
      }
      try verify(); try restore(); try verify()
      guard try saved.photoImport(key)?.target == assetId,
        try saved.photoText("SELECT target FROM webdav_photo_album WHERE key=?", [albumKey]) == albumId else { throw fail("fixture_restore_duplicate") }
      record["status"] = "VERIFIED_CLEANUP_PENDING"; try save()
      // These exact IDs were absent before this run and recorded by its own native import transaction.
      guard let ownedAsset = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject,
        let ownedAlbum = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject,
        try saved.photoImport(key)?.target == assetId else { throw fail("fixture_restore_cleanup_receipt") }
      try PHPhotoLibrary.shared().performChangesAndWait {
        PHAssetChangeRequest.deleteAssets([ownedAsset] as NSArray)
        PHAssetCollectionChangeRequest.deleteAssetCollections([ownedAlbum] as NSArray)
      }
      guard PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).count == 0,
        PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).count == 0,
        PHAsset.fetchAssets(withLocalIdentifiers: [sourceAsset], options: nil).count == 1 else { throw fail("fixture_restore_cleanup") }
      record["status"] = "PASS"
      record["scope"] = "own PhotoKit restore via real native actor/Keychain/HTTPS/Completed receipts, full bytes/name/MIME/favorite/album, same-process DB reopen and repeat no duplicate; only recorded new restore copy/album cleaned; source retained; Expo UI, fresh process, BG delivery and physical NOT_RUN"
      try save()
    } catch {
      record["status"] = "FAIL_RETAINED_FOR_REVIEW"; record["error"] = String(describing: error)
      try? save(); throw error
    }
  }
  private static func fail(_ code: String) -> IosWebDavFailure { .code(code) }
}
