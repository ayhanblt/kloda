import AuthenticationServices
import ExpoModulesCore
import UIKit

// Step18A/4 (ADR0027): add, list, enable and remove DAV destinations. Saving custody is not enabling (ADR0023);
// an enabled DAV destination gets its own queue plan (18A/3). The original WebDAV entry is managed by KlodaBackup.
public final class KlodaCloudModule: Module {
  private let worker = DispatchQueue(label: "com.kloda.cloud-destinations")
  private let anchor = CloudPresentationAnchor()
  private var login: IosNextcloudLogin?
  private var browser: ASWebAuthenticationSession?
  private var oauth: (login: IosOAuthLogin, promise: Promise)?

  public func definition() -> ModuleDefinition {
    Name("KlodaCloud")
    OnDestroy { DispatchQueue.main.async { self.cancel() } }
    AsyncFunction("destinations") { (promise: Promise) in
      self.background(promise) { ["destinations": try Self.summaries()] }
    }
    AsyncFunction("signInNextcloud") { (server: String, folder: String, promise: Promise) in
      self.signIn(server: server, folder: folder, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("signInOAuth") { (provider: String, folder: String, promise: Promise) in
      self.signInOAuth(provider: provider, folder: folder, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("cancelSignIn") { self.cancel() }.runOnQueue(.main)
    AsyncFunction("addKolabNow") { (username: String, password: String, folder: String, promise: Promise) in
      guard UIApplication.shared.applicationState == .active else { return promise.reject("candidate_stale", "candidate_stale") }
      self.background(promise) {
        let profile = IosWebDavProfile(revision: UUID().uuidString, endpoint: Self.kolabNow, targetPath: folder,
          username: username, password: password, provider: "kolab-now")
        try Self.store(profile)
        return try Self.summary(profile)
      }
    }.runOnQueue(.main)
    AsyncFunction("removeDestination") { (targetId: String, promise: Promise) in
      guard UIApplication.shared.applicationState == .active else { return promise.reject("candidate_stale", "candidate_stale") }
      self.background(promise) {
        if let profile = try IosWebDavVault.read(slot: targetId) {
          try IosWebDavDestinations.forget(targetId)
          if profile.provider == "nextcloud" { try IosNextcloudLogin().revoke(profile) }
          try IosWebDavVault.delete(slot: targetId)
        } else if let profile = try IosOAuthVault.read(slot: targetId) {
          // Best effort (ADR0028): local custody is deleted whatever the provider answers.
          IosOAuthLogin(try IosOAuthProvider.named(profile.provider)).revoke(refreshToken: profile.refreshToken)
          try IosOAuthVault.delete(slot: targetId)
        } else { throw IosWebDavFailure.code("not_found") }
        return ["destinations": try Self.summaries()]
      }
    }.runOnQueue(.main)
    // Explicit, foreground-only opt-in (ADR0023); OAuth destinations stay unsupported until their adapters exist.
    AsyncFunction("setDestinationEnabled") { (targetId: String, enabled: Bool, promise: Promise) in
      guard UIApplication.shared.applicationState == .active else { return promise.reject("candidate_stale", "candidate_stale") }
      self.background(promise) {
        try IosWebDavDestinations.setEnabled(targetId, enabled: enabled)
        return ["destinations": try Self.summaries()]
      }
    }.runOnQueue(.main)
    // Step18A/4c: one manual run of an enabled, added DAV destination through the shared queue (same lock and
    // begin() order as the original WebDAV run); the original entry keeps KlodaBackup's run/pause.
    AsyncFunction("runDestination") { (targetId: String, promise: Promise) in
      guard UIApplication.shared.applicationState == .active else { return promise.reject("candidate_stale", "candidate_stale") }
      self.background(promise) {
        try Self.added(targetId)
        try IosWebDavQueue.shared.start(target: targetId)
        return ["destinations": try Self.summaries()]
      }
    }.runOnQueue(.main)
    AsyncFunction("pauseDestination") { (targetId: String, promise: Promise) in
      self.background(promise) {
        try Self.added(targetId)
        try IosWebDavQueue.shared.pauseTarget(targetId, code: "target_pause")
        return ["destinations": try Self.summaries()]
      }
    }
  }

  // Login Flow v2: the login page opens in an ephemeral system browser sheet while the poll waits for the grant.
  private func signIn(server: String, folder: String, promise: Promise) {
    guard login == nil, oauth == nil, UIApplication.shared.applicationState == .active else {
      let code = login == nil && oauth == nil ? "candidate_stale" : "backup_busy"
      return promise.reject(code, code)
    }
    let current = IosNextcloudLogin()
    login = current
    // Own queue: the poll can wait up to 20 minutes and must not hold up listing or removal.
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        guard try Self.total() < IosWebDavVault.limit else { throw IosWebDavFailure.code("destination_limit") }
        let start = try current.start(server)
        DispatchQueue.main.async { self.open(start.login, for: current) }
        let credential = try current.waitForGrant(start)
        let profile = try current.profile(start, credential, folder: folder)
        do { try Self.store(profile) } catch { try? IosNextcloudLogin().revoke(profile); throw error }
        let summary = try Self.summary(profile)
        DispatchQueue.main.async { self.finish(current); promise.resolve(summary) }
      } catch {
        let code = IosWebDavFilesRunner.code(error)
        DispatchQueue.main.async { self.finish(current); promise.reject(code, code) }
      }
    }
  }
  private func open(_ url: URL, for current: IosNextcloudLogin) {
    guard login === current else { return }
    let session = ASWebAuthenticationSession(url: url, callbackURLScheme: nil) { _, _ in
      // Closing the sheet before the grant cancels the poll; after the grant finish() already dismissed it.
      DispatchQueue.main.async { if self.login === current { current.cancel() } }
    }
    session.prefersEphemeralWebBrowserSession = true
    session.presentationContextProvider = anchor
    browser = session
    if !session.start() { current.cancel() }
  }
  private func finish(_ current: IosNextcloudLogin) {
    guard login === current else { return }
    login = nil; browser?.cancel(); browser = nil
  }
  private func cancel() {
    login?.cancel(); browser?.cancel(); browser = nil
    if let current = oauth?.login { current.cancel(); settle(current) { $0.reject("cancelled", "cancelled") } }
  }

  // Code + PKCE (ADR0028): the sheet returns the redirect; the code exchange and save run off the main thread.
  private func signInOAuth(provider name: String, folder: String, promise: Promise) {
    guard let provider = try? IosOAuthProvider.named(name) else { return promise.reject("invalid_request", "invalid_request") }
    guard login == nil, oauth == nil, UIApplication.shared.applicationState == .active else {
      let code = login == nil && oauth == nil ? "candidate_stale" : "backup_busy"
      return promise.reject(code, code)
    }
    let current = IosOAuthLogin(provider)
    oauth = (current, promise)
    worker.async {
      do {
        guard try Self.total() < IosWebDavVault.limit else { throw IosWebDavFailure.code("destination_limit") }
        let request = try IosOAuthLogin.request(provider)
        DispatchQueue.main.async { self.openOAuth(request, folder: folder, for: current) }
      } catch {
        let code = IosWebDavFilesRunner.code(error)
        DispatchQueue.main.async { self.settle(current) { $0.reject(code, code) } }
      }
    }
  }
  private func openOAuth(_ request: IosOAuthRequest, folder: String, for current: IosOAuthLogin) {
    guard oauth?.login === current else { return }
    let session = ASWebAuthenticationSession(url: request.url, callbackURLScheme: request.provider.scheme) { callback, _ in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          guard let callback else { throw IosWebDavFailure.code("cancelled") }
          let grant = try current.exchange(try IosOAuthLogin.code(callback, request), request)
          let profile = IosOAuthProfile(revision: UUID().uuidString, provider: request.provider.name, accountId: grant.accountId,
            targetPath: folder, refreshToken: grant.refreshToken, expiresAt: grant.expiresAt)
          do {
            if current.isCancelled() { throw IosWebDavFailure.code("cancelled") }
            guard try Self.total() < IosWebDavVault.limit else { throw IosWebDavFailure.code("destination_limit") }
            try IosOAuthVault.add(profile)
          } catch { IosOAuthLogin(request.provider).revoke(accessToken: grant.accessToken); throw error }
          let summary = try Self.summary(profile)
          DispatchQueue.main.async { self.settle(current) { $0.resolve(summary) } }
        } catch {
          let code = IosWebDavFilesRunner.code(error)
          DispatchQueue.main.async { self.settle(current) { $0.reject(code, code) } }
        }
      }
    }
    session.prefersEphemeralWebBrowserSession = true
    session.presentationContextProvider = anchor
    browser = session
    if !session.start() { settle(current) { $0.reject("oauth_login", "oauth_login") } }
  }
  // Main thread only: the promise of one attempt is settled exactly once.
  private func settle(_ current: IosOAuthLogin, _ result: (Promise) -> Void) {
    guard let attempt = oauth, attempt.login === current else { return }
    oauth = nil; browser?.cancel(); browser = nil
    result(attempt.promise)
  }
  private func background(_ promise: Promise, _ operation: @escaping () throws -> [String: Any]) {
    worker.async {
      do { let value = try operation(); DispatchQueue.main.async { promise.resolve(value) } }
      catch { let code = IosWebDavFilesRunner.code(error); DispatchQueue.main.async { promise.reject(code, code) } }
    }
  }

