#if KLODA_SFTP_NATIVE
import Foundation
import SQLite3

enum IosSftpBackups {
  static func list(after: String, issues: Bool = false) throws -> [String: Any] {
    return try IosWebDavContext.synchronized {
    let journal = try IosSftpQueue.shared.journal(); try journal.createReviewEntries()
    guard let target = try IosSftpProfiles(journal: journal).capture()?.profile.target else { throw IosSftpFailure(code: "profile_missing") }
    let page = try issues ? journal.issues(target: target, after: after.isEmpty ? nil : after) : journal.catalog(target: target, after: after.isEmpty ? nil : after)
    let jobs = page.jobs.filter { issues || $0.kind != "photo_resource" }
    var result: [String: Any] = ["targetId": try target.archiveId(), "items": try jobs.map { job -> [String: Any] in
      var row: [String: Any] = ["id": job.id, "name": job.name ?? (job.relativePath as NSString).lastPathComponent,
        "path": job.relativePath, "kind": job.kind, "size": String(job.size), "sha256": job.sha256]
      if issues { row["errorCode"] = try journal.state(job).issue ?? (journal.state(job).completed ? "native_7" : "review_required") }; return row
    }, "hasMore": page.next != nil, "canRestoreFiles": true, "canRestorePhotos": true]
    if let next = page.next { result["next"] = next }; return result
    }
  }
}
#endif
