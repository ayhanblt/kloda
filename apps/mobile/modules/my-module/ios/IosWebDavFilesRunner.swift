import Foundation

// Files shares selected-bookmark reads and private snapshots with PC, not PC authority/receipts.
final class IosWebDavFilesRunner {
  let publisher: IosWebDavPublisher
  private(set) var errorCode: String?
  init(publisher: IosWebDavPublisher) { self.publisher = publisher }
  func run() throws {
    for source in try IosFilesSelection.current() {
      try publisher.check()
      let files: [IosQueuedSourceFile]
      do { files = try IosSourceScanner().scanDirectory(bookmark: source.bookmark) }
      catch { errorCode = Self.code(error); continue }
      for file in files {
        try publisher.check()
        do { try publish(file, source: source) }
        catch {
          let code = Self.code(error)
          if ["cancelled", "settings_changed", "connection_unavailable", "storage_failure", "local_storage_full"].contains(code) { throw error }
          errorCode = code
        }
      }
    }
  }
  private func publish(_ file: IosQueuedSourceFile, source: IosFilesSelection) throws {
    let fingerprint = try IosFilesSource.read(bookmark: source.bookmark, file: file, cancelled: cancelled) { fd, _, wire in
      let (hash, size) = try IosFilesSource.hash(fd, maxBytes: file.size, cancelled: self.cancelled)
      guard size == file.size else { throw IosWebDavFailure.code("source_changed") }
      return (hash: hash, size: size, wire: wire)
    }
    try publisher.publish(source: source.id, reference: file.reference, path: source.id + "/" + file.relativePath,
      revision: file.revision, sha256: fingerprint.hash, size: fingerprint.size, sourceIdentity: "files:" + fingerprint.wire, prepare: {
        let prepared = try self.publisher.snapshots.prepare(sourceId: source.id, bookmark: source.bookmark, file: file, cancelled: self.cancelled)
        guard prepared.sha256 == fingerprint.hash, prepared.size == fingerprint.size, prepared.wireSourceId == fingerprint.wire else {
          try self.publisher.snapshots.discard(prepared.snapshot); throw IosWebDavFailure.code("source_changed")
        }
        return prepared.snapshot
      }, validate: {
        try self.publisher.check()
        try self.publisher.snapshots.validateSource(bookmark: source.bookmark, file: file, sha256: fingerprint.hash, size: fingerprint.size,
          wireSourceId: fingerprint.wire, cancelled: self.cancelled)
      })
  }
  private func cancelled() -> Bool { (try? publisher.check()) == nil }
  static func code(_ error: Error) -> String {
    if case IosWebDavFailure.code(let code) = error { return code }
    let native = error as NSError
    if native.domain == "KlodaSyncJournal", native.localizedDescription == "retry_clock_unavailable" { return "retry_clock_unavailable" }
    return IosFilesQueue.failure(error).code
  }
}
