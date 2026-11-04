#if KLODA_FTPS_NATIVE
import Foundation
import Darwin

private typealias FtpsConnectCallback = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<UInt8>?, Int, UInt16) -> Int32
private typealias FtpsReceiptCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UInt64) -> Int32
@_silgen_name("kloda_ftps_publish_bound")
private func ftpsPublishBound(_ json: UnsafePointer<UInt8>, _ length: Int, _ snapshot: Int32, _ socket: Int32,
  _ callback: FtpsReceiptCallback?, _ connect: FtpsConnectCallback?, _ context: UnsafeMutableRawPointer?) -> Int32

private final class IosFtpsReceiptOwner {
  let journal: IosFtpsJournal
  let job: IosFtpsUpload
  let current: () throws -> Bool
  let connect: (String, UInt16) -> Int32
  init(journal: IosFtpsJournal, job: IosFtpsUpload, current: @escaping () throws -> Bool, connect: @escaping (String, UInt16) -> Int32) {
    self.journal = journal; self.job = job; self.current = current; self.connect = connect
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
// The opt-in product bridge uses these owners; production defaults remain disabled.
enum IosFtpsPublication {
  static func runBound(journal: IosFtpsJournal, job: IosFtpsUpload, snapshot: Int32, password: String,
    socket: Int32, connect: @escaping (String, UInt16) -> Int32, current: @escaping () throws -> Bool, completed: (() throws -> Bool)? = nil) throws {
    try execute(journal: journal, job: job, snapshot: snapshot, password: password, socket: socket, connect: connect, current: current, completed: completed ?? current)
  }
  static func request(job: IosFtpsUpload, password: String) throws -> Data {
    try job.validate()
    guard password.utf8.count <= 4096, !password.utf8.contains(0),
      let hash = Data(base64Encoded: job.sha256.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") + "="),
      hash.count == 32 else { throw IosFtpsFailure(code: "invalid_request") }
    let request: [String: Any] = ["address": job.target.address, "port": job.target.port, "hostname": job.target.hostname,
      "root": job.target.root, "username": job.target.username, "password": password,
      "operationId": job.id, "finalPath": job.relativePath, "size": String(job.size), "sha256": hash.map { Int($0) }, "responseTimeoutMs": 5000]
    return try JSONSerialization.data(withJSONObject: request)
  }
  private static func execute(journal: IosFtpsJournal, job: IosFtpsUpload, snapshot: Int32, password: String,
    socket: Int32, connect: @escaping (String, UInt16) -> Int32, current: @escaping () throws -> Bool, completed: @escaping () throws -> Bool) throws {
    var ownedSocket: Int32? = socket
    defer { if let fd = ownedSocket, fd >= 0 { Darwin.close(fd) } }
    if socket < 0 || socket == snapshot { throw IosFtpsFailure(code: "invalid_request") }
    guard !Thread.isMainThread else { throw IosFtpsFailure(code: "worker_required") }
    let data = try request(job: job, password: password)
    try journal.insert(job)
    let transferred = Darwin.dup(snapshot)
    guard transferred >= 0 else { try? journal.markIssue(job, code: 2); throw IosFtpsFailure(code: "snapshot_io_failed") }
    let owner = IosFtpsReceiptOwner(journal: journal, job: job, current: current, connect: connect)
    let context = Unmanaged.passUnretained(owner).toOpaque()
    let result = withExtendedLifetime(owner) { data.withUnsafeBytes { buffer in
      let callback: FtpsReceiptCallback = { context, event, bytes in
        guard let context else { return 1 }
        return Unmanaged<IosFtpsReceiptOwner>.fromOpaque(context).takeUnretainedValue().callback(event: event, bytes: bytes)
      }
      ownedSocket = nil // The C ABI consumes the duplicate even on error.
      return ftpsPublishBound(buffer.bindMemory(to: UInt8.self).baseAddress!, data.count, transferred, socket, callback, { raw, address, length, port in
        guard let raw, let address, (1...39).contains(length), port > 0 else { return -1 }
        let owner = Unmanaged<IosFtpsReceiptOwner>.fromOpaque(raw).takeUnretainedValue()
        guard owner.callback(event: 0, bytes: 0) == 0, let text = String(bytes: UnsafeBufferPointer(start: address, count: length), encoding: .utf8) else { return -1 }
        return owner.connect(text, port)
      }, context)
    } }
    guard result == 0 else {
      try? journal.markIssue(job, code: result)
      throw IosFtpsFailure(code: "native_" + String(result))
    }
    do { try journal.complete(job, current: completed) }
    catch { try? journal.markIssue(job, code: 4); throw error }
  }
}

#endif
