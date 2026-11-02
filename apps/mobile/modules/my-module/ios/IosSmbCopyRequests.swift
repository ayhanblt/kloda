import Foundation
import SQLite3

// A repeated foreground request observes its original result; it never invents a second copy.
final class IosSmbCopyRequests {
  let journal: IosSmbJournal
  init(journal: IosSmbJournal) throws {
    self.journal = journal
    try journal.database.execute("CREATE TABLE IF NOT EXISTS smb_copy_request(request TEXT PRIMARY KEY,original TEXT NOT NULL,job TEXT NOT NULL UNIQUE)")
    try journal.database.execute("CREATE TRIGGER IF NOT EXISTS immutable_smb_copy_request BEFORE UPDATE ON smb_copy_request BEGIN SELECT RAISE(ABORT,'binding'); END")
    try journal.database.execute("CREATE TRIGGER IF NOT EXISTS retain_smb_copy_request BEFORE DELETE ON smb_copy_request BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  func result(request: UUID, original: String, target: IosSmbTarget) throws -> IosSmbUpload? {
    try journal.database.statement("SELECT original,job FROM smb_copy_request WHERE request=?", values: [request.uuidString.lowercased()]) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let old = sqlite3_column_text(row, 0), String(cString: old) == original,
        let id = sqlite3_column_text(row, 1) else { throw IosSmbFailure(code: "binding_changed") }
      // Missing/incomplete publication after interruption remains review, including before insert.
      do { return try journal.ownReceipt(id: String(cString: id), target: target) }
      catch { throw IosSmbFailure(code: "review_required", jobId: String(cString: id)) }
    }
  }
  func reserve(request: UUID, original: String, job: IosSmbUpload) throws {
    try job.validate()
    let old = try journal.reviewJob(id: original, target: job.target)
    guard try job.installation == journal.installation(), try job.context == journal.context(), old.kind == "file", job.kind == "file",
      old.source == job.source, old.reference == job.reference else { throw IosSmbFailure(code: "binding_changed") }
    try journal.database.execute("INSERT INTO smb_copy_request VALUES(?,?,?)", values: [request.uuidString.lowercased(), original, job.id])
  }
  static func path(_ path: String, hash: String, id: String) throws -> String {
    let name = (path as NSString).lastPathComponent, ext = (path as NSString).pathExtension
    let clock = DateFormatter(); clock.locale = Locale(identifier: "en_US_POSIX"); clock.timeZone = TimeZone(secondsFromGMT: 0)
    clock.calendar = Calendar(identifier: .gregorian); clock.dateFormat = "yyyyMMdd-HHmmss"
    let suffix = " (Kloda " + clock.string(from: Date()) + " " + hash.prefix(8) + " " + id.prefix(8) + ")" + (ext.isEmpty ? "" : "." + ext)
    let stem = ext.isEmpty ? name : String(name.dropLast(ext.count + 1))
    var short = ""
    for char in stem { if short.utf8.count + String(char).utf8.count > 255 - suffix.utf8.count { break }; short.append(char) }
    guard !short.isEmpty else { throw IosSmbFailure(code: "review_required") }
    return (path as NSString).deletingLastPathComponent + "/" + short + suffix
  }
}
