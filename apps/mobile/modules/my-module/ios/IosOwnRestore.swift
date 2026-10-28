import Foundation

final class IosOwnRestore {
  private let worker = DispatchQueue(label: "com.kloda.restore.ios")
  private let lock = NSLock()
  private var generation: UInt64 = 0
  private var busy = false

  func cancel() { lock.lock(); generation &+= 1; lock.unlock() }
  func ticket() -> UInt64 { lock.lock(); defer { lock.unlock() }; return generation }
  func isCurrent(_ ticket: UInt64) -> Bool { lock.lock(); defer { lock.unlock() }; return generation == ticket }

  func restore(record: String, backup: IosOwnBackup, destination: String, connection: IosFilesConnection, ticket: UInt64,
    completion: @escaping (Result<[String: Any]?, IosPairingFailure>) -> Void) {
    lock.lock()
    guard generation == ticket else { lock.unlock(); completion(.failure(.native("cancelled"))); return }
    guard !busy else { lock.unlock(); completion(.failure(.native("backup_busy"))); return }
    busy = true
    lock.unlock()
    worker.async {
      defer { self.lock.lock(); self.busy = false; self.lock.unlock() }
      do {
        let check = {
          self.lock.lock(); let current = self.generation == ticket; self.lock.unlock()
          guard current else { throw IosPairingFailure.native("cancelled") }
          try connection.check()
        }
        let journal = try IosSyncJournal(), snapshots = try IosFilesSnapshot()
        let current = try IosOwnBackups.status(connection, id: backup.id)
        guard backup.matches(current) else { throw IosPairingFailure.native("outcome_unknown") }
        func freshIntent() throws -> IosRestoreIntent {
          let (name, file) = try snapshots.createStaging(); try file.close()
          let value = IosRestoreIntent(id: IosFilesTransfer.identifier(), recordId: record, operationId: backup.id,
            name: backup.name, sha256: backup.sha256, size: backup.size, staging: name, destination: destination)
          try journal.saveRestoreIntent(value)
          return value
        }
        var intent: IosRestoreIntent
        if let previous = try journal.restoreIntent(record: record, operation: backup.id),
          IosRestoreDestination.sameLocation(previous.destination, destination) {
          intent = previous
          guard intent.name == backup.name, intent.sha256 == backup.sha256, intent.size == backup.size,
            IosRestoreDestination.sameLocation(intent.destination, destination) else { throw IosPairingFailure.native("conflict") }
        } else {
          intent = try freshIntent()
        }
        do {
          if intent.state == "completed" {
            do {
              try IosRestoreDestination.publish(&intent, journal: journal, snapshots: snapshots, check: check)
              try snapshots.discard(intent.staging)
              var value: [String: Any] = backup.publicValue; value["state"] = "completed"
              completion(.success(value)); return
            } catch IosPairingFailure.native(let code) {
              guard code == "not_found" else { throw IosPairingFailure.native(code) }
              intent = try freshIntent()
            }
          }
          if intent.state != "completed" && intent.offset < intent.size {
            let target = try snapshots.openStaging(intent.staging, offset: intent.offset, discardUnacknowledgedTail: true)
            defer { try? target.close() }
            while intent.offset < intent.size {
              try check()
              let response = try IosFilesTransfer.response(connection.send(["kind": "restore", "id": backup.id,
                "offset": intent.offset], target.fileDescriptor), fields: ["bytes", "offset", "size"])
              let bytes = try IosFilesTransfer.number(response, "bytes")
              guard try IosFilesTransfer.number(response, "offset") == intent.offset,
                try IosFilesTransfer.number(response, "size") == intent.size,
                bytes == min(65536, intent.size - intent.offset) else { throw IosPairingFailure.invalidReply }
              intent.offset += bytes; try journal.saveRestoreIntent(intent)
            }
          }
          let verified = try snapshots.open(intent.staging, sha256: intent.sha256, size: intent.size, cancelled: { (try? check()) == nil })
          try verified.close()
          if intent.state != "completed" && intent.device == nil { intent.state = "verified"; try journal.saveRestoreIntent(intent) }
          guard backup.matches(try IosOwnBackups.status(connection, id: backup.id)) else { throw IosPairingFailure.invalidReply }
          try IosRestoreDestination.publish(&intent, journal: journal, snapshots: snapshots, check: check)
          try snapshots.discard(intent.staging)
          var value: [String: Any] = backup.publicValue
          value["state"] = "completed"
          completion(.success(value))
        } catch {
          if intent.state != "completed" { intent.state = "review_required"; intent.errorCode = IosFilesQueue.failure(error).code; try journal.saveRestoreIntent(intent) }
          throw error
        }
      } catch { completion(.failure(IosFilesQueue.failure(error))) }
    }
  }
}
