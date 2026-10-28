import Foundation
import Photos
import Darwin
import SQLite3

final class IosPhotosRestore {
  private let worker = DispatchQueue(label: "com.kloda.photos.restore")
  private let lock = NSLock()
  private var generation: UInt64 = 0
  private var busy = false
  func cancel() { lock.lock(); generation &+= 1; lock.unlock() }
  func status() throws -> [String: Any] {
    var value = try IosSyncJournal().photoImportStatus()
    if value["total"] as? String != "0" && PHPhotoLibrary.authorizationStatus(for: .readWrite) != .authorized {
      value["state"] = "review_required"; value["review"] = value["total"]; value["completed"] = "0"
    }
    return value
  }

  func restore(record: String, backup: IosOwnBackup?, session: KlodaPairingSession,
    completion: @escaping (Result<[String: Any]?, IosPairingFailure>) -> Void) {
    lock.lock()
    guard !busy else { lock.unlock(); completion(.failure(.native("backup_busy"))); return }
    let ticket = generation
    busy = true; lock.unlock()
    session.fileConnection(record: record) { result in
      self.worker.async {
        defer { self.lock.lock(); self.busy = false; self.lock.unlock() }
        do {
          let connection = try result.get()
          let check = {
            self.lock.lock(); let current = self.generation == ticket; self.lock.unlock()
            guard current else { throw IosPairingFailure.native("cancelled") }
            try connection.check()
          }
          try check()
          guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else { throw IosPairingFailure.native("photo_permission_lost") }
          let journal = try IosSyncJournal(), snapshots = try IosFilesSnapshot()
          if let backup { try self.restoreOne(record: record, backup: backup, journal: journal, snapshots: snapshots, connection: connection, check: check) }
          else { try self.restoreAll(record: record, journal: journal, snapshots: snapshots, connection: connection, check: check) }
          completion(.success(try journal.photoImportStatus()))
        } catch { completion(.failure(IosFilesQueue.failure(error))) }
      }
    }
  }

  private func restoreAll(record: String, journal: IosSyncJournal, snapshots: IosFilesSnapshot,
    connection: IosFilesConnection, check: @escaping () throws -> Void) throws {
    // Like Android's catalog: choose the latest verified version before creating any target.
    try journal.execute("CREATE TEMP TABLE photos_catalog (key TEXT PRIMARY KEY,revision INTEGER,id TEXT,name TEXT,sha256 TEXT,size INTEGER)")
    var cursor: String?
    repeat {
      try check()
      let page = try IosOwnBackups.list(connection, after: cursor)
      guard let items = page["items"] as? [[String: String]], let more = page["hasMore"] as? Bool else { throw IosPairingFailure.invalidReply }
      for item in items {
        guard let id = item["id"], let name = item["name"], let hash = item["sha256"], let text = item["size"], let size = Int64(text) else { throw IosPairingFailure.invalidReply }
        cursor = id
        if !name.hasPrefix(IosPhotoManifestCodec.prefix) || !name.hasSuffix(".json") { continue }
        let backup = IosOwnBackup(id: id, name: name, sha256: hash, size: size)
        guard size <= 65_536 else { throw IosPairingFailure.native("manifest_invalid") }
        let stage = try download(record: record, backup: backup, journal: journal, snapshots: snapshots, connection: connection, check: check)
        defer { try? snapshots.discard(stage.name) }
        let manifest = try IosPhotoManifestCodec.decode(Data(contentsOf: stage.url))
        guard manifest.filename == name else { throw IosPairingFailure.native("manifest_invalid") }
        let key = try IosSyncJournal.photoKey([manifest.sourceDeviceId, manifest.assetId])
        guard try journal.photoText("SELECT key FROM photos_catalog WHERE key=? AND revision=? AND sha256<>?", [key, manifest.revision, hash]) == nil else { throw IosPairingFailure.native("manifest_invalid") }
        try journal.execute("""
          INSERT INTO photos_catalog VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET
          revision=excluded.revision,id=excluded.id,name=excluded.name,sha256=excluded.sha256,size=excluded.size
          WHERE excluded.revision>photos_catalog.revision
          """, values: [key, manifest.revision, id, name, hash, size])
      }
      if !more { break }
      guard !items.isEmpty else { throw IosPairingFailure.invalidReply }
    } while true
    var after = ""
    var review: IosPairingFailure?
    while let next = try journal.statement("SELECT key,id,name,sha256,size FROM photos_catalog WHERE key>? ORDER BY key LIMIT 1", values: [after], body: { row -> (String, IosOwnBackup)? in
      let result = sqlite3_step(row)
      if result == SQLITE_DONE { return nil }
      guard result == SQLITE_ROW, let key = sqlite3_column_text(row, 0), let id = sqlite3_column_text(row, 1),
        let name = sqlite3_column_text(row, 2), let hash = sqlite3_column_text(row, 3),
        sqlite3_column_type(row, 4) == SQLITE_INTEGER else { throw journal.journalError("outcome_unknown") }
      return (String(cString: key), IosOwnBackup(id: String(cString: id), name: String(cString: name), sha256: String(cString: hash), size: sqlite3_column_int64(row, 4)))
    }) {
      after = next.0
      do { try restoreOne(record: record, backup: next.1, journal: journal, snapshots: snapshots, connection: connection, check: check) }
      catch IosPairingFailure.native(let code) {
        guard ["review_required", "organization_review", "photo_review_required"].contains(code) else { throw IosPairingFailure.native(code) }
        review = .native(code)
      }
    }
    if let review { throw review }
  }

