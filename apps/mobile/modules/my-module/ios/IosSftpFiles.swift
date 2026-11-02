#if KLODA_SFTP_NATIVE
import Foundation

// Native selected Files only. UI/automatic dispatch remains disabled until acceptance.
final class IosSftpFiles {
  let profiles: IosSftpProfiles
  let snapshots: IosFilesSnapshot
  let track: (IosSftpUpload) throws -> Void
  init(profiles: IosSftpProfiles, snapshots: IosFilesSnapshot, track: @escaping (IosSftpUpload) throws -> Void = { _ in }) throws {
    guard snapshots.isSftp else { throw IosSftpFailure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.track = track
  }
  func run(cancelled: @escaping () -> Bool) throws { _ = try execute(original: nil, request: nil, cancelled: cancelled) }
  func keepBoth(_ original: String, request: UUID, cancelled: @escaping () -> Bool) throws -> IosSftpUpload {
    guard let result = try execute(original: original, request: request, cancelled: cancelled) else { throw IosSftpFailure(code: "source_unavailable") }
    return result
  }
  private func execute(original: String?, request: UUID?, cancelled: @escaping () -> Bool) throws -> IosSftpUpload? {
    guard !Thread.isMainThread else { throw IosSftpFailure(code: "worker_required") }
    let installation = try profiles.journal.installation()
    let sources = try IosSftpSources.capture(journal: profiles.journal)
    guard let captured = try profiles.capture() else { throw IosSftpFailure(code: "profile_missing") }
    let check = {
      guard !cancelled(), try self.profiles.current(captured) else { throw IosSftpFailure(code: "context_changed") }
      try sources.check(journal: self.profiles.journal)
    }
    let copies = try IosSftpCopyRequests(journal: profiles.journal)
    let review = try original.map { try profiles.journal.reviewJob(id: $0, target: captured.profile.target) }
    if let review, review.kind != "file" { throw IosSftpFailure(code: "manifest_invalid") }
    if let original, let request, let prior = try copies.result(request: request, original: original, target: captured.profile.target) {
      try check()
      let download = try IosSftpDownload(profiles: profiles, snapshots: snapshots, check: check)
      let staged = try download.stage(prior.id); try snapshots.discard(staged); try check(); return prior
    }
    let publisher = IosSftpPublisher(profiles: profiles, snapshots: snapshots, check: check)
    for source in sources.files where review == nil || review?.source == source.id {
      try check()
      for file in try IosSourceScanner().scanDirectory(bookmark: source.bookmark) {
        if let review, review.reference != file.reference { continue }
        try check()
        let prepared = try snapshots.prepare(sourceId: source.id, bookmark: source.bookmark, file: file,
          cancelled: { (try? check()) == nil })
        let id = String(prepared.snapshot.dropLast(9))
        let base = source.id + "/files/" + prepared.sha256 + "/" + file.relativePath
        let path = try review == nil ? base : IosSftpCopyRequests.path(base, hash: prepared.sha256, id: id)
        let job = IosSftpUpload(id: id, installation: installation, target: captured.profile.target,
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
            guard wire == prepared.wireSourceId else { throw IosSftpFailure(code: "source_changed") }
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
