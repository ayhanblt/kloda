import Foundation
import Darwin

// Native UI state and opaque owner lifetime; the serial worker never blocks the UI on network I/O.
final class KlodaPairingSession {
  typealias Completion = (Result<[String: Any]?, IosPairingFailure>) -> Void
  private let worker = DispatchQueue(label: "com.kloda.pairing.ios")
  private let lock = NSLock()
  private var owner: UInt64?
  private var nativeEpoch: UInt64?
  private var active = false
  private var generation: UInt64 = 0
  private var destroyed = false
  private var poisoned = false

  var isForegroundActive: Bool { lock.lock(); defer { lock.unlock() }; return active && !destroyed && !poisoned }

  var isDestroyed: Bool {
    lock.lock()
    defer { lock.unlock() }
    return destroyed
  }

  func updateActive(_ value: Bool) {
    lock.lock()
    defer { lock.unlock() }
    guard !destroyed, !poisoned, active != value else { return }
    active = value
    invalidateLocked()
    if let owner {
      do {
        let reply = try IosPairingNativeCall.consume(kloda_ios_set_foreground(owner, value ? 1 : 0))
        if value { nativeEpoch = try IosPairingReply.epoch(reply) }
        else { try IosPairingReply.empty(reply); nativeEpoch = nil }
      } catch { nativeEpoch = nil; active = false; poisoned = true }
    }
  }

  func request(_ command: [String: Any], foreground: Bool, completion: @escaping Completion) {
    lock.lock()
    let ticket = generation
    let permitted = !destroyed && !poisoned && (!foreground || active)
    lock.unlock()
    guard permitted else { completion(.failure(.native("candidate_stale"))); return }
    worker.async {
      do {
        let owner = try self.ownerOnWorker(ticket: ticket)
        let epoch = try self.check(owner: owner, ticket: ticket, foreground: foreground)
        let value = try self.nativeRequest(owner: owner, command: command, expectedEpoch: epoch)
        let status = try IosPairingReply.status(value)
        _ = try self.check(owner: owner, ticket: ticket, foreground: foreground)
        completion(.success(status))
      } catch { completion(.failure(self.failure(error))) }
    }
  }

  func fileConnection(record: String, automatic: Bool = false, completion: @escaping (Result<IosFilesConnection, IosPairingFailure>) -> Void) {
    lock.lock()
    let ticket = generation
    let permitted = active && !destroyed && !poisoned
    lock.unlock()
    guard permitted else { completion(.failure(.native("candidate_stale"))); return }
    worker.async {
      do {
        let owner = try self.ownerOnWorker(ticket: ticket)
        let epoch = try self.check(owner: owner, ticket: ticket, foreground: true)
        if !automatic {
          let status = try IosPairingReply.status(self.nativeRequest(owner: owner, command: ["kind": "status"]))
          guard status["phase"] as? String == "complete", status["recordId"] as? String == record,
            status["repairRequired"] as? Bool == false else { throw IosPairingFailure.native("candidate_stale") }
        }
        // Native automatic admission retains a selected-record hint; every core transfer still
        // revalidates its actual Complete record, pin, TLS and PC ACL, including on cold launch.
        let check = { [self] in
          guard try self.check(owner: owner, ticket: ticket, foreground: true) == epoch else {
            throw IosPairingFailure.native("candidate_stale")
          }
        }
        completion(.success(IosFilesConnection(check: check, send: { command, descriptor in
          try check()
          var data = try JSONSerialization.data(withJSONObject: command)
          defer { data.resetBytes(in: 0..<data.count) }
          guard data.count <= 8192 else { throw IosPairingFailure.native("invalid_request") }
          let recordBytes = Data(record.utf8)
          let value = try recordBytes.withUnsafeBytes { recordBuffer in
            try data.withUnsafeBytes { commandBuffer in
              try IosPairingNativeCall.consume(kloda_ios_transfer(owner,
                recordBuffer.bindMemory(to: UInt8.self).baseAddress, recordBuffer.count,
                commandBuffer.bindMemory(to: UInt8.self).baseAddress, commandBuffer.count, descriptor, epoch))
            }
          }
          try check()
          guard let object = value as? [String: Any] else { throw IosPairingFailure.invalidReply }
          return object
        })))
      } catch { completion(.failure(self.failure(error))) }
    }
  }

  func close(destroy: Bool = false, completion: Completion? = nil) {
    lock.lock()
    active = false
    destroyed = destroyed || destroy
    invalidateLocked()
    let closing = owner
    if let closing {
      do { try IosPairingReply.empty(IosPairingNativeCall.consume(kloda_ios_suspend(closing))) }
      catch { poisoned = true }
    }
    owner = nil
    nativeEpoch = nil
    worker.async {
      do {
        if let closing { try IosPairingReply.empty(self.nativeRequest(owner: closing, command: ["kind": "close"])) }
        completion?(.success(nil))
      } catch {
        self.lock.lock()
        self.owner = closing
        self.poisoned = true
        self.lock.unlock()
        completion?(.failure(self.failure(error)))
      }
    }
    lock.unlock()
  }

