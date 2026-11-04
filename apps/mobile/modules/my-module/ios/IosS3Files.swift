#if KLODA_S3_NATIVE
import Foundation

final class IosS3Files {
  let copying: IosS3Copy?
  let profiles: IosS3Profiles
  let snapshots: IosFilesSnapshot
  init(profiles: IosS3Profiles, snapshots: IosFilesSnapshot, copying: IosS3Copy? = nil) throws {
    guard snapshots.isS3(profiles.journal.provider) else { throw IosS3Failure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.copying = copying
  }
  func run(cancelled: @escaping () -> Bool, completed: (IosS3Job) throws -> Void) throws {
    guard !Thread.isMainThread, try profiles.capture() != nil else { throw IosS3Failure(code: "profile_missing") }
    let journal = profiles.journal, sources = try IosS3Sources.capture(journal: profiles.journal)
    guard let captured = try profiles.capture() else { throw IosS3Failure(code: "profile_missing") }
    func check() throws {
      guard !cancelled(), try profiles.current(captured) else { throw IosS3Failure(code: "context_changed") }
      try sources.check(journal: journal)
    }
    for source in sources.files {
      try check()
      for file in try IosSourceScanner().scanDirectory(bookmark: source.bookmark) {
        try check()
        if let copying, !copying.matches(source: source.id, reference: file.reference) { continue }
        let prepared = try snapshots.prepare(sourceId: source.id, bookmark: source.bookmark, file: file, cancelled: { (try? check()) == nil })
        let id = String(prepared.snapshot.dropLast(9)), installation = try journal.installation()
        let job = IosS3Job(id: id, installation: installation, context: captured.context, target: captured.profile.target,
          source: source.id.lowercased(), reference: file.reference, revision: file.revision + ":" + prepared.wireSourceId,
          sourceGeneration: sources.binding, snapshot: prepared.snapshot, key: "objects/" + installation + "/" + id,
          sha256: prepared.sha256, size: prepared.size, name: prepared.name, logicalPath: file.relativePath)
        func sourceCurrent() throws -> Bool {
          try check()
          try IosFilesSource.read(bookmark: source.bookmark, file: file, cancelled: { (try? check()) == nil }) { _, _, wire in
            guard wire == prepared.wireSourceId else { throw IosS3Failure(code: "source_changed") }
          }
          try check(); return true
        }
        func completedSource() throws {
          try check(); try snapshots.validateSource(bookmark: source.bookmark, file: file, sha256: prepared.sha256,
            size: prepared.size, wireSourceId: prepared.wireSourceId, cancelled: { (try? check()) == nil }); try check()
        }
        var retained = false
        defer { if !retained { try? snapshots.discard(prepared.snapshot) } }
        if copying == nil, let known = try journal.known(job) {
          let download = try IosS3Download(profiles: profiles, snapshots: snapshots, check: check)
          let stage = try download.stage(known.id); defer { try? snapshots.discard(stage) }
          try completedSource(); try completed(known); continue
        }
        guard try copying != nil || !journal.unresolved(job) else { throw IosS3Failure(code: "review_required") }
        let descriptor = try snapshots.open(prepared.snapshot, sha256: prepared.sha256, size: prepared.size, cancelled: { (try? check()) == nil })
        defer { try? descriptor.close() }
        try journal.insert(job); try copying?.record(job); retained = true
        try IosS3Publisher(profiles: profiles).publish(job, snapshot: descriptor.fileDescriptor, currentSource: sourceCurrent, completedSource: completedSource)
        try check(); try completed(job); try snapshots.discard(prepared.snapshot)
      }
    }
  }
}
#endif
