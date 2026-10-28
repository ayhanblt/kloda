import Foundation
import CryptoKit
import Darwin

@main struct IosRestorePublicationChecks {
  static func main() throws {
    guard CommandLine.arguments.count == 3 else { fatalError("Expected mode/disposable directory") }
    let root = URL(fileURLWithPath: CommandLine.arguments[2])
    guard root.lastPathComponent.hasPrefix("kloda-ios-files-publication-") else { fatalError("Not a disposable fixture") }
    let journal = try IosSyncJournal(databaseURL: root.appendingPathComponent("restore.sqlite"))
    let snapshots = try IosFilesSnapshot(directoryURL: root.appendingPathComponent("snapshots"))
    let record = String(repeating: "A", count: 22)
    let directory = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
    precondition(directory >= 0)
    defer { Darwin.close(directory) }
    let bytes = Data(repeating: 42, count: 100_000)
    let hash = IosFilesTransfer.encode(Data(SHA256.hash(data: bytes)))
    if CommandLine.arguments[1] == "reopen" {
      var previous = try journal.restoreIntent(record: record, operation: record)!
      precondition(previous.state == "publishing" && previous.inode != nil)
      let file = try snapshots.open(previous.staging, sha256: hash, size: Int64(bytes.count))
      defer { try? file.close() }
      try IosRestoreDestination.publishVerified(&previous, journal: journal, source: file, directory: directory, check: {})
      precondition(previous.state == "completed")
      precondition(tryData(root.appendingPathComponent("recovery.bin")) == bytes)
      try snapshots.discard(previous.staging)
      try IosRestoreDestination.verifyCompleted(previous, directory: directory, check: {})
      print("PASS completed target is reverified without retaining a second full staging copy")
      print("PASS separate-process publication resumes only its recorded exact-prefix inode")
      return
    }
    precondition(CommandLine.arguments[1] == "seed")
    func make(_ name: String) throws -> IosRestoreIntent {
      let (stage, handle) = try snapshots.createStaging()
      try handle.write(contentsOf: bytes); try handle.synchronize(); try handle.close()
      return IosRestoreIntent(id: IosFilesTransfer.identifier(), recordId: record, operationId: record,
        name: name, sha256: hash, size: Int64(bytes.count), staging: stage, offset: Int64(bytes.count),
        destination: Data("test-native-selected-folder".utf8).base64EncodedString(), state: "verified")
    }
    var collision = try make("unrelated.bin")
    try journal.saveRestoreIntent(collision)
    let original = Data("unrelated".utf8)
    try original.write(to: root.appendingPathComponent(collision.name), options: .withoutOverwriting)
    let source = try snapshots.open(collision.staging, sha256: hash, size: Int64(bytes.count))
    defer { try? source.close() }
    do { try IosRestoreDestination.publishVerified(&collision, journal: journal, source: source, directory: directory, check: {})
      fatalError("Existing target overwritten") } catch IosPairingFailure.native(let code) { precondition(code == "destination_not_empty") }
    precondition(tryData(root.appendingPathComponent(collision.name)) == original)
    print("PASS pre-existing unrelated target is never replaced")
    var interrupted = try make("recovery.bin")
    try journal.saveRestoreIntent(interrupted)
    let second = try snapshots.open(interrupted.staging, sha256: hash, size: Int64(bytes.count))
    defer { try? second.close() }
    var checks = 0
    do { try IosRestoreDestination.publishVerified(&interrupted, journal: journal, source: second, directory: directory, check: {
      checks += 1; if checks == 4 { throw IosPairingFailure.native("cancelled") }
    }); fatalError("Cancellation ignored") } catch IosPairingFailure.native(let code) { precondition(code == "cancelled") }
    let persisted = try journal.restoreIntent(record: record, operation: record)!
    precondition(persisted.state == "publishing" && persisted.inode != nil)
    let count = tryData(root.appendingPathComponent("recovery.bin")).count
    precondition(count > 0 && count < bytes.count)
    print("PASS publication intent/inode survives cancellation without false completion")
  }
  static func tryData(_ url: URL) -> Data { try! Data(contentsOf: url) }
}
