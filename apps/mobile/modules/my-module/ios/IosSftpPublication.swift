#if KLODA_SFTP_NATIVE
import Foundation
import Darwin

private typealias SftpReceiptCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UInt64) -> Int32
@_silgen_name("kloda_sftp_publish_bound")
private func sftpPublishBound(_ json: UnsafePointer<UInt8>, _ length: Int, _ snapshot: Int32, _ socket: Int32,
  _ callback: SftpReceiptCallback?, _ context: UnsafeMutableRawPointer?) -> Int32

private final class IosSftpReceiptOwner {
  let journal: IosSftpJournal
  let job: IosSftpUpload
  let current: () throws -> Bool
  init(journal: IosSftpJournal, job: IosSftpUpload, current: @escaping () throws -> Bool) {
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
enum IosSftpPublication {
  static func runBound(journal: IosSftpJournal, job: IosSftpUpload, snapshot: Int32, password: String,
    socket: Int32, current: @escaping () throws -> Bool, completed: (() throws -> Bool)? = nil) throws {
    try execute(journal: journal, job: job, snapshot: snapshot, password: password, socket: socket, current: current, completed: completed ?? current)
  }
  static func request(job: IosSftpUpload, password: String) throws -> Data {
    try job.validate()
    guard password.utf8.count <= 4096, !password.utf8.contains(0),
      let hash = Data(base64Encoded: job.sha256.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") + "="),
      hash.count == 32 else { throw IosSftpFailure(code: "invalid_request") }
    let request: [String: Any] = ["address": job.target.address, "port": job.target.port, "fingerprint": job.target.fingerprint,
      "root": job.target.root, "username": job.target.username, "password": password,
      "operationId": job.id, "finalPath": job.relativePath, "size": String(job.size), "sha256": hash.map { Int($0) }, "responseTimeoutMs": 5000]
    return try JSONSerialization.data(withJSONObject: request)
  }
  private static func execute(journal: IosSftpJournal, job: IosSftpUpload, snapshot: Int32, password: String,
    socket: Int32, current: @escaping () throws -> Bool, completed: @escaping () throws -> Bool) throws {
    var ownedSocket: Int32? = socket
    defer { if let fd = ownedSocket, fd >= 0 { Darwin.close(fd) } }
    if socket < 0 || socket == snapshot { throw IosSftpFailure(code: "invalid_request") }
    guard !Thread.isMainThread else { throw IosSftpFailure(code: "worker_required") }
    let data = try request(job: job, password: password)
    try journal.insert(job)
    let transferred = Darwin.dup(snapshot)
    guard transferred >= 0 else { try? journal.markIssue(job, code: 2); throw IosSftpFailure(code: "snapshot_io_failed") }
    let owner = IosSftpReceiptOwner(journal: journal, job: job, current: current)
    let context = Unmanaged.passUnretained(owner).toOpaque()
    let result = withExtendedLifetime(owner) { data.withUnsafeBytes { buffer in
      let callback: SftpReceiptCallback = { context, event, bytes in
        guard let context else { return 1 }
        return Unmanaged<IosSftpReceiptOwner>.fromOpaque(context).takeUnretainedValue().callback(event: event, bytes: bytes)
      }
      ownedSocket = nil // The C ABI consumes the duplicate even on error.
      return sftpPublishBound(buffer.bindMemory(to: UInt8.self).baseAddress!, data.count, transferred, socket, callback, context)
    } }
    guard result == 0 else {
      try? journal.markIssue(job, code: result)
      throw IosSftpFailure(code: "native_" + String(result))
    }
    do { try journal.complete(job, current: completed) }
    catch { try? journal.markIssue(job, code: 4); throw error }
  }
}

#endif
