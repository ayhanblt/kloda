#if KLODA_SFTP_NATIVE
import Foundation
import SQLite3

struct IosSftpRun: Codable, Equatable {
  let id: String
  let target: String
  let binding: String
  let automatic: Bool
  let occurrence: Int64
  var phase = "running"
  var attempts = 1
  var osAttempts = 1
  var error: String?
  var retryAt: Int64?
  var retryUptime: Int64?
  var boot: String?
  func validate() throws {
    guard UUID(uuidString: id) != nil, occurrence >= 0,
      target.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil,
      !binding.isEmpty, binding.utf8.count <= 4096, !binding.utf8.contains(0),
      ["running", "waiting", "paused", "finished", "needs_attention", "exhausted"].contains(phase),
      (1...5).contains(attempts), (1...5).contains(osAttempts),
      error == nil || (!error!.isEmpty && error!.utf8.count <= 128 && !error!.utf8.contains(0)) else { throw IosSftpFailure(code: "outcome_unknown") }
    if phase == "waiting" {
      guard let retryAt, let retryUptime, let boot, retryAt >= 0, retryUptime >= 0, !boot.isEmpty,
        Self.delay(error) != nil, boot.utf8.count <= 255, !boot.utf8.contains(0) else { throw IosSftpFailure(code: "outcome_unknown") }
    } else if retryAt != nil || retryUptime != nil || boot != nil { throw IosSftpFailure(code: "outcome_unknown") }
  }
  static func delay(_ code: String?) -> Int64? {
    if code == "lan_unavailable" { return IosAutomaticPolicy.accessDelay }
    if code == "os_interrupted" || code == "credential_locked" { return IosAutomaticPolicy.osDelay }
    return nil
  }
  func failed(_ code: String, clock: (now: Int64, uptime: Int64, boot: String?)) throws -> IosSftpRun {
    guard ["running", "waiting"].contains(phase), clock.now >= 0, clock.uptime >= 0 else { throw IosSftpFailure(code: "outcome_unknown") }
    var next = self; next.error = code; next.retryAt = nil; next.retryUptime = nil; next.boot = nil
    if ["cancelled", "settings_changed", "user_pause", "target_pause"].contains(code) { next.phase = "paused"; return next }
    guard let delay = Self.delay(code) else { next.phase = "needs_attention"; return next }
    guard (code == "lan_unavailable" ? attempts : osAttempts) < 5 else { next.phase = "exhausted"; return next }
    guard let boot = clock.boot else { next.phase = "exhausted"; next.error = "retry_clock_unavailable"; return next }
    let wall = clock.now.addingReportingOverflow(delay), uptime = clock.uptime.addingReportingOverflow(delay)
    guard !wall.overflow, !uptime.overflow else { throw IosSftpFailure(code: "retry_clock_unavailable") }
    next.phase = "waiting"; next.retryAt = wall.partialValue; next.retryUptime = uptime.partialValue; next.boot = boot
    try next.validate(); return next
  }
  func retried(clock: (now: Int64, uptime: Int64, boot: String?)) throws -> IosSftpRun? {
    try validate()
    guard phase == "waiting", let delay = Self.delay(error) else { return nil }
    if boot != clock.boot || clock.uptime < retryUptime! - delay { return try failed(error!, clock: clock) }
    guard clock.uptime >= retryUptime! else { return nil }
    var next = self
    if error == "lan_unavailable" { next.attempts += 1 } else { next.osAttempts += 1 }
    next.phase = "running"; next.error = nil; next.retryAt = nil; next.retryUptime = nil; next.boot = nil
    try next.validate(); return next
  }
}

