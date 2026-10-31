import Foundation
import SQLite3

extension IosWebDavJournal {
  func createPublicationPaths() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS webdav_publication(job TEXT PRIMARY KEY REFERENCES webdav_upload(id),path TEXT NOT NULL)")
    for operation in ["INSERT", "UPDATE"] {
      try database.execute("""
        CREATE TRIGGER IF NOT EXISTS scoped_webdav_publication_\(operation.lowercased()) BEFORE \(operation) ON webdav_publication
        WHEN NOT EXISTS(SELECT 1 FROM webdav_upload WHERE id=NEW.job AND phase IN ('uploaded','moving') AND issue='conflict' AND skipped=0)
        BEGIN SELECT RAISE(ABORT,'binding'); END
        """)
    }
    try database.execute("CREATE TRIGGER IF NOT EXISTS retain_webdav_publication BEFORE DELETE ON webdav_publication BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  private func safePublication(_ path: String, _ value: IosWebDavUpload) throws {
    guard path.utf8.count <= 8192, path.hasPrefix(value.source + "/"), !path.contains("\\"),
      !path.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }),
      path.components(separatedBy: "/").allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && $0.utf8.count <= 255 }),
      (path as NSString).deletingLastPathComponent == (value.relativePath as NSString).deletingLastPathComponent else { throw IosWebDavFailure.code("backup_path_rejected") }
  }
  func publication(_ value: IosWebDavUpload) throws -> String {
    try database.statement("SELECT path FROM webdav_publication WHERE job=?", values: [value.id]) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return value.relativePath }
      guard step == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw IosWebDavFailure.code("storage_failure") }
      let path = String(cString: text); try safePublication(path, value); return path
    }
  }
  func choosePublication(_ value: IosWebDavUpload, path: String) throws {
    try safePublication(path, value)
    try database.execute("INSERT INTO webdav_publication(job,path) VALUES(?,?) ON CONFLICT(job) DO UPDATE SET path=excluded.path", values: [value.id, path])
  }
  func clearIssue(_ value: IosWebDavUpload) throws {
    try database.statement("UPDATE webdav_upload SET issue=NULL WHERE id=? AND target=? AND phase=? AND skipped=0 RETURNING id", values: [value.id, value.target, value.phase]) { row in
      guard sqlite3_step(row) == SQLITE_ROW, sqlite3_step(row) == SQLITE_DONE else { throw IosWebDavFailure.code("outcome_unknown") }
    }
  }
}
