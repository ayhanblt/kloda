import Foundation
import CryptoKit

final class IosFilesRunner {
  let connection: IosFilesConnection
  let check: () throws -> Void
  private(set) var errorCode: String?
  init(connection: IosFilesConnection, check: @escaping () throws -> Void) { self.connection = connection; self.check = check }

  func run(record: String, rebackup: String?) throws {
    let journal = try IosSyncJournal()
    let snapshots = try IosFilesSnapshot()
    let sources = try IosFilesSelection.current()
    guard !sources.isEmpty else { throw IosPairingFailure.native("source_unavailable") }
    let selected = try rebackup.map { id -> IosFilesJob in
      guard let job = try journal.fileJob(id: id), job.state == "owner_deleted", job.operationId != nil else {
        throw IosPairingFailure.native("invalid_request")
      }
      return job
    }
    if let selected {
      let raw = try connection.send(["kind": "status", "id": selected.operationId!], -1)
      do { _ = try IosFilesTransfer.ack(raw, job: selected); throw IosPairingFailure.native("conflict") }
      catch IosPairingFailure.native(let code) { guard code == "owner_deleted" else { throw IosPairingFailure.native(code) } }
    }
    var foundRebackup = false
    var seen = Set<String>(), seenReferences = Set<String>()
    var sourceFailures: [String: String] = [:]
    for source in sources {
      let files: [IosQueuedSourceFile]
      let directoryIdentity: String
      do {
        directoryIdentity = try IosFilesSource.directoryIdentity(bookmark: source.bookmark)
        let previous = try journal.sourceFilesJobs(sourceId: source.id)
        guard previous.allSatisfy({ $0.wireSourceId == IosFilesSource.wireSource(directory: directoryIdentity, reference: $0.reference) }) else {
          throw IosPairingFailure.native("source_identity_unknown")
        }
        files = try IosSourceScanner().scanDirectory(bookmark: source.bookmark)
      }
      catch { let code = IosFilesQueue.failure(error).code; sourceFailures[source.id] = code; errorCode = code; continue }
      for file in files {
        try check()
        seenReferences.insert(source.id + "\u{0}" + file.reference)
        if let selected, selected.reference != file.reference { continue }
        let fingerprint: (sha256: String, size: Int64, wireSourceId: String)
        do {
          fingerprint = try IosFilesSource.read(bookmark: source.bookmark, file: file,
            cancelled: { (try? self.check()) == nil }) { fd, _, wire in
            let (hash, size) = try IosFilesSource.hash(fd, maxBytes: file.size, cancelled: { (try? self.check()) == nil })
            guard size == file.size else { throw IosPairingFailure.native("source_changed") }
            return (hash, size, wire)
          }
        }
        catch {
          let code = IosFilesQueue.failure(error).code; errorCode = code
          if ["cancelled", "candidate_stale", "settings_changed"].contains(code) { throw error }
          continue
        }
        if fingerprint.wireSourceId != IosFilesSource.wireSource(directory: directoryIdentity, reference: file.reference) {
          sourceFailures[source.id] = "source_identity_unknown"; errorCode = "source_identity_unknown"
          continue
        }
        // Reuse an existing immutable snapshot; resume/completed checks need no second full copy.
        func newSnapshot() throws -> IosPreparedFile {
          let value = try snapshots.prepare(sourceId: source.id, bookmark: source.bookmark, file: file,
            cancelled: { (try? self.check()) == nil })
          guard value.sha256 == fingerprint.sha256, value.size == fingerprint.size, value.wireSourceId == fingerprint.wireSourceId else {
            try snapshots.discard(value.snapshot); throw IosPairingFailure.native("source_changed")
          }
          return value
        }
        let identityData = try JSONSerialization.data(withJSONObject: [record, source.id, source.bookmark, file.reference, fingerprint.sha256], options: .sortedKeys)
        let baseIdentity = IosFilesTransfer.encode(Data(SHA256.hash(data: identityData)))
        let candidates = try journal.matchingFilesJobs(record: record, wireSource: fingerprint.wireSourceId, hash: fingerprint.sha256, size: fingerprint.size)
        var job: IosFilesJob
        do {
          if let selected {
            if fingerprint.wireSourceId != selected.wireSourceId { continue }
            foundRebackup = true
            guard fingerprint.sha256 == selected.sha256, fingerprint.size == selected.size, fingerprint.wireSourceId == selected.wireSourceId else {
              throw IosPairingFailure.native("source_changed")
            }
            if let existing = candidates.first(where: { $0.rebackupOf == selected.operationId && $0.state != "owner_deleted" }) {
              job = existing
            } else {
              job = makeJob(try newSnapshot(), source: source, file: file, record: record, identity: baseIdentity + ":" + IosFilesTransfer.identifier(), rebackup: selected.operationId)
              try journal.saveFileJob(job)
            }
          } else if let existing = candidates.first(where: {
            $0.state == "owner_deleted" || $0.state == "completed" || $0.identity == baseIdentity || $0.identity.hasPrefix(baseIdentity + ":")
          }) {
            job = existing
            seen.insert(job.id)
            if job.state == "owner_deleted" { continue }
            // An old bookmark/source selection cannot authorize a pending job under new settings.
            if job.state != "completed" && (job.sourceId != source.id || (job.identity != baseIdentity && job.rebackupOf == nil)) {
              errorCode = "settings_changed"; continue
            }
          } else {
            job = makeJob(try newSnapshot(), source: source, file: file, record: record, identity: baseIdentity, rebackup: nil)
            try journal.saveFileJob(job)
          }
        } catch {
          let code = IosFilesQueue.failure(error).code; errorCode = code
          if ["cancelled", "candidate_stale", "settings_changed", "storage_failure"].contains(code) { throw error }
          continue
        }
        seen.insert(job.id)
        do {
          if job.state == "completed" {
            let ack = try IosFilesTransfer.ack(connection.send(["kind": "status", "id": job.operationId!], -1), job: job)
            guard ack.state == "completed" else { throw IosPairingFailure.native("outcome_unknown") }
            continue
          }
          try send(&job, source: source, file: file, journal: journal, snapshots: snapshots)
        } catch {
          let code = IosFilesQueue.failure(error).code
          errorCode = code
          if code == "owner_deleted" { job.state = "owner_deleted" }
          else if job.state != "completed" { job.state = ["cancelled", "candidate_stale", "settings_changed"].contains(code) ? "paused" : "blocked" }
          job.errorCode = code; try journal.saveFileJob(job)
          if ["cancelled", "candidate_stale", "settings_changed"].contains(code) { throw error }
        }
      }
    }
    for var old in try journal.filesJobs() where old.recordId == record && !old.isPhotos && !seen.contains(old.id)
      && !["completed", "owner_deleted"].contains(old.state) {
      let code = !sources.contains(where: { $0.id == old.sourceId }) ? "settings_changed"
        : (sourceFailures[old.sourceId] ?? (seenReferences.contains(old.sourceId + "\u{0}" + old.reference) ? "source_changed" : "source_unavailable"))
      old.state = "paused"; old.errorCode = code; try journal.saveFileJob(old)
      errorCode = errorCode ?? code
    }
    if selected != nil && !foundRebackup { throw IosPairingFailure.native("source_unavailable") }
  }