  func backgroundOwner(completion: @escaping (Result<UInt64, IosPairingFailure>) -> Void) {
    lock.lock(); let ticket = generation; lock.unlock()
    worker.async {
      do { completion(.success(try self.ownerOnWorker(ticket: ticket, background: true))) }
      catch { completion(.failure(self.failure(error))) }
    }
  }

  func checkBackgroundOwner(_ expected: UInt64) throws {
    lock.lock(); defer { lock.unlock() }
    guard !destroyed, !poisoned, owner == expected else { throw IosPairingFailure.native("candidate_stale") }
  }

  private func ownerOnWorker(ticket: UInt64, background: Bool = false) throws -> UInt64 {
    lock.lock()
    guard !destroyed, !poisoned else { lock.unlock(); throw IosPairingFailure.native("candidate_stale") }
    if let owner { lock.unlock(); return owner }
    guard background || (active && generation == ticket) else { lock.unlock(); throw IosPairingFailure.native("candidate_stale") }
    lock.unlock()
    #if targetEnvironment(simulator)
    // The simulator cannot establish Secure Enclave custody; do not even create authority directories.
    throw IosPairingFailure.native("native_unsupported")
    #else
    let support: URL
    do {
      support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
        appropriateFor: nil, create: false)
    } catch { throw IosPairingFailure.native("storage_failure") }
    var path = Data(support.appendingPathComponent("kloda-pairing", isDirectory: true).path.utf8)
    defer { path.resetBytes(in: 0..<path.count) }
    if background {
      // Background work may reopen an installation, never silently provision a fresh one.
      let directory = support.appendingPathComponent("kloda-pairing", isDirectory: true)
      for name in ["owner.lock", "epoch", "initialized", "pairing.sqlite3", "certificate.der"] {
        var info = stat()
        guard lstat(directory.appendingPathComponent(name).path, &info) == 0, info.st_mode & S_IFMT == S_IFREG else {
          throw IosPairingFailure.native("continuity_lost")
        }
      }
    }
    let value = try path.withUnsafeBytes { bytes in
      try IosPairingNativeCall.consume(kloda_ios_open(bytes.bindMemory(to: UInt8.self).baseAddress, bytes.count))
    }
    let opened = try IosPairingReply.owner(value)
    lock.lock()
    guard !destroyed, !poisoned, (background || (active && generation == ticket)), owner == nil else {
      lock.unlock()
      do { try IosPairingReply.empty(nativeRequest(owner: opened, command: ["kind": "close"])) }
      catch {
        lock.lock(); owner = opened; poisoned = true; lock.unlock()
        throw failure(error)
      }
      throw IosPairingFailure.native("cancelled")
    }
    owner = opened
    do {
      let reply = try IosPairingNativeCall.consume(kloda_ios_set_foreground(opened, active ? 1 : 0))
      if active { nativeEpoch = try IosPairingReply.epoch(reply) }
      else { try IosPairingReply.empty(reply); nativeEpoch = nil }
      lock.unlock()
      return opened
    } catch {
      active = false; poisoned = true; lock.unlock()
      throw failure(error)
    }
    #endif
  }

  private func check(owner expected: UInt64, ticket: UInt64, foreground: Bool) throws -> UInt64 {
    lock.lock()
    defer { lock.unlock() }
    guard !destroyed, !poisoned, owner == expected, generation == ticket, !foreground || active else {
      throw IosPairingFailure.native("candidate_stale")
    }
    if foreground {
      guard let epoch = nativeEpoch else { throw IosPairingFailure.native("candidate_stale") }
      return epoch
    }
    return 0
  }

  private func nativeRequest(owner: UInt64, command: [String: Any], expectedEpoch: UInt64 = 0) throws -> Any {
    var data = try JSONSerialization.data(withJSONObject: command)
    defer { data.resetBytes(in: 0..<data.count) }
    guard data.count <= 8192 else { throw IosPairingFailure.native("invalid_request") }
    return try data.withUnsafeBytes { bytes in
      try IosPairingNativeCall.consume(kloda_ios_request(owner, bytes.bindMemory(to: UInt8.self).baseAddress, bytes.count, expectedEpoch))
    }
  }

  private func invalidateLocked() {
    let (next, overflow) = generation.addingReportingOverflow(1)
    if overflow { poisoned = true; active = false }
    else { generation = next }
  }

  private func failure(_ error: Error) -> IosPairingFailure {
    (error as? IosPairingFailure) ?? .native("outcome_unknown")
  }
}
