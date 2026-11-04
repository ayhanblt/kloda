#if KLODA_S3_NATIVE
import Foundation
import CryptoKit
import SQLite3

// Shared source generation only; S3 never borrows DAV receipts or target authority.
struct IosS3Sources {
  let binding: String
  let context: String
  let files: [IosFilesSelection]
  static func binding() throws -> String {
    try IosWebDavContext.synchronized {
      let database = try IosWebDavJournal.open().database
      let revision = try database.statement("SELECT revision FROM backup_context WHERE id=1") { row -> String in
        guard sqlite3_step(row) == SQLITE_ROW, let raw = sqlite3_column_text(row, 0),
          UUID(uuidString: String(cString: raw)) != nil else { throw IosS3Failure(code: "storage_failure") }
        return String(cString: raw)
      }
      let data = try JSONSerialization.data(withJSONObject: [revision, IosFilesSelection.binding().base64EncodedString()])
      return Data(SHA256.hash(data: data)).base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
  }
  static func capture(journal: IosS3Journal) throws -> IosS3Sources {
    try IosWebDavContext.synchronized {
      let files = try IosFilesSelection.current()
      guard Set(files.map { $0.id.lowercased() }).count == files.count,
        files.allSatisfy({ UUID(uuidString: $0.id) != nil && !$0.bookmark.isEmpty })
        else { throw IosS3Failure(code: "source_unavailable") }
      let binding = try binding()
      return IosS3Sources(binding: binding, context: try journal.bindSources(binding), files: files)
    }
  }
  func check(journal: IosS3Journal) throws {
    try IosWebDavContext.synchronized {
      guard try Self.binding() == binding, try journal.context() == context else { throw IosS3Failure(code: "context_changed") }
    }
  }
}

#endif
