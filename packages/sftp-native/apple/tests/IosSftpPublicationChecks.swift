import Foundation
import CryptoKit
import Darwin

func require(_ value: @autoclosure () throws -> Bool) throws {
  guard try value() else { throw IosSftpFailure(code: "fixture_assertion") }
}
func refuses(_ work: () throws -> Void) throws {
  var failed = false
  do { try work() } catch { failed = true }
  try require(failed)
}

@main struct Checks {
  static func main() throws {
    guard ProcessInfo.processInfo.environment["KLODA_SFTP16_FIXTURE"] == "owned-loopback",
      CommandLine.arguments.count == 3 else { throw IosSftpFailure(code: "fixture_required") }
    let mode = CommandLine.arguments[1], root = URL(fileURLWithPath: CommandLine.arguments[2])
    let done = DispatchSemaphore(value: 0)
    // Rust invokes synchronous callbacks on this worker, never the main thread.
    DispatchQueue.global().async {
      do { try run(mode: mode, root: root); print("PASS native bound SFTP SQLite/FFI " + mode) }
      catch { print("FAIL native SFTP fixture " + String(describing: type(of: error))); exit(1) }
      done.signal()
    }
    done.wait()
  }
  static func run(mode: String, root: URL) throws {
    let journal = try IosSftpJournal(databaseURL: root.appendingPathComponent("sftp.sqlite"))
    if mode == "reopen" {
      for name in ["complete", "fenced", "unknown", "collision", "cancelled"] {
        let job = try JSONDecoder().decode(IosSftpUpload.self, from: Data(contentsOf: root.appendingPathComponent(name + ".json")))
        let row = try journal.state(job)
        try require(row.completed == (name == "complete"))
        if name == "complete" { try require(row.step == 5 && row.issue == nil) }
        else { try require(row.issue != nil) }
      }
      return
    }
    try require(mode == "seed")
    let bytes = Data((0..<1048576).map { UInt8($0 % 251) })
    let hash = Data(SHA256.hash(data: bytes)).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    let target = IosSftpTarget(address: "127.0.0.1", port: 27448,
      fingerprint: ProcessInfo.processInfo.environment["KLODA_SFTP_FIXTURE_PIN"]!, root: "/home/owned-sftp", username: "owned-sftp",
      profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    let unique = UUID().uuidString.lowercased()
    let source = UUID().uuidString.lowercased()
    let snapshotURL = root.appendingPathComponent("owned.snapshot")
    try bytes.write(to: snapshotURL, options: .withoutOverwriting)
    let descriptor = Darwin.open(snapshotURL.path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW)
    guard descriptor >= 0 else { throw IosSftpFailure(code: "fixture_snapshot") }
    defer { Darwin.close(descriptor) }
    // Owned loopback handoff proof only, never OS LAN admission evidence.
    func publish(_ value: IosSftpUpload, current: @escaping () throws -> Bool) throws {
      let fd = Darwin.socket(AF_INET, SOCK_STREAM, 0)
      guard fd >= 0 else { throw IosSftpFailure(code: "fixture_socket") }
      var peer = sockaddr_in()
      peer.sin_len = UInt8(MemoryLayout<sockaddr_in>.size); peer.sin_family = sa_family_t(AF_INET)
      peer.sin_port = UInt16(27448).bigEndian
      guard inet_pton(AF_INET, "127.0.0.1", &peer.sin_addr) == 1 else {
        Darwin.close(fd); throw IosSftpFailure(code: "fixture_socket")
      }
      let connected = withUnsafePointer(to: &peer) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.connect(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) }
      }
      guard connected == 0 else { Darwin.close(fd); throw IosSftpFailure(code: "fixture_socket") }
      try IosSftpPublication.runBound(journal: journal, job: value, snapshot: descriptor,
        password: "owned-disposable-fixture", socket: fd, current: current)
    }
    func job(_ name: String, path: String? = nil) throws -> IosSftpUpload {
      let id = UUID().uuidString.lowercased()
      return IosSftpUpload(id: id, installation: "owned-installation", target: target, context: try journal.context(), source: source,
        reference: name + ".bin", revision: "1", relativePath: path ?? "swift-owned-" + unique + "-" + name + ".bin",
        snapshot: id + ".snapshot", sha256: hash, size: Int64(bytes.count), kind: "file", asset: nil)
    }
    func save(_ job: IosSftpUpload, _ name: String) throws {
      try JSONEncoder().encode(job).write(to: root.appendingPathComponent(name + ".json"), options: .withoutOverwriting)
    }
    let complete = try job("complete")
    try publish(complete, current: { true })
    try require(journal.state(complete).completed)
    try save(complete, "complete")
    try refuses { try journal.database.execute("UPDATE sftp_upload SET header='forged' WHERE id=?", values: [complete.id]) }
    try refuses { try journal.database.execute("DELETE FROM sftp_upload WHERE id=?", values: [complete.id]) }
    try refuses { try publish(complete, current: { true }) }

    let fenced = try job("fenced")
    try refuses {
      try publish(fenced, current: {
        if try journal.state(fenced).step == 4 { try journal.invalidate(); return false }; return true
      })
    }
    try require(journal.state(fenced).step == 4 && !journal.state(fenced).completed)
    try save(fenced, "fenced")

    let unknown = try job("unknown")
    try journal.database.execute("CREATE TRIGGER owned_fail_rename_receipt BEFORE UPDATE ON sftp_upload WHEN NEW.id='" + unknown.id + "' AND NEW.step=4 BEGIN SELECT RAISE(ABORT,'owned_receipt_failure'); END")
    try refuses { try publish(unknown, current: { true }) }
    try require(journal.state(unknown).step == 3 && !journal.state(unknown).completed)
    try journal.database.execute("DROP TRIGGER owned_fail_rename_receipt")
    try save(unknown, "unknown")
    let collision = try job("collision", path: unknown.relativePath)
    try refuses { try publish(collision, current: { true }) }
    try require(journal.state(collision).step == 3 && !journal.state(collision).completed)
    try save(collision, "collision")

    let cancelled = try job("cancelled")
    try refuses { try publish(cancelled, current: { false }) }
    try require(journal.state(cancelled).step == 0 && !journal.state(cancelled).completed)
    try save(cancelled, "cancelled")

    // Even observed later ACKs survive context invalidation, but can never complete.
    let changed = try job("context-changed")
    try journal.insert(changed); try journal.record(changed, event: 1, bytes: 0); try journal.invalidate()
    try journal.record(changed, event: 2, bytes: UInt64(changed.size))
    for event in 3...5 { try journal.record(changed, event: Int32(event), bytes: 0) }
    try refuses { try journal.complete(changed, current: { true }) }
    try require(journal.state(changed).step == 5 && !journal.state(changed).completed)
  }
}