extension IosSftpJournal {
  func createRuns() throws {
    try database.execute("""
      CREATE TABLE IF NOT EXISTS sftp_run(id TEXT PRIMARY KEY,target TEXT NOT NULL,binding TEXT NOT NULL,
        automatic INTEGER NOT NULL CHECK(automatic IN (0,1)),occurrence INTEGER NOT NULL CHECK(occurrence>=0),payload TEXT NOT NULL,
        phase TEXT NOT NULL,error TEXT,attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 5),os_attempts INTEGER NOT NULL CHECK(os_attempts BETWEEN 1 AND 5))
      """)
    try database.execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_sftp_run BEFORE UPDATE ON sftp_run
      WHEN NEW.id IS NOT OLD.id OR NEW.target IS NOT OLD.target OR NEW.binding IS NOT OLD.binding OR NEW.automatic IS NOT OLD.automatic
        OR NEW.occurrence IS NOT OLD.occurrence OR NEW.attempts<OLD.attempts OR NEW.attempts>OLD.attempts+1
        OR NEW.os_attempts<OLD.os_attempts OR NEW.os_attempts>OLD.os_attempts+1
        OR ((OLD.phase IN ('finished','needs_attention','exhausted') OR (OLD.phase='paused' AND OLD.error='settings_changed')) AND NEW.payload IS NOT OLD.payload)
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
    try database.execute("CREATE TRIGGER IF NOT EXISTS retain_sftp_run BEFORE DELETE ON sftp_run BEGIN SELECT RAISE(ABORT,'retained'); END")
    try database.execute("""
      CREATE TABLE IF NOT EXISTS sftp_run_job(run TEXT NOT NULL REFERENCES sftp_run(id),job TEXT NOT NULL REFERENCES sftp_upload(id),kind TEXT NOT NULL,PRIMARY KEY(run,job))
      """)
    for operation in ["UPDATE", "DELETE"] {
      try database.execute("CREATE TRIGGER IF NOT EXISTS retain_sftp_run_job_\(operation.lowercased()) BEFORE \(operation) ON sftp_run_job BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }
  func saveRun(_ value: IosSftpRun) throws {
    try value.validate()
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let payload = String(data: try encoder.encode(value), encoding: .utf8)!
    try database.execute("""
      INSERT INTO sftp_run(id,target,binding,automatic,occurrence,payload,phase,error,attempts,os_attempts) VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET target=excluded.target,binding=excluded.binding,automatic=excluded.automatic,
        occurrence=excluded.occurrence,payload=excluded.payload,phase=excluded.phase,error=excluded.error,attempts=excluded.attempts,os_attempts=excluded.os_attempts
      """, values: [value.id, value.target, value.binding, Int64(value.automatic ? 1 : 0), value.occurrence, payload, value.phase, value.error as Any? ?? NSNull(), Int64(value.attempts), Int64(value.osAttempts)])
  }
  func run(id: String? = nil, target: String? = nil, automatic: Bool? = nil) throws -> IosSftpRun? {
    var conditions: [String] = []; var values: [Any] = []
    if let id { conditions.append("id=?"); values.append(id) }
    if let target { conditions.append("target=?"); values.append(target) }
    if let automatic { conditions.append("automatic=?"); values.append(Int64(automatic ? 1 : 0)) }
    let whereClause = conditions.isEmpty ? "" : " WHERE " + conditions.joined(separator: " AND ")
    return try database.statement("SELECT payload,id,target,binding,phase,attempts,os_attempts,automatic,occurrence FROM sftp_run" + whereClause + " ORDER BY rowid DESC LIMIT 1", values: values) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, sqlite3_column_bytes(row, 0) <= 8192, let text = sqlite3_column_text(row, 0) else { throw IosSftpFailure(code: "storage_failure") }
      let value = try JSONDecoder().decode(IosSftpRun.self, from: Data(String(cString: text).utf8)); try value.validate()
      for (index, expected) in [(1, value.id), (2, value.target), (3, value.binding), (4, value.phase)] {
        guard let text = sqlite3_column_text(row, Int32(index)), String(cString: text) == expected else { throw IosSftpFailure(code: "outcome_unknown") }
      }
      guard sqlite3_column_int(row, 5) == value.attempts, sqlite3_column_int(row, 6) == value.osAttempts,
        sqlite3_column_int(row, 7) == (value.automatic ? 1 : 0), sqlite3_column_int64(row, 8) == value.occurrence else { throw IosSftpFailure(code: "outcome_unknown") }
      return value
    }
  }
  func track(run: IosSftpRun, job: IosSftpUpload) throws {
    guard try job.installation == installation(), try job.target.archiveId() == run.target,
      try state(job).completed || job.context == run.binding else { throw IosSftpFailure(code: "context_changed") }
    try database.execute("INSERT OR IGNORE INTO sftp_run_job(run,job,kind) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM sftp_run WHERE id=? AND target=? AND binding=? AND phase='running')",
      values: [run.id, job.id, job.kind, run.id, run.target, run.binding])
    try database.statement("SELECT 1 FROM sftp_run_job WHERE run=? AND job=?", values: [run.id, job.id]) { row in
      guard sqlite3_step(row) == SQLITE_ROW else { throw IosSftpFailure(code: "context_changed") }
    }
  }
  func runCounts(_ id: String) throws -> [String: String] {
    try database.statement("SELECT u.header,u.completed,u.issue FROM sftp_run_job r JOIN sftp_upload u ON u.id=r.job WHERE r.run=? ORDER BY u.rowid DESC", values: [id]) { row in
      var operations: Int64 = 0, completed: Int64 = 0, files: Int64 = 0, photos: Int64 = 0, completedFiles: Int64 = 0, completedPhotos: Int64 = 0
      var seen = Set<String>()
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { break }
        guard step == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosSftpFailure(code: "storage_failure") }
        let header = String(cString: raw), job = try JSONDecoder().decode(IosSftpUpload.self, from: Data(String(cString: raw).utf8))
        try job.validate(); guard try job.payload() == header else { throw IosSftpFailure(code: "binding_changed") }
        operations += 1
        let done = sqlite3_column_int(row, 1) == 1 && sqlite3_column_type(row, 2) == SQLITE_NULL
        if done { completed += 1 }
        if job.kind == "photo_resource" { continue }
        if !seen.insert(job.source + ":" + job.reference).inserted { continue }
        if job.kind == "photo_manifest" { photos += 1; if done { completedPhotos += 1 } } else { files += 1; if done { completedFiles += 1 } }
      }
      return ["operations": String(operations), "completedOperations": String(completed), "files": String(files), "completedFiles": String(completedFiles), "photos": String(photos), "completedPhotos": String(completedPhotos)]
    }
  }
}

#endif
