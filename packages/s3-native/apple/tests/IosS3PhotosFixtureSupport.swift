import Foundation
import CryptoKit
import SQLite3
extension IosSyncJournal {
  static func photoKey(_ values: [String]) throws -> String {
    IosS3Target.hashDigest(Data(SHA256.hash(data: try JSONSerialization.data(withJSONObject: values))))
  }
  func photoText(_ sql: String, _ values: [Any]) throws -> String? {
    try statement(sql, values: values) { row in
      let result = sqlite3_step(row)
      if result == SQLITE_DONE { return nil }
      guard result == SQLITE_ROW, sqlite3_column_type(row, 0) == SQLITE_TEXT,
        let text = sqlite3_column_text(row, 0) else { throw journalError("outcome_unknown") }
      return String(cString: text)
    }
  }
}
