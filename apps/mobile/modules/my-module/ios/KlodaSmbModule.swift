#if KLODA_SMB_NATIVE
import ExpoModulesCore
import UIKit

public final class KlodaSmbModule: Module {
  private let token = UUID()
  private let review = IosSmbReview()
  private let restore = IosSmbFilesRestore()
  private let photosRestore = IosSmbPhotosRestore()
  private let restorePicker = DirectoryPickerDelegate()
  private var restoreRequest: UUID?
  private var restoreSelecting = false
  private var cancelledRestoreRequests = Set<UUID>()
  private var observers: [NSObjectProtocol] = []
  private var destroyed = false
  public func definition() -> ModuleDefinition {
    Name("KlodaSmb")
    OnCreate { IosSmbQueue.shared.attachUI(self.token); DispatchQueue.main.async { self.observe() } }
    OnAppBecomesActive { DispatchQueue.main.async { self.refresh() } }
    OnAppEntersBackground { self.inactive() }
    OnDestroy {
      self.destroyed = true; self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; self.inactive()
      DispatchQueue.main.async { self.observers.forEach(NotificationCenter.default.removeObserver); self.observers = [] }
    }
    AsyncFunction("smbStatus") { (promise: Promise) in self.reply(promise) {
      var value = try IosSmbQueue.shared.status(); value["supported"] = true
      if let code = IosSmbAutomaticCoordinator.shared.error() { value["automaticError"] = code }
      return value
    } }
    AsyncFunction("configureSmb") { (address: String, port: Int, share: String, root: String, username: String, domain: String, password: String, promise: Promise) in
      self.reply(promise) {
        try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil
        try IosSmbQueue.shared.configure(target: IosSmbTarget(address: address, port: port, share: share, root: root, username: username, domain: domain, profileGeneration: "native", credentialGeneration: "native"), password: password)
        IosSmbAutomaticCoordinator.shared.reconcile()
        return try IosSmbQueue.shared.status()
      }
    }.runOnQueue(.main)
    AsyncFunction("enableSmb") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosSmbQueue.shared.enable(); IosSmbAutomaticCoordinator.shared.reconcile(); return try IosSmbQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("disableSmb") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; try IosSmbQueue.shared.disable(); IosSmbAutomaticCoordinator.shared.reconcile(); return try IosSmbQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("runSmb") { (promise: Promise) in
      self.refresh(); self.reply(promise) { try self.checkUi(); return try IosSmbQueue.shared.start() }
    }.runOnQueue(.main)
    AsyncFunction("pauseSmb") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosSmbQueue.shared.pause(code: "target_pause"); return try IosSmbQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("smbIssues") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosSmbBackups.list(after: after, issues: true) }
    }.runOnQueue(.main)
    AsyncFunction("reviewSmb") { (id: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard let ticket = UUID(uuidString: request) else { throw IosSmbFailure(code: "invalid_request") }
        self.review.perform(id: id, request: ticket, visible: { IosSmbQueue.shared.interactive(self.token) }) { result in
          self.reply(promise) { try result.get() }
        }
      } catch { let code = IosSmbQueue.code(error); promise.reject(code, code) }
    }.runOnQueue(.main)
    AsyncFunction("cancelSmbReview") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosSmbFailure(code: "invalid_request") }
      self.review.cancel(ticket)
    }
    AsyncFunction("smbBackups") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosSmbBackups.list(after: after) }
    }.runOnQueue(.main)
    AsyncFunction("restoreSmbFile") { (id: String, request: String, promise: Promise) in
      Task { @MainActor in
        do {
          try self.checkUi()
          guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request), !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil,
            let view = self.appContext?.utilities?.currentViewController() else { throw IosSmbFailure(code: "invalid_request") }
          let (profiles, captured, binding) = try self.restoreContext()
          self.restoreRequest = ticket; self.restoreSelecting = true
          defer { self.restoreSelecting = false }
          guard let destination = await self.restorePicker.pick(from: view) else { throw IosSmbFailure(code: "cancelled") }
          guard self.restoreRequest == ticket else { throw IosSmbFailure(code: "cancelled") }
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
    AsyncFunction("restoreSmbPhotos") { (id: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request),
          !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil else { throw IosSmbFailure(code: "cancelled") }
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
    AsyncFunction("cancelSmbRestore") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosSmbFailure(code: "invalid_request") }
      self.cancelledRestoreRequests.insert(ticket)
      if self.restoreRequest == ticket { self.restoreRequest = nil; self.restore.cancel(ticket); self.photosRestore.cancel(ticket) }
    }.runOnQueue(.main)
  }
  private func restoreContext() throws -> (IosSmbProfiles, IosSmbProfileCapture, String) {
    let profiles = try IosSmbProfiles(journal: IosSmbQueue.shared.journal())
    guard let captured = try profiles.capture() else { throw IosSmbFailure(code: "profile_missing") }
    return (profiles, captured, try IosSmbSources.binding())
  }
  private func restoreVisible(_ profiles: IosSmbProfiles, _ captured: IosSmbProfileCapture, _ binding: String) -> Bool {
    IosSmbQueue.shared.interactive(token) && (try? profiles.current(captured)) == true && (try? IosSmbSources.binding()) == binding
  }
  private func reply(_ promise: Promise, _ operation: () throws -> [String: Any]) {
    do { promise.resolve(try operation()) }
    catch { let code = IosSmbQueue.code(error); promise.reject(code, code) }
  }
  private func checkUi() throws {
    guard !destroyed, UIApplication.shared.applicationState == .active, IosSmbQueue.shared.interactive(token) else { throw IosSmbFailure(code: "candidate_stale") }
  }
  private func refresh() {
    guard !destroyed, IosSmbQueue.shared.ownsUI(token) else { return }
    let application = UIApplication.shared
    IosSmbQueue.shared.setProtected(application.isProtectedDataAvailable)
    if application.applicationState == .active {
      IosSmbQueue.shared.uiActive(owner: token, protected: application.isProtectedDataAvailable)
      IosSmbAutomaticCoordinator.shared.uiActive()
    } else { inactive() }
  }
  private func inactive() {
    guard IosSmbQueue.shared.ownsUI(token) else { return }
    review.cancel(); restore.cancel(); photosRestore.cancel(); restoreRequest = nil
    IosSmbQueue.shared.uiInactive(owner: token); IosSmbAutomaticCoordinator.shared.uiInactive()
  }
  private func observe() {
    guard !destroyed, observers.isEmpty else { return }
    for name in [UIApplication.protectedDataDidBecomeAvailableNotification, UIApplication.protectedDataWillBecomeUnavailableNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
        if note.name == UIApplication.protectedDataWillBecomeUnavailableNotification {
          IosSmbQueue.shared.setProtected(false)
          try? IosSmbQueue.shared.pause(code: "credential_locked")
        } else { self?.refresh() }
      })
    }
    refresh()
  }
}
#else
import ExpoModulesCore
public final class KlodaSmbModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KlodaSmb")
    AsyncFunction("smbStatus") { ["supported": false, "configured": false, "enabled": false, "running": false] }
  }
}
#endif
