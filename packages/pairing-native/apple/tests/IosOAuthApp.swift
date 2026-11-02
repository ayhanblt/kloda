import UIKit
import Foundation
import AuthenticationServices

// Code + PKCE, refresh and (where the provider allows) revoke against the user's own account, plus OAuth Keychain custody
// (ADR0028). The provider is the first launch argument. Tokens never leave memory: the report holds booleans only.
@main final class OAuthChecksApp: UIResponder, UIApplicationDelegate, ASWebAuthenticationPresentationContextProviding {
  var window: UIWindow?
  var session: ASWebAuthenticationSession?
  static var documents: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    let controller = UIViewController(); controller.view.backgroundColor = .systemBackground
    window.rootViewController = controller; window.makeKeyAndVisible(); self.window = window
    Self.write(["status": "RUNNING"])
    let request: IosOAuthRequest
    do {
      let provider = try IosOAuthProvider.named(CommandLine.arguments.dropFirst().first ?? "")
      try Self.offline(provider)
      request = try IosOAuthLogin.request(provider)
    } catch { Self.fail(error); return true }
    let session = ASWebAuthenticationSession(url: request.url, callbackURLScheme: request.provider.scheme) { callback, _ in
      DispatchQueue.global().async {
        do {
          guard let callback else { throw IosWebDavFailure.code("cancelled") }
          if CommandLine.arguments.contains("diagnose") { Self.write(["status": "DIAGNOSE", "steps": Self.diagnose(callback, request)]); return }
          Self.write(["status": "PASS", "provider": request.provider.name, "checks": try Self.live(callback, request)])
        } catch { Self.fail(error) }
      }
    }
    session.prefersEphemeralWebBrowserSession = true
    session.presentationContextProvider = self
    self.session = session
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { if !session.start() { Self.fail(IosWebDavFailure.code("oauth_login")) } }
    return true
  }
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window ?? ASPresentationAnchor() }

  static func write(_ value: [String: Any]) {
    try? JSONSerialization.data(withJSONObject: value).write(to: documents.appendingPathComponent("oauth-result.json"), options: .atomic)
  }
  static func fail(_ error: Error) {
    if case IosWebDavFailure.code(let value) = error { write(["status": "FAIL", "code": value]) }
    else if let check = error as? Check { write(["status": "FAIL", "code": check.reason]) }
    else { write(["status": "FAIL", "code": String(describing: error)]) }
  }
  struct Check: Error { let reason: String }
  static func expect(_ condition: Bool, _ reason: String) throws { if !condition { throw Check(reason: reason) } }
  static func rejects(_ code: String, _ action: () throws -> Void) throws {
    var observed: String?
    do { try action() } catch IosWebDavFailure.code(let value) { observed = value }
    try expect(observed == code, "expected \(code), observed \(observed ?? "none")")
  }

  static func offline(_ provider: IosOAuthProvider) throws {
    let request = try IosOAuthLogin.request(provider)
    let items = Dictionary(uniqueKeysWithValues: (URLComponents(url: request.url, resolvingAgainstBaseURL: false)?.queryItems ?? []).map { ($0.name, $0.value ?? "") })
    try expect(items["client_id"] == provider.clientId && items["redirect_uri"] == provider.redirect &&
      items["code_challenge_method"] == "S256" && items["state"] == request.state && items["scope"] == provider.scope &&
      items["code_challenge"]?.count == 43 && request.verifier.count == 43 && items["client_secret"] == nil &&
      provider.extra.allSatisfy { items[$0.key] == $0.value }, "authorize url")
    try expect(try IosOAuthLogin.request(provider).state != request.state, "fresh state")
    let base = provider.redirect
    try expect(try IosOAuthLogin.code(URL(string: base + "?state=\(request.state)&code=abc")!, request) == "abc", "code")
    try expect(try IosOAuthLogin.code(URL(string: base + "/?state=\(request.state)&code=abc")!, request) == "abc", "trailing slash")
    try rejects("oauth_login") { _ = try IosOAuthLogin.code(URL(string: base + "/other?state=\(request.state)&code=abc")!, request) }
    try rejects("oauth_login") { _ = try IosOAuthLogin.code(URL(string: base + "?state=other&code=abc")!, request) }
    try rejects("oauth_login") { _ = try IosOAuthLogin.code(URL(string: "db-other://oauth?state=\(request.state)&code=abc")!, request) }
    try rejects("cancelled") { _ = try IosOAuthLogin.code(URL(string: base + "?state=\(request.state)&error=access_denied")!, request) }
    for slot in try IosOAuthVault.slots() { try IosOAuthVault.delete(slot: slot) }
    let profile = IosOAuthProfile(revision: UUID().uuidString, provider: provider.name, accountId: "owned", targetPath: "/Kloda/", refreshToken: "fixture-token", expiresAt: provider == .yandex ? 4102444800 : nil)
    let same = IosOAuthProfile(revision: UUID().uuidString, provider: provider.name, accountId: "owned", targetPath: "Kloda", refreshToken: "other", expiresAt: provider == .yandex ? 4102444800 : nil)
    let other = IosOAuthProfile(revision: UUID().uuidString, provider: provider.name, accountId: "other", targetPath: "Kloda", refreshToken: "x", expiresAt: provider == .yandex ? 4102444800 : nil)
    let elsewhere = IosOAuthProfile(revision: UUID().uuidString, provider: provider == .dropbox ? "onedrive" : "dropbox", accountId: "owned",
      targetPath: "Kloda", refreshToken: "x")
    try expect(try profile.targetId() == same.targetId() && profile.targetId() != other.targetId() &&
      profile.targetId() != elsewhere.targetId(), "provider+account+root identity")
    try IosOAuthVault.add(profile)
    try expect(try IosOAuthVault.read(slot: profile.targetId()) == profile, "round trip")
    try rejects("destination_exists") { try IosOAuthVault.add(same) }
    try rejects("webdav_fields") { try IosOAuthProfile(revision: UUID().uuidString, provider: "box", accountId: "a", targetPath: "K", refreshToken: "t").validate() }
    try rejects("webdav_fields") { try IosOAuthProfile(revision: UUID().uuidString, provider: provider.name, accountId: "a", targetPath: "../x", refreshToken: "t").validate() }
    try IosOAuthVault.delete(slot: profile.targetId())
    try expect(try IosOAuthVault.slots().isEmpty, "delete")
  }

  // Failure triage only: callback parameter names, HTTP statuses and provider error codes; token values are never kept.
  static func diagnose(_ callback: URL, _ request: IosOAuthRequest) -> [String: Any] {
    let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
    var steps: [String: Any] = ["callbackScheme": callback.scheme ?? "", "callbackHost": callback.host ?? "",
      "callbackKeys": items.map(\.name).sorted(), "callbackError": items.first(where: { $0.name == "error" })?.value ?? ""]
    guard let code = items.first(where: { $0.name == "code" })?.value else { return steps }
    func shape(_ value: String?) -> [String: Any] {
      guard let value else { return ["present": false] }
      return ["bytes": value.utf8.count, "printable": !value.unicodeScalars.contains(where: { $0.value <= 32 || $0.value >= 127 })]
    }
    steps["code"] = shape(code)
    do { _ = try IosOAuthLogin.code(callback, request); steps["productCode"] = "ok" } catch { steps["productCode"] = String(describing: error) }
    var fields = ["code": code, "grant_type": "authorization_code", "code_verifier": request.verifier,
      "client_id": request.provider.clientId, "redirect_uri": request.provider.redirect]
    if let scope = request.provider.scope { fields["scope"] = scope }
    var token = URLRequest(url: URL(string: request.provider.token)!)
    token.httpMethod = "POST"
    token.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    token.httpBody = Data(fields.map { $0.key + "=" + $0.value.addingPercentEncoding(withAllowedCharacters: allowed)! }.joined(separator: "&").utf8)
    let (status, json) = send(token)
    steps["tokenStatus"] = status
    steps["tokenKeys"] = json.keys.sorted()
    steps["access"] = shape(json["access_token"] as? String)
    steps["refresh"] = shape(json["refresh_token"] as? String)
    steps["tokenError"] = [json["error"] as? String ?? "", (json["error_codes"] as? [Int])?.map(String.init).joined(separator: ",") ?? ""]
    // Granted scope names only (Google lets the user untick a scope on its consent screen).
    steps["grantedScope"] = json["scope"] as? String ?? ""
    if let access = json["access_token"] as? String {
      let drive = request.provider == .googleDrive
      var me = URLRequest(url: URL(string: request.provider.api + (drive ? "/drive/v3/about?fields=user(permissionId)" : "/v1.0/me?$select=id"))!)
      me.setValue("Bearer " + access, forHTTPHeaderField: "Authorization")
      let (meStatus, profile) = send(me)
      steps["meStatus"] = meStatus
      steps["meKeys"] = profile.keys.sorted()
      steps["id"] = shape(drive ? (profile["user"] as? [String: Any])?["permissionId"] as? String : profile["id"] as? String)
      let failure = profile["error"] as? [String: Any]
      steps["meError"] = failure?["code"].map { "\($0)" } ?? ""
      steps["meReason"] = ((failure?["errors"] as? [[String: Any]])?.first?["reason"] as? String) ?? (failure?["status"] as? String ?? "")
    }
    return steps
  }
  private static func send(_ request: URLRequest) -> (Int, [String: Any]) {
    let done = DispatchSemaphore(value: 0)
    var result: (Int, [String: Any]) = (0, [:])
    URLSession(configuration: .ephemeral).dataTask(with: request) { data, response, _ in
      result = ((response as? HTTPURLResponse)?.statusCode ?? 0, data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:])
      done.signal()
    }.resume()
    done.wait()
    return result
  }

  static func live(_ callback: URL, _ request: IosOAuthRequest) throws -> [String: Any] {
    let login = IosOAuthLogin(request.provider)
    func stage<T>(_ name: String, _ action: () throws -> T) throws -> T {
      do { return try action() } catch IosWebDavFailure.code(let code) { throw Check(reason: name + ": " + code) }
    }
    let grant = try stage("exchange") { try login.exchange(try IosOAuthLogin.code(callback, request), request) }
    let profile = IosOAuthProfile(revision: UUID().uuidString, provider: request.provider.name, accountId: grant.accountId,
      targetPath: "Kloda", refreshToken: grant.refreshToken, expiresAt: grant.expiresAt)
    try IosOAuthVault.add(profile)
    try expect(try IosOAuthVault.read(slot: profile.targetId()) == profile, "stored grant")
    _ = try stage("refresh") { try login.refresh(grant.refreshToken, expiresAt: grant.expiresAt) }
    if request.provider == .yandex {
      try rejects("oauth_expired") { _ = try login.refresh(grant.refreshToken, expiresAt: 1) }
      try expect((grant.expiresAt ?? 0) > Int64(Date().timeIntervalSince1970) + 86400, "yandex expiry")
    }
    var checks: [String: Any] = ["pkceExchange": true, "accountId": true, "keychainRoundTrip": true, "refresh": true]
    if login.canRevoke {
      login.revoke(refreshToken: grant.refreshToken)
      // Google notes revocation may take a moment to apply everywhere.
      var revoked = false
      for attempt in 0..<5 where !revoked {
        if attempt > 0 { Thread.sleep(forTimeInterval: 3) }
        do { _ = try IosOAuthLogin(request.provider).refresh(grant.refreshToken) } catch IosWebDavFailure.code("oauth_login") { revoked = true }
      }
      try expect(revoked, "refresh token still valid after revoke")
      checks["revokeInvalidatesRefresh"] = true
    } else { checks["revoke"] = "not offered by provider; user removes access in account settings" }
    try IosOAuthVault.delete(slot: profile.targetId())
    try expect(try IosOAuthVault.read(slot: profile.targetId()) == nil, "custody deleted")
    checks["custodyDeleted"] = true
    return checks
  }
}
