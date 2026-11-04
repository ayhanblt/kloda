import Foundation
import CryptoKit
import Security

// Public-client registrations (ADR0028); IDs are not secrets. Redirects must equal the registered strings exactly.
struct IosOAuthProvider: Equatable {
  let name: String
  let clientId: String
  let authorize: String
  let token: String
  let redirect: String
  let scope: String?
  let extra: [String: String]
  let api: String

  static let dropbox = IosOAuthProvider(name: "dropbox", clientId: "5435jnh71fcmfck",
    authorize: "https://www.dropbox.com/oauth2/authorize", token: "https://api.dropboxapi.com/oauth2/token",
    redirect: "db-5435jnh71fcmfck://oauth", scope: nil, extra: ["token_access_type": "offline"], api: "https://api.dropboxapi.com")
  // `common` accepts personal and work accounts; AppFolder is the only file scope, User.Read gives the stable account ID.
  static let onedrive = IosOAuthProvider(name: "onedrive", clientId: "dcd6301f-639d-4289-80d0-620f376fab71",
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token", redirect: "msauth.com.kloda.app://auth",
    scope: "offline_access User.Read Files.ReadWrite.AppFolder", extra: ["response_mode": "query"], api: "https://graph.microsoft.com")
  // Scopes come from the Yandex app registration (Disk app folder only). The redirect uses Yandex's own `yx<client ID>` scheme.
  static let yandex = IosOAuthProvider(name: "yandex", clientId: "c50f110fd8ab48debcabb20f8b1474f0",
    authorize: "https://oauth.yandex.com/authorize", token: "https://oauth.yandex.com/token",
    redirect: "yxc50f110fd8ab48debcabb20f8b1474f0://authorize", scope: nil, extra: [:], api: "https://cloud-api.yandex.net")
  // iOS client: Google allows its reversed client ID as a custom scheme (single-slash path). drive.file sees only Kloda's files.
  static let googleDrive = IosOAuthProvider(name: "google-drive",
    clientId: "169708313293-8ddls2ekh492ba9tfsb3ovllq25u6cqr.apps.googleusercontent.com",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
    redirect: "com.googleusercontent.apps.169708313293-8ddls2ekh492ba9tfsb3ovllq25u6cqr:/oauthredirect",
    scope: "https://www.googleapis.com/auth/drive.file", extra: [:], api: "https://www.googleapis.com")
  static func named(_ name: String) throws -> IosOAuthProvider {
    guard let provider = [dropbox, onedrive, yandex, googleDrive].first(where: { $0.name == name }) else { throw IosWebDavFailure.code("invalid_request") }
    return provider
  }
  var scheme: String { String(redirect.prefix(while: { $0 != ":" })) }
}

struct IosOAuthRequest: Equatable {
  let provider: IosOAuthProvider
  let url: URL
  let state: String
  let verifier: String
}

// `refreshToken` is the stored credential: a refresh token, or for Yandex the long-lived access token with its expiry.
struct IosOAuthGrant: Equatable {
  let accessToken: String
  let refreshToken: String
  let accountId: String
  var expiresAt: Int64? = nil
}

private final class OAuthReply: @unchecked Sendable { var value: (Data?, URLResponse?, Error?) = (nil, nil, nil) }

