import Foundation

@main struct IosFilesUploadChecks {
  static func main() throws {
    guard CommandLine.arguments.count == 2 else { fatalError("Disposable directory required") }
    let root = URL(fileURLWithPath: CommandLine.arguments[1])
    guard root.lastPathComponent.hasPrefix("kloda-ios-files-upload-"), !FileManager.default.fileExists(atPath: root.appendingPathComponent("jobs.sqlite").path) else { fatalError("New disposable database required") }
    let journal = try IosSyncJournal(databaseURL: root.appendingPathComponent("jobs.sqlite"))
    let record = String(repeating: "A", count: 22), hash = String(repeating: "A", count: 43)
    let operation = "AQ" + String(repeating: "A", count: 20)
    func job(_ tag: String) -> IosFilesJob {
      let id = IosFilesTransfer.identifier()
      return IosFilesJob(id: id, sourceId: "source", reference: "file", revision: "4:1", recordId: record,
        wireSourceId: record, requestId: id, name: "file.bin", sha256: hash, size: 4, snapshot: "private.snapshot", identity: tag)
    }
    func reply(_ job: IosFilesJob, offset: Int64, state: String) -> [String: Any] {
      ["status": 200, "operation": ["id": operation, "requestId": job.requestId, "sourceId": job.wireSourceId,
        "sourceRevision": hash, "name": job.name, "sha256": hash, "size": job.size, "offset": offset, "state": state]]
    }
    var lost = job("lost-create"); try journal.saveFileJob(lost)
    var requestIds: [String] = []
    let createLost = IosFilesConnection(check: {}, send: { command, _ in
      requestIds.append((command["upload"] as! [String: Any])["requestId"] as! String)
      throw IosPairingFailure.native("outcome_unknown")
    })
    do { try IosFilesUpload.send(&lost, journal: journal, descriptor: -1, connection: createLost, check: {}, validateSource: {})
      fatalError("Lost response completed") } catch IosPairingFailure.native(let code) { precondition(code == "outcome_unknown") }
    let persistedCreate = try journal.fileJob(id: lost.id)!
    precondition(persistedCreate.operationId == nil && persistedCreate.state == "queued")
    let original = lost
    var finalizing = false
    let sender = IosFilesConnection(check: {}, send: { command, _ in
      switch command["kind"] as! String {
      case "create": requestIds.append((command["upload"] as! [String: Any])["requestId"] as! String); return reply(original, offset: 0, state: "receiving")
      case "chunk": return reply(original, offset: 4, state: "receiving")
      case "finalize": finalizing = true; throw IosPairingFailure.native("outcome_unknown")
      default: fatalError("Unexpected command")
      }
    })
    do { try IosFilesUpload.send(&lost, journal: journal, descriptor: -1, connection: sender, check: {}, validateSource: {})
      fatalError("Lost finalize completed") } catch IosPairingFailure.native(let code) { precondition(code == "outcome_unknown") }
    precondition(finalizing && requestIds.count == 2 && Set(requestIds).count == 1)
    try journal.recoverFilesJobs()
    var reopened = try journal.fileJob(id: lost.id)!
    precondition(reopened.state == "paused" && reopened.operationId == operation && reopened.acknowledged == 4)
    let statusOnly = IosFilesConnection(check: {}, send: { command, _ in
      precondition(command["kind"] as? String == "status")
      return reply(original, offset: 4, state: "completed")
    })
    try IosFilesUpload.send(&reopened, journal: journal, descriptor: -1, connection: statusOnly, check: {}, validateSource: {})
    precondition(reopened.state == "completed")
    print("PASS lost create/finalize preserve request/operation/ACK and resume by exact status")

    var wrong = job("wrong-ack"); try journal.saveFileJob(wrong)
    let wrongOriginal = wrong
    let bad = IosFilesConnection(check: {}, send: { command, _ in
      reply(wrongOriginal, offset: command["kind"] as? String == "chunk" ? 3 : 0, state: "receiving")
    })
    do { try IosFilesUpload.send(&wrong, journal: journal, descriptor: -1, connection: bad, check: {}, validateSource: {})
      fatalError("Wrong ACK completed") } catch IosPairingFailure.native(let code) { precondition(code == "outcome_unknown") }
    precondition(tryRead(journal, id: wrong.id).acknowledged == 0)
    print("PASS contradictory ACK cannot advance durable offset or invent completion")

    var deleted = job("deleted"); try journal.saveFileJob(deleted)
    let denied = IosFilesConnection(check: {}, send: { _, _ in ["status": 410, "errorCode": "owner_deleted"] })
    do { try IosFilesUpload.send(&deleted, journal: journal, descriptor: -1, connection: denied, check: {}, validateSource: {})
      fatalError("Deleted source uploaded") } catch IosPairingFailure.native(let code) { precondition(code == "owner_deleted") }
    precondition(tryRead(journal, id: deleted.id).operationId == nil)
    print("PASS receiver source suppression is not converted into upload completion")
  }
  static func tryRead(_ journal: IosSyncJournal, id: String) -> IosFilesJob { try! journal.fileJob(id: id)! }
}
