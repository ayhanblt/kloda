import Foundation

// Shared Files/Photos publication; source-specific preparation and validation remain native.
final class IosWebDavPublisher {
  let profile: IosWebDavProfile
  let binding: String
  let journal: IosWebDavJournal
  let snapshots: IosFilesSnapshot
  let transport: IosWebDavTransport
  let check: () throws -> Void
  let settle: (IosWebDavUpload) throws -> Void
  let track: (IosWebDavUpload) throws -> Void
  init(profile: IosWebDavProfile, binding: String, journal: IosWebDavJournal, snapshots: IosFilesSnapshot,
    check: @escaping () throws -> Void, settle: @escaping (IosWebDavUpload) throws -> Void, track: @escaping (IosWebDavUpload) throws -> Void) {
    self.profile = profile; self.binding = binding; self.journal = journal; self.snapshots = snapshots
    self.check = check; self.settle = settle; self.track = track
    transport = IosWebDavTransport(profile: profile, snapshots: snapshots, check: check)
  }
  @discardableResult func publish(source: String, reference: String, path: String, revision: String,
    sha256: String, size: Int64, sourceIdentity: String, kind: String = "file", prepare: () throws -> String, validate: @escaping () throws -> Void) throws -> IosWebDavUpload {
    try check()
    let target = try profile.targetId()
    let rows = try journal.candidates(target: target, source: source, reference: reference)
    let pending = rows.filter { $0.phase != "completed" && !$0.skipped }
    guard pending.count <= 1 else { throw IosWebDavFailure.code("review_required") }
    let job: IosWebDavUpload
    if let old = pending.first {
      guard old.binding == binding, old.sourceIdentity == sourceIdentity, old.relativePath == path, old.sha256 == sha256, old.size == size else {
        if old.issue == nil { try journal.issue(old, code: "settings_changed") }
        throw IosWebDavFailure.code("review_required")
      }
      job = old
    } else if let old = rows.first(where: { $0.relativePath == path && $0.sha256 == sha256 && $0.size == size }) {
      guard old.sourceIdentity == sourceIdentity else { throw IosWebDavFailure.code("source_identity_unknown") }
      guard old.phase == "completed", !old.skipped else { throw IosWebDavFailure.code("review_required") }
      job = old
    } else {
      let snapshot = try prepare()
      do { try check() } catch { try? snapshots.discard(snapshot); throw error }
      job = IosWebDavUpload(id: UUID().uuidString.lowercased(), target: target, binding: binding, source: source,
        reference: reference, relativePath: path, revision: revision, snapshot: snapshot, sha256: sha256, size: size, kind: kind, sourceIdentity: sourceIdentity)
      // Insertion uncertainty must retain bytes for a possibly durable intent.
      try journal.insert(job)
    }
    try track(job)
    do {
      try validate(); try check()
      let sender = IosWebDavPublication(journal: journal, inspect: transport.inspect, upload: transport.upload,
        move: transport.move, check: check, complete: { value in try validate(); try self.settle(value) })
      guard try sender.execute(job.id), let completed = try journal.find(job.id), completed.phase == "completed" else {
        throw IosWebDavFailure.code("review_required")
      }
      try validate(); try check()
      if job.phase != "completed" { try snapshots.discard(job.snapshot) }
      return completed
    } catch {
      let code = IosWebDavFilesRunner.code(error)
      if !["connection_unavailable", "cancelled", "settings_changed", "storage_failure"].contains(code),
        let current = try journal.find(job.id), current.phase != "completed", current.issue == nil { try journal.issue(current, code: code) }
      throw error
    }
  }
}