  private func restoreOne(record: String, backup: IosOwnBackup, journal: IosSyncJournal, snapshots: IosFilesSnapshot,
    connection: IosFilesConnection, check: @escaping () throws -> Void) throws {
    guard backup.name.hasPrefix(IosPhotoManifestCodec.prefix), backup.size <= 65_536 else { throw IosPairingFailure.native("manifest_invalid") }
    let sidecar = try download(record: record, backup: backup, journal: journal, snapshots: snapshots, connection: connection, check: check)
    let manifest = try IosPhotoManifestCodec.decode(Data(contentsOf: sidecar.url))
    guard manifest.filename == backup.name else { throw IosPairingFailure.native("manifest_invalid") }
    var stages: [String: URL] = [:]
    var retained = [sidecar]
    for resource in manifest.resources {
      try check()
      let own = try IosOwnBackups.status(connection, id: resource.operationId)
      guard own.name == resource.name, own.sha256 == resource.sha256, own.size == resource.size else { throw IosPairingFailure.invalidReply }
      let stage = try download(record: record, backup: own, journal: journal, snapshots: snapshots, connection: connection, check: check)
      stages[resource.operationId] = stage.url; retained.append(stage)
    }
    // Recheck current authority and every immutable receipt immediately before local import.
    guard backup.matches(try IosOwnBackups.status(connection, id: backup.id)) else { throw IosPairingFailure.invalidReply }
    for resource in manifest.resources {
      let own = try IosOwnBackups.status(connection, id: resource.operationId)
      guard own.name == resource.name, own.sha256 == resource.sha256, own.size == resource.size else { throw IosPairingFailure.invalidReply }
    }
    try IosPhotosImport.importManifest(manifest: manifest, stages: stages, journal: journal, check: check)
    for stage in retained { try snapshots.discard(stage.name) }
  }

  private struct Stage { let name: String; let url: URL }
  private func download(record: String, backup: IosOwnBackup, journal: IosSyncJournal, snapshots: IosFilesSnapshot,
    connection: IosFilesConnection, check: @escaping () throws -> Void) throws -> Stage {
    try check()
    guard backup.matches(try IosOwnBackups.status(connection, id: backup.id)) else { throw IosPairingFailure.invalidReply }
    var intent: IosRestoreIntent
    if let old = try journal.restoreIntent(record: record, operation: backup.id), old.destination == nil {
      intent = old
      guard old.sha256 == backup.sha256, old.size == backup.size, old.name == backup.name else { throw IosPairingFailure.invalidReply }
      // A previous completed import may have released its private stage; allocate a new explicit download.
      if old.offset == old.size, (try? snapshots.open(old.staging, sha256: old.sha256, size: old.size).close()) == nil {
        intent = try fresh(record: record, backup: backup, journal: journal, snapshots: snapshots)
      }
    } else { intent = try fresh(record: record, backup: backup, journal: journal, snapshots: snapshots) }
    if intent.offset < intent.size {
      let file = try snapshots.openStaging(intent.staging, offset: intent.offset, discardUnacknowledgedTail: true)
      defer { try? file.close() }
      while intent.offset < intent.size {
        try check()
        let response = try IosFilesTransfer.response(connection.send(["kind": "restore", "id": backup.id, "offset": intent.offset], file.fileDescriptor), fields: ["bytes", "offset", "size"])
        let bytes = try IosFilesTransfer.number(response, "bytes")
        guard try IosFilesTransfer.number(response, "offset") == intent.offset,
          try IosFilesTransfer.number(response, "size") == intent.size,
          bytes == min(65_536, intent.size - intent.offset) else { throw IosPairingFailure.invalidReply }
        try file.synchronize()
        guard fcntl(file.fileDescriptor, F_FULLFSYNC) == 0 else { throw IosFilesSource.ioFailure() }
        intent.offset += bytes; try journal.saveRestoreIntent(intent)
      }
    }
    let url = try snapshots.verifiedURL(intent.staging, sha256: intent.sha256, size: intent.size, check: check)
    intent.state = "verified"; try journal.saveRestoreIntent(intent)
    guard backup.matches(try IosOwnBackups.status(connection, id: backup.id)) else { throw IosPairingFailure.invalidReply }
    return Stage(name: intent.staging, url: url)
  }

  private func fresh(record: String, backup: IosOwnBackup, journal: IosSyncJournal, snapshots: IosFilesSnapshot) throws -> IosRestoreIntent {
    let (name, file) = try snapshots.createStaging(); try file.close()
    let intent = IosRestoreIntent(id: IosFilesTransfer.identifier(), recordId: record, operationId: backup.id,
      name: backup.name, sha256: backup.sha256, size: backup.size, staging: name)
    try journal.saveRestoreIntent(intent); return intent
  }
}
