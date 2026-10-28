import Foundation

// Explicit disposable database only; never open the default app journal or native authority.
@main struct IosFilesJournalChecks {
  static func expectFailure(_ action: () throws -> Void) {
    do { try action(); fatalError("Unexpected journal mutation accepted") }
    catch {}
  }

  static func job(_ id: String = "fixture-job", identity: String = "fixture-identity") -> IosFilesJob {
    IosFilesJob(id: id, sourceId: "fixture-source", reference: "test.bin", revision: "v1",
      recordId: String(repeating: "A", count: 22), wireSourceId: String(repeating: "A", count: 22),
      requestId: String(repeating: "A", count: 22), name: "test.bin", sha256: String(repeating: "A", count: 43),
      size: 4, snapshot: "fixture.snapshot", identity: identity)
  }

  static func main() throws {
    guard CommandLine.arguments.count == 3,
      ["seed", "reopen"].contains(CommandLine.arguments[1]) else { fatalError("Expected mode and disposable database URL") }
    let url = URL(fileURLWithPath: CommandLine.arguments[2])
    guard url.deletingLastPathComponent().lastPathComponent.hasPrefix("kloda-ios-files-journal-"),
      url.lastPathComponent == "fixture.sqlite" else { fatalError("Unexpected fixture path") }
    if CommandLine.arguments[1] == "reopen" {
      guard FileManager.default.fileExists(atPath: url.path) else { fatalError("Missing fixture database") }
      let journal = try IosSyncJournal(databaseURL: url)
      var saved = try journal.fileJob(id: "fixture-job")!
      precondition(saved.acknowledged == 2 && saved.state == "uploading" && saved.operationId != nil)
      try journal.recoverFilesJobs()
      saved = try journal.fileJob(id: saved.id)!
      precondition(saved.state == "paused" && saved.errorCode == "interrupted" && saved.acknowledged == 2)
      print("PASS separate-process reopen retains operation/offset and never invents completion")
      return
    }
    guard !FileManager.default.fileExists(atPath: url.path) else { fatalError("Fixture database already exists") }
    let journal = try IosSyncJournal(databaseURL: url)
    var saved = job()
    try journal.saveFileJob(saved)
    let initial = try journal.fileJob(identity: saved.identity)
    precondition(initial == saved)
    expectFailure { try journal.saveFileJob(job("different-id")) }
    for field in ["record", "source", "revision", "request", "hash", "snapshot"] {
      var changed = saved
      switch field {
      case "record": changed.recordId = "AQAAAAAAAAAAAAAAAAAAAA"
      case "source": changed.sourceId = "new-source"
      case "revision": changed.revision = "new-revision"
      case "request": changed.requestId = "AQAAAAAAAAAAAAAAAAAAAA"
      case "hash": changed.sha256 = "AQ" + String(repeating: "A", count: 41)
      default: changed.snapshot = "different.snapshot"
      }
      expectFailure { try journal.saveFileJob(changed) }
    }
    print("PASS immutable content/source/target/request/snapshot and duplicate identity refusal")
    saved.operationId = String(repeating: "A", count: 22)
    saved.acknowledged = 2
    saved.state = "uploading"
    saved.attempts = 1
    saved.retryAt = 60000
    try journal.saveFileJob(saved)
    var wrong = saved
    wrong.operationId = "AQAAAAAAAAAAAAAAAAAAAA"
    expectFailure { try journal.saveFileJob(wrong) }
    wrong = saved; wrong.acknowledged = 1
    expectFailure { try journal.saveFileJob(wrong) }
    wrong = saved; wrong.state = "completed"
    expectFailure { try journal.saveFileJob(wrong) }
    wrong = saved; wrong.attempts = 0
    expectFailure { try journal.saveFileJob(wrong) }
    wrong = saved; wrong.attempts = 5
    expectFailure { try journal.saveFileJob(wrong) }
    print("PASS monotonic verified offset/operation/attempt and retry budget binding")
    _ = try journal.replaceSourceFiles(sourceId: saved.sourceId, files: [IosQueuedSourceFile(reference: "test.bin", relativePath: "test.bin", revision: "v1", size: 4)])
    try journal.removeSource(sourceId: saved.sourceId)
    let afterRemoval = try journal.fileJob(id: saved.id)
    precondition(afterRemoval == saved)
    expectFailure { try journal.execute("DELETE FROM files_job") }
    print("PASS source removal and direct deletion preserve transfer recovery history")
    var terminal = job("completed", identity: "completed-identity")
    terminal.operationId = String(repeating: "A", count: 22)
    terminal.acknowledged = terminal.size
    terminal.state = "completed"
    try journal.saveFileJob(terminal)
    wrong = terminal; wrong.state = "queued"
    expectFailure { try journal.saveFileJob(wrong) }
    terminal.state = "owner_deleted"
    terminal.errorCode = "owner_deleted"
    try journal.saveFileJob(terminal)
    wrong = terminal; wrong.state = "completed"
    expectFailure { try journal.saveFileJob(wrong) }
    try journal.recoverFilesJobs()
    let deleted = try journal.fileJob(id: terminal.id)!
    precondition(deleted.state == "owner_deleted" && deleted.acknowledged == 4)
    saved = try journal.fileJob(id: saved.id)!
    precondition(saved.state == "paused" && saved.acknowledged == 2 && saved.retryAt == 60000)
    saved.state = "uploading"; saved.errorCode = nil
    try journal.saveFileJob(saved)
    print("PASS terminal completion/deletion survive recovery without automatic resurrection")
  }
}
