#if KLODA_FTPS_NATIVE
import Foundation
import Photos
import UniformTypeIdentifiers
import Darwin

// PhotoKit transaction/reconciliation follows the existing importer with a separate FTPS schema/receipt store.
enum IosFtpsPhotosImport {
  static func importManifest(manifest: IosFtpsPhotoManifest, stages: [String: URL], journal: IosFtpsPhotosJournal,
    check: @escaping () throws -> Void) throws {
    try check(); try permission()
    let data = try IosFtpsPhotoManifestCodec.encode(manifest)
    let key = try journal.photoKey([manifest.sourceDeviceId, manifest.assetId])
    var intent = IosFtpsPhotoImport(key: key, manifest: data)
    if var existing = try journal.photoImport(key) {
      guard try IosFtpsPhotoManifestCodec.decode(existing.manifest) == manifest else {
        existing.state = "review_required"; existing.errorCode = "review_required"
        try journal.savePhotoImport(existing)
        throw fail("review_required")
      }
      if existing.state != "prepared" { try verify(intent: existing, journal: journal, check: check); return }
      intent = existing
    }
    try journal.savePhotoImport(intent)
    let types: [PHAssetResourceType]
    let albums: [Album]
    var importFiles: [String: URL] = [:]
    defer { for url in importFiles.values { try? FileManager.default.removeItem(at: url) } }
    do {
      types = try manifest.resources.map { try IosPhotosImportMedia.resourceType($0, single: manifest.resources.count == 1) }
      guard PHAssetCreationRequest.supportsAssetResourceTypes(types.map { NSNumber(value: $0.rawValue) }),
        Set(stages.keys) == Set(manifest.resources.map(\.relativePath)) else { throw fail("review_required") }
      for resource in manifest.resources {
        guard let url = stages[resource.relativePath], url.isFileURL else { throw fail("review_required") }
        try IosPhotosImportMedia.verifyStage(url, resource: resource, check: check)
        guard let suffix = UTType(mimeType: resource.mimeType)?.preferredFilenameExtension,
          !suffix.isEmpty, suffix.utf8.count <= 32,
          suffix.utf8.allSatisfy({ (48...57).contains($0) || (65...90).contains($0) || (97...122).contains($0) }) else { throw fail("review_required") }
        // PhotoKit rejected identical bytes under .snapshot in the isolated runtime check.
        let target = url.deletingLastPathComponent().appendingPathComponent(UUID().uuidString.lowercased()).appendingPathExtension(suffix)
        try FileManager.default.copyItem(at: url, to: target)
        importFiles[resource.relativePath] = target
        try FileManager.default.setAttributes([.posixPermissions: 0o600, .protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
        try IosPhotosImportMedia.verifyStage(target, resource: resource, check: check)
      }
      albums = try prepareAlbums(manifest, journal: journal)
      try check(); try permission()
    } catch {
      let code = (error as? IosPairingFailure)?.code ?? (IosFilesSource.isStorageFull(error) ? "local_storage_full" : "review_required")
      // No PhotoKit write began: retain the prepared intent so an explicit retry is safe.
      intent.errorCode = code
      try journal.savePhotoImport(intent)
      throw error
    }
    intent.state = "creating"; intent.errorCode = nil
    try journal.execute("BEGIN IMMEDIATE")
    do {
      try journal.savePhotoImport(intent)
      for album in albums where album.target == nil {
        try journal.execute("INSERT INTO ftps_photo_album(key,target,state) VALUES (?,NULL,'creating')", values: [album.key])
      }
      try journal.execute("COMMIT")
    } catch { try? journal.execute("ROLLBACK"); throw error }
    var bindingError: Error?
    do {
      try PHPhotoLibrary.shared().performChangesAndWait {
        do {
          try check()
          let request = PHAssetCreationRequest.forAsset()
          for (index, resource) in manifest.resources.enumerated() {
            let options = PHAssetResourceCreationOptions()
            options.originalFilename = resource.name
            options.uniformTypeIdentifier = UTType(mimeType: resource.mimeType)?.identifier
            options.shouldMoveFile = false
            request.addResource(with: types[index], fileURL: importFiles[resource.relativePath]!, options: options)
          }
          if let favorite = manifest.favorite { request.isFavorite = favorite }
          guard let placeholder = request.placeholderForCreatedAsset else { throw fail("review_required") }
          intent.target = placeholder.localIdentifier
          try journal.savePhotoImport(intent)
          for album in albums {
            let change: PHAssetCollectionChangeRequest
            if let existing = album.target {
              guard let collection = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [existing], options: nil).firstObject,
                collection.assetCollectionSubtype == .albumRegular, collection.canPerform(.addContent),
                let update = PHAssetCollectionChangeRequest(for: collection) else { throw fail("organization_review") }
              change = update
            } else {
              change = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: album.title)
              try journal.execute("UPDATE ftps_photo_album SET target=? WHERE key=? AND target IS NULL",
                values: [change.placeholderForCreatedAssetCollection.localIdentifier, album.key])
            }
            change.addAssets([placeholder] as NSArray)
          }
        } catch { bindingError = error }
      }
    } catch {
      // A failed callback or response does not establish that Photos made no changes.
      intent.state = "review_required"; intent.errorCode = "review_required"
      try journal.savePhotoImport(intent)
      throw fail("review_required")
    }
    if bindingError != nil {
      intent.state = "review_required"; intent.errorCode = "review_required"
      try journal.savePhotoImport(intent)
      throw fail("review_required")
    }
    try verify(intent: intent, journal: journal, check: check)
  }

