import Foundation
import CryptoKit

struct IosFilesSelection {
  let id: String
  let bookmark: String
  static func current() throws -> [IosFilesSelection] {
    let raw = UserDefaults.standard.array(forKey: "kloda.sync.directorySources") ?? []
    return try raw.map {
      guard let source = $0 as? [String: String], let id = source["id"], let bookmark = source["reference"], !id.isEmpty else {
        throw IosPairingFailure.native("source_unavailable")
      }
      return IosFilesSelection(id: id, bookmark: bookmark)
    }
  }
  static func binding() throws -> Data {
    let defaults = UserDefaults.standard
    return try JSONSerialization.data(withJSONObject: ["sources": defaults.array(forKey: "kloda.sync.directorySources") ?? [],
      "photos": defaults.array(forKey: "kloda.sync.photoSources") ?? [],
      "mode": defaults.string(forKey: "kloda.sync.backupMode") ?? "",
      "interval": defaults.integer(forKey: "kloda.sync.intervalHours"), "time": defaults.string(forKey: "kloda.sync.localTime") ?? ""], options: .sortedKeys)
  }
}

final class IosFilesQueue {
  private let worker = DispatchQueue(label: "com.kloda.files.ios")
  private let lock = NSLock()
  private var running = false
  private var generation: UInt64 = 0
  private var lastError: String?
  private var recovered = false
  var onIdle: (() -> Void)?
  private var onFinish: ((String?) -> Void)?
  private var activeRun: IosFilesRun?


  func pause() {
    lock.lock(); generation &+= 1; lock.unlock()
  }

  func status() throws -> [String: Any] {
    lock.lock()
    defer { lock.unlock() }
    let journal = try IosSyncJournal()
    if !recovered && !running { try journal.recoverFilesJobs(); try journal.recoverFilesRuns(); recovered = true }
    let all = try journal.filesJobs()
    let jobs: [[String: Any]] = all.prefix(100).map { job in
      var value: [String: Any] = ["id": job.id, "sourceId": job.sourceId, "name": job.name,
        "recordId": job.recordId, "state": job.state, "acknowledgedBytes": String(job.acknowledged), "totalBytes": String(job.size)]
      if let error = job.errorCode { value["errorCode"] = error }
      return value
    }
    var value: [String: Any] = ["running": running, "jobs": jobs, "totalJobs": String(all.count), "hasMore": all.count > 100]
    if let run = try journal.latestFilesRun() {
      var visible: [String: Any] = ["id": run.id, "recordId": run.recordId, "state": run.state, "attempts": run.attempts]
      if let error = run.errorCode { visible["errorCode"] = error }
      value["run"] = visible
    }
    if let error = lastError { value["errorCode"] = error }
    return value
  }

  func start(record: String, rebackup: String?, session: KlodaPairingSession, background: IosBackgroundLease? = nil, attempt: Int = 1, onFinish: ((String?) -> Void)? = nil, onAdmitted: (() throws -> Void)? = nil, completion: @escaping (Result<[String: Any]?, IosPairingFailure>) -> Void) {
    do { try IosFilesTransfer.fixed(record, bytes: 16); _ = try status() }
    catch { completion(.failure(Self.failure(error))); return }
    lock.lock()
    guard !running else { lock.unlock(); completion(.failure(.native("backup_busy"))); return }
    let binding: Data
    do {
      try onAdmitted?()
      binding = try IosFilesSelection.binding()
      let run = IosFilesRun(id: IosFilesTransfer.identifier(), recordId: record,
        binding: IosFilesTransfer.encode(Data(SHA256.hash(data: binding))), attempts: attempt)
      try IosSyncJournal().saveFilesRun(run); activeRun = run
    } catch { lock.unlock(); completion(.failure(Self.failure(error))); return }
    running = true; lastError = nil; self.onFinish = onFinish
    let ticket = generation
    lock.unlock()
    let connected: (Result<IosFilesConnection, IosPairingFailure>) -> Void = { result in
      switch result {
      case .failure(let error): self.finish(error.code); completion(.failure(error))
      case .success(let connection):
        self.worker.async {
          do {
            let check = { [self] in
              self.lock.lock(); let current = self.generation == ticket; self.lock.unlock()
              guard current else { throw IosPairingFailure.native("cancelled") }
              try connection.check()
              guard try IosFilesSelection.binding() == binding else { throw IosPairingFailure.native("settings_changed") }
            }
            let job = try rebackup.flatMap { try IosSyncJournal().fileJob(id: $0) }
            let photosOnly = job?.isPhotos == true
            var error: String?
            let hasFiles = try !IosFilesSelection.current().isEmpty
            let hasPhotos = try !IosPhotosSource.currentSelections().isEmpty
            guard hasFiles || hasPhotos else { throw IosPairingFailure.native("source_unavailable") }
            if hasFiles && !photosOnly {
              let sender = IosFilesRunner(connection: connection, check: check)
              try sender.run(record: record, rebackup: rebackup); error = sender.errorCode
            }
            let retainedPhotos = try IosSyncJournal().filesJobs().contains { $0.recordId == record && $0.isPhotos && !["completed", "owner_deleted"].contains($0.state) }
            if (hasPhotos || retainedPhotos) && (rebackup == nil || photosOnly) {
              let sender = IosPhotosRunner(connection: connection, check: check)
              try sender.run(record: record, rebackup: rebackup); error = sender.errorCode ?? error
            }
            if rebackup != nil && job == nil { throw IosPairingFailure.native("invalid_request") }
            self.finish(error)
          } catch { self.finish(Self.failure(error).code) }
        }
        do { completion(.success(try self.status())) }
        catch { completion(.failure(Self.failure(error))) }
      }
    }
    if let background { session.backgroundFileConnection(record: record, lease: background, completion: connected) }
    else { session.fileConnection(record: record, automatic: onAdmitted != nil, completion: connected) }
  }

  private func finish(_ error: String?) {
    lock.lock()
    lastError = error
    if var run = activeRun {
      run.state = error == nil ? "finished" : (["cancelled", "candidate_stale", "settings_changed"].contains(error!) ? "paused" : "needs_attention")
      run.errorCode = error
      do { try IosSyncJournal().saveFilesRun(run) }
      catch { lastError = "storage_failure" }
    }
    activeRun = nil; running = false
    let callback = onFinish; onFinish = nil; let result = lastError
    lock.unlock(); callback?(result)
    if callback == nil { onIdle?() }
  }

  static func failure(_ error: Error) -> IosPairingFailure {
    if let failure = error as? IosPairingFailure { return failure }
    if IosFilesSource.isStorageFull(error) { return .native("local_storage_full") }
    let native = error as NSError
    if native.domain == "KlodaSyncJournal" {
      return .native(native.localizedDescription == "outcome_unknown" ? "outcome_unknown" : "storage_failure")
    }
    return .native("outcome_unknown")
  }
}
