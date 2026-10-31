import Foundation
import Photos
import UIKit
import SQLite3

// Read-only gallery access is deliberately separate from full-membership backup validation.
enum IosGallery {
  static func permission() -> String {
    switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
    case .authorized: return "granted"
    case .limited: return "limited"
    default: return "denied"
    }
  }
  private static func selection(_ source: String) throws -> IosPhotosSelection {
    guard let selected = try IosPhotosSource.currentSelections().first(where: { $0.id == source }) else {
      throw IosPairingFailure.native("source_changed")
    }
    return selected
  }
  private static func assets(_ source: String) throws -> PHFetchResult<PHAsset> {
    let selected = try selection(source)
    guard permission() != "denied" else { throw IosPairingFailure.native("photo_permission_lost") }
    let options = PHFetchOptions()
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    options.predicate = NSPredicate(format: "mediaType == %d OR mediaType == %d", PHAssetMediaType.image.rawValue, PHAssetMediaType.video.rawValue)
    if selected.reference == "photos-library" { return PHAsset.fetchAssets(with: options) }
    guard let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [selected.reference], options: nil).firstObject else {
      throw IosPairingFailure.native("source_unavailable")
    }
    return PHAsset.fetchAssets(in: album, options: options)
  }
  private static func checked(_ source: String, _ id: String) throws -> PHAsset {
    guard !id.isEmpty, id.utf8.count <= 4096,
      let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject,
      try assets(source).index(of: asset) != NSNotFound else { throw IosPairingFailure.native("source_changed") }
    return asset
  }
  static func page(_ source: String, _ offset: Int) throws -> [String: Any] {
    guard offset >= 0, offset <= Int.max - 24 else { throw IosPairingFailure.native("invalid_request") }
    let selected = try selection(source), access = permission()
    if access == "denied" { return ["permission": access, "items": [], "hasMore": false] }
    let result: PHFetchResult<PHAsset>
    do { result = try assets(source) }
    catch IosPairingFailure.native("source_unavailable") where access == "limited" {
      // PhotoKit hides user-album membership in limited mode; never broaden it to the library.
      return ["permission": access, "items": [], "hasMore": false, "scopeUnavailable": true]
    }
    let end = min(result.count, offset + 24)
    var items: [[String: Any]] = []
    if offset < end {
      for index in offset..<end {
        let asset = result.object(at: index)
        var row: [String: Any] = ["id": asset.localIdentifier,
          "name": PHAssetResource.assetResources(for: asset).first?.originalFilename ?? asset.localIdentifier,
          "width": asset.pixelWidth, "height": asset.pixelHeight,
          "video": asset.mediaType == .video, "favorite": asset.isFavorite]
        if let created = asset.creationDate {
          let milliseconds = created.timeIntervalSince1970 * 1000
          if milliseconds.isFinite && abs(milliseconds) <= 8640000000000000 { row["created"] = String(Int64(milliseconds)) }
        }
        items.append(row)
      }
    }
    guard try selection(source) == selected, permission() == access else { throw IosPairingFailure.native("source_changed") }
    return ["permission": access, "items": items, "hasMore": end < result.count]
  }
  static func preview(_ source: String, _ id: String, _ detail: Bool) throws -> String? {
    let selected = try selection(source), asset = try checked(source, id)
    let options = PHImageRequestOptions()
    options.isNetworkAccessAllowed = false
    options.isSynchronous = true
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .exact
    let edge = detail ? 1024 : 256
    var data: Data?
    PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: edge, height: edge),
      contentMode: .aspectFit, options: options) { image, info in
      guard info?[PHImageErrorKey] == nil, info?[PHImageCancelledKey] as? Bool != true,
        let image else { return }
      // Bound encoded pixels even if PhotoKit returns a larger image than requested.
      let ratio = min(1, CGFloat(edge) / max(image.size.width, image.size.height))
      guard ratio > 0 else { return }
      let format = UIGraphicsImageRendererFormat(); format.scale = 1
      let size = CGSize(width: max(1, image.size.width * ratio), height: max(1, image.size.height * ratio))
      data = UIGraphicsImageRenderer(size: size, format: format).image { _ in
        image.draw(in: CGRect(origin: .zero, size: size))
      }.jpegData(compressionQuality: 0.75)
    }
    _ = try checked(source, id)
    guard try selection(source) == selected else { throw IosPairingFailure.native("source_changed") }
    guard let data, data.count <= 1048576 else { return nil }
    return "data:image/jpeg;base64," + data.base64EncodedString()
  }
  static func history(_ source: String, _ id: String) throws -> [[String: String]] {
    _ = try checked(source, id)
    let path = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
      appropriateFor: nil, create: false).appendingPathComponent("kloda-sync.sqlite").path
    if !FileManager.default.fileExists(atPath: path) { return [] }
    var db: OpaquePointer?
    guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      sqlite3_close(db); throw IosPairingFailure.native("storage_failure")
    }
    defer { sqlite3_close(db) }
    var statement: OpaquePointer?
    let sql = "SELECT record_id,state FROM files_job WHERE source_id=? AND reference=? ORDER BY rowid DESC LIMIT 16"
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { throw IosPairingFailure.native("storage_failure") }
    defer { sqlite3_finalize(statement) }
    let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    guard sqlite3_bind_text(statement, 1, source, -1, transient) == SQLITE_OK,
      sqlite3_bind_text(statement, 2, IosFilesJob.photosReferencePrefix + id + ":manifest", -1, transient) == SQLITE_OK else {
      throw IosPairingFailure.native("storage_failure")
    }
    var rows: [[String: String]] = []
    while true {
      let step = sqlite3_step(statement)
      if step == SQLITE_DONE { break }
      guard step == SQLITE_ROW, let record = sqlite3_column_text(statement, 0),
        let state = sqlite3_column_text(statement, 1) else { throw IosPairingFailure.native("storage_failure") }
      rows.append(["recordId": String(cString: record), "state": String(cString: state), "kind": "manifest"])
    }
    _ = try checked(source, id)
    return rows
  }
}
