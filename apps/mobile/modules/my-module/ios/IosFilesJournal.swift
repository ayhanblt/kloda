import Foundation
import SQLite3

extension IosSyncJournal {
  func createFilesJobs() throws {
    try execute("""
      CREATE TABLE IF NOT EXISTS files_job (
        id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL, reference TEXT NOT NULL,
        revision TEXT NOT NULL, record_id TEXT NOT NULL, wire_source_id TEXT NOT NULL,
        request_id TEXT NOT NULL, name TEXT NOT NULL, sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK(size_bytes>=0), snapshot TEXT NOT NULL,
        operation_id TEXT, acknowledged_bytes INTEGER NOT NULL CHECK(acknowledged_bytes>=0 AND acknowledged_bytes<=size_bytes),
        state TEXT NOT NULL CHECK(state IN ('queued','preparing','uploading','finalizing','completed','paused','blocked','owner_deleted')),
        error_code TEXT, rebackup_of TEXT, attempts INTEGER NOT NULL CHECK(attempts BETWEEN 0 AND 5),
        retry_at INTEGER CHECK(retry_at IS NULL OR (retry_at>=0 AND attempts<5)),
        identity TEXT NOT NULL UNIQUE,
        CHECK(state!='completed' OR (operation_id IS NOT NULL AND acknowledged_bytes=size_bytes))
      )
      """)
    try execute("CREATE INDEX IF NOT EXISTS files_job_locator ON files_job(source_id,reference)")
    try execute("CREATE INDEX IF NOT EXISTS files_job_source ON files_job(record_id,wire_source_id,sha256,size_bytes)")
    try execute("""
      CREATE TRIGGER IF NOT EXISTS retain_files_job BEFORE DELETE ON files_job
      BEGIN SELECT RAISE(ABORT,'retained'); END
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_files_job BEFORE UPDATE ON files_job
      WHEN NEW.id IS NOT OLD.id OR NEW.source_id IS NOT OLD.source_id OR NEW.reference IS NOT OLD.reference
        OR NEW.revision IS NOT OLD.revision OR NEW.record_id IS NOT OLD.record_id
        OR NEW.wire_source_id IS NOT OLD.wire_source_id OR NEW.request_id IS NOT OLD.request_id
        OR NEW.name IS NOT OLD.name OR NEW.sha256 IS NOT OLD.sha256 OR NEW.size_bytes IS NOT OLD.size_bytes
        OR NEW.snapshot IS NOT OLD.snapshot OR NEW.identity IS NOT OLD.identity OR NEW.rebackup_of IS NOT OLD.rebackup_of
        OR (OLD.operation_id IS NOT NULL AND NEW.operation_id IS NOT OLD.operation_id)
        OR NEW.acknowledged_bytes<OLD.acknowledged_bytes OR NEW.attempts<OLD.attempts
        OR (OLD.state='completed' AND NEW.state NOT IN ('completed','owner_deleted'))
        OR (OLD.state='owner_deleted' AND NEW.state!='owner_deleted')
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
  }

  func filesJobs() throws -> [IosFilesJob] {
    try readFileJobs("SELECT * FROM files_job ORDER BY id")
  }

  func sourceFilesJobs(sourceId: String, reference: String? = nil) throws -> [IosFilesJob] {
    if let reference { return try readFileJobs("SELECT * FROM files_job WHERE source_id=? AND reference=?", values: [sourceId, reference]) }
    return try readFileJobs("SELECT * FROM files_job WHERE source_id=?", values: [sourceId])
  }
  func matchingFilesJobs(record: String, wireSource: String, hash: String, size: Int64) throws -> [IosFilesJob] {
    try readFileJobs("SELECT * FROM files_job WHERE record_id=? AND wire_source_id=? AND sha256=? AND size_bytes=? ORDER BY CASE state WHEN 'owner_deleted' THEN 2 WHEN 'completed' THEN 0 ELSE 1 END,rowid DESC",
      values: [record, wireSource, hash, size])
  }
  func fileJob(id: String) throws -> IosFilesJob? {
    try readFileJobs("SELECT * FROM files_job WHERE id=?", values: [id]).first
  }

  func fileJob(identity: String) throws -> IosFilesJob? {
    try readFileJobs("SELECT * FROM files_job WHERE identity=?", values: [identity]).first
  }

  func saveFileJob(_ job: IosFilesJob) throws {
    try job.validate()
    let values: [Any] = [job.id, job.sourceId, job.reference, job.revision, job.recordId,
      job.wireSourceId, job.requestId, job.name, job.sha256, job.size, job.snapshot,
      job.operationId as Any? ?? NSNull(), job.acknowledged, job.state,
      job.errorCode as Any? ?? NSNull(), job.rebackupOf as Any? ?? NSNull(),
      Int64(job.attempts), job.retryAt as Any? ?? NSNull(), job.identity]
    try execute("""
      INSERT INTO files_job (id,source_id,reference,revision,record_id,wire_source_id,request_id,name,sha256,
        size_bytes,snapshot,operation_id,acknowledged_bytes,state,error_code,rebackup_of,attempts,retry_at,identity)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, reference=excluded.reference,
        revision=excluded.revision, record_id=excluded.record_id, wire_source_id=excluded.wire_source_id,
        request_id=excluded.request_id, name=excluded.name, sha256=excluded.sha256, size_bytes=excluded.size_bytes,
        snapshot=excluded.snapshot, operation_id=excluded.operation_id, acknowledged_bytes=excluded.acknowledged_bytes,
        state=excluded.state, error_code=excluded.error_code, rebackup_of=excluded.rebackup_of,
        attempts=excluded.attempts, retry_at=excluded.retry_at, identity=excluded.identity
      """, values: values)
  }

  func recoverFilesJobs() throws {
    try execute("""
      UPDATE files_job SET state='paused',error_code='interrupted'
      WHERE state IN ('preparing','uploading','finalizing')
      """)
  }

  func readFileJobs(_ sql: String, values: [Any] = []) throws -> [IosFilesJob] {
    try statement(sql, values: values) { statement in
      var jobs: [IosFilesJob] = []
      while true {
        let result = sqlite3_step(statement)
        if result == SQLITE_DONE { return jobs }
        guard result == SQLITE_ROW else { throw journalError("storage_failure") }
        func text(_ column: Int32) throws -> String {
          guard sqlite3_column_type(statement, column) == SQLITE_TEXT,
            let bytes = sqlite3_column_text(statement, column) else { throw journalError("outcome_unknown") }
          let data = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, column)))
          guard let value = String(data: data, encoding: .utf8) else { throw journalError("outcome_unknown") }
          return value
        }
        func optionalText(_ column: Int32) throws -> String? {
          sqlite3_column_type(statement, column) == SQLITE_NULL ? nil : try text(column)
        }
        func number(_ column: Int32) throws -> Int64 {
          guard sqlite3_column_type(statement, column) == SQLITE_INTEGER else { throw journalError("outcome_unknown") }
          return sqlite3_column_int64(statement, column)
        }
        let retryAt = sqlite3_column_type(statement, 17) == SQLITE_NULL ? nil : try number(17)
        let job = try IosFilesJob(id: text(0), sourceId: text(1), reference: text(2), revision: text(3),
          recordId: text(4), wireSourceId: text(5), requestId: text(6), name: text(7), sha256: text(8),
          size: number(9), snapshot: text(10), operationId: optionalText(11), acknowledged: number(12),
          state: text(13), errorCode: optionalText(14), rebackupOf: optionalText(15),
          attempts: Int(number(16)), retryAt: retryAt, identity: text(18))
        try job.validate()
        jobs.append(job)
      }
    }
  }
}
