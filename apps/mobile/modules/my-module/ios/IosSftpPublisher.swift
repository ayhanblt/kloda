#if KLODA_SFTP_NATIVE
import Foundation

final class IosSftpPublisher {
  let profiles: IosSftpProfiles
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  init(profiles: IosSftpProfiles, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) {
    self.profiles = profiles; self.snapshots = snapshots; self.check = check
  }
  func publish(job: IosSftpUpload, snapshot: Int32, reuseKnown: Bool = true,
    currentSource: @escaping () throws -> Bool, completedSource: @escaping () throws -> Bool) throws -> IosSftpUpload {
    try check()
    guard let captured = try profiles.capture(), try job.installation == profiles.journal.installation(),
      job.context == captured.context, job.target == captured.profile.target else { throw IosSftpFailure(code: "context_changed") }
    if reuseKnown {
      if let known = try profiles.journal.knownCompleted(job) {
        var staged: String?
        defer { if let staged { try? snapshots.discard(staged) } }
        do {
          let download = try IosSftpDownload(profiles: profiles, snapshots: snapshots, check: {
            try self.check(); guard try currentSource() else { throw IosSftpFailure(code: "source_changed") }
          })
          staged = try download.stage(known.id)
          guard try completedSource() else { throw IosSftpFailure(code: "source_changed") }
          try check(); try profiles.journal.reviewVerified(known); return known
        } catch let error as IosSftpFailure { if error.code == "native_7" { try profiles.journal.reviewMismatch(known) }; throw IosSftpFailure(code: error.code, jobId: known.id) }
      }
      if let old = try profiles.journal.unresolved(job) { throw IosSftpFailure(code: "review_required", jobId: old.id) }
    }
    do {
      try profiles.publishLan(job: job, snapshot: snapshot, currentSource: {
        try self.check(); return try currentSource()
      }, completedSource: {
        try self.check(); return try completedSource()
      })
      return job
    } catch let error as IosSftpFailure { throw IosSftpFailure(code: error.code, jobId: job.id) }
  }
}
#endif
