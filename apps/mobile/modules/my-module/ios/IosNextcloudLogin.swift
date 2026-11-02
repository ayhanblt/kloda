import Foundation

struct IosNextcloudLoginStart: Equatable {
  let server: URL
  let login: URL
  let poll: URL
  let token: String
}

struct IosNextcloudCredential: Equatable {
  let loginName: String
  let appPassword: String
}

private final class Reply: @unchecked Sendable { var value: (Data?, URLResponse?, Error?) = (nil, nil, nil) }

// Nextcloud Login Flow v2 (ADR0027): same no-cellular, no-redirect, no-cookie policy as the DAV client.
final class IosNextcloudLogin: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  private let lock = NSLock()
  private var task: URLSessionTask?
  private var cancelled = false

  func cancel() { lock.lock(); cancelled = true; let current = task; lock.unlock(); current?.cancel() }

  func start(_ entered: String) throws -> IosNextcloudLoginStart {
    let server = try Self.server(entered)
    var request = URLRequest(url: server.appendingPathComponent("index.php/login/v2"))
    request.httpMethod = "POST"
    let (status, body) = try exchange(request)
    guard status == 200, let body,
      let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
      let poll = json["poll"] as? [String: Any], let token = poll["token"] as? String,
      let endpoint = poll["endpoint"] as? String, let login = json["login"] as? String,
      !token.isEmpty, token.utf8.count <= 1024,
      !token.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else {
      throw IosWebDavFailure.code("nextcloud_login")
    }
    return IosNextcloudLoginStart(server: server, login: try Self.sameOrigin(server, login),
      poll: try Self.sameOrigin(server, endpoint), token: token)
  }

  // One poll: nil until the user grants access in the browser (Nextcloud answers 404).
  func poll(_ start: IosNextcloudLoginStart) throws -> IosNextcloudCredential? {
    var request = URLRequest(url: start.poll)
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    var form = URLComponents(); form.queryItems = [URLQueryItem(name: "token", value: start.token)]
    request.httpBody = Data((form.percentEncodedQuery ?? "").replacingOccurrences(of: "+", with: "%2B").utf8)
    let (status, body) = try exchange(request)
    if status == 404 { return nil }
    guard status == 200, let body, let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
      let server = json["server"] as? String, let name = json["loginName"] as? String,
      let password = json["appPassword"] as? String else { throw IosWebDavFailure.code("nextcloud_login") }
    guard (try? Self.server(server)) == start.server else {
      // The entered server issued this app password: revoke it there, never at the other address.
      if !name.isEmpty, !password.isEmpty { revoke(base: start.server, authorization: Self.basic(name, password)) }
      throw IosWebDavFailure.code("nextcloud_server_mismatch")
    }
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !name.contains(":"), !password.isEmpty,
      [name, password].allSatisfy({ !$0.utf8.contains(0) && $0.utf8.count <= 8192 }) else {
      throw IosWebDavFailure.code("nextcloud_login")
    }
    return IosNextcloudCredential(loginName: name, appPassword: password)
  }

  // The poll token is valid for 20 minutes; polling stops on cancel, expiry or any non-404 failure.
  func waitForGrant(_ start: IosNextcloudLoginStart, interval: TimeInterval = 2, limit: TimeInterval = 20 * 60) throws -> IosNextcloudCredential {
    let deadline = Date().addingTimeInterval(limit)
    while true {
      if isCancelled() { throw IosWebDavFailure.code("cancelled") }
      if let credential = try poll(start) { return credential }
      if Date().addingTimeInterval(interval) > deadline { throw IosWebDavFailure.code("nextcloud_login_expired") }
      Thread.sleep(forTimeInterval: interval)
    }
  }

  func profile(_ start: IosNextcloudLoginStart, _ credential: IosNextcloudCredential, folder: String) throws -> IosWebDavProfile {
    let endpoint = start.server.appendingPathComponent("remote.php/dav/files").appendingPathComponent(credential.loginName)
    let profile = IosWebDavProfile(revision: UUID().uuidString, endpoint: endpoint.absoluteString, targetPath: folder,
      username: credential.loginName, password: credential.appPassword, provider: "nextcloud")
    try profile.validate()
    return profile
  }

  // Best effort on removal: local custody is deleted whatever the server answers.
  func revoke(_ profile: IosWebDavProfile) throws {
    guard profile.provider == "nextcloud" else { throw IosWebDavFailure.code("invalid_request") }
    guard let endpoint = URL(string: profile.endpoint) else { return }
    let parts = endpoint.pathComponents.filter { $0 != "/" }
    guard parts.count >= 4, Array(parts.suffix(4).prefix(3)) == ["remote.php", "dav", "files"] else { return }
    var base = endpoint
    for _ in 0..<4 { base.deleteLastPathComponent() }
    revoke(base: base, authorization: profile.authorization)
  }
  private func revoke(base: URL, authorization: String) {
    var request = URLRequest(url: base.appendingPathComponent("ocs/v2.php/core/apppassword"))
    request.httpMethod = "DELETE"
    request.setValue(authorization, forHTTPHeaderField: "Authorization")
    request.setValue("true", forHTTPHeaderField: "OCS-APIREQUEST")
    _ = try? exchange(request)
  }
  private static func basic(_ name: String, _ password: String) -> String {
    "Basic " + Data((name + ":" + password).utf8).base64EncodedString()
  }

  private func isCancelled() -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled }

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
    let reply = Reply()
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
    guard let status = (result.1 as? HTTPURLResponse)?.statusCode else { throw IosWebDavFailure.code("nextcloud_login") }
    guard status == 200 else { return (status, nil) }
    guard let data = result.0, data.count <= 65536 else { throw IosWebDavFailure.code("nextcloud_login") }
    return (status, data)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

  // HTTPS origin plus optional sub-path, no credentials/query/fragment, without a trailing slash.
  static func server(_ value: String) throws -> URL {
    guard var url = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)), url.scheme == "https",
      url.host?.isEmpty == false, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else {
      throw IosWebDavFailure.code("webdav_fields")
    }
    let parts = url.percentEncodedPath.split(separator: "/").map(String.init)
    guard !parts.contains(where: { $0 == "." || $0 == ".." }) else { throw IosWebDavFailure.code("webdav_fields") }
    url.percentEncodedPath = parts.isEmpty ? "" : "/" + parts.joined(separator: "/")
    guard let result = url.url else { throw IosWebDavFailure.code("webdav_fields") }
    return result
  }

  // Login and poll URLs must stay on the entered server; anything else is refused before it is opened or polled.
  static func sameOrigin(_ server: URL, _ value: String) throws -> URL {
    guard let url = URL(string: value), url.scheme == "https", url.host == server.host, url.port == server.port,
      url.user == nil else { throw IosWebDavFailure.code("nextcloud_server_mismatch") }
    let prefix = server.pathComponents.filter { $0 != "/" }
    guard Array(url.pathComponents.filter { $0 != "/" }.prefix(prefix.count)) == prefix else {
      throw IosWebDavFailure.code("nextcloud_server_mismatch")
    }
    return url
  }
}