  private func makeJob(_ prepared: IosPreparedFile, source: IosFilesSelection, file: IosQueuedSourceFile,
    record: String, identity: String, rebackup: String?) -> IosFilesJob {
    let id = IosFilesTransfer.identifier()
    return IosFilesJob(id: id, sourceId: source.id, reference: file.reference, revision: file.revision,
      recordId: record, wireSourceId: prepared.wireSourceId, requestId: id, name: prepared.name,
      sha256: prepared.sha256, size: prepared.size, snapshot: prepared.snapshot, rebackupOf: rebackup, identity: identity)
  }

  private func send(_ job: inout IosFilesJob, source: IosFilesSelection, file: IosQueuedSourceFile,
    journal: IosSyncJournal, snapshots: IosFilesSnapshot) throws {
    try check()
    let descriptor = try snapshots.open(job.snapshot, sha256: job.sha256, size: job.size)
    defer { try? descriptor.close() }
    try snapshots.validateSource(bookmark: source.bookmark, file: file, sha256: job.sha256, size: job.size,
      wireSourceId: job.wireSourceId, cancelled: { (try? self.check()) == nil })
    let hash = job.sha256, size = job.size, wireSource = job.wireSourceId
    try IosFilesUpload.send(&job, journal: journal, descriptor: descriptor.fileDescriptor,
      connection: connection, check: check, validateSource: {
        try snapshots.validateSource(bookmark: source.bookmark, file: file, sha256: hash,
          size: size, wireSourceId: wireSource, cancelled: { (try? self.check()) == nil })
      })
    try snapshots.discard(job.snapshot)
  }

}
