#if KLODA_S3_NATIVE
import Foundation
import SQLite3

// New request/new key only. Original unknown result remains immutable Review.
final class IosS3Copy {
  private let profiles: IosS3Profiles
  private let old: IosS3Job
  private let request: String
  private let current: () -> Bool
  private var used = false
  init(profiles: IosS3Profiles, id: String, request: String, current: @escaping () -> Bool) throws {
    self.profiles = profiles; self.request = request; self.current = current
    let journal = profiles.journal
    guard let target = try profiles.capture()?.profile.target else { throw IosS3Failure(code: "profile_missing") }
    old = try journal.receipt(id, target: target, completed: false)
    guard try journal.state(old) == "review", old.kind == nil || old.kind == "file", current() else { throw IosS3Failure(code: "review_required") }
    try journal.database.execute("CREATE TABLE IF NOT EXISTS s3_copy_request(request TEXT PRIMARY KEY,original TEXT NOT NULL REFERENCES s3_job(id),replacement TEXT NOT NULL REFERENCES s3_job(id),target TEXT NOT NULL,context TEXT NOT NULL)")
    for operation in ["UPDATE", "DELETE"] { try journal.database.execute("CREATE TRIGGER IF NOT EXISTS retain_s3_copy_\(operation.lowercased()) BEFORE \(operation) ON s3_copy_request BEGIN SELECT RAISE(ABORT,'retained'); END") }
  }
  func matches(source: String, reference: String) -> Bool { source.lowercased() == old.source && reference == old.reference }
  func record(_ job: IosS3Job) throws {
    guard !used, current(), matches(source: job.source, reference: job.reference), try job.target.archiveId() == old.target.archiveId(),
      job.sha256 == old.sha256, job.size == old.size, job.revision == old.revision, job.kind == nil || job.kind == "file", job.key != old.key else { throw IosS3Failure(code: "source_changed") }
    try profiles.journal.database.execute("INSERT INTO s3_copy_request VALUES(?,?,?,?,?)", values: [request, old.id, job.id, job.target.archiveId(), job.context]); used = true
  }
}
#endif
