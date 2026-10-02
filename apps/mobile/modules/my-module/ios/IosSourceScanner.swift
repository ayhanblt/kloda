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
    guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys, options: [.skipsHiddenFiles]) else {
      throw sourceError("Could not enumerate the selected directory.")
    }
    var files: [IosQueuedSourceFile] = []
    for case let fileUrl as URL in enumerator {
      let values = try fileUrl.resourceValues(forKeys: Set(keys))
      guard values.isRegularFile == true, values.isSymbolicLink != true else { continue }
      let relativePath = String(fileUrl.path.dropFirst(root.path.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
      let size = Int64(values.fileSize ?? 0)
      let modified = Int64(values.contentModificationDate?.timeIntervalSince1970 ?? 0)
      files.append(IosQueuedSourceFile(reference: relativePath, relativePath: relativePath, revision: "\(size):\(modified)", size: size))
    }
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

  private func sourceError(_ message: String) -> NSError {
    NSError(domain: "KlodaSourceScanner", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