  // ADR0027 §6: the documented HTTPS Basic DAV endpoint; the server is never user-entered. CloudMe offers only
  // Digest (probed 2026-11-01), so it has no add path and stays blocked.
  static let kolabNow = "https://apps.kolabnow.com/files"
  // An existing destination is never replaced; the vault refuses a new slot past the limit.
  static func store(_ profile: IosWebDavProfile) throws {
    try profile.validate()
    let slot = try profile.targetId()
    guard try IosWebDavVault.read(slot: slot) == nil else { throw IosWebDavFailure.code("destination_exists") }
    guard try total() < IosWebDavVault.limit else { throw IosWebDavFailure.code("destination_limit") }
    try IosWebDavVault.write(profile, slot: slot)
  }
  static func added(_ targetId: String) throws {
    guard try IosWebDavVault.read(slot: targetId)?.provider != nil else {
      throw IosWebDavFailure.code(try IosOAuthVault.read(slot: targetId) != nil ? "destination_unsupported" : "not_found")
    }
  }
  // ADR0028 §7: DAV and OAuth destinations share one limit.
  static func total() throws -> Int { try IosWebDavVault.count() + IosOAuthVault.slots().count }

  // Display metadata only: never the password. `enabled` is the destination's queue opt-in (the original WebDAV
  // entry's lives in KlodaBackup, so it reads false here).
  static func summary(_ profile: IosWebDavProfile) throws -> [String: Any] {
    let target = try profile.targetId()
    var row: [String: Any] = ["targetId": target, "provider": profile.provider ?? "webdav", "endpoint": profile.endpoint,
      "targetPath": profile.targetPath, "username": profile.username,
      "enabled": profile.provider != nil ? try IosWebDavDestinations.enabled(target) : false]
    if profile.provider != nil, let run = try IosWebDavQueue.shared.runView(target: target) { row["run"] = run }
    return row
  }
  // Display metadata only: never the refresh token. The account ID stands in for the user name.
  static func summary(_ profile: IosOAuthProfile) throws -> [String: Any] {
    ["targetId": try profile.targetId(), "provider": profile.provider, "endpoint": try IosOAuthProvider.named(profile.provider).api,
      "targetPath": profile.targetPath, "username": profile.accountId, "enabled": false]
  }
  static func summaries() throws -> [[String: Any]] {
    var rows = try IosWebDavVault.read().map { [try summary($0)] } ?? []
    for slot in try IosWebDavVault.slots() {
      guard let profile = try IosWebDavVault.read(slot: slot) else { continue }
      rows.append(try summary(profile))
    }
    for slot in try IosOAuthVault.slots() {
      guard let profile = try IosOAuthVault.read(slot: slot) else { continue }
      rows.append(try summary(profile))
    }
    return rows
  }
}

private final class CloudPresentationAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
  }
}