  static func verify(intent: IosFtpsPhotoImport, journal: IosFtpsPhotosJournal,
    check: @escaping () throws -> Void) throws {
    var current = intent
    do {
      try check(); try permission()
      let manifest = try IosFtpsPhotoManifestCodec.decode(intent.manifest)
      guard intent.key == (try journal.photoKey([manifest.sourceDeviceId, manifest.assetId])),
        let target = intent.target,
        let asset = PHAsset.fetchAssets(withLocalIdentifiers: [target], options: nil).firstObject else {
        throw fail("review_required")
      }
      let before = try IosPhotosSource.stamp(asset: asset)
      let snapshots = try IosFilesSnapshot.ftps()
      let exported = try IosPhotosSource.export(asset: asset, check: check, snapshots: snapshots)
      defer { for value in exported { try? snapshots.discard(value.snapshot) } }
      guard exported.count == manifest.resources.count else { throw fail("review_required") }
      for expected in manifest.resources {
        let type = try IosPhotosImportMedia.resourceType(expected, single: manifest.resources.count == 1)
        guard let actual = exported.first(where: { $0.role == "resource-\(type.rawValue)" }),
          actual.name == expected.name, actual.mimeType == expected.mimeType,
          actual.sha256 == expected.sha256, actual.size == expected.size else { throw fail("review_required") }
      }
      if let favorite = manifest.favorite, favorite != asset.isFavorite { throw fail("organization_review") }
      for album in manifest.albums {
        let key = try journal.photoKey([manifest.sourceDeviceId, album.id])
        guard let id = try journal.photoText("SELECT target FROM ftps_photo_album WHERE key=?", [key]),
          let collection = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [id], options: nil).firstObject,
          collection.assetCollectionSubtype == .albumRegular, collection.localizedTitle == album.name else {
          throw fail("organization_review")
        }
        let members = PHAsset.fetchAssets(in: collection, options: nil)
        var present = false
        members.enumerateObjects { member, _, _ in if member.localIdentifier == target { present = true } }
        guard present else { throw fail("organization_review") }
        try journal.execute("UPDATE ftps_photo_album SET state='completed' WHERE key=? AND target=?", values: [key, id])
      }
      try check(); try permission()
      try IosPhotosSource.validate(stamp: before)
      current.state = "completed"; current.errorCode = nil
      try journal.savePhotoImport(current)
    } catch {
      let code = (error as? IosPairingFailure)?.code ?? "review_required"
      current.state = code == "organization_review" ? "organization_review" : "review_required"
      current.errorCode = code
      try journal.savePhotoImport(current)
      throw error
    }
  }

  private struct Album {
    let key: String
    let title: String
    let target: String?
  }
  private static func prepareAlbums(_ manifest: IosFtpsPhotoManifest, journal: IosFtpsPhotosJournal) throws -> [Album] {
    try manifest.albums.map { album in
      let key = try journal.photoKey([manifest.sourceDeviceId, album.id])
      let state = try journal.photoText("SELECT state FROM ftps_photo_album WHERE key=?", [key])
      let target = try journal.photoText("SELECT target FROM ftps_photo_album WHERE key=?", [key])
      if state != nil {
        guard state != "review_required", let target,
          let collection = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [target], options: nil).firstObject,
          collection.assetCollectionSubtype == .albumRegular, collection.localizedTitle == album.name,
          collection.canPerform(.addContent) else { throw fail("organization_review") }
      }
      return Album(key: key, title: album.name, target: target)
    }
  }
  private static func permission() throws {
    guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else { throw fail("photo_permission_lost") }
  }
  private static func fail(_ code: String) -> IosPairingFailure { .native(code) }
}

#endif
