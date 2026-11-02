import ExpoModulesCore
import UIKit

public final class KlodaPairingModule: Module {
  private let session = IosAutomaticCoordinator.shared.session
  private let files = IosAutomaticCoordinator.shared.files
  private let restore = IosOwnRestore()
  private let photos = IosPhotosRestore()
  private let restorePicker = DirectoryPickerDelegate()
  private var restoreSelecting = false
  private var observers: [NSObjectProtocol] = []
  private var destroyed = false

  public func definition() -> ModuleDefinition {
    Name("KlodaPairing")
    OnCreate { DispatchQueue.main.async { self.installObservers() } }
    OnAppBecomesActive { DispatchQueue.main.async { self.refreshVisibility() } }
    OnAppEntersBackground { self.session.updateActive(false); IosAutomaticCoordinator.shared.uiInactive(); self.restore.cancel(); self.photos.cancel() }
    OnDestroy {
      self.session.updateActive(false); IosAutomaticCoordinator.shared.uiInactive()
      self.restore.cancel(); self.photos.cancel()
      DispatchQueue.main.async { self.removeObservers() }
    }

    AsyncFunction("status") { (promise: Promise) in
      self.request(["kind": "status"], foreground: false, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("scan") { (qr: String, promise: Promise) in
      self.request(["kind": "scan", "wire": qr], foreground: true, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("approve") { (operation: String, generation: String, promise: Promise) in
      self.request(["kind": "approve", "operation": operation, "generation": generation], foreground: true, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("deny") { (operation: String, generation: String, promise: Promise) in
      self.request(["kind": "deny", "operation": operation, "generation": generation], foreground: true, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("cancel") { (operation: String, promise: Promise) in
      self.request(["kind": "cancel", "operation": operation], foreground: false, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("resume") { (record: String, promise: Promise) in
      self.request(["kind": "resume", "record": record], foreground: true, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("removePairing") { (record: String, online: Bool, promise: Promise) in
      self.request(["kind": "removePairing", "record": record, "online": online], foreground: true, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("queueStatus") { () throws -> [String: Any] in try self.queueStatus() }
    AsyncFunction("runFiles") { (record: String, promise: Promise) in
      MainActor.assumeIsolated { self.restore.cancel(); self.photos.cancel(); self.refreshVisibility(); self.files.start(record: record, rebackup: nil, session: self.session) { Self.finish($0, promise: promise) } }
    }.runOnQueue(.main)
    AsyncFunction("rebackupFile") { (record: String, job: String, promise: Promise) in
      MainActor.assumeIsolated { self.restore.cancel(); self.photos.cancel(); self.refreshVisibility(); self.files.start(record: record, rebackup: job, session: self.session) { Self.finish($0, promise: promise) } }
    }.runOnQueue(.main)
    AsyncFunction("pauseFiles") { () throws -> [String: Any] in try IosAutomaticCoordinator.shared.pause(); return try self.queueStatus() }
    AsyncFunction("resumeAutomatic") { () throws -> [String: Any] in
      MainActor.assumeIsolated { self.refreshVisibility() }
      guard self.session.isForegroundActive else { throw IosPairingFailure.native("candidate_stale") }
      try IosAutomaticCoordinator.shared.resume(); return try self.queueStatus()
    }.runOnQueue(.main)
    AsyncFunction("requestBackupNotifications") { (promise: Promise) in
      MainActor.assumeIsolated { self.refreshVisibility() }
      guard self.session.isForegroundActive else { throw IosPairingFailure.native("candidate_stale") }
      IosBackupNotifications.request { promise.resolve($0) }
    }.runOnQueue(.main)
    AsyncFunction("listBackups") { (record: String, after: String?, promise: Promise) in
      MainActor.assumeIsolated { self.refreshVisibility() }
      self.session.fileConnection(record: record) { result in
        do { Self.finish(.success(try IosOwnBackups.list(result.get(), after: after)), promise: promise) }
        catch { Self.finish(.failure(IosFilesQueue.failure(error)), promise: promise) }
      }
    }.runOnQueue(.main)
    AsyncFunction("restoreBackup") { (record: String, operation: String, sha256: String, size: String, name: String, promise: Promise) in
      let ticket = self.restore.ticket()
      Task { @MainActor in
        guard !self.restoreSelecting, self.restore.isCurrent(ticket), !self.destroyed else {
          Self.finish(.failure(.native("cancelled")), promise: promise); return
        }
        self.restoreSelecting = true
        defer { self.restoreSelecting = false }
        self.refreshVisibility(); self.files.pause()
        guard let count = Int64(size), count >= 0, String(count) == size,
          let view = self.appContext?.utilities?.currentViewController(), UIApplication.shared.applicationState == .active else {
          Self.finish(.failure(.native("invalid_request")), promise: promise); return
        }
        guard let destination = await self.restorePicker.pick(from: view) else {
          Self.finish(.failure(.native("cancelled")), promise: promise); return
        }
        guard self.restore.isCurrent(ticket), !self.destroyed else {
          Self.finish(.failure(.native("cancelled")), promise: promise); return
        }
        self.refreshVisibility()
        let backup = IosOwnBackup(id: operation, name: name, sha256: sha256, size: count)
        self.session.fileConnection(record: record) { result in
          do {
            self.restore.restore(record: record, backup: backup, destination: destination.bookmark,
              connection: try result.get(), ticket: ticket) { Self.finish($0, promise: promise) }
          } catch { Self.finish(.failure(IosFilesQueue.failure(error)), promise: promise) }
        }
      }
    }.runOnQueue(.main)
    AsyncFunction("photoImportStatus") { () throws -> [String: Any] in try self.photos.status() }
    AsyncFunction("restorePhotos") { (record: String, operation: String?, hash: String?, size: String?, name: String?, promise: Promise) in
      MainActor.assumeIsolated { self.refreshVisibility(); self.files.pause(); self.restore.cancel() }
      do {
        let backup: IosOwnBackup?
        if let operation, let hash, let size, let name, let count = Int64(size), count >= 0, String(count) == size {
          try IosFilesTransfer.fixed(operation, bytes: 16); try IosFilesTransfer.fixed(hash, bytes: 32)
          backup = IosOwnBackup(id: operation, name: name, sha256: hash, size: count)
        } else {
          guard operation == nil && hash == nil && size == nil && name == nil else { throw IosPairingFailure.native("invalid_request") }
          backup = nil
        }
        self.photos.restore(record: record, backup: backup, session: self.session) { Self.finish($0, promise: promise) }
      } catch { Self.finish(.failure(IosFilesQueue.failure(error)), promise: promise) }
    }.runOnQueue(.main)
    AsyncFunction("cancelRestore") { self.restore.cancel(); self.photos.cancel() }
    AsyncFunction("close") { (promise: Promise) in
      self.restore.cancel(); self.photos.cancel()
      self.session.updateActive(false); IosAutomaticCoordinator.shared.uiInactive()
      promise.resolve(nil)
    }.runOnQueue(.main)
  }

  @MainActor private func installObservers() {
    guard !destroyed, observers.isEmpty, !session.isDestroyed else { return }
    for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification,
      UIScene.willDeactivateNotification, UIScene.didDisconnectNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        self?.session.updateActive(false)
        IosAutomaticCoordinator.shared.uiInactive()
      })
    }
    refreshVisibility()
  }

  @MainActor private func removeObservers() {
    destroyed = true
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers = []
  }

  @MainActor private func refreshVisibility() {
    guard !destroyed else { return }
    let window = appContext?.utilities?.currentViewController()?.viewIfLoaded?.window
    let visible = window?.isKeyWindow == true && window?.isHidden == false
      && window?.windowScene?.activationState == .foregroundActive
    let active = UIApplication.shared.applicationState == .active && visible
    let wasActive = session.isForegroundActive
    session.updateActive(active)
    if active && !wasActive {
      IosAutomaticCoordinator.shared.uiActive()
      #if canImport(ActivityKit)
      // A lock-screen Resume only opens Kloda; it is performed here, behind the same foreground fence as Resume in the app.
      IosLiveActivity.shared.uiActive()
      #endif
    }
  }

  private func queueStatus() throws -> [String: Any] {
    var value = try files.status()
    for (key, state) in try IosAutomaticCoordinator.shared.status() { value[key] = state }
    value["notificationsEnabled"] = IosBackupNotifications.enabled
    return value
  }

  private func request(_ command: [String: Any], foreground: Bool, promise: Promise) {
    // Expo's main queue is runtime configuration, not a Swift actor annotation.
    MainActor.assumeIsolated {
      refreshVisibility()
      if foreground { IosAutomaticCoordinator.shared.invalidateForTrustChange(); files.pause(); restore.cancel(); photos.cancel() }
      session.request(command, foreground: foreground) { Self.finish($0, promise: promise) }
    }
  }

  private static func finish(_ result: Result<[String: Any]?, IosPairingFailure>, promise: Promise) {
    switch result {
    case .success(let value):
      if let value, value["phase"] != nil { IosAutomaticCoordinator.shared.observed(status: value) }
      promise.resolve(value)
    case .failure(let failure): promise.reject(failure.code, failure.code)
    }
  }
}
