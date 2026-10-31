import Foundation
import SQLite3

// Retained audit only; a live foreground request must also pass its cancellation/context fences.
extension IosWebDavJournal {
  private func reviewAuthorityTable() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS webdav_review_authorization(request TEXT PRIMARY KEY,job TEXT NOT NULL REFERENCES webdav_upload(id),target TEXT NOT NULL,source TEXT NOT NULL,original_binding TEXT NOT NULL,current_binding TEXT NOT NULL)")
    for operation in ["UPDATE", "DELETE"] {
      try database.execute("CREATE TRIGGER IF NOT EXISTS immutable_webdav_review_\(operation.lowercased()) BEFORE \(operation) ON webdav_review_authorization BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }
  func authorizeReview(_ value: IosWebDavUpload, request: UUID, binding: String) throws {
    try reviewAuthorityTable()
    guard !binding.isEmpty, binding.utf8.count <= 8192, !binding.utf8.contains(0),
      let current = try find(value.id), current.binding == value.binding, !current.skipped,
      ["uploaded", "moving", "moved"].contains(current.phase), current.kind != nil, current.sourceIdentity != nil else { throw IosWebDavFailure.code("review_required") }
    try database.execute("INSERT INTO webdav_review_authorization(request,job,target,source,original_binding,current_binding) VALUES(?,?,?,?,?,?)",
      values: [request.uuidString.lowercased(), value.id, value.target, value.source, value.binding, binding])
  }
  func requireReviewAuthority(_ value: IosWebDavUpload, request: UUID, binding: String) throws {
    try reviewAuthorityTable()
    try database.statement("SELECT 1 FROM webdav_review_authorization WHERE request=? AND job=? AND target=? AND source=? AND original_binding=? AND current_binding=?",
      values: [request.uuidString.lowercased(), value.id, value.target, value.source, value.binding, binding]) { row in
      guard sqlite3_step(row) == SQLITE_ROW else { throw IosWebDavFailure.code("settings_changed") }
    }
  }
}
