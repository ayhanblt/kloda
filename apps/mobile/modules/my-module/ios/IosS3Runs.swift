#if KLODA_S3_NATIVE
import Foundation
import SQLite3

struct IosS3Run: Equatable {
  let id: String
  let target: String
  let binding: String
  var phase = "running"
  var error: String? = nil
}
final class IosS3Runs {
  let journal: IosS3Journal
  init(journal: IosS3Journal) throws {
    self.journal = journal; let db = journal.database
    try db.execute("CREATE TABLE IF NOT EXISTS s3_run(id TEXT PRIMARY KEY,target TEXT NOT NULL,binding TEXT NOT NULL,phase TEXT NOT NULL CHECK(phase IN('running','finished','paused','needs_attention')),error TEXT)")
    try db.execute("CREATE TRIGGER IF NOT EXISTS immutable_s3_run BEFORE UPDATE ON s3_run WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.binding IS NOT OLD.binding OR OLD.phase!='running' BEGIN SELECT RAISE(ABORT,'binding'); END")
    try db.execute("CREATE TRIGGER IF NOT EXISTS retain_s3_run BEFORE DELETE ON s3_run BEGIN SELECT RAISE(ABORT,'retained'); END")
    try db.execute("CREATE TABLE IF NOT EXISTS s3_run_job(run TEXT NOT NULL REFERENCES s3_run(id),job TEXT NOT NULL REFERENCES s3_job(id),PRIMARY KEY(run,job))")
    for operation in ["UPDATE", "DELETE"] {
      try db.execute("CREATE TRIGGER IF NOT EXISTS retain_s3_run_job_\(operation.lowercased()) BEFORE \(operation) ON s3_run_job BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }
  func start(_ value: IosS3Run) throws {
    guard UUID(uuidString: value.id)?.uuidString.lowercased() == value.id, value.phase == "running", value.error == nil,
      try value.binding == journal.context() else { throw IosS3Failure(code: "binding_changed") }
    try journal.database.execute("INSERT INTO s3_run VALUES(?,?,?,'running',NULL)", values: [value.id, value.target, value.binding])
  }
  func read(_ target: String) throws -> IosS3Run? {
    try journal.database.statement("SELECT id,target,binding,phase,error FROM s3_run WHERE target=? ORDER BY rowid DESC LIMIT 1", values: [target]) { row in
      let step = sqlite3_step(row); if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let id = sqlite3_column_text(row, 0), let target = sqlite3_column_text(row, 1),
        let binding = sqlite3_column_text(row, 2), let phase = sqlite3_column_text(row, 3) else { throw IosS3Failure(code: "storage_failure") }
      return IosS3Run(id: String(cString: id), target: String(cString: target), binding: String(cString: binding), phase: String(cString: phase),
        error: sqlite3_column_text(row, 4).map { String(cString: $0) })
    }
  }
  func finish(_ value: IosS3Run) throws {
    guard ["finished", "paused", "needs_attention"].contains(value.phase), value.error == nil || value.error!.range(of: "\\A[a-z][a-z0-9_]{0,127}\\z", options: .regularExpression) != nil else { throw IosS3Failure(code: "invalid_request") }
    try journal.database.execute("UPDATE s3_run SET phase=?,error=? WHERE id=? AND target=? AND binding=? AND phase='running'", values: [value.phase, value.error.map { $0 as Any } ?? NSNull(), value.id, value.target, value.binding])
    guard try read(value.target) == value else { throw IosS3Failure(code: "binding_changed") }
  }
  func recover() throws { try journal.database.execute("UPDATE s3_run SET phase='paused',error='os_interrupted' WHERE phase='running'") }
  func track(_ run: IosS3Run, job: IosS3Job) throws {
    guard try job.installation == journal.installation(), try job.target.archiveId() == run.target,
      try journal.state(job) == "completed", try journal.events(job, kind: "complete-ack").count == 1 else { throw IosS3Failure(code: "binding_changed") }
    try journal.database.execute("INSERT OR IGNORE INTO s3_run_job SELECT ?,? WHERE EXISTS(SELECT 1 FROM s3_run WHERE id=? AND target=? AND binding=? AND phase='running')", values: [run.id, job.id, run.id, run.target, run.binding])
    try journal.database.statement("SELECT 1 FROM s3_run_job WHERE run=? AND job=?", values: [run.id, job.id]) { row in
      guard sqlite3_step(row) == SQLITE_ROW else { throw IosS3Failure(code: "binding_changed") }
    }
  }
  func counts(_ id: String) throws -> [String: String] {
    try journal.database.statement("SELECT j.header FROM s3_run_job r JOIN s3_job j ON j.id=r.job WHERE r.run=? AND j.state='completed'", values: [id]) { row in
      var files: Int64 = 0, bytes: Int64 = 0, step = sqlite3_step(row)
      while step == SQLITE_ROW {
        guard let raw = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "storage_failure") }
        let job = try JSONDecoder().decode(IosS3Job.self, from: Data(String(cString: raw).utf8)); _ = try job.payload()
        guard files < Int64.max, job.size <= Int64.max - bytes else { throw IosS3Failure(code: "outcome_unknown") }
        files += 1; bytes += job.size; step = sqlite3_step(row)
      }
      guard step == SQLITE_DONE else { throw IosS3Failure(code: "storage_failure") }
      return ["verifiedFiles": String(files), "verifiedBytes": String(bytes)]
    }
  }
}
#endif
