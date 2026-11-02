// Actual Rust LAN/storage ABI + Swift link; rejected peers only, no network/auth.
import Foundation
import Darwin

@_silgen_name("kloda_smb_read_bound")
private func readBound(_ json: UnsafePointer<UInt8>, _ length: Int, _ output: Int32, _ socket: Int32,
  _ callback: (@convention(c) (UnsafeMutableRawPointer?, Int32, UInt64) -> Int32)?, _ context: UnsafeMutableRawPointer?) -> Int32

@main struct LanSimulatorChecks {
  static func main() throws {
    precondition(kloda_ios_lan_current(nil) == 1)
    for address in ["", "not-an-ip", "127.0.0.1", "0.0.0.0", "8.8.8.8", "::1", "::"] {
      let bytes = Array(address.utf8)
      let result = bytes.withUnsafeBufferPointer { buffer in
        kloda_ios_lan_with_socket(buffer.baseAddress, bytes.count, 445, { _, _, _ in
          fatalError("Rejected peer reached worker")
        }, nil)
      }
      precondition(result == 1)
    }
    let output = Darwin.open("/dev/null", O_RDWR), socket = Darwin.open("/dev/null", O_RDWR)
    precondition(output >= 0 && socket >= 0 && output != socket)
    let malformed = Array("{}".utf8)
    let readResult = malformed.withUnsafeBufferPointer { readBound($0.baseAddress!, malformed.count, output, socket, nil, nil) }
    precondition(readResult != 0 && fcntl(output, F_GETFD) == -1 && fcntl(socket, F_GETFD) == -1)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("smb-lan-main-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let journal = try IosSmbJournal(databaseURL: root.appendingPathComponent("journal.sqlite"))
    let target = IosSmbTarget(address: "127.0.0.1", port: 445, share: "owned", root: "backup", username: "fixture",
      domain: "", profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    let id = UUID().uuidString.lowercased()
    let job = IosSmbUpload(id: id, installation: "fixture", target: target, context: try journal.context(),
      source: UUID().uuidString.lowercased(), reference: "owned.bin", revision: "1", relativePath: "owned.bin",
      snapshot: id + ".snapshot", sha256: String(repeating: "A", count: 43), size: 0, kind: "file", asset: nil)
    do {
      try IosSmbProfiles(journal: journal).publishLan(job: job, snapshot: -1, currentSource: { true })
      fatalError("Main thread must not publish")
    } catch let error as IosSmbFailure { precondition(error.code == "worker_required") }
    print("PASS actual iOS Simulator ABI link/readonly malformed FD consumption/rejected peers/main-thread refusal; no admitted LAN or SMB authentication")
  }
}
