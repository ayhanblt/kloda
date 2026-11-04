#if KLODA_S3_NATIVE
import Foundation
import CryptoKit
#if KLODA_S3_OWNED_FIXTURE
import Security
#endif

struct IosS3Reply { let status: Int; let body: Data; let headers: [String: String]; let size: Int64; let sha256: String }

// Each exchange owns a fresh session; full completion XML is required, never HTTP200 alone.
final class IosS3Client: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private let condition = NSCondition()
  private var finished = false
  private var failure: Error?
  private var status = 0
  private var received: Int64 = 0
  private var maximum: Int64 = 65536
  private var digest = SHA256()
  private var body = Data()
  private var headers: [String: String] = [:]
  private var sink: ((Data) throws -> Void)?
  static func send(profile: IosS3Profile, key: String, operation: [String: Any], upload: URL? = nil,
    maximum: Int64 = 65536, receive: ((Data) throws -> Void)? = nil, check: () throws -> Void) throws -> IosS3Reply {
    try IosS3Client().request(profile: profile, key: key, operation: operation, upload: upload, maximum: maximum, receive: receive, check: check)
  }
  private func request(profile: IosS3Profile, key: String, operation: [String: Any], upload: URL?,
    maximum: Int64, receive: ((Data) throws -> Void)?, check: () throws -> Void) throws -> IosS3Reply {
    try check()
    let prepared = try IosS3Bridge.prepare(profile, key: key, operation: operation)
    guard maximum >= 0, let rawURL = prepared["url"] as? String, let url = URL(string: rawURL), url.scheme == "https",
      let method = prepared["method"] as? String, let signedHeaders = prepared["headers"] as? [[String]],
      let rawBody = prepared["body"] as? String, upload == nil || (method == "PUT" && rawBody.isEmpty)
      else { throw IosS3Failure(code: "invalid_request") }
    self.maximum = maximum; sink = receive
    let config = URLSessionConfiguration.ephemeral
    config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.urlCredentialStorage = nil; config.urlCache = nil
    config.allowsCellularAccess = false; config.waitsForConnectivity = false
    config.timeoutIntervalForRequest = 60; config.timeoutIntervalForResource = 180
    let queue = OperationQueue(); queue.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: config, delegate: self, delegateQueue: queue)
    defer { session.invalidateAndCancel(); condition.lock(); sink = nil; condition.unlock() }
    var request = URLRequest(url: url); request.httpMethod = method
    request.cachePolicy = .reloadIgnoringLocalCacheData; request.httpShouldHandleCookies = false
    for header in signedHeaders { guard header.count == 2 else { throw IosS3Failure(code: "invalid_request") }; request.setValue(header[1], forHTTPHeaderField: header[0]) }
    if !rawBody.isEmpty { request.httpBody = Data(rawBody.utf8); request.setValue("application/xml", forHTTPHeaderField: "Content-Type") }
    let task = upload.map { session.uploadTask(with: request, fromFile: $0) } ?? session.dataTask(with: request)
    task.resume()
    condition.lock()
    while !finished {
      _ = condition.wait(until: Date(timeIntervalSinceNow: 0.1))
      if !finished {
        condition.unlock()
        do { try check() } catch { task.cancel(); throw error }
        condition.lock()
      }
    }
    let error = failure
    let reply = IosS3Reply(status: status, body: body, headers: headers, size: received,
      sha256: IosS3Target.hashDigest(Data(digest.finalize())))
    condition.unlock()
    if let error { throw error }
    return reply // Caller records a received ACK before rechecking changed authority.
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
  func urlSession(_ session: URLSession, task: URLSessionTask, needNewBodyStream completionHandler: @escaping (InputStream?) -> Void) { completionHandler(nil) }
  func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    #if KLODA_S3_OWNED_FIXTURE
    if ["127.0.0.1", "localhost"].contains(challenge.protectionSpace.host),
      challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
      guard let path = ProcessInfo.processInfo.environment["KLODA_S3_FIXTURE_CA_DER"],
        let data = try? Data(contentsOf: URL(fileURLWithPath: path)), let certificate = SecCertificateCreateWithData(nil, data as CFData),
        let trust = challenge.protectionSpace.serverTrust,
        SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, challenge.protectionSpace.host as CFString)) == errSecSuccess,
        SecTrustSetAnchorCertificates(trust, [certificate] as CFArray) == errSecSuccess,
        SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess, SecTrustEvaluateWithError(trust, nil)
        else { completionHandler(.cancelAuthenticationChallenge, nil); return }
      completionHandler(.useCredential, URLCredential(trust: trust)); return
    }
    #endif
    if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust { completionHandler(.performDefaultHandling, nil) }
    else { completionHandler(.cancelAuthenticationChallenge, nil) }
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    condition.lock()
    status = (response as? HTTPURLResponse)?.statusCode ?? 0
    if let response = response as? HTTPURLResponse {
      for (key, value) in response.allHeaderFields { if let key = key as? String { headers[key.lowercased()] = String(describing: value) } }
    }
    if status != 200 || dataTask.originalRequest?.httpMethod != "GET" { maximum = 65536; sink = nil }
    condition.unlock(); completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    condition.lock(); defer { condition.unlock() }
    guard failure == nil else { return }
    do {
      guard Int64(data.count) <= maximum - received else { throw IosS3Failure(code: "review_required") }
      if let sink { try sink(data) } else { guard data.count <= 65536 - body.count else { throw IosS3Failure(code: "review_required") }; body.append(data) }
      received += Int64(data.count); digest.update(data: data)
    } catch { failure = error; dataTask.cancel() }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    condition.lock()
    if failure == nil, error != nil { failure = IosS3Failure(code: "connection_unavailable") }
    finished = true; condition.broadcast(); condition.unlock()
  }
}
#if KLODA_S3_OWNED_FIXTURE
@_cdecl("kloda_s3_owned_fixture_marker")
public func s3OwnedFixtureMarker() -> Int32 { 17 }
#endif
extension IosS3Target {
  static func hashDigest(_ digest: Data) -> String {
    digest.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
}
#endif