// Authorization code + PKCE public client (ADR0028): no client secret, app-folder scope, offline refresh token.
// Same no-cellular, no-redirect, no-cookie policy as the Nextcloud login.
final class IosOAuthLogin: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  let provider: IosOAuthProvider
  private let lock = NSLock()
  private var task: URLSessionTask?
  private var cancelled = false

  init(_ provider: IosOAuthProvider) { self.provider = provider }
  func cancel() { lock.lock(); cancelled = true; let current = task; lock.unlock(); current?.cancel() }
  func isCancelled() -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled }

  static func request(_ provider: IosOAuthProvider) throws -> IosOAuthRequest {
    let verifier = try random(), state = try random()
    let challenge = encode(Data(SHA256.hash(data: Data(verifier.utf8))))
    guard var url = URLComponents(string: provider.authorize) else { throw IosWebDavFailure.code("oauth_login") }
    url.queryItems = [URLQueryItem(name: "client_id", value: provider.clientId), URLQueryItem(name: "response_type", value: "code"),
      URLQueryItem(name: "redirect_uri", value: provider.redirect), URLQueryItem(name: "code_challenge", value: challenge),
      URLQueryItem(name: "code_challenge_method", value: "S256"), URLQueryItem(name: "state", value: state)] +
      (provider.scope.map { [URLQueryItem(name: "scope", value: $0)] } ?? []) +
      provider.extra.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
    // URLComponents leaves '+' unescaped in queries; it would read as a space.
    url.percentEncodedQuery = url.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
    guard let value = url.url else { throw IosWebDavFailure.code("oauth_login") }
    return IosOAuthRequest(provider: provider, url: value, state: state, verifier: verifier)
  }

  // Only the registered redirect with the matching state is accepted; a denied grant is a cancel, anything else a failure.
  // Microsoft answers `…://auth/?code=` for the registered `…://auth`, so a trailing slash is not a different path.
  static func code(_ callback: URL, _ request: IosOAuthRequest) throws -> String {
    func path(_ value: String) -> String { value.hasSuffix("/") ? String(value.dropLast()) : value }
    guard let url = URLComponents(url: callback, resolvingAgainstBaseURL: false),
      let expected = URLComponents(string: request.provider.redirect), url.scheme == expected.scheme, url.host == expected.host,
      path(url.path) == path(expected.path), url.queryItems?.first(where: { $0.name == "state" })?.value == request.state else {
      throw IosWebDavFailure.code("oauth_login")
    }
    if url.queryItems?.contains(where: { $0.name == "error" && ["access_denied", "consent_required"].contains($0.value) }) == true {
      throw IosWebDavFailure.code("cancelled")
    }
    guard let code = url.queryItems?.first(where: { $0.name == "code" })?.value, Self.token(code) else {
      throw IosWebDavFailure.code("oauth_login")
    }
    return code
  }

  func exchange(_ code: String, _ request: IosOAuthRequest) throws -> IosOAuthGrant {
    guard request.provider == provider else { throw IosWebDavFailure.code("invalid_request") }
    var fields = ["code": code, "grant_type": "authorization_code", "code_verifier": request.verifier,
      "client_id": provider.clientId, "redirect_uri": provider.redirect]
    if let scope = provider.scope { fields["scope"] = scope }
    let json = try token(fields)
    guard let access = json["access_token"] as? String, Self.token(access) else { throw IosWebDavFailure.code("oauth_login") }
    // ADR0028 §2 exception (user decision 2026-11-02): Yandex refreshes only with the app secret, so its long-lived
    // access token is kept with its expiry instead; the user signs in again when it ends.
    if provider == .yandex {
      guard let lifetime = (json["expires_in"] as? NSNumber)?.int64Value, lifetime > 0 else { throw IosWebDavFailure.code("oauth_login") }
      return IosOAuthGrant(accessToken: access, refreshToken: access, accountId: try account(json, access),
        expiresAt: Int64(Date().timeIntervalSince1970) + lifetime)
    }
    guard let refresh = json["refresh_token"] as? String, Self.token(refresh) else { throw IosWebDavFailure.code("oauth_login") }
    return IosOAuthGrant(accessToken: access, refreshToken: refresh, accountId: try account(json, access))
  }
  // Dropbox names the account in the token reply; the others need the profile of the signed-in user.
  // Google: the Drive permission ID is stable per user and readable with drive.file alone.
  private func account(_ json: [String: Any], _ access: String) throws -> String {
    var value = json["account_id"] as? String
    if provider == .googleDrive {
      var request = URLRequest(url: URL(string: provider.api + "/drive/v3/about?fields=user(permissionId)")!)
      request.setValue("Bearer " + access, forHTTPHeaderField: "Authorization")
      let (status, body) = try exchange(request)
      let user = status == 200 ? body.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["user"] as? [String: Any] : nil
      value = user?["permissionId"] as? String
    } else if provider != .dropbox {
      let yandex = provider == .yandex
      var request = URLRequest(url: URL(string: yandex ? "https://login.yandex.ru/info?format=json" : provider.api + "/v1.0/me?$select=id")!)
      request.setValue((yandex ? "OAuth " : "Bearer ") + access, forHTTPHeaderField: "Authorization")
      let (status, body) = try exchange(request)
      value = status == 200 ? body.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["id"] as? String : nil
    }
    guard let value, Self.token(value) else { throw IosWebDavFailure.code("oauth_login") }
    return value
  }

  // ADR0028 account display label, Dropbox only for now: best effort, a failure never fails sign-in.
  func label(_ access: String) -> String? {
    guard provider == .dropbox else { return nil }
    var request = URLRequest(url: URL(string: provider.api + "/2/users/get_current_account")!)
    request.httpMethod = "POST"
    request.setValue("Bearer " + access, forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = Data("null".utf8)
    guard let (status, body) = try? exchange(request), status == 200 else { return nil }
    return IosOAuthProfile.label(body)
  }

  // A fresh access token; for Yandex the stored token itself while it has not expired.
  func refresh(_ refreshToken: String, expiresAt: Int64? = nil) throws -> String {
    if provider == .yandex {
      guard let expiresAt, expiresAt > Int64(Date().timeIntervalSince1970) else { throw IosWebDavFailure.code("oauth_expired") }
      return refreshToken
    }
    var fields = ["grant_type": "refresh_token", "refresh_token": refreshToken, "client_id": provider.clientId]
    if let scope = provider.scope { fields["scope"] = scope }
    let json = try token(fields)
    guard let access = json["access_token"] as? String, Self.token(access) else { throw IosWebDavFailure.code("oauth_login") }
    return access
  }
  // Best effort on removal or a failed save. Dropbox and Google let a public client revoke; Microsoft has no such call and
  // Yandex requires the app secret (ADR0028 §6). Google revokes the refresh token directly.
  var canRevoke: Bool { provider == .dropbox || provider == .googleDrive }
  func revoke(refreshToken: String) {
    if provider == .googleDrive { return revoke(accessToken: refreshToken) }
    guard canRevoke, let access = try? refresh(refreshToken) else { return }
    revoke(accessToken: access)
  }
  func revoke(accessToken: String) {
    guard canRevoke else { return }
    if provider == .googleDrive {
      var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/revoke")!)
      request.httpMethod = "POST"
      request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
      let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
      request.httpBody = Data(("token=" + accessToken.addingPercentEncoding(withAllowedCharacters: allowed)!).utf8)
      _ = try? exchange(request)
      return
    }
    var request = URLRequest(url: URL(string: provider.api + "/2/auth/token/revoke")!)
    request.httpMethod = "POST"
    request.setValue("Bearer " + accessToken, forHTTPHeaderField: "Authorization")
    _ = try? exchange(request)
  }

  private func token(_ fields: [String: String]) throws -> [String: Any] {
    var request = URLRequest(url: URL(string: provider.token)!)
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    request.httpBody = Data(fields.sorted { $0.key < $1.key }.map { key, value in
      key + "=" + value.addingPercentEncoding(withAllowedCharacters: allowed)!
    }.joined(separator: "&").utf8)
    let (status, body) = try exchange(request)
    guard status == 200, let body, let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else {
      throw IosWebDavFailure.code("oauth_login")
    }
    return json
  }

  private func exchange(_ original: URLRequest) throws -> (Int, Data?) {
    let config = URLSessionConfiguration.ephemeral
    config.httpCookieStorage = nil; config.httpShouldSetCookies = false
    config.urlCredentialStorage = nil; config.urlCache = nil
    config.allowsCellularAccess = false
    let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    defer { session.finishTasksAndInvalidate() }
    var request = original
    request.cachePolicy = .reloadIgnoringLocalCacheData; request.httpShouldHandleCookies = false
    let done = DispatchSemaphore(value: 0)
    let reply = OAuthReply()
    let operation = session.dataTask(with: request) { data, response, error in reply.value = (data, response, error); done.signal() }
    lock.lock()
    guard !cancelled, task == nil else { lock.unlock(); throw IosWebDavFailure.code(cancelled ? "cancelled" : "backup_busy") }
    task = operation
    lock.unlock()
    defer { lock.lock(); task = nil; lock.unlock() }
    operation.resume()
    done.wait()
    // The semaphore orders the completion handler's write before this read.
    let result = reply.value
    if let error = result.2 {
      if isCancelled() { throw IosWebDavFailure.code("cancelled") }
      throw IosWebDavClient.failure(error)
    }
    guard let status = (result.1 as? HTTPURLResponse)?.statusCode else { throw IosWebDavFailure.code("oauth_login") }
    guard status == 200 else { return (status, nil) }
    guard let data = result.0, data.count <= 65536 else { throw IosWebDavFailure.code("oauth_login") }
    return (status, data)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

  private static func token(_ value: String) -> Bool {
    !value.isEmpty && value.utf8.count <= 8192 && !value.unicodeScalars.contains(where: { $0.value <= 32 || $0.value >= 127 })
  }
  private static func random() throws -> String {
    var bytes = [UInt8](repeating: 0, count: 32)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw IosWebDavFailure.code("oauth_login") }
    return encode(Data(bytes))
  }
  private static func encode(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
