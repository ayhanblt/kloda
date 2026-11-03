import ExpoModulesCore
import UIKit
import Photos
import UniformTypeIdentifiers

struct DirectorySelection {
  let bookmark: String
  let displayName: String
}

final class DirectoryPickerDelegate: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  private var continuation: CheckedContinuation<DirectorySelection?, Never>?

  @MainActor func pick(from viewController: UIViewController) async -> DirectorySelection? {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
      picker.delegate = self
      picker.presentationController?.delegate = self
      viewController.present(picker, animated: true)
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first, url.startAccessingSecurityScopedResource() else {
      finish(with: nil)
      return
    }
    defer { url.stopAccessingSecurityScopedResource() }
    let bookmark = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
    let selection = bookmark.map { DirectorySelection(bookmark: $0.base64EncodedString(), displayName: url.lastPathComponent) }
    finish(with: selection)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(with: nil) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(with: nil) }

  private func finish(with value: DirectorySelection?) {
    continuation?.resume(returning: value)
    continuation = nil
  }
}

public class KlodaSyncRuntimeModule: Module {
  private let intervalKey = "kloda.sync.intervalHours"
  private let timeKey = "kloda.sync.localTime"
  private let directorySourcesKey = "kloda.sync.directorySources"
  private let photoSourcesKey = "kloda.sync.photoSources"
  private let storageEndpointKey = "kloda.sync.storageEndpoint"
  private let storageTargetPathKey = "kloda.sync.storageTargetPath"
  private let storageUsernameKey = "kloda.sync.storageUsername"
  private let directoryPicker = DirectoryPickerDelegate()

  // The picker and the current view controller are UIKit state: main actor only (an async function runs off main).
  @MainActor private func presentDirectoryPicker() async -> DirectorySelection? {
    guard let viewController = appContext?.utilities?.currentViewController() else { return nil }
    return await directoryPicker.pick(from: viewController)
  }

  public func definition() -> ModuleDefinition {
    Name("KlodaSyncRuntime")

    AsyncFunction("pickDirectory") { (_: String) async throws -> [String: String]? in
      guard let selection = await self.presentDirectoryPicker() else {
        return nil
      }
      return try self.saveDirectorySource(selection)
    }

    AsyncFunction("loadDirectorySources") { () -> [[String: String]] in
      self.loadSources(forKey: self.directorySourcesKey, kind: "directory")
    }

    AsyncFunction("validateDirectorySources") { () -> [[String: Any]] in
      self.directorySourceAccess()
    }

    AsyncFunction("prepareSourceJobs") { () throws -> [String: Int] in
      let journal = try IosSyncJournal()
      let scanner = IosSourceScanner()
      var queuedFiles = 0
      let directorySources = UserDefaults.standard.array(forKey: self.directorySourcesKey) as? [[String: String]] ?? []
      for source in directorySources {
        guard let id = source["id"], let bookmark = source["reference"] else { continue }
        queuedFiles += try journal.replaceSourceFiles(sourceId: id, files: scanner.scanDirectory(bookmark: bookmark))
      }
      let photoSources = UserDefaults.standard.array(forKey: self.photoSourcesKey) as? [[String: String]] ?? []
      for source in photoSources {
        guard let id = source["id"], let reference = source["reference"] else { continue }
        queuedFiles += try journal.replaceSourceFiles(sourceId: id, files: scanner.scanPhotos(reference: reference))
      }
      return ["queuedFiles": queuedFiles, "scannedSources": directorySources.count + photoSources.count]
    }

    AsyncFunction("removeDirectorySource") { (id: String) throws in
      try self.removeSource(id: id, forKey: self.directorySourcesKey)
    }

    AsyncFunction("selectPhotoLibrary") { () async throws -> [String: String]? in
      guard await self.requestPhotoLibraryAuthorization() else {
        return nil
      }
      return try self.savePhotoSource(reference: "photos-library", displayName: "Photos library")
    }

    AsyncFunction("loadPhotoAlbums") { () async -> [[String: String]] in
      guard await self.requestPhotoLibraryAuthorization() else {
        return []
      }
      return self.photoAlbums()
    }

    AsyncFunction("selectPhotoAlbum") { (id: String) async throws -> [String: String]? in
      guard await self.requestPhotoLibraryAuthorization(),
            let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [id], options: nil).firstObject,
            let displayName = album.localizedTitle else {
        return nil
      }
      return try self.savePhotoSource(reference: album.localIdentifier, displayName: displayName)
    }

    AsyncFunction("galleryPage") { (source: String, offset: Int) throws -> [String: Any] in
      try IosGallery.page(source, offset)
    }
    AsyncFunction("galleryPreview") { (source: String, asset: String, detail: Bool) throws -> String? in
      try IosGallery.preview(source, asset, detail)
    }
    AsyncFunction("galleryHistory") { (source: String, asset: String) throws -> [[String: String]] in
      try IosGallery.history(source, asset)
    }

    AsyncFunction("loadPhotoSources") { () -> [[String: String]] in
      self.loadSources(forKey: self.photoSourcesKey, kind: "photos")
    }

    AsyncFunction("removePhotoSource") { (id: String) throws in
      try self.removeSource(id: id, forKey: self.photoSourcesKey)
    }

    AsyncFunction("loadStorageConfig") { () -> [String: String]? in
      let defaults = UserDefaults.standard
      guard let endpoint = defaults.string(forKey: self.storageEndpointKey),
            let targetPath = defaults.string(forKey: self.storageTargetPathKey),
            let username = defaults.string(forKey: self.storageUsernameKey) else {
        return nil
      }
      return ["endpoint": endpoint, "targetPath": targetPath, "username": username]
    }

