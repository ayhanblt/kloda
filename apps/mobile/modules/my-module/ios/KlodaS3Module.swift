import ExpoModulesCore
import UIKit

#if KLODA_S3_NATIVE
public final class KlodaS3Module: Module {
  private let uiOwner = UUID()
  private let photosRestore = IosS3PhotosRestore()
  private let restore = IosS3FilesRestore()
  private let restorePicker = DirectoryPickerDelegate()
  private var restoreRequest: UUID?
  private var restoreSelecting = false
  private var cancelledRestoreRequests = Set<UUID>()
  private func cancelRestore(_ ticket: UUID? = nil) {
    if let ticket { cancelledRestoreRequests.insert(ticket) }
    if ticket == nil || ticket == restoreRequest { restoreRequest = nil; restore.cancel(ticket); photosRestore.cancel(ticket) }
  }
  private var queues: [String: IosS3Queue] = [:]
  private func queue(_ provider: String) throws -> IosS3Queue {
    if provider == "amazon-s3" { return try IosS3Runtime.shared.queue() }
    if let value = queues[provider] { return value }
    let grant = testGrant
    let value = try IosS3Queue(profiles: owner(provider), mayRun: { grant.available() })
    queues[provider] = value; return value
  }
  private func stopQueues() {
    testGrant.deactivate()
    if !restoreSelecting { cancelRestore() }
    let values = Array(queues.values); values.forEach { $0.cancelInMemory() }
    values.forEach { try? $0.pauseForeground() }
    IosS3Runtime.shared.foreground(uiOwner, active: false, protected: UIApplication.shared.isProtectedDataAvailable)
    IosS3Automatic.shared.uiActive(false)
  }
  private func requirePersonal(_ provider: String) throws { guard provider == "amazon-s3" else { throw IosS3Failure(code: "provider_verification_required") } }
  private var owners: [String: IosS3Profiles] = [:]
  private var destroyed = false
  private let testGrant = IosS3TestGrant()
  private var observers: [NSObjectProtocol] = []
  private func refreshTestGrant() {
    let application = UIApplication.shared
    IosS3Runtime.shared.foreground(uiOwner, active: !destroyed && application.applicationState == .active, protected: application.isProtectedDataAvailable)
    IosS3Automatic.shared.uiActive(!destroyed && application.applicationState == .active)
    if !destroyed && application.applicationState == .active { testGrant.activate(protected: application.isProtectedDataAvailable) }
    else { testGrant.deactivate() }
  }
  private func observe() {
    guard observers.isEmpty else { return }
    for name in [UIApplication.willResignActiveNotification, UIApplication.protectedDataWillBecomeUnavailableNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: nil) { [weak self] _ in self?.stopQueues() })
    }
    refreshTestGrant()
  }
  private func checkUi() throws {
    guard !destroyed, UIApplication.shared.applicationState == .active, UIApplication.shared.isProtectedDataAvailable else { throw IosS3Failure(code: "candidate_stale") }
  }
  private func owner(_ provider: String) throws -> IosS3Profiles {
    guard ["amazon-s3", "s3-compatible"].contains(provider) else { throw IosS3Failure(code: "invalid_request") }
    if provider == "amazon-s3" { return try IosS3Runtime.shared.queue().profiles }
    if let value = owners[provider] { return value }
    let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let value = IosS3Profiles(journal: try IosS3Journal(url: root.appendingPathComponent("kloda-" + provider + ".sqlite"), provider: provider))
    owners[provider] = value; return value
  }
  private func status(_ provider: String) throws -> [String: Any] {
    let state = try provider == "amazon-s3" ? queue(provider).status() : [:]
    let capture = try owner(provider).capture()
    var result: [String: Any] = ["provider": provider, "supported": true, "configured": capture != nil, "enabled": state["enabled"] ?? false, "canRun": state["canRun"] ?? false, "running": state["running"] ?? false, "canEnable": provider == "amazon-s3" && capture != nil, "automaticEnabled": state["automaticEnabled"] ?? false, "canAutomatic": provider == "amazon-s3" && state["enabled"] as? Bool == true, "canTest": state["running"] as? Bool != true && capture != nil && capture?.profile.target.prefix.isEmpty == false]
    result["run"] = state["run"]
    if let t = capture?.profile.target { result["profile"] = ["endpoint": t.endpoint, "region": t.region, "bucket": t.bucket, "prefix": t.prefix, "pathStyle": t.pathStyle] }
    return result
  }
  private func reply(_ promise: Promise, _ action: () throws -> [String: Any]) {
    do { promise.resolve(try action()) } catch { let code = IosS3Queue.code(error); promise.reject(code, code) }
  }
  public func definition() -> ModuleDefinition {
    Name("KlodaS3")
    Function("s3TestRequest") { UUID().uuidString.lowercased() }
    OnCreate { DispatchQueue.main.async { self.observe() } }
    OnAppBecomesActive { DispatchQueue.main.async { self.refreshTestGrant() } }
    OnAppEntersBackground { self.stopQueues() }
    OnDestroy {
      self.destroyed = true; self.cancelRestore(); self.stopQueues()
      DispatchQueue.main.async { self.observers.forEach(NotificationCenter.default.removeObserver); self.observers = [] }
    }
    AsyncFunction("cancelS3Test") { (request: String) throws in
      guard let ticket = UUID(uuidString: request) else { throw IosS3Failure(code: "invalid_request") }
      self.testGrant.cancel(ticket)
    }
    AsyncFunction("testS3") { (provider: String, request: String, promise: Promise) in
      do {
        try self.checkUi(); self.refreshTestGrant()
        guard try self.queues[provider]?.available() != false else { throw IosS3Failure(code: "backup_busy") }
        guard let ticket = UUID(uuidString: request) else { throw IosS3Failure(code: "invalid_request") }
        let profiles = try self.owner(provider)
        guard let captured = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        try self.testGrant.start(ticket)
        DispatchQueue.global(qos: .userInitiated).async {
          let result = Result { try IosS3Diagnostic.run(profiles: profiles, captured: captured, request: ticket, root: root, current: { self.testGrant.current(ticket) }) }
          self.testGrant.finish(ticket)
          DispatchQueue.main.async { self.reply(promise) { try result.get() } }
        }
      } catch { self.reply(promise) { throw error } }
    }.runOnQueue(.main)
    AsyncFunction("enableS3") { (provider: String, promise: Promise) in self.reply(promise) {
      try self.checkUi(); try self.requirePersonal(provider); self.testGrant.deactivate(); self.refreshTestGrant(); try self.queue(provider).enable(); IosS3Automatic.shared.reconcile(); return try self.status(provider)
    } }.runOnQueue(.main)
    AsyncFunction("disableS3") { (provider: String, promise: Promise) in self.reply(promise) {
      try self.checkUi(); self.cancelRestore(); self.testGrant.deactivate(); self.refreshTestGrant(); try self.queue(provider).disable(); IosS3Automatic.shared.reconcile(); return try self.status(provider)
    } }.runOnQueue(.main)
    AsyncFunction("runS3") { (provider: String, promise: Promise) in self.reply(promise) {
      try self.checkUi(); try self.requirePersonal(provider); self.refreshTestGrant(); _ = try self.queue(provider).start(); return try self.status(provider)
    } }.runOnQueue(.main)
    AsyncFunction("pauseS3") { (provider: String, promise: Promise) in self.reply(promise) {
      try self.queue(provider).pause(); try self.queue(provider).setAutomatic(false); IosS3Automatic.shared.reconcile(); return try self.status(provider)
    } }.runOnQueue(.main)
    AsyncFunction("automaticS3") { (provider: String, enabled: Bool, promise: Promise) in self.reply(promise) {
      try self.checkUi(); try self.requirePersonal(provider); self.cancelRestore(); try self.queue(provider).setAutomatic(enabled)
      IosS3Automatic.shared.reconcile(); return try self.status(provider)
    } }.runOnQueue(.main)
    AsyncFunction("reviewS3") { (provider: String, id: String, request: String, promise: Promise) in
      do {
        try self.checkUi(); try self.requirePersonal(provider); self.refreshTestGrant()
        guard try self.queue(provider).available(), self.restoreRequest == nil,
          let ticket = UUID(uuidString: request), ticket.uuidString.lowercased() == request else { throw IosS3Failure(code: "backup_busy") }
        let profiles = try self.owner(provider); try self.testGrant.start(ticket)
        DispatchQueue.global(qos: .userInitiated).async {
          let result = Result { () throws -> [String: Any] in
            let copy = try IosS3Copy(profiles: profiles, id: id, request: request, current: { self.testGrant.current(ticket) })
            let snapshots = try IosFilesSnapshot.s3(provider); var done: IosS3Job?
            try IosS3Files(profiles: profiles, snapshots: snapshots, copying: copy).run(cancelled: { !self.testGrant.current(ticket) }) { done = $0 }
            guard let done else { throw IosS3Failure(code: "source_unavailable") }
            return ["id": done.id, "state": "completed", "path": done.logicalPath ?? done.reference]
          }
          self.testGrant.finish(ticket); DispatchQueue.main.async { self.reply(promise) { try result.get() } }
        }
      } catch { self.reply(promise) { throw error } }
    }.runOnQueue(.main)
    AsyncFunction("s3Backups") { (provider: String, after: String, issues: Bool, promise: Promise) in self.reply(promise) {
      try self.checkUi(); return try IosS3Backups.list(profiles: self.owner(provider), after: after, issues: issues)
    } }.runOnQueue(.main)
    AsyncFunction("restoreS3File") { (provider: String, id: String, request: String, promise: Promise) in
      Task { @MainActor in
        do {
          try self.checkUi(); self.refreshTestGrant()
          guard try self.queues[provider]?.available() != false else { throw IosS3Failure(code: "backup_busy") }
          guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request), ticket.uuidString.lowercased() == request,
            !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id)?.uuidString.lowercased() == id,
            let view = self.appContext?.utilities?.currentViewController() else { throw IosS3Failure(code: "invalid_request") }
          let profiles = try self.owner(provider)
          guard let captured = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
          let binding = try IosS3Sources.binding()
          self.restoreRequest = ticket; self.restoreSelecting = true
          defer { self.restoreSelecting = false }
          guard let destination = await self.restorePicker.pick(from: view) else { throw IosS3Failure(code: "cancelled") }
          guard self.restoreRequest == ticket else { throw IosS3Failure(code: "cancelled") }
          try self.checkUi(); self.refreshTestGrant()
          self.restore.restore(id: id, destination: destination.bookmark, profiles: profiles, ticket: ticket,
            visible: { self.testGrant.available() && (try? IosWebDavContext.synchronized { try profiles.current(captured) && IosS3Sources.binding() == binding }) == true }) { result in
            DispatchQueue.main.async {
              self.cancelledRestoreRequests.insert(ticket)
              if self.restoreRequest == ticket { self.restoreRequest = nil }
              self.reply(promise) { try result.get() }
            }
          }
        } catch {
          if self.restoreRequest?.uuidString.lowercased() == request { self.cancelRestore() }
          self.reply(promise) { throw error }
        }
      }
    }.runOnQueue(.main)
    AsyncFunction("restoreS3Photos") { (provider: String, id: String, request: String, promise: Promise) in
      do {
        try self.checkUi(); self.refreshTestGrant()
        guard try self.queues[provider]?.available() != false else { throw IosS3Failure(code: "backup_busy") }
        guard self.restoreRequest == nil, !self.restoreSelecting, let ticket = UUID(uuidString: request), ticket.uuidString.lowercased() == request,
          !self.cancelledRestoreRequests.contains(ticket), UUID(uuidString: id)?.uuidString.lowercased() == id else { throw IosS3Failure(code: "invalid_request") }
        let profiles = try self.owner(provider)
        guard let captured = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
        let binding = try IosS3Sources.binding(); self.restoreRequest = ticket
        self.photosRestore.restore(id: id, profiles: profiles, ticket: ticket,
          visible: { self.testGrant.available() && (try? IosWebDavContext.synchronized { try profiles.current(captured) && IosS3Sources.binding() == binding }) == true }) { result in
          DispatchQueue.main.async {
            self.cancelledRestoreRequests.insert(ticket)
            if self.restoreRequest == ticket { self.restoreRequest = nil }
            self.reply(promise) { try result.get() }
          }
        }
      } catch { self.reply(promise) { throw error } }
    }.runOnQueue(.main)
    AsyncFunction("cancelS3Restore") { (request: String) throws in
      guard let ticket = UUID(uuidString: request), ticket.uuidString.lowercased() == request else { throw IosS3Failure(code: "invalid_request") }
      self.cancelRestore(ticket)
    }.runOnQueue(.main)
    AsyncFunction("s3Status") { (provider: String, promise: Promise) in self.reply(promise) { try self.status(provider) } }.runOnQueue(.main)
    AsyncFunction("configureS3") { (provider: String, fields: [String: Any], promise: Promise) in self.reply(promise) {
      try self.checkUi(); self.cancelRestore(); self.testGrant.deactivate(); try self.queues[provider]?.pause(code: "settings_changed"); self.refreshTestGrant()
      guard Set(fields.keys) == ["endpoint", "region", "bucket", "prefix", "pathStyle", "accessKey", "secret", "token"],
        let rawStyle = fields["pathStyle"], CFGetTypeID(rawStyle as CFTypeRef) == CFBooleanGetTypeID(), let pathStyle = rawStyle as? Bool,
        fields["token"] is String || fields["token"] is NSNull else { throw IosS3Failure(code: "invalid_request") }
      func text(_ key: String) throws -> String { guard let value = fields[key] as? String else { throw IosS3Failure(code: "invalid_request") }; return value }
      let access = try text("accessKey"), generation = UUID().uuidString.lowercased()
      let target = IosS3Target(provider: provider, endpoint: try text("endpoint"), region: try text("region"), bucket: try text("bucket"), prefix: try text("prefix"),
        pathStyle: pathStyle, accountBinding: IosS3Target.hash(Data(access.utf8)), profileGeneration: generation, credentialGeneration: generation)
      try self.owner(provider).save(target, accessKey: access, secret: try text("secret"), token: fields["token"] as? String, check: self.checkUi)
      IosS3Automatic.shared.reconcile(); return try self.status(provider)
    } }.runOnQueue(.main)
  }
}
#else
public final class KlodaS3Module: Module {
  public func definition() -> ModuleDefinition {
    Name("KlodaS3")
    Function("s3TestRequest") { UUID().uuidString.lowercased() }
    AsyncFunction("s3Status") { (provider: String) in ["provider": provider, "supported": false, "configured": false, "enabled": false, "canRun": false, "canTest": false] as [String: Any] }
    AsyncFunction("configureS3") { (_: String, _: [String: Any], promise: Promise) in promise.reject("native_unavailable", "native_unavailable") }
    AsyncFunction("testS3") { (_: String, _: String, promise: Promise) in promise.reject("native_unavailable", "native_unavailable") }
    AsyncFunction("cancelS3Test") { (_: String) in }
  }
}
#endif
