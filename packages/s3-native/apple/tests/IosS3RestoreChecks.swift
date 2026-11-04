// Component proof: actual SQLite/private stages/local inode publication, no bookmark/LAN grant.
import Foundation
import CryptoKit
import Darwin

private func check(_ value: @autoclosure () throws -> Bool) throws {
  guard try value() else { throw IosS3Failure(code: "fixture_assertion") }
}
private func rejected(_ block: () throws -> Void) throws {
  do { try block() } catch { return }
  throw IosS3Failure(code: "fixture_expected_rejection")
}
@main struct S3RestoreChecks {
  static func main() throws {
    let mode = CommandLine.arguments[1], root = URL(fileURLWithPath: CommandLine.arguments[2])
    let journal = try IosS3Journal(url: root.appendingPathComponent("restore.sqlite"), provider: "amazon-s3")
    let history = try IosS3RestoreJournal(journal: journal)
    let snapshots = try IosFilesSnapshot(directoryURL: root.appendingPathComponent("kloda-amazon-s3-snapshots"))
    let destination = root.appendingPathComponent("destination")
    if mode == "seed" { try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: false) }
    let directory = Darwin.open(destination.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard directory >= 0 else { throw IosS3Failure(code: "fixture_directory") }
    defer { Darwin.close(directory) }
    if mode == "seed" {
      let bytes = Data((0..<131073).map { UInt8($0 % 251) })
      let hash = IosFilesSource.encoded(Data(SHA256.hash(data: bytes)))
      let target = IosS3Target(provider: "amazon-s3", endpoint: "https://s3.us-east-1.amazonaws.com", region: "us-east-1", bucket: "owned-bucket", prefix: "owned", pathStyle: false,
        accountBinding: IosS3Target.hash(Data("fixture-key".utf8)), profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
      try journal.prepareProfile(target); try journal.confirmProfile(target); try journal.setEnabled(true)
      let id = UUID().uuidString.lowercased(), installation = try journal.installation()
      let receipt = IosS3Job(id: id, installation: installation, context: try journal.context(), target: target,
        source: UUID().uuidString.lowercased(), reference: "owned.bin", revision: "1", sourceGeneration: "fixture-generation",
        snapshot: id + ".snapshot", key: "objects/" + installation + "/" + id, sha256: hash, size: Int64(bytes.count), name: "owned.bin")
      try journal.insert(receipt)
      // Synthetic ACKs isolate the local receipt/inode component, not server acceptance.
      for (from,to) in [("prepared","creating"),("creating","created"),("created","part-intent"),("part-intent","part-ack"),("part-ack","completing"),("completing","complete-ack")] {
        try journal.record(receipt, from: from, to: to, current: { true })
      }
      try journal.record(receipt, from: "complete-ack", to: "completed", payload: ["size": String(bytes.count), "sha256": hash], current: { true })
      try check(journal.known(receipt) == receipt)
      try JSONEncoder().encode(receipt).write(to: root.appendingPathComponent("receipt.json"))
      let (stage, file) = try snapshots.createStaging()
      try file.write(contentsOf: bytes); try file.synchronize(); try file.close()
      try snapshots.sealStaging(stage, sha256: hash, size: Int64(bytes.count), cancelled: { false })
      var intent = IosS3RestoreIntent(id: UUID().uuidString.lowercased(), target: try target.archiveId(), job: receipt.id,
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
      let unknown = IosS3RestoreIntent(id: UUID().uuidString.lowercased(), target: intent.target, job: receipt.id,
        name: "unknown.bin", sha256: hash, size: Int64(bytes.count), staging: stage, offset: Int64(bytes.count),
        destination: intent.destination, state: "verified")
      try history.saveRestoreIntent(unknown)
      var pending = unknown; pending.state = "publishing"; try history.saveRestoreIntent(pending)
      // Simulate create succeeding but its inode receipt being lost before process exit.
      try bytes.write(to: destination.appendingPathComponent(pending.name), options: .withoutOverwriting)
      try JSONEncoder().encode(pending).write(to: root.appendingPathComponent("unknown.json"))
    } else if mode == "reopen" {
      let receipt = try JSONDecoder().decode(IosS3Job.self, from: Data(contentsOf: root.appendingPathComponent("receipt.json")))
      let saved = try JSONDecoder().decode(IosS3RestoreIntent.self, from: Data(contentsOf: root.appendingPathComponent("intent.json")))
      try check(journal.receipt(receipt.id, target: receipt.target) == receipt)
      let loaded = try history.restoreIntent(target: saved.target, job: saved.job)
      // Latest is intentionally the unresolved create; it must not become a known completed copy.
      try check(loaded?.state == "publishing" && loaded?.device == nil)
      try IosRestoreDestination.verifyCompleted(saved, directory: directory, check: {})
      try IosRestoreDestination.verifyCompleted(saved, directory: directory, check: {})
      let count = try FileManager.default.contentsOfDirectory(atPath: destination.path).count
      try check(count == 2)
      var unknown = try JSONDecoder().decode(IosS3RestoreIntent.self, from: Data(contentsOf: root.appendingPathComponent("unknown.json")))
      let source = try snapshots.open(unknown.staging, sha256: unknown.sha256, size: unknown.size)
      defer { try? source.close() }
      try rejected { try IosRestoreDestination.publishVerified(&unknown, source: source, directory: directory, check: {}, save: history.saveRestoreIntent) }
      try check(FileManager.default.contentsOfDirectory(atPath: destination.path).count == count)
      var changed = saved; changed.inode = saved.inode! + 1
      try rejected { try history.saveRestoreIntent(changed) }
      try rejected { try journal.database.execute("DELETE FROM s3_restore WHERE id=?", values: [saved.id]) }
      let original = destination.appendingPathComponent(saved.name)
      let moved = destination.appendingPathComponent("original-inode.bin")
      try FileManager.default.moveItem(at: original, to: moved)
      try Data(contentsOf: moved).write(to: original, options: .withoutOverwriting)
      try rejected { try IosRestoreDestination.verifyCompleted(saved, directory: directory, check: {}) }
    } else { throw IosS3Failure(code: "fixture_mode") }
    print("PASS S3 local restore " + mode + "; private inode/SQLite proof, bookmark/provider/runtime acceptance open")
  }
}
