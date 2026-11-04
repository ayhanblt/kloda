// Component proof: actual SQLite/private stages/local inode publication, no bookmark/LAN grant.
import Foundation
import CryptoKit
import Darwin

private func check(_ value: @autoclosure () throws -> Bool) throws {
  guard try value() else { throw IosFtpsFailure(code: "fixture_assertion") }
}
private func rejected(_ block: () throws -> Void) throws {
  do { try block() } catch { return }
  throw IosFtpsFailure(code: "fixture_expected_rejection")
}
@main struct FtpsRestoreChecks {
  static func main() throws {
    let mode = CommandLine.arguments[1], root = URL(fileURLWithPath: CommandLine.arguments[2])
    let journal = try IosFtpsJournal(databaseURL: root.appendingPathComponent("restore.sqlite"))
    let history = try IosFtpsRestoreJournal(journal: journal)
    let snapshots = try IosFilesSnapshot(directoryURL: root.appendingPathComponent("kloda-ftps-snapshots"))
    let destination = root.appendingPathComponent("destination")
    if mode == "seed" { try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: false) }
    let directory = Darwin.open(destination.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard directory >= 0 else { throw IosFtpsFailure(code: "fixture_directory") }
    defer { Darwin.close(directory) }
    if mode == "seed" {
      let bytes = Data((0..<131073).map { UInt8($0 % 251) })
      let hash = IosFilesSource.encoded(Data(SHA256.hash(data: bytes)))
      let target = IosFtpsTarget(address: "192.168.1.10", port: 21, hostname: "nas.example.test", root: "/backup", username: "owned",
        profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
      let id = UUID().uuidString.lowercased()
      let receipt = IosFtpsUpload(id: id, installation: try journal.installation(), target: target, context: try journal.context(),
        source: UUID().uuidString.lowercased(), reference: "owned.bin", revision: "1", relativePath: "owned.bin",
        snapshot: id + ".snapshot", sha256: hash, size: Int64(bytes.count), kind: "file", asset: nil)
      try journal.insert(receipt)
      for event in 1...3 { try journal.record(receipt, event: Int32(event), bytes: event == 2 ? UInt64(bytes.count) : 0) }
      try journal.complete(receipt, current: { true })
      try JSONEncoder().encode(receipt).write(to: root.appendingPathComponent("receipt.json"))
      let (stage, file) = try snapshots.createStaging()
      try file.write(contentsOf: bytes); try file.synchronize(); try file.close()
      try snapshots.sealStaging(stage, sha256: hash, size: Int64(bytes.count), cancelled: { false })
      var intent = IosFtpsRestoreIntent(id: UUID().uuidString.lowercased(), target: try target.archiveId(), job: receipt.id,
        name: "restored.bin", sha256: hash, size: Int64(bytes.count), staging: stage, offset: Int64(bytes.count),
        destination: Data("fixture-metadata-only".utf8).base64EncodedString(), state: "verified")
      var invalid = intent; invalid.state = "completed"; invalid.device = 1; invalid.inode = 1
      try rejected { try history.saveRestoreIntent(invalid) }
      try history.saveRestoreIntent(intent)
      let source = try snapshots.open(stage, sha256: hash, size: Int64(bytes.count))
      defer { try? source.close() }
      try IosRestoreDestination.publishVerified(&intent, source: source, directory: directory, check: {}, save: history.saveRestoreIntent)
      try check(intent.state == "completed" && intent.device != nil && intent.inode != nil)
      try check(Data(contentsOf: destination.appendingPathComponent(intent.name)) == bytes)
      try JSONEncoder().encode(intent).write(to: root.appendingPathComponent("intent.json"))
      let unknown = IosFtpsRestoreIntent(id: UUID().uuidString.lowercased(), target: intent.target, job: receipt.id,
        name: "unknown.bin", sha256: hash, size: Int64(bytes.count), staging: stage, offset: Int64(bytes.count),
        destination: intent.destination, state: "verified")
      try history.saveRestoreIntent(unknown)
      var pending = unknown; pending.state = "publishing"; try history.saveRestoreIntent(pending)
      // Simulate create succeeding but its inode receipt being lost before process exit.
      try bytes.write(to: destination.appendingPathComponent(pending.name), options: .withoutOverwriting)
      try JSONEncoder().encode(pending).write(to: root.appendingPathComponent("unknown.json"))
    } else if mode == "reopen" {
      let receipt = try JSONDecoder().decode(IosFtpsUpload.self, from: Data(contentsOf: root.appendingPathComponent("receipt.json")))
      let saved = try JSONDecoder().decode(IosFtpsRestoreIntent.self, from: Data(contentsOf: root.appendingPathComponent("intent.json")))
      try check(journal.ownReceipt(id: receipt.id, target: receipt.target) == receipt)
      let loaded = try history.restoreIntent(target: saved.target, job: saved.job)
      // Latest is intentionally the unresolved create; it must not become a known completed copy.
      try check(loaded?.state == "publishing" && loaded?.device == nil)
      try IosRestoreDestination.verifyCompleted(saved, directory: directory, check: {})
      try IosRestoreDestination.verifyCompleted(saved, directory: directory, check: {})
      let count = try FileManager.default.contentsOfDirectory(atPath: destination.path).count
      try check(count == 2)
      var unknown = try JSONDecoder().decode(IosFtpsRestoreIntent.self, from: Data(contentsOf: root.appendingPathComponent("unknown.json")))
      let source = try snapshots.open(unknown.staging, sha256: unknown.sha256, size: unknown.size)
      defer { try? source.close() }
      try rejected { try IosRestoreDestination.publishVerified(&unknown, source: source, directory: directory, check: {}, save: history.saveRestoreIntent) }
      try check(FileManager.default.contentsOfDirectory(atPath: destination.path).count == count)
      var changed = saved; changed.inode = saved.inode! + 1
      try rejected { try history.saveRestoreIntent(changed) }
      try rejected { try journal.database.execute("DELETE FROM ftps_restore WHERE id=?", values: [saved.id]) }
      let original = destination.appendingPathComponent(saved.name)
      let moved = destination.appendingPathComponent("original-inode.bin")
      try FileManager.default.moveItem(at: original, to: moved)
      try Data(contentsOf: moved).write(to: original, options: .withoutOverwriting)
      try rejected { try IosRestoreDestination.verifyCompleted(saved, directory: directory, check: {}) }
    } else { throw IosFtpsFailure(code: "fixture_mode") }
    print("PASS FTPS local restore " + mode + "; private inode/SQLite proof, bookmark/provider/runtime acceptance open")
  }
}
