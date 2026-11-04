#if KLODA_S3_NATIVE
import Foundation
import SQLite3

// Local own receipts only; listing never discovers/adopts remote objects.
enum IosS3Backups {
  static func list(profiles: IosS3Profiles, after: String, issues: Bool) throws -> [String: Any] {
    try IosWebDavContext.synchronized {
      let journal = profiles.journal
      guard let target = try profiles.capture()?.profile.target else { throw IosS3Failure(code: "profile_missing") }
      let archive = try target.archiveId(), installation = try journal.installation(), phase = issues ? "review" : "completed"
      var cursor: Int64 = 0
      if !after.isEmpty {
        guard UUID(uuidString: after)?.uuidString.lowercased() == after else { throw IosS3Failure(code: "invalid_request") }
        cursor = try journal.database.statement("SELECT l.rowid FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.job=? AND l.archive=? AND l.installation=? AND j.state=?", values: [after, archive, installation, phase]) { row in
          guard sqlite3_step(row) == SQLITE_ROW else { throw IosS3Failure(code: "invalid_request") }; return sqlite3_column_int64(row, 0)
        }
      }
      let jobs = try journal.database.statement("SELECT j.header FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.archive=? AND l.installation=? AND j.state=? AND l.rowid>? ORDER BY l.rowid LIMIT 101", values: [archive, installation, phase, cursor]) { row -> [IosS3Job] in
        var jobs: [IosS3Job] = [], step = sqlite3_step(row)
        while step == SQLITE_ROW {
          guard let raw = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "storage_failure") }
          let job = try JSONDecoder().decode(IosS3Job.self, from: Data(String(cString: raw).utf8)); _ = try job.payload(); jobs.append(job); step = sqlite3_step(row)
        }
        guard step == SQLITE_DONE else { throw IosS3Failure(code: "storage_failure") }; return jobs
      }
      let visible = Array(jobs.prefix(100))
      let items: [[String: Any]] = try visible.filter { issues || $0.kind != "photo_resource" }.map { job in
        guard job.installation == installation, try job.target.archiveId() == archive else { throw IosS3Failure(code: "binding_changed") }
        if !issues { _ = try journal.receipt(job.id, target: target) }
        var item: [String: Any] = ["id": job.id, "name": job.name ?? job.id, "path": job.logicalPath ?? job.reference, "kind": job.kind ?? "file", "size": String(job.size), "sha256": job.sha256]
        if issues { item["errorCode"] = "review_required" }; return item
      }
      var page: [String: Any] = ["targetId": archive, "items": items, "hasMore": jobs.count > 100, "canRestoreFiles": !issues, "canRestorePhotos": !issues]
      if jobs.count > 100 { page["next"] = visible.last!.id }
      return ["provider": journal.provider, "page": page]
    }
  }
}
#endif
