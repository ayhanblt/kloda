import Foundation

// One upload state machine shared by the real queue and disposable evidence fixtures.
enum IosFilesUpload {
  static func send(_ job: inout IosFilesJob, journal: IosSyncJournal, descriptor: Int32,
    connection: IosFilesConnection, check: () throws -> Void, validateSource: () throws -> Void) throws {
    var ack = try IosFilesTransfer.ack(connection.send(job.operationId.map { ["kind": "status", "id": $0] }
      ?? IosFilesTransfer.create(job), -1), job: job)
    try save(ack, job: &job, journal: journal)
    while ack.offset < job.size {
      try check()
      let length = min(Int64(65536), job.size - job.acknowledged)
      let offset = job.acknowledged
      ack = try IosFilesTransfer.ack(connection.send(["kind": "chunk", "id": ack.id, "offset": offset, "length": length], descriptor), job: job)
      guard ack.offset == offset + length else { throw IosPairingFailure.native("outcome_unknown") }
      try save(ack, job: &job, journal: journal)
    }
    if ack.state != "completed" {
      try check()
      job.state = "finalizing"; try journal.saveFileJob(job)
      try validateSource()
      ack = try IosFilesTransfer.ack(connection.send(["kind": "finalize", "id": ack.id], -1), job: job)
      guard ack.state == "completed", ack.offset == job.size else { throw IosPairingFailure.native("outcome_unknown") }
      try save(ack, job: &job, journal: journal)
    }
  }

  private static func save(_ ack: IosFileAck, job: inout IosFilesJob, journal: IosSyncJournal) throws {
    job.operationId = ack.id; job.acknowledged = ack.offset; job.errorCode = nil
    job.state = ack.state == "completed" ? "completed" : "uploading"
    try journal.saveFileJob(job)
  }
}