    AsyncFunction("saveStorageConfig") { (endpoint: String, targetPath: String, username: String) in
      guard !endpoint.isEmpty && !targetPath.isEmpty && !username.isEmpty else {
        throw NSError(domain: "KlodaSyncRuntime", code: 3, userInfo: [NSLocalizedDescriptionKey: "Storage fields are required."])
      }
      let defaults = UserDefaults.standard
      defaults.set(endpoint, forKey: self.storageEndpointKey)
      defaults.set(targetPath, forKey: self.storageTargetPathKey)
      defaults.set(username, forKey: self.storageUsernameKey)
    }

    AsyncFunction("loadSchedule") { () -> [String: Any] in
      let defaults = UserDefaults.standard
      return [
        "backupMode": defaults.string(forKey: "kloda.sync.backupMode") ?? (defaults.object(forKey: self.intervalKey) == nil ? "live" : "scheduled"),
        "intervalHours": max(12, defaults.object(forKey: self.intervalKey) as? Int ?? 12),
        "localTime": defaults.string(forKey: self.timeKey) ?? "12:00"
      ]
    }

    AsyncFunction("saveLiveSchedule") {
      try IosWebDavContext.mutate { UserDefaults.standard.set("live", forKey: "kloda.sync.backupMode") }
      IosAutomaticCoordinator.shared.settingsChanged()
    }

    AsyncFunction("saveSchedule") { (intervalHours: Int, localTime: String) in
      guard intervalHours == 0 || intervalHours == 12 || intervalHours == 24 else {
        throw NSError(domain: "KlodaSyncRuntime", code: 1, userInfo: [NSLocalizedDescriptionKey: "Interval must be Live, 12 or 24 hours."])
      }
      guard localTime.range(of: "^([01]\\d|2[0-3]):[0-5]\\d$", options: .regularExpression) != nil else {
        throw NSError(domain: "KlodaSyncRuntime", code: 2, userInfo: [NSLocalizedDescriptionKey: "Time must use HH:mm."])
      }
      try IosWebDavContext.mutate {
      UserDefaults.standard.set(intervalHours, forKey: self.intervalKey)
      UserDefaults.standard.set(intervalHours == 0 ? "live" : "scheduled", forKey: "kloda.sync.backupMode")
      UserDefaults.standard.set(localTime, forKey: self.timeKey)
      }
      IosAutomaticCoordinator.shared.settingsChanged()
    }
  }

  private func loadSources(forKey key: String, kind: String) -> [[String: String]] {
    let sources = UserDefaults.standard.array(forKey: key) as? [[String: String]] ?? []
    return sources.map { source in
      var typedSource = source
      typedSource["kind"] = kind
      return typedSource
    }
  }

  private func removeSource(id: String, forKey key: String) throws {
    try IosSyncJournal().removeSource(sourceId: id)
    let sources = UserDefaults.standard.array(forKey: key) as? [[String: String]] ?? []
    try IosWebDavContext.mutate { UserDefaults.standard.set(sources.filter { $0["id"] != id }, forKey: key) }
    IosAutomaticCoordinator.shared.settingsChanged()
  }

  private func directorySourceAccess() -> [[String: Any]] {
    let sources = UserDefaults.standard.array(forKey: directorySourcesKey) as? [[String: String]] ?? []
    return sources.compactMap { source in
      guard let id = source["id"], let bookmark = source["reference"],
            let bookmarkData = Data(base64Encoded: bookmark) else {
        return nil
      }
      var stale = false
      let url = try? URL(resolvingBookmarkData: bookmarkData, bookmarkDataIsStale: &stale)
      let accessible = !stale && (url?.startAccessingSecurityScopedResource() ?? false)
      if accessible { url?.stopAccessingSecurityScopedResource() }
      return ["accessible": accessible, "id": id]
    }
  }

  private func saveDirectorySource(_ selection: DirectorySelection) throws -> [String: String] {
    let sources = UserDefaults.standard.array(forKey: directorySourcesKey) as? [[String: String]] ?? []
    if var existingSource = sources.first(where: { $0["reference"] == selection.bookmark }) {
      existingSource["kind"] = "directory"
      return existingSource
    }
    let source = [
      "displayName": selection.displayName,
      "id": UUID().uuidString,
      "kind": "directory",
      "reference": selection.bookmark
    ]
    try IosWebDavContext.mutate { UserDefaults.standard.set(sources + [source], forKey: directorySourcesKey) }
    IosAutomaticCoordinator.shared.settingsChanged()
    return source
  }

  private func requestPhotoLibraryAuthorization() async -> Bool {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    let resolvedStatus: PHAuthorizationStatus
    if status == .notDetermined {
      resolvedStatus = await withCheckedContinuation { continuation in
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { continuation.resume(returning: $0) }
      }
    } else {
      resolvedStatus = status
    }
    return resolvedStatus == .authorized || resolvedStatus == .limited
  }

  private func savePhotoSource(reference: String, displayName: String) throws -> [String: String] {
    let sources = UserDefaults.standard.array(forKey: photoSourcesKey) as? [[String: String]] ?? []
    if var source = sources.first(where: { $0["reference"] == reference }) {
      source["kind"] = "photos"
      return source
    }
    let source = [
      "displayName": displayName,
      "id": UUID().uuidString,
      "kind": "photos",
      "reference": reference
    ]
    try IosWebDavContext.mutate { UserDefaults.standard.set(sources + [source], forKey: photoSourcesKey) }
    IosAutomaticCoordinator.shared.settingsChanged()
    return source
  }

  private func photoAlbums() -> [[String: String]] {
    let collections = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumRegular, options: nil)
    var albums: [[String: String]] = []
    collections.enumerateObjects { collection, _, _ in
      if let displayName = collection.localizedTitle {
        albums.append(["displayName": displayName, "id": collection.localIdentifier])
      }
    }
    return albums
  }
}
