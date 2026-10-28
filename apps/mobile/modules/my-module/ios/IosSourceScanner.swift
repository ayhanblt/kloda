import Foundation
import Photos

final class IosSourceScanner {
  func scanDirectory(bookmark: String) throws -> [IosQueuedSourceFile] {
    guard let bookmarkData = Data(base64Encoded: bookmark) else { throw sourceError("The directory reference is invalid.") }
    var stale = false
    let root = try URL(resolvingBookmarkData: bookmarkData, bookmarkDataIsStale: &stale)
    guard !stale, root.startAccessingSecurityScopedResource() else { throw sourceError("The selected directory is unavailable.") }
    defer { root.stopAccessingSecurityScopedResource() }

    let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey]
    var enumerationError: Error?
    guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys,
      options: [.skipsHiddenFiles], errorHandler: { _, error in enumerationError = error; return false }) else {
      throw sourceError("Could not enumerate the selected directory.")
    }
    var files: [IosQueuedSourceFile] = []
    for case let fileUrl as URL in enumerator {
      let values = try fileUrl.resourceValues(forKeys: Set(keys))
      if values.isSymbolicLink == true { enumerator.skipDescendants(); continue }
      guard values.isRegularFile == true else { continue }
      let base = root.standardizedFileURL.pathComponents
      let components = fileUrl.standardizedFileURL.pathComponents
      guard components.starts(with: base), components.count > base.count,
        let byteCount = values.fileSize, byteCount >= 0, let date = values.contentModificationDate else {
        throw IosPairingFailure.native("source_unavailable")
      }
      let relativePath = components.dropFirst(base.count).joined(separator: "/")
      _ = try IosFilesSource.components(relativePath)
      let size = Int64(byteCount)
      let modified = Int64(date.timeIntervalSince1970)
      files.append(IosQueuedSourceFile(reference: relativePath, relativePath: relativePath, revision: "\(size):\(modified)", size: size))
    }
    if enumerationError != nil { throw IosPairingFailure.native("source_unavailable") }
    return files
  }

  func scanPhotos(reference: String) throws -> [IosQueuedSourceFile] {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    guard status == .authorized || status == .limited else { throw sourceError("Photo access is unavailable.") }
    let assets: PHFetchResult<PHAsset>
    if reference == "photos-library" {
      assets = PHAsset.fetchAssets(with: nil)
    } else {
      guard let collection = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [reference], options: nil).firstObject else {
        throw sourceError("The selected photo album is unavailable.")
      }
      assets = PHAsset.fetchAssets(in: collection, options: nil)
    }

    var files: [IosQueuedSourceFile] = []
    assets.enumerateObjects { asset, _, _ in
      let assetName = asset.localIdentifier.replacingOccurrences(of: "/", with: "_")
      for (index, resource) in PHAssetResource.assetResources(for: asset).enumerated() {
        let filename = resource.originalFilename.isEmpty ? "resource-\(index)" : resource.originalFilename
        let reference = "\(asset.localIdentifier)|\(index)"
        let relativePath = "\(assetName)/\(filename)"
        let modified = Int64(asset.modificationDate?.timeIntervalSince1970 ?? asset.creationDate?.timeIntervalSince1970 ?? 0)
        files.append(IosQueuedSourceFile(reference: reference, relativePath: relativePath, revision: "\(resource.uniformTypeIdentifier):\(modified)", size: 0))
      }
    }
    return files
  }

  private func sourceError(_ message: String) -> IosPairingFailure {
    .native("source_unavailable")
  }
}
