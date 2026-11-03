import ExpoModulesCore
import UIKit

public final class KlodaBackupModule: Module {
  private let token = UUID()
  private let review = IosWebDavReview()
  private let restore = IosWebDavFilesRestore()
  private let photosRestore = IosWebDavPhotosRestore()
  private let restorePicker = DirectoryPickerDelegate()
  private var restoreRequest: UUID?
  private var restoreSelecting = false
  private var cancelledRestoreRequests = Set<UUID>()
  private var observers: [NSObjectProtocol] = []
  private var destroyed = false
  public func definition() -> ModuleDefinition {
    Name("KlodaBackup")
    OnCreate { IosWebDavQueue.shared.attachUI(self.token); DispatchQueue.main.async { self.observe() } }
    OnAppBecomesActive { DispatchQueue.main.async { self.refresh() } }
    OnAppEntersBackground { self.inactive() }
    OnDestroy {
      self.destroyed = true; self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; self.inactive()
      DispatchQueue.main.async { self.observers.forEach(NotificationCenter.default.removeObserver); self.observers = [] }
    }
    AsyncFunction("webDavStatus") { (promise: Promise) in self.reply(promise) {
      var value = try IosWebDavQueue.shared.status()
      if let code = IosWebDavAutomaticCoordinator.shared.error() { value["automaticError"] = code }
      return value
    } }
    AsyncFunction("configureWebDav") { (endpoint: String, path: String, username: String, password: String, promise: Promise) in
      self.reply(promise) {
        try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil
        try IosWebDavQueue.shared.configure(IosWebDavProfile(revision: UUID().uuidString, endpoint: endpoint, targetPath: path, username: username, password: password))
        IosWebDavAutomaticCoordinator.shared.reconcile()
        return try IosWebDavQueue.shared.status()
      }
    }.runOnQueue(.main)
    AsyncFunction("disableWebDav") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; try IosWebDavQueue.shared.disable(); IosWebDavAutomaticCoordinator.shared.reconcile(); return try IosWebDavQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("runWebDav") { (promise: Promise) in
      self.refresh(); self.reply(promise) { try self.checkUi(); return try IosWebDavQueue.shared.start() }
    }.runOnQueue(.main)
    AsyncFunction("pauseWebDav") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosWebDavQueue.shared.pause(code: "target_pause"); return try IosWebDavQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("webDavIssues") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try self.review.items(after: after) }
    }.runOnQueue(.main)
    AsyncFunction("reviewWebDav") { (id: String, action: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard let ticket = UUID(uuidString: request) else { throw IosWebDavFailure.code("invalid_request") }
        self.review.perform(id: id, action: action, request: ticket, visible: { IosWebDavQueue.shared.interactive(self.token) }) { result in
          self.reply(promise) { try result.get() }
        }
      } catch { let code = IosWebDavFilesRunner.code(error); promise.reject(code, code) }
    }.runOnQueue(.main)
    AsyncFunction("cancelWebDavReview") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosWebDavFailure.code("invalid_request") }
      self.review.cancel(request: ticket)
    }
    AsyncFunction("webDavBackups") { (after: String, target: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosWebDavBackups.list(after: after, target: target) }
    }.runOnQueue(.main)
    AsyncFunction("restoreWebDavFile") { (id: String, request: String, target: String, promise: Promise) in
      Task { @MainActor in
        do {
          try self.checkUi()
          guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request), !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil,
            let view = self.appContext?.utilities?.currentViewController() else { throw IosWebDavFailure.code("invalid_request") }
          let (cloud, binding) = try self.restoreContext(target)
          self.restoreRequest = ticket; self.restoreSelecting = true
          defer { self.restoreSelecting = false }
          guard let destination = await self.restorePicker.pick(from: view) else { throw IosWebDavFailure.code("cancelled") }
          guard self.restoreRequest == ticket else { throw IosWebDavFailure.code("cancelled") }
          try self.checkUi()
          self.restore.restore(id: id, destination: destination.bookmark, cloud: cloud, binding: binding, ticket: ticket,
            visible: { IosWebDavQueue.shared.interactive(self.token) }) { result in
            DispatchQueue.main.async {
              self.cancelledRestoreRequests.insert(ticket)
      if self.restoreRequest == ticket { self.restoreRequest = nil }
              self.reply(promise) { try result.get() }
            }
          }
        } catch {
          if self.restoreRequest?.uuidString.lowercased() == request.lowercased() { self.restoreRequest = nil }
          self.reply(promise) { throw error }
        }
      }
    }.runOnQueue(.main)
    AsyncFunction("restoreWebDavPhotos") { (id: String, request: String, target: String, promise: Promise) in
      do {
        try self.checkUi()
        guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request),
          !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil else { throw IosWebDavFailure.code("cancelled") }
        let (cloud, binding) = try self.restoreContext(target)
        self.restoreRequest = ticket
        self.photosRestore.restore(id: id, destination: cloud, binding: binding, ticket: ticket, visible: { IosWebDavQueue.shared.interactive(self.token) }) { result in
          DispatchQueue.main.async {
            if self.restoreRequest == ticket { self.restoreRequest = nil }
            self.reply(promise) { try result.get() }
          }
        }
      } catch { self.reply(promise) { throw error } }
    }.runOnQueue(.main)
    AsyncFunction("cancelWebDavRestore") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosWebDavFailure.code("invalid_request") }
      self.cancelledRestoreRequests.insert(ticket)
      if self.restoreRequest == ticket { self.restoreRequest = nil; self.restore.cancel(ticket); self.photosRestore.cancel(ticket) }
    }.runOnQueue(.main)
    AsyncFunction("pcSelected") { (promise: Promise) in
      self.reply(promise) { ["enabled": try IosWebDavJournal.open().hasEnabledPc()] }
    }
    AsyncFunction("pcEnabled") { (record: String, promise: Promise) in
      self.reply(promise) { try IosFilesTransfer.fixed(record, bytes: 16); return ["enabled": try IosWebDavJournal.open().enabled(kind: "pc", id: record, revision: "v1")] }
    }
    AsyncFunction("setPcEnabled") { (record: String, enabled: Bool, promise: Promise) in
      self.reply(promise) {
        try self.checkUi(); try IosFilesTransfer.fixed(record, bytes: 16)
        let journal = try IosWebDavJournal.open()
        if try journal.enabled(kind: "pc", id: record, revision: "v1") != enabled {
          try journal.setEnabled(kind: "pc", id: record, enabled: enabled, revision: "v1")
          IosAutomaticCoordinator.shared.settingsChanged()
        }
        return ["enabled": enabled]
      }
    }.runOnQueue(.main)
  }
  private func restoreContext(_ target: String) throws -> (IosCloudTarget, String) {
    try IosWebDavContext.synchronized {
      let destination = try IosWebDavContext.restoreTarget(target)
      return (destination, try IosWebDavContext.capture(destination, journal: IosWebDavJournal.open()))
    }
  }
  private func reply(_ promise: Promise, _ operation: () throws -> [String: Any]) {
    do { promise.resolve(try operation()) }
    catch { let code = IosWebDavFilesRunner.code(error); promise.reject(code, code) }
  }
  private func checkUi() throws {
    guard !destroyed, UIApplication.shared.applicationState == .active, IosWebDavQueue.shared.interactive(token) else { throw IosWebDavFailure.code("candidate_stale") }
  }
  private func refresh() {
    guard !destroyed, IosWebDavQueue.shared.ownsUI(token) else { return }
    let application = UIApplication.shared
    IosWebDavQueue.shared.setProtected(application.isProtectedDataAvailable)
    if application.applicationState == .active {
      IosWebDavQueue.shared.uiActive(owner: token, protected: application.isProtectedDataAvailable)
      IosWebDavAutomaticCoordinator.shared.uiActive()
    } else { inactive() }
  }
  private func inactive() {
    guard IosWebDavQueue.shared.ownsUI(token) else { return }
    review.cancel(); restore.cancel(); photosRestore.cancel(); restoreRequest = nil
    IosWebDavQueue.shared.uiInactive(owner: token); IosWebDavAutomaticCoordinator.shared.uiInactive()
  }
  private func observe() {
    guard !destroyed, observers.isEmpty else { return }
    for name in [UIApplication.protectedDataDidBecomeAvailableNotification, UIApplication.protectedDataWillBecomeUnavailableNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
        if note.name == UIApplication.protectedDataWillBecomeUnavailableNotification {
          IosWebDavQueue.shared.setProtected(false)
          try? IosWebDavQueue.shared.pause(code: "credential_locked")
        } else { self?.refresh() }
      })
    }
    refresh()
  }
}
