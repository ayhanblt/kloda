import Foundation

// New disposable DB only; early failure and restart evidence, not a scheduler or native transfer.
@main struct IosFilesRunJournalChecks {
  static func rejects(_ action: () throws -> Void) {
    do { try action(); fatalError("Immutable run mutation accepted") }
    catch {}
  }

  static func main() throws {
    guard CommandLine.arguments.count == 3,
      ["seed", "reopen"].contains(CommandLine.arguments[1]) else { fatalError("Expected fixture mode/database") }
    let url = URL(fileURLWithPath: CommandLine.arguments[2])
    guard url.deletingLastPathComponent().lastPathComponent.hasPrefix("kloda-ios-files-journal-"),
      url.lastPathComponent == "run.sqlite" else { fatalError("Unexpected fixture path") }
    if CommandLine.arguments[1] == "reopen" {
      guard FileManager.default.fileExists(atPath: url.path) else { fatalError("Missing fixture") }
      let journal = try IosSyncJournal(databaseURL: url)
      let before = try journal.latestFilesRun()!
      precondition(before.id == "a-current" && before.state == "running" && before.attempts == 1)
      try journal.recoverFilesRuns()
      let after = try journal.latestFilesRun()!
      precondition(after.state == "paused" && after.errorCode == "interrupted" && after.binding == "current-binding")
      print("PASS separate-process current run reopen becomes interrupted, never completed")
      return
    }
    guard !FileManager.default.fileExists(atPath: url.path) else { fatalError("Fixture already exists") }
    let journal = try IosSyncJournal(databaseURL: url)
    let empty = try journal.latestFilesRun()
    precondition(empty == nil)
    var early = IosFilesRun(id: "z-earlier", recordId: String(repeating: "A", count: 22), binding: "old-binding")
    try journal.saveFilesRun(early)
    early.state = "failed"; early.errorCode = "native_unsupported"
    try journal.saveFilesRun(early)
    let saved = try journal.latestFilesRun()
    let jobs = try journal.filesJobs()
    precondition(saved == early && jobs.isEmpty)
    print("PASS early native failure is durable even with no scanned files or jobs")
    var wrong = early; wrong.state = "running"; wrong.errorCode = nil
    rejects { try journal.saveFilesRun(wrong) }
    wrong = early; wrong.binding = "new-binding"
    rejects { try journal.saveFilesRun(wrong) }
    wrong = early; wrong.recordId = "AQ" + String(repeating: "A", count: 20)
    rejects { try journal.saveFilesRun(wrong) }
    wrong = early; wrong.attempts = 2
    rejects { try journal.saveFilesRun(wrong) }
    print("PASS immutable run target/binding/attempt and terminal result cannot reset")
    let current = IosFilesRun(id: "a-current", recordId: early.recordId, binding: "current-binding")
    try journal.saveFilesRun(current)
    let newest = try journal.latestFilesRun()
    precondition(newest == current)
    try journal.removeSource(sourceId: "unused-source")
    rejects { try journal.execute("DELETE FROM files_run") }
    let retained = try journal.latestFilesRun()
    precondition(retained == current)
    print("PASS new explicit run is latest by insertion order; source removal keeps results")
  }
}
