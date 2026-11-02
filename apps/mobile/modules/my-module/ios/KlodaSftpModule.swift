#if KLODA_SFTP_NATIVE
import ExpoModulesCore
import UIKit

public final class KlodaSftpModule: Module {
  private let token = UUID()
  private let review = IosSftpReview()
  private let restore = IosSftpFilesRestore()
  private let photosRestore = IosSftpPhotosRestore()
  private let restorePicker = DirectoryPickerDelegate()
  private var restoreRequest: UUID?
  private var restoreSelecting = false
  private var cancelledRestoreRequests = Set<UUID>()
  private var observers: [NSObjectProtocol] = []
  private var destroyed = false
  public func definition() -> ModuleDefinition {
    Name("KlodaSftp")
    OnCreate { IosSftpQueue.shared.attachUI(self.token); DispatchQueue.main.async { self.observe() } }
    OnAppBecomesActive { DispatchQueue.main.async { self.refresh() } }
    OnAppEntersBackground { self.inactive() }
    OnDestroy {
      self.destroyed = true; self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; self.inactive()
      DispatchQueue.main.async { self.observers.forEach(NotificationCenter.default.removeObserver); self.observers = [] }
    }
    AsyncFunction("sftpStatus") { (promise: Promise) in self.reply(promise) {
      var value = try IosSftpQueue.shared.status(); value["supported"] = true
      if let code = IosSftpAutomaticCoordinator.shared.error() { value["automaticError"] = code }
      return value
    } }
    AsyncFunction("configureSftp") { (address: String, port: Int, fingerprint: String, root: String, username: String, password: String, promise: Promise) in
      self.reply(promise) {
        try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil
        try IosSftpQueue.shared.configure(target: IosSftpTarget(address: address, port: port, fingerprint: fingerprint, root: root, username: username, profileGeneration: "native", credentialGeneration: "native"), password: password)
        IosSftpAutomaticCoordinator.shared.reconcile()
        return try IosSftpQueue.shared.status()
      }
    }.runOnQueue(.main)
    AsyncFunction("enableSftp") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosSftpQueue.shared.enable(); IosSftpAutomaticCoordinator.shared.reconcile(); return try IosSftpQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("disableSftp") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); self.review.cancel(); self.restore.cancel(); self.photosRestore.cancel(); self.restoreRequest = nil; try IosSftpQueue.shared.disable(); IosSftpAutomaticCoordinator.shared.reconcile(); return try IosSftpQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("runSftp") { (promise: Promise) in
      self.refresh(); self.reply(promise) { try self.checkUi(); return try IosSftpQueue.shared.start() }
    }.runOnQueue(.main)
    AsyncFunction("pauseSftp") { (promise: Promise) in
      self.reply(promise) { try self.checkUi(); try IosSftpQueue.shared.pause(code: "target_pause"); return try IosSftpQueue.shared.status() }
    }.runOnQueue(.main)
    AsyncFunction("sftpIssues") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosSftpBackups.list(after: after, issues: true) }
    }.runOnQueue(.main)
    AsyncFunction("reviewSftp") { (id: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard let ticket = UUID(uuidString: request) else { throw IosSftpFailure(code: "invalid_request") }
        self.review.perform(id: id, request: ticket, visible: { IosSftpQueue.shared.interactive(self.token) }) { result in
          self.reply(promise) { try result.get() }
        }
      } catch { let code = IosSftpQueue.code(error); promise.reject(code, code) }
    }.runOnQueue(.main)
    AsyncFunction("cancelSftpReview") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosSftpFailure(code: "invalid_request") }
      self.review.cancel(ticket)
    }
    AsyncFunction("sftpBackups") { (after: String, promise: Promise) in
      self.reply(promise) { try self.checkUi(); return try IosSftpBackups.list(after: after) }
    }.runOnQueue(.main)
    AsyncFunction("restoreSftpFile") { (id: String, request: String, promise: Promise) in
      Task { @MainActor in
        do {
          try self.checkUi()
          guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request), !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil,
            let view = self.appContext?.utilities?.currentViewController() else { throw IosSftpFailure(code: "invalid_request") }
          let (profiles, captured, binding) = try self.restoreContext()
          self.restoreRequest = ticket; self.restoreSelecting = true
          defer { self.restoreSelecting = false }
          guard let destination = await self.restorePicker.pick(from: view) else { throw IosSftpFailure(code: "cancelled") }
          guard self.restoreRequest == ticket else { throw IosSftpFailure(code: "cancelled") }
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
    AsyncFunction("restoreSftpPhotos") { (id: String, request: String, promise: Promise) in
      do {
        try self.checkUi()
        guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request),
          !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id) != nil else { throw IosSftpFailure(code: "cancelled") }
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
    AsyncFunction("cancelSftpRestore") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosSftpFailure(code: "invalid_request") }
      self.cancelledRestoreRequests.insert(ticket)
      if self.restoreRequest == ticket { self.restoreRequest = nil; self.restore.cancel(ticket); self.photosRestore.cancel(ticket) }
    }.runOnQueue(.main)
  }
  private func restoreContext() throws -> (IosSftpProfiles, IosSftpProfileCapture, String) {
    let profiles = try IosSftpProfiles(journal: IosSftpQueue.shared.journal())
    guard let captured = try profiles.capture() else { throw IosSftpFailure(code: "profile_missing") }
    return (profiles, captured, try IosSftpSources.binding())
  }
  private func restoreVisible(_ profiles: IosSftpProfiles, _ captured: IosSftpProfileCapture, _ binding: String) -> Bool {
    IosSftpQueue.shared.interactive(token) && (try? profiles.current(captured)) == true && (try? IosSftpSources.binding()) == binding
  }
  private func reply(_ promise: Promise, _ operation: () throws -> [String: Any]) {
    do { promise.resolve(try operation()) }
    catch { let code = IosSftpQueue.code(error); promise.reject(code, code) }
  }
  private func checkUi() throws {
    guard !destroyed, UIApplication.shared.applicationState == .active, IosSftpQueue.shared.interactive(token) else { throw IosSftpFailure(code: "candidate_stale") }
  }
  private func refresh() {
    guard !destroyed, IosSftpQueue.shared.ownsUI(token) else { return }
    let application = UIApplication.shared
    IosSftpQueue.shared.setProtected(application.isProtectedDataAvailable)
    if application.applicationState == .active {
      IosSftpQueue.shared.uiActive(owner: token, protected: application.isProtectedDataAvailable)
      IosSftpAutomaticCoordinator.shared.uiActive()
    } else { inactive() }
  }
  private func inactive() {
    guard IosSftpQueue.shared.ownsUI(token) else { return }
    review.cancel(); restore.cancel(); photosRestore.cancel(); restoreRequest = nil
    IosSftpQueue.shared.uiInactive(owner: token); IosSftpAutomaticCoordinator.shared.uiInactive()
  }
  private func observe() {
    guard !destroyed, observers.isEmpty else { return }
    for name in [UIApplication.protectedDataDidBecomeAvailableNotification, UIApplication.protectedDataWillBecomeUnavailableNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
        if note.name == UIApplication.protectedDataWillBecomeUnavailableNotification {
          IosSftpQueue.shared.setProtected(false)
          try? IosSftpQueue.shared.pause(code: "credential_locked")
        } else { self?.refresh() }
      })
    }
    refresh()
  }
}
#else
import ExpoModulesCore
public final class KlodaSftpModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KlodaSftp")
    AsyncFunction("sftpStatus") { ["supported": false, "configured": false, "enabled": false, "running": false] }
  }
}
#endif
