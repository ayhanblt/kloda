import Foundation
import CryptoKit

struct IosWebDavReply {
  let status: Int
  let size: Int64
  let sha256: String
  // Bounded (64 KiB) body of an error reply, or of a reply the caller asked to collect (JSON APIs).
  var body = Data()
}

// A request owns one serial delegate queue and never buffers a whole download in memory.
final class IosWebDavClient: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private let condition = NSCondition()
  private var finished = false
  private var mutation = false
  private var readsBody = false
  private var collect = false
  private var body = Data()
  private var mutationAcknowledged = false
  private var failure: Error?
  private var status = 0
  private var received: Int64 = 0
  private var maximum: Int64 = 65536
  private var digest = SHA256()
  private var sink: ((Data) throws -> Void)?
  private var task: URLSessionTask?
  private var active: URLSession?

  private override init() { super.init() }
  static func send(profile: IosWebDavProfile, path: String, method: String, headers: [String: String] = [:],
    upload: URL? = nil, size: Int64 = 65536, receive: ((Data) throws -> Void)? = nil,
    check: () throws -> Void) throws -> IosWebDavReply {
    try check()
    let target = try profile.url(path)
    var request = URLRequest(url: method == "MKCOL" ? target.appendingPathComponent("", isDirectory: true) : target)
    request.httpMethod = method
    request.setValue(profile.authorization, forHTTPHeaderField: "Authorization")
    for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
    // Each exchange has its own delegate state; late cancellation callbacks cannot mutate the next request.
    return try IosWebDavClient().perform(request, mutation: method != "GET", readsBody: method == "GET", collect: false,
      upload: upload, data: nil, size: size, receive: receive, check: check)
  }
  // REST APIs (Dropbox): the body is always read. A mutation's received status stays its ACK even if the body is lost;
  // a read's interrupted body is a failure. `collect` keeps a 200 body (at most `size`, which callers bound to 64 KiB).
  static func exchange(_ request: URLRequest, mutation: Bool, upload: URL? = nil, data: Data? = nil, size: Int64 = 65536,
    collect: Bool = false, receive: ((Data) throws -> Void)? = nil, check: () throws -> Void) throws -> IosWebDavReply {
    try check()
    guard !collect || size <= 65536 else { throw IosWebDavFailure.code("invalid_request") }
    return try IosWebDavClient().perform(request, mutation: mutation, readsBody: true, collect: collect,
      upload: upload, data: data, size: size, receive: receive, check: check)
  }
  func cancel() { condition.lock(); let current = task; condition.unlock(); current?.cancel() }

  private func perform(_ original: URLRequest, mutation: Bool, readsBody: Bool, collect: Bool, upload: URL?, data: Data?,
    size: Int64, receive: ((Data) throws -> Void)?, check: () throws -> Void) throws -> IosWebDavReply {
    guard size >= 0, upload == nil || data == nil else { throw IosWebDavFailure.code("invalid_request") }
    let config = URLSessionConfiguration.ephemeral
    config.httpCookieStorage = nil; config.httpShouldSetCookies = false
    config.urlCredentialStorage = nil; config.urlCache = nil
    config.allowsCellularAccess = false
    let queue = OperationQueue(); queue.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: config, delegate: self, delegateQueue: queue)
    var request = original
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.httpShouldHandleCookies = false
    condition.lock()
    guard task == nil else { condition.unlock(); session.invalidateAndCancel(); throw IosWebDavFailure.code("backup_busy") }
    finished = false; mutationAcknowledged = false; failure = nil; status = 0; received = 0; maximum = size; digest = SHA256(); sink = receive
    self.mutation = mutation; self.readsBody = readsBody; self.collect = collect; body = Data()
    active = session
    let operation = upload.map { session.uploadTask(with: request, fromFile: $0) }
      ?? data.map { session.uploadTask(with: request, from: $0) } ?? session.dataTask(with: request)
    task = operation
    condition.unlock()
    operation.resume()
    defer {
      session.finishTasksAndInvalidate()
      condition.lock(); task = nil; active = nil; sink = nil; condition.unlock()
    }
    condition.lock()
    while !finished {
      _ = condition.wait(until: Date(timeIntervalSinceNow: 0.1))
      if !finished {
        condition.unlock()
        do { try check() } catch { operation.cancel(); throw error }
        condition.lock()
      }
    }
    let error = failure
    let reply = IosWebDavReply(status: status, size: received, sha256: Self.encode(Data(digest.finalize())), body: body)
    condition.unlock()
    if let error { throw error }
    // The caller persists a received mutation ACK before testing a newly changed context.
    return reply
  }
  func urlSession(_ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
  func urlSession(_ session: URLSession, task: URLSessionTask,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
      completionHandler(.performDefaultHandling, nil)
    } else {
      condition.lock(); failure = IosWebDavFailure.code("webdav_auth"); condition.unlock()
      completionHandler(.cancelAuthenticationChallenge, nil)
    }
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    condition.lock(); status = (response as? HTTPURLResponse)?.statusCode ?? 0
    // A received mutation status is its ACK. Diagnostic-body cancellation or loss cannot erase it.
    if mutation, status != 0 { mutationAcknowledged = true }
    if !readsBody, mutationAcknowledged {
      finished = true; condition.broadcast()
      condition.unlock(); completionHandler(.cancel); return
    }
    if status != 200 { maximum = 65536; sink = nil; collect = true }
    condition.unlock()
    completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    condition.lock(); defer { condition.unlock() }
    guard !finished, failure == nil else { return }
    do {
      guard Int64(data.count) <= maximum - received else { throw IosWebDavFailure.code("review_required") }
      try sink?(data); received += Int64(data.count); digest.update(data: data)
      if collect { body.append(data) }
    } catch {
      // A mutation's ACK stands; its oversized diagnostic body is simply dropped.
      if mutationAcknowledged { body = Data(); finished = true; condition.broadcast() } else { failure = error }
      dataTask.cancel()
    }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    condition.lock()
    if !mutationAcknowledged, failure == nil, let error { failure = Self.failure(error) }
    finished = true; condition.broadcast(); condition.unlock()
  }
  static func encode(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  static func failure(_ error: Error) -> Error {
    if error is IosWebDavFailure { return error }
    if (error as NSError).domain == NSURLErrorDomain, (error as NSError).code == NSURLErrorDataNotAllowed { return IosWebDavFailure.code("wifi_required") }
    return IosWebDavFailure.code("connection_unavailable")
  }
  static func require(_ reply: IosWebDavReply, _ codes: Set<Int>) throws {
    if codes.contains(reply.status) { return }
    let code = [401, 403].contains(reply.status) ? "webdav_auth" : reply.status == 507 ? "disk_full"
      : reply.status == 412 ? "conflict" : "webdav_response"
    throw IosWebDavFailure.code(code)
  }
}
