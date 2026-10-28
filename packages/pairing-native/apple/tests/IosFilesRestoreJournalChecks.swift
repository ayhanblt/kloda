import Foundation

// Explicit newly-created disposable database only; no default journal, picker or filesystem publication.
@main struct IosFilesRestoreJournalChecks {
  static func rejects(_ action: () throws -> Void) {
    do { try action(); fatalError("Unsafe restore journal mutation accepted") }
    catch {}
  }

  static func main() throws {
    guard CommandLine.arguments.count == 3,
      ["seed", "reopen"].contains(CommandLine.arguments[1]) else { fatalError("Expected fixture mode/database") }
    let url = URL(fileURLWithPath: CommandLine.arguments[2])
    guard url.deletingLastPathComponent().lastPathComponent.hasPrefix("kloda-ios-files-journal-"),
      url.lastPathComponent == "restore.sqlite" else { fatalError("Unexpected fixture path") }
    let record = String(repeating: "A", count: 22), operation = "AQ" + String(repeating: "A", count: 20)
    if CommandLine.arguments[1] == "reopen" {
      guard FileManager.default.fileExists(atPath: url.path) else { fatalError("Missing fixture") }
      let journal = try IosSyncJournal(databaseURL: url)
      let saved = try journal.restoreIntent(record: operation, operation: operation)!
      precondition(saved.state == "publishing" && saved.offset == 4 && saved.device == UInt64.max && saved.inode == 42)
      precondition(saved.destination == Data("bookmark-only-fixture".utf8).base64EncodedString())
      print("PASS separate-process restore reopen retains bound destination/inode without inventing completion")
      return
    }
    guard !FileManager.default.fileExists(atPath: url.path) else { fatalError("Fixture already exists") }
    let journal = try IosSyncJournal(databaseURL: url)
    var intent = IosRestoreIntent(id: record, recordId: record, operationId: operation,
      name: "fixture.bin", sha256: String(repeating: "A", count: 43), size: 4, staging: "restore.part")
    try journal.saveRestoreIntent(intent)
    let original = try journal.restoreIntent(record: record, operation: operation)
    precondition(original == intent)
    var changed = intent; changed.sha256 = "AQ" + String(repeating: "A", count: 41)
    rejects { try journal.saveRestoreIntent(changed) }
    changed = intent; changed.staging = "different.part"
    rejects { try journal.saveRestoreIntent(changed) }
    changed = intent; changed.recordId = operation
    rejects { try journal.saveRestoreIntent(changed) }
    print("PASS restore intent immutable transfer/staging binding within one attempt")
    intent.offset = 2
    try journal.saveRestoreIntent(intent)
    changed = intent; changed.offset = 1
    rejects { try journal.saveRestoreIntent(changed) }
    changed = intent; changed.state = "completed"
    rejects { try journal.saveRestoreIntent(changed) }
    intent.offset = 4; intent.state = "verified"
    try journal.saveRestoreIntent(intent)
    intent.destination = Data("bookmark-only-fixture".utf8).base64EncodedString()
    intent.state = "publishing"
    try journal.saveRestoreIntent(intent)
    changed = intent; changed.destination = Data("different-destination".utf8).base64EncodedString()
    rejects { try journal.saveRestoreIntent(changed) }
    changed = intent; changed.state = "completed"
    rejects { try journal.saveRestoreIntent(changed) }
    print("PASS monotonic offset and no completion before bound publication identity")
    intent.device = UInt64.max; intent.inode = 42
    try journal.saveRestoreIntent(intent)
    changed = intent; changed.inode = 43
    rejects { try journal.saveRestoreIntent(changed) }
    changed = intent; changed.device = nil; changed.inode = nil
    rejects { try journal.saveRestoreIntent(changed) }
    rejects { try journal.execute("DELETE FROM files_restore") }
    intent.state = "completed"
    try journal.saveRestoreIntent(intent)
    changed = intent; changed.state = "publishing"
    rejects { try journal.saveRestoreIntent(changed) }
    let final = try journal.restoreIntent(record: record, operation: operation)
    precondition(final == intent)
    print("PASS UInt64 identity round-trip, once-bound destination/identity and retained completion")
    var another = intent
    another.id = "Ag" + String(repeating: "A", count: 20)
    another.destination = Data("another-explicit-user-folder".utf8).base64EncodedString()
    another.device = nil; another.inode = nil; another.state = "verified"
    try journal.saveRestoreIntent(another)
    let latest = try journal.restoreIntent(record: record, operation: operation)
    precondition(latest?.id == another.id)
    print("PASS a new explicit restore attempt retains previous results without retargeting them")
    var interrupted = IosRestoreIntent(id: operation, recordId: operation, operationId: operation,
      name: "fixture.bin", sha256: String(repeating: "A", count: 43), size: 4, staging: "second.part")
    interrupted.offset = 4; interrupted.destination = intent.destination
    interrupted.device = UInt64.max; interrupted.inode = 42; interrupted.state = "publishing"
    try journal.saveRestoreIntent(interrupted)
  }
}
