#if KLODA_S3_NATIVE
import Foundation
import CryptoKit
import SQLite3

extension IosS3Journal {
  func photoIdentity(_ kind: String, _ locator: String) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: [installation(), kind, locator])
    return Data(SHA256.hash(data: data)).base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  func photoRevision(asset: String, signature: String) throws -> Int64 {
    Self.lock.lock(); defer { Self.lock.unlock() }
    try database.execute("CREATE TABLE IF NOT EXISTS s3_photo_revision(asset TEXT PRIMARY KEY,signature TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0))")
    try database.execute("BEGIN IMMEDIATE")
    do {
      try database.execute("INSERT OR IGNORE INTO s3_photo_revision VALUES(?,?,1)", values: [asset, signature])
      try database.execute("UPDATE s3_photo_revision SET signature=?,revision=revision+1 WHERE asset=? AND signature!=? AND revision<9223372036854775807", values: [signature, asset, signature])
      let revision = try database.statement("SELECT signature,revision FROM s3_photo_revision WHERE asset=?", values: [asset]) { row -> Int64 in
        guard sqlite3_step(row) == SQLITE_ROW, sqlite3_column_type(row, 0) == SQLITE_TEXT,
          let text = sqlite3_column_text(row, 0), String(cString: text) == signature,
          sqlite3_column_type(row, 1) == SQLITE_INTEGER, sqlite3_column_int64(row, 1) > 0 else { throw IosS3Failure(code: "storage_failure") }
        return sqlite3_column_int64(row, 1)
      }
      try database.execute("COMMIT"); return revision
    } catch { try? database.execute("ROLLBACK"); throw error }
  }
}

#endif
