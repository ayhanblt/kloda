#if KLODA_S3_NATIVE
import Foundation
import SQLite3

extension IosS3Journal {
  func createCatalog() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS s3_locator(job TEXT PRIMARY KEY REFERENCES s3_job(id),archive TEXT NOT NULL,installation TEXT NOT NULL,source TEXT NOT NULL,reference TEXT NOT NULL,revision TEXT NOT NULL,sha256 TEXT NOT NULL)")
    try database.execute("CREATE INDEX IF NOT EXISTS s3_source_locator ON s3_locator(archive,installation,source,reference,revision,sha256)")
    for operation in ["UPDATE", "DELETE"] {
      try database.execute("CREATE TRIGGER IF NOT EXISTS immutable_s3_locator_\(operation.lowercased()) BEFORE \(operation) ON s3_locator BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }
  func index(_ job: IosS3Job) throws {
    try database.execute("INSERT INTO s3_locator VALUES(?,?,?,?,?,?,?)", values: [job.id, try job.target.archiveId(), job.installation, job.source, job.reference, job.revision, job.sha256])
  }
  func receipt(_ id: String, target: IosS3Target, completed: Bool = true) throws -> IosS3Job {
    guard UUID(uuidString: id)?.uuidString.lowercased() == id else { throw IosS3Failure(code: "invalid_request") }
    let value = try database.statement("SELECT header FROM s3_job WHERE id=?", values: [id]) { row -> IosS3Job in
      guard sqlite3_step(row) == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "receipt_missing") }
      return try JSONDecoder().decode(IosS3Job.self, from: Data(String(cString: raw).utf8))
    }
    guard value.id == id, try value.installation == installation(), try value.target.archiveId() == target.archiveId() else { throw IosS3Failure(code: "binding_changed") }
    let phase = try state(value)
    if completed {
      guard phase == "completed", try events(value, kind: "complete-ack").count == 1 else { throw IosS3Failure(code: "receipt_missing") }
    }
    return value
  }
  func known(_ job: IosS3Job) throws -> IosS3Job? {
    let id: String? = try database.statement("""
      SELECT l.job FROM s3_locator l JOIN s3_job j ON j.id=l.job
      WHERE l.archive=? AND l.installation=? AND l.source=? AND l.reference=? AND l.revision=? AND l.sha256=? AND j.state='completed'
      ORDER BY l.rowid DESC LIMIT 1
      """, values: [try job.target.archiveId(), job.installation, job.source, job.reference, job.revision, job.sha256]) { row in
      let step = sqlite3_step(row); if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "storage_failure") }; return String(cString: text)
    }
    guard let id else { return nil }
    let value = try receipt(id, target: job.target)
    guard value.source == job.source, value.reference == job.reference, value.revision == job.revision, value.sha256 == job.sha256, value.size == job.size, value.kind == job.kind, value.asset == job.asset, value.name == job.name, value.mimeType == job.mimeType else { throw IosS3Failure(code: "binding_changed") }
    return value
  }
  func unresolved(_ job: IosS3Job) throws -> Bool {
    try database.statement("""
      SELECT 1 FROM s3_locator l JOIN s3_job j ON j.id=l.job
      WHERE l.archive=? AND l.installation=? AND l.source=? AND l.reference=? AND j.state NOT IN('completed','aborted') LIMIT 1
      """, values: [try job.target.archiveId(), job.installation, job.source, job.reference]) { row in
      let step = sqlite3_step(row); guard step == SQLITE_ROW || step == SQLITE_DONE else { throw IosS3Failure(code: "storage_failure") }; return step == SQLITE_ROW
    }
  }
}
#endif
