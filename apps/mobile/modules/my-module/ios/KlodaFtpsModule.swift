#if KLODA_FTPS_NATIVE
import ExpoModulesCore
import UIKit

public final class KlodaFtpsModule: Module {
  private let token = UUID()
  private let review = IosFtpsReview()
  private let restore = IosFtpsFilesRestore()
  private let photosRestore = IosFtpsPhotosRestore()
  private let restorePicker = DirectoryPickerDelegate()
  private var restoreRequest: UUID?
  private var restoreSelecting = false
  private var cancelledRestoreRequests = Set<UUID>()
  private var observers: [NSObjectProtocol] = []
  private var destroyed = false
  public func definition() -> ModuleDefinition {
    Name("KlodaFtps")
    OnCreate { IosFtpsQueue.shared.attachUI(self.token); DispatchQueue.main.async { self.observe() } }
    OnAppBecomesActive { DispatchQueue.main.async { self.refresh() } }
    OnAppEntersBackground { self.inactive() }
    OnDestroy {
      self.destroyed = true; self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; self.inactive()
      DispatchQueue.main.async { self.observers.forEach(NotificationCenter.default.removeObserver); self.observers = [] }
    }
    AsyncFunction("ftpsStatus") { (promise: Promise) in self.reply(promise) {
      var value = try IosFtpsQueue.shared.status(); value["supported"] = true
      if let code = IosFtpsAutomaticCoordinator.shared.error() { value["automaticError"] = code }
      return value
    } }
    AsyncFunction("configureFtps") { (address: String, port: Int, hostname: String, root: String, username: String, password: String, promise: Promise) in
      self.reply(promise) {
        try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil
        try IosFtpsQueue.shared.configure(target: IosFtpsTarget(address: address, port: port, hostname: hostname, root: root, username: username, profileGeneration: "native", credentialGeneration: "native"), password: password)
        IosFtpsAutomaticCoordinator.shared.reconcile()
        return try IosFtpsQueue.shared.status()
      }
    }.runOnQueue(.main)
    AsyncFunction("enableFtps") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosFtpsQueue.shared.enable(); IosFtpsAutomaticCoordinator.shared.reconcile(); return try IosFtpsQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("disableFtps") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; try IosFtpsQueue.shared.disable(); IosFtpsAutomaticCoordinator.shared.reconcile(); return try IosFtpsQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("runFtps") { (promise: Promise) in
      self.refresh(); self.reply(promise) { try self.checkUi(); return try IosFtpsQueue.shared.start() }
    }.runOnQueue(.main)
    AsyncFunction("pauseFtps") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosFtpsQueue.shared.pause(code: "target_pause"); return try IosFtpsQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("ftpsIssues") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosFtpsBackups.list(after: after, issues: true) }
    }.runOnQueue(.main)
    AsyncFunction("reviewFtps") { (id: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard let ticket = UUID(uuidString: request) else { throw IosFtpsFailure(code: "invalid_request") }
        self.review.perform(id: id, request: ticket, visible: { IosFtpsQueue.shared.interactive(self.token) }) { result in
          self.reply(promise) { try result.get() }
        }
      } catch { let code = IosFtpsQueue.code(error); promise.reject(code, code) }
    }.runOnQueue(.main)
    AsyncFunction("cancelFtpsReview") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosFtpsFailure(code: "invalid_request") }
      self.review.cancel(ticket)
    }
    AsyncFunction("ftpsBackups") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosFtpsBackups.list(after: after) }
    }.runOnQueue(.main)
    AsyncFunction("restoreFtpsFile") { (id: String, request: String, promise: Promise) in
      Task { @MainActor in
        do {
          try self.checkUi()
          guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request), !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil,
            let view = self.appContext?.utilities?.currentViewController() else { throw IosFtpsFailure(code: "invalid_request") }
          let (profiles, captured, binding) = try self.restoreContext()
          self.restoreRequest = ticket; self.restoreSelecting = true
          defer { self.restoreSelecting = false }
          guard let destination = await self.restorePicker.pick(from: view) else { throw IosFtpsFailure(code: "cancelled") }
          guard self.restoreRequest == ticket else { throw IosFtpsFailure(code: "cancelled") }
          try self.checkUi()
          self.restore.restore(id: id, destination: destination.bookmark, profiles: profiles, ticket: ticket,
            visible: { self.restoreVisible(profiles, captured, binding) }) { result in
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
    AsyncFunction("restoreFtpsPhotos") { (id: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request),
          !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil else { throw IosFtpsFailure(code: "cancelled") }
        let (profiles, captured, binding) = try self.restoreContext()
        self.restoreRequest = ticket
        self.photosRestore.restore(id: id, profiles: profiles, ticket: ticket, visible: { self.restoreVisible(profiles, captured, binding) }) { result in
          DispatchQueue.main.async {
            if self.restoreRequest == ticket { self.restoreRequest = nil }
            self.reply(promise) { try result.get() }
          }
        }
      } catch { self.reply(promise) { throw error } }
    }.runOnQueue(.main)
    AsyncFunction("cancelFtpsRestore") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosFtpsFailure(code: "invalid_request") }
      self.cancelledRestoreRequests.insert(ticket)
      if self.restoreRequest == ticket { self.restoreRequest = nil; self.restore.cancel(ticket); self.photosRestore.cancel(ticket) }
    }.runOnQueue(.main)
  }
  private func restoreContext() throws -> (IosFtpsProfiles, IosFtpsProfileCapture, String) {
    let profiles = try IosFtpsProfiles(journal: IosFtpsQueue.shared.journal())
    guard let captured = try profiles.capture() else { throw IosFtpsFailure(code: "profile_missing") }
    return (profiles, captured, try IosFtpsSources.binding())
  }
  private func restoreVisible(_ profiles: IosFtpsProfiles, _ captured: IosFtpsProfileCapture, _ binding: String) -> Bool {
    IosFtpsQueue.shared.interactive(token) && (try? profiles.current(captured)) == true && (try? IosFtpsSources.binding()) == binding
  }
  private func reply(_ promise: Promise, _ operation: () throws -> [String: Any]) {
    do { promise.resolve(try operation()) }
    catch { let code = IosFtpsQueue.code(error); promise.reject(code, code) }
  }
  private func checkUi() throws {
    guard !destroyed, UIApplication.shared.applicationState == .active, IosFtpsQueue.shared.interactive(token) else { throw IosFtpsFailure(code: "candidate_stale") }
  }
  private func refresh() {
    guard !destroyed, IosFtpsQueue.shared.ownsUI(token) else { return }
    let application = UIApplication.shared
    IosFtpsQueue.shared.setProtected(application.isProtectedDataAvailable)
    if application.applicationState == .active {
      IosFtpsQueue.shared.uiActive(owner: token, protected: application.isProtectedDataAvailable)
      IosFtpsAutomaticCoordinator.shared.uiActive()
    } else { inactive() }
  }
  private func inactive() {
    guard IosFtpsQueue.shared.ownsUI(token) else { return }
    review.cancel(); restore.cancel(); photosRestore.cancel(); restoreRequest = nil
    IosFtpsQueue.shared.uiInactive(owner: token); IosFtpsAutomaticCoordinator.shared.uiInactive()
  }
  private func observe() {
    guard !destroyed, observers.isEmpty else { return }
    for name in [UIApplication.protectedDataDidBecomeAvailableNotification, UIApplication.protectedDataWillBecomeUnavailableNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
        if note.name == UIApplication.protectedDataWillBecomeUnavailableNotification {
          IosFtpsQueue.shared.setProtected(false)
          try? IosFtpsQueue.shared.pause(code: "credential_locked")
        } else { self?.refresh() }
      })
    }
    refresh()
  }
}
#else
import ExpoModulesCore
public final class KlodaFtpsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KlodaFtps")
    AsyncFunction("ftpsStatus") { ["supported": false, "configured": false, "enabled": false, "running": false] }
  }
}
#endif
