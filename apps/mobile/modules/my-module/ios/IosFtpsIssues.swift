#if KLODA_FTPS_NATIVE
import Foundation
import SQLite3
extension IosFtpsJournal {
  func issues(target: IosFtpsTarget, after: String? = nil) throws -> IosFtpsCatalogPage {
    if let after, UUID(uuidString: after)?.uuidString.lowercased() != after { throw IosFtpsFailure(code: "invalid_request") }
    return try database.statement("SELECT header FROM ftps_upload WHERE (completed=0 OR EXISTS(SELECT 1 FROM ftps_review_required r WHERE r.job=ftps_upload.id AND r.resolved=0)) AND NOT EXISTS(SELECT 1 FROM ftps_copy_request c JOIN ftps_upload n ON n.id=c.job WHERE c.original=ftps_upload.id AND n.completed=1 AND n.issue IS NULL) AND id>? ORDER BY id LIMIT 101", values: [after ?? ""]) { row in
      var jobs = [IosFtpsUpload](), cursor: String?, count = 0
      while true {
        let step = sqlite3_step(row)
        if step == SQLITE_DONE { return IosFtpsCatalogPage(jobs: jobs, next: nil) }
        guard step == SQLITE_ROW, let raw = sqlite3_column_text(row, 0) else { throw IosFtpsFailure(code: "storage_failure") }
        if count == 100 { return IosFtpsCatalogPage(jobs: jobs, next: cursor) }
        let header = String(cString: raw), job = try JSONDecoder().decode(IosFtpsUpload.self, from: Data(String(cString: raw).utf8))
        try job.validate(); guard try job.payload() == header else { throw IosFtpsFailure(code: "binding_changed") }
        cursor = job.id; count += 1
        if try job.installation == installation(), job.target.sameArchive(target) { jobs.append(job) }
      }
    }
  }
}

#endif
