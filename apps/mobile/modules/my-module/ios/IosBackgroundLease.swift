import Foundation
import BackgroundTasks

// Constructed only by the native OS task callback; never marshalled to Expo/JS.
final class IosBackgroundLease {
  private let lock = NSLock()
  private var cancelled = false
  private var didExpire = false
  var expired: Bool { lock.lock(); defer { lock.unlock() }; return didExpire }
  func expire() { lock.lock(); didExpire = true; lock.unlock(); cancel() }
  private var owner: UInt64?
  private var token: Data?
  private let task: BGProcessingTask
  init(task: BGProcessingTask) { self.task = task }

  func check() throws {
    lock.lock(); defer { lock.unlock() }
    guard !cancelled, !didExpire else { throw IosPairingFailure.native("cancelled") }
  }

  func attach(owner: UInt64, record: String) throws {
    lock.lock(); defer { lock.unlock() }
    guard !cancelled, !didExpire, self.owner == nil else { throw IosPairingFailure.native("cancelled") }
    let bytes = Data(record.utf8)
    let raw = try bytes.withUnsafeBytes {
      try IosPairingNativeCall.consume(kloda_ios_background_begin(owner, $0.bindMemory(to: UInt8.self).baseAddress, $0.count))
    }
    guard let object = raw as? [String: Any], Set(object.keys) == ["lease"], let value = object["lease"] as? String else { throw IosPairingFailure.invalidReply }
    try IosFilesTransfer.fixed(value, bytes: 16)
    self.owner = owner; token = Data(value.utf8)
  }

  func send(owner: UInt64, record: String, command: [String: Any], descriptor: Int32) throws -> [String: Any] {
    lock.lock()
    guard !cancelled, !didExpire, self.owner == owner, let token else { lock.unlock(); throw IosPairingFailure.native("cancelled") }
    lock.unlock()
    var data = try JSONSerialization.data(withJSONObject: command)
    defer { data.resetBytes(in: 0..<data.count) }
    guard data.count <= 8192 else { throw IosPairingFailure.native("invalid_request") }
    let recordBytes = Data(record.utf8)
    let raw = try recordBytes.withUnsafeBytes { r in
      try data.withUnsafeBytes { c in
        try token.withUnsafeBytes { t in
          try IosPairingNativeCall.consume(kloda_ios_background_transfer(owner,
            r.bindMemory(to: UInt8.self).baseAddress, r.count, c.bindMemory(to: UInt8.self).baseAddress, c.count,
            descriptor, t.bindMemory(to: UInt8.self).baseAddress, t.count))
        }
      }
    }
    try check()
    guard let result = raw as? [String: Any] else { throw IosPairingFailure.invalidReply }
    return result
  }

  func cancel() {
    lock.lock(); defer { lock.unlock() }
    cancelled = true
    if let owner, let token {
      // Does not wait for the actor/network; a lost remote result remains unknown.
      _ = try? token.withUnsafeBytes {
        try IosPairingReply.empty(IosPairingNativeCall.consume(kloda_ios_background_end(owner,
          $0.bindMemory(to: UInt8.self).baseAddress, $0.count)))
      }
    }
    owner = nil; token = nil
  }
  deinit { cancel() }
}

extension KlodaPairingSession {
  func backgroundFileConnection(record: String, lease: IosBackgroundLease,
    completion: @escaping (Result<IosFilesConnection, IosPairingFailure>) -> Void) {
    backgroundOwner { result in
      do {
        try lease.check()
        let owner = try result.get()
        try lease.attach(owner: owner, record: record)
        let check = { try lease.check(); try self.checkBackgroundOwner(owner) }
        try check()
        completion(.success(IosFilesConnection(check: check, send: { command, descriptor in
          try check()
          let value = try lease.send(owner: owner, record: record, command: command, descriptor: descriptor)
          try check(); return value
        })))
      } catch { lease.cancel(); completion(.failure(IosFilesQueue.failure(error))) }
    }
  }
}
