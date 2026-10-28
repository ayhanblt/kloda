import Foundation
import Photos
import UniformTypeIdentifiers
import Darwin

struct IosPhotosSelection: Equatable {
  let id: String
  let reference: String
}
struct IosPhotosAlbumReference: Codable, Equatable {
  let localIdentifier: String
  let title: String
}
struct IosPhotosResourceStamp: Codable, Equatable {
  let type: Int
  let name: String
  let uti: String
}
struct IosPhotosAssetStamp: Codable, Equatable {
  let localIdentifier: String
  let modified: Date?
  let created: Date?
  let mediaType: Int
  let mediaSubtypes: UInt
  let width: Int
  let height: Int
  let duration: Double
  let favorite: Bool
  let resources: [IosPhotosResourceStamp]
  let albums: [IosPhotosAlbumReference]
}
struct IosPhotosExportedResource {
  let role: String
  let name: String
  let mimeType: String
  let sha256: String
  let size: Int64
  let snapshot: String
}

enum IosPhotosSource {
  static func currentSelections() throws -> [IosPhotosSelection] {
    guard let raw = UserDefaults.standard.object(forKey: "kloda.sync.photoSources") else { return [] }
    guard let rows = raw as? [[String: String]] else { throw failure("review_required") }
    var seen = Set<String>(), references = Set<String>()
    return try rows.map {
      guard let id = $0["id"], !id.isEmpty, let reference = $0["reference"], !reference.isEmpty,
        seen.insert(id).inserted, references.insert(reference).inserted else { throw failure("review_required") }
      return IosPhotosSelection(id: id, reference: reference)
    }
  }
  static func assets(selection: IosPhotosSelection) throws -> [PHAsset] {
    try permission()
    guard try currentSelections().contains(selection) else { throw failure("source_changed") }
    let result: PHFetchResult<PHAsset>
    if selection.reference == "photos-library" { result = PHAsset.fetchAssets(with: nil) }
    else {
      guard let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [selection.reference], options: nil).firstObject,
        album.assetCollectionSubtype == .albumRegular else { throw failure("review_required") }
      result = PHAsset.fetchAssets(in: album, options: nil)
    }
    var assets: [PHAsset] = []
    result.enumerateObjects { asset, _, _ in assets.append(asset) }
    return assets
  }
  static func albums(asset: PHAsset) throws -> [IosPhotosAlbumReference] {
    try permission()
    let result = PHAssetCollection.fetchAssetCollectionsContaining(asset, with: .album, options: nil)
    var albums: [IosPhotosAlbumReference] = []
    var invalid = false
    result.enumerateObjects { album, _, _ in
      guard album.assetCollectionSubtype == .albumRegular else { invalid = true; return }
      guard let title = album.localizedTitle, validName(title) else {
        invalid = true; return
      }
      albums.append(IosPhotosAlbumReference(localIdentifier: album.localIdentifier, title: title))
    }
    guard !invalid, albums.count <= 32, Set(albums.map(\.localIdentifier)).count == albums.count else {
      throw failure("review_required")
    }
    return albums.sorted { $0.localIdentifier < $1.localIdentifier }
  }
  static func stamp(asset: PHAsset) throws -> IosPhotosAssetStamp {
    try permission()
    let resources = try resourceList(asset)
    return try IosPhotosAssetStamp(localIdentifier: asset.localIdentifier, modified: asset.modificationDate,
      created: asset.creationDate, mediaType: asset.mediaType.rawValue, mediaSubtypes: asset.mediaSubtypes.rawValue,
      width: asset.pixelWidth, height: asset.pixelHeight, duration: asset.duration, favorite: asset.isFavorite,
      resources: resources.map { IosPhotosResourceStamp(type: $0.type.rawValue, name: $0.originalFilename,
        uti: $0.uniformTypeIdentifier) }, albums: albums(asset: asset))
  }
  static func validate(stamp expected: IosPhotosAssetStamp) throws {
    try permission()
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [expected.localIdentifier], options: nil).firstObject,
      try stamp(asset: asset) == expected else { throw failure("source_changed") }
  }
  static func export(asset: PHAsset, check: @escaping () throws -> Void,
    snapshots: IosFilesSnapshot) throws -> [IosPhotosExportedResource] {
    try check()
    let before = try stamp(asset: asset)
    let resources = try resourceList(asset)
    var exported: [IosPhotosExportedResource] = []
    do {
      for resource in resources {
        try check()
        let value = try stream(resource, check: check, snapshots: snapshots)
        exported.append(value)
      }
      try check()
      try validate(stamp: before)
      return exported
    } catch {
      for value in exported { try? snapshots.discard(value.snapshot) }
      throw error
    }
  }
  private static func resourceList(_ asset: PHAsset) throws -> [PHAssetResource] {
    let resources = PHAssetResource.assetResources(for: asset).sorted { $0.type.rawValue < $1.type.rawValue }
    guard (1...8).contains(resources.count), Set(resources.map { $0.type.rawValue }).count == resources.count,
      resources.allSatisfy({ (1...12).contains($0.type.rawValue) && $0.assetLocalIdentifier == asset.localIdentifier
        && validName($0.originalFilename) && UTType($0.uniformTypeIdentifier)?.preferredMIMEType != nil }) else {
      throw failure("review_required")
    }
    return resources
  }
  private static func stream(_ resource: PHAssetResource, check: @escaping () throws -> Void,
    snapshots: IosFilesSnapshot) throws -> IosPhotosExportedResource {
    guard let mime = UTType(resource.uniformTypeIdentifier)?.preferredMIMEType else { throw failure("review_required") }
    let (name, handle) = try snapshots.createStaging()
    var retained = false
    defer { try? handle.close(); if !retained { try? snapshots.discard(name) } }
    let state = StreamState(handle: handle, check: check)
    let manager = PHAssetResourceManager.default()
    let options = PHAssetResourceRequestOptions()
    // A local backup does not implicitly authorize downloading originals from iCloud.
    options.isNetworkAccessAllowed = false
    let request = manager.requestData(for: resource, options: options,
      dataReceivedHandler: { state.receive($0) }, completionHandler: { state.finish($0) })
    var cancelled = false
    while !state.wait() {
      do { try check() } catch { state.fail(error) }
      if state.failed && !cancelled { manager.cancelDataRequest(request); cancelled = true }
    }
    let total = try state.result()
    try check()
    guard fsync(handle.fileDescriptor) == 0, fcntl(handle.fileDescriptor, F_FULLFSYNC) == 0 else {
      throw IosFilesSource.ioFailure()
    }
    let before = try IosFilesSource.metadata(handle.fileDescriptor)
    let (hash, size) = try IosFilesSource.hash(handle.fileDescriptor, maxBytes: total, cancelled: {
      do { try check(); return false } catch { return true }
    })
    guard size == total, IosFilesSource.unchanged(before, try IosFilesSource.metadata(handle.fileDescriptor)) else {
      throw failure("source_changed")
    }
    try check()
    retained = true
    return IosPhotosExportedResource(role: "resource-\(resource.type.rawValue)", name: resource.originalFilename,
      mimeType: mime, sha256: hash, size: size, snapshot: name)
  }
  private static func validName(_ text: String) -> Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text.utf16.count <= 255
      && text != "." && text != ".." && !text.unicodeScalars.contains {
        $0 == "/" || $0 == "\\" || $0.value < 32 || (127...159).contains($0.value)
      }
  }
  private static func permission() throws {
    // Limited access cannot establish complete album membership for the v1 sidecar.
    guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else {
      throw failure("photo_permission_lost")
    }
  }
  private static func failure(_ code: String) -> IosPairingFailure { .native(code) }

  private final class StreamState {
    private let condition = NSCondition()
    private let handle: FileHandle
    private let check: () throws -> Void
    private var error: Error?
    private var done = false
    private var count: Int64 = 0
    init(handle: FileHandle, check: @escaping () throws -> Void) { self.handle = handle; self.check = check }
    var failed: Bool { condition.lock(); defer { condition.unlock() }; return error != nil }
    func fail(_ value: Error) { condition.lock(); defer { condition.unlock() }; if error == nil { error = value } }
    func receive(_ data: Data) {
      condition.lock(); defer { condition.unlock() }
      guard error == nil, !done else { return }
      do {
        try check()
        let (next, overflow) = count.addingReportingOverflow(Int64(data.count))
        guard !overflow else { throw IosPhotosSource.failure("review_required") }
        try data.withUnsafeBytes { bytes in
          var offset = 0
          while offset < bytes.count {
            try check()
            let written = Darwin.write(handle.fileDescriptor, bytes.baseAddress!.advanced(by: offset), min(65_536, bytes.count - offset))
            if written < 0 && errno == EINTR { continue }
            guard written > 0 else { throw IosFilesSource.ioFailure() }
            offset += written
          }
        }
        count = next
      } catch { self.error = error }
    }
    func finish(_ value: Error?) {
      condition.lock(); defer { condition.unlock() }
      if error == nil, value != nil { error = IosPhotosSource.failure("source_unavailable") }
      done = true; condition.broadcast()
    }
    func wait() -> Bool {
      condition.lock(); defer { condition.unlock() }
      if !done { _ = condition.wait(until: Date(timeIntervalSinceNow: 0.05)) }
      return done
    }
    func result() throws -> Int64 {
      condition.lock(); defer { condition.unlock() }
      if let error { throw error }
      guard done else { throw IosPhotosSource.failure("source_unavailable") }
      return count
    }
  }
}
