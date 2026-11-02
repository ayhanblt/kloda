#if KLODA_SMB_NATIVE
import Foundation

// Native selected Files only. UI/automatic dispatch remains disabled until acceptance.
final class IosSmbFiles {
  let profiles: IosSmbProfiles
  let snapshots: IosFilesSnapshot
  let track: (IosSmbUpload) throws -> Void
  init(profiles: IosSmbProfiles, snapshots: IosFilesSnapshot, track: @escaping (IosSmbUpload) throws -> Void = { _ in }) throws {
    guard snapshots.isSmb else { throw IosSmbFailure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.track = track
  }
  func run(cancelled: @escaping () -> Bool) throws { _ = try execute(original: nil, request: nil, cancelled: cancelled) }
  func keepBoth(_ original: String, request: UUID, cancelled: @escaping () -> Bool) throws -> IosSmbUpload {
    guard let result = try execute(original: original, request: request, cancelled: cancelled) else { throw IosSmbFailure(code: "source_unavailable") }
    return result
  }
  private func execute(original: String?, request: UUID?, cancelled: @escaping () -> Bool) throws -> IosSmbUpload? {
    guard !Thread.isMainThread else { throw IosSmbFailure(code: "worker_required") }
    let installation = try profiles.journal.installation()
    let sources = try IosSmbSources.capture(journal: profiles.journal)
    guard let captured = try profiles.capture() else { throw IosSmbFailure(code: "profile_missing") }
    let check = {
      guard !cancelled(), try self.profiles.current(captured) else { throw IosSmbFailure(code: "context_changed") }
      try sources.check(journal: self.profiles.journal)
    }
    let copies = try IosSmbCopyRequests(journal: profiles.journal)
    let review = try original.map { try profiles.journal.reviewJob(id: $0, target: captured.profile.target) }
    if let review, review.kind != "file" { throw IosSmbFailure(code: "manifest_invalid") }
    if let original, let request, let prior = try copies.result(request: request, original: original, target: captured.profile.target) {
      try check()
      let download = try IosSmbDownload(profiles: profiles, snapshots: snapshots, check: check)
      let staged = try download.stage(prior.id); try snapshots.discard(staged); try check(); return prior
    }
    let publisher = IosSmbPublisher(profiles: profiles, snapshots: snapshots, check: check)
    for source in sources.files where review == nil || review?.source == source.id {
      try check()
      for file in try IosSourceScanner().scanDirectory(bookmark: source.bookmark) {
        if let review, review.reference != file.reference { continue }
        try check()
        let prepared = try snapshots.prepare(sourceId: source.id, bookmark: source.bookmark, file: file,
          cancelled: { (try? check()) == nil })
        let id = String(prepared.snapshot.dropLast(9))
        let base = source.id + "/files/" + prepared.sha256 + "/" + file.relativePath
        let path = try review == nil ? base : IosSmbCopyRequests.path(base, hash: prepared.sha256, id: id)
        let job = IosSmbUpload(id: id, installation: installation, target: captured.profile.target,
          context: captured.context, source: source.id, reference: file.reference, revision: file.revision + ":" + prepared.wireSourceId,
          relativePath: path, snapshot: prepared.snapshot, sha256: prepared.sha256,
          size: prepared.size, kind: "file", asset: nil, name: prepared.name, logicalPath: file.relativePath)
        if let original, let request { try check(); try copies.reserve(request: request, original: original, job: job) }
        let descriptor = try snapshots.open(prepared.snapshot, sha256: prepared.sha256, size: prepared.size,
          cancelled: { (try? check()) == nil })
        defer { try? descriptor.close() }
        let completed = try publisher.publish(job: job, snapshot: descriptor.fileDescriptor, reuseKnown: review == nil, currentSource: {
          try check()
          try IosFilesSource.read(bookmark: source.bookmark, file: file, cancelled: { (try? check()) == nil }) { _, _, wire in
            guard wire == prepared.wireSourceId else { throw IosSmbFailure(code: "source_changed") }
          }
          try check(); return true
        }, completedSource: {
          try check()
          try self.snapshots.validateSource(bookmark: source.bookmark, file: file, sha256: prepared.sha256,
            size: prepared.size, wireSourceId: prepared.wireSourceId, cancelled: { (try? check()) == nil })
          try check(); return true
        })
        try track(completed)
        if try completed.id != job.id || profiles.journal.state(job).completed { try snapshots.discard(prepared.snapshot) }
        if review != nil { return completed }
      }
    }
    return nil
  }
}
#endif
