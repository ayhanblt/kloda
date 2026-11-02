#if KLODA_SMB_NATIVE
import Foundation
import Darwin

private typealias SmbReceiptCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UInt64) -> Int32
@_silgen_name("kloda_smb_publish")
private func smbPublish(_ json: UnsafePointer<UInt8>, _ length: Int, _ snapshot: Int32,
  _ callback: SmbReceiptCallback?, _ context: UnsafeMutableRawPointer?) -> Int32

@_silgen_name("kloda_smb_publish_bound")
private func smbPublishBound(_ json: UnsafePointer<UInt8>, _ length: Int, _ snapshot: Int32, _ socket: Int32,
  _ callback: SmbReceiptCallback?, _ context: UnsafeMutableRawPointer?) -> Int32

private final class IosSmbReceiptOwner {
  let journal: IosSmbJournal
  let job: IosSmbUpload
  let current: () throws -> Bool
  init(journal: IosSmbJournal, job: IosSmbUpload, current: @escaping () throws -> Bool) {
    self.journal = journal; self.job = job; self.current = current
  }
  func callback(event: Int32, bytes: UInt64) -> Int32 {
    do {
      if event == 0 {
        guard try journal.context() == job.context, try current() else { return 1 }
      } else { try journal.record(job, event: event, bytes: bytes) }
      return 0
    } catch { return 1 }
  }
}

// Native-only worker entry. Profile/vault/source/route owners must supply current admission.
// No JS export or feature activation until those owners and runtime gates are integrated.
enum IosSmbPublication {
  static func run(journal: IosSmbJournal, job: IosSmbUpload, snapshot: Int32, password: String,
    current: @escaping () throws -> Bool) throws {
    try execute(journal: journal, job: job, snapshot: snapshot, password: password, socket: nil, current: current, completed: current)
  }
  // Consumes the native route owner's exclusive socket on every return.
  static func runBound(journal: IosSmbJournal, job: IosSmbUpload, snapshot: Int32, password: String,
    socket: Int32, current: @escaping () throws -> Bool, completed: (() throws -> Bool)? = nil) throws {
    try execute(journal: journal, job: job, snapshot: snapshot, password: password, socket: socket, current: current, completed: completed ?? current)
  }
  static func request(job: IosSmbUpload, password: String) throws -> Data {
    try job.validate()
    guard password.utf8.count <= 4096, !password.utf8.contains(0),
      let hash = Data(base64Encoded: job.sha256.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") + "="),
      hash.count == 32 else { throw IosSmbFailure(code: "invalid_request") }
    let path = job.target.root.isEmpty ? job.relativePath : job.target.root + "/" + job.relativePath
    let request: [String: Any] = ["address": job.target.address, "port": job.target.port, "share": job.target.share,
      "username": job.target.username, "password": password, "domain": job.target.domain,
      "operationId": job.id, "finalPath": path, "size": String(job.size), "sha256": hash.map { Int($0) }, "responseTimeoutMs": 5000]
    return try JSONSerialization.data(withJSONObject: request)
  }
  private static func execute(journal: IosSmbJournal, job: IosSmbUpload, snapshot: Int32, password: String,
    socket: Int32?, current: @escaping () throws -> Bool, completed: @escaping () throws -> Bool) throws {
    var ownedSocket = socket
    defer { if let fd = ownedSocket, fd >= 0 { Darwin.close(fd) } }
    if let socket, socket < 0 || socket == snapshot { throw IosSmbFailure(code: "invalid_request") }
    guard !Thread.isMainThread else { throw IosSmbFailure(code: "worker_required") }
    let data = try request(job: job, password: password)
    try journal.insert(job)
    let transferred = Darwin.dup(snapshot)
    guard transferred >= 0 else { try? journal.markIssue(job, code: 2); throw IosSmbFailure(code: "snapshot_io_failed") }
    let owner = IosSmbReceiptOwner(journal: journal, job: job, current: current)
    let context = Unmanaged.passUnretained(owner).toOpaque()
    let result = withExtendedLifetime(owner) { data.withUnsafeBytes { buffer in
      let callback: SmbReceiptCallback = { context, event, bytes in
        guard let context else { return 1 }
        return Unmanaged<IosSmbReceiptOwner>.fromOpaque(context).takeUnretainedValue().callback(event: event, bytes: bytes)
      }
      if let socket {
        ownedSocket = nil // The C ABI now consumes the socket, including error returns.
        return smbPublishBound(buffer.bindMemory(to: UInt8.self).baseAddress!, data.count, transferred, socket, callback, context)
      }
      return smbPublish(buffer.bindMemory(to: UInt8.self).baseAddress!, data.count, transferred, callback, context)
    } }
    guard result == 0 else {
      try? journal.markIssue(job, code: result)
      throw IosSmbFailure(code: "native_" + String(result))
    }
    do { try journal.complete(job, current: completed) }
    catch { try? journal.markIssue(job, code: 4); throw error }
  }
}

#endif
