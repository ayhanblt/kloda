import Foundation
import SQLite3

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

struct IosQueuedSourceFile {
  let reference: String
  let relativePath: String
  let revision: String
  let size: Int64
}

final class IosSyncJournal {
  private var database: OpaquePointer?

  init() throws {
    let applicationSupport = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    try FileManager.default.createDirectory(at: applicationSupport, withIntermediateDirectories: true)
    let databasePath = applicationSupport.appendingPathComponent("kloda-sync.sqlite").path
    guard sqlite3_open_v2(databasePath, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      throw journalError("Could not open the sync journal.")
    }
    try execute("""
      CREATE TABLE IF NOT EXISTS queued_source_file (
        source_id TEXT NOT NULL,
        reference TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        revision TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL,
        PRIMARY KEY (source_id, reference)
      )
      """)
  }

  deinit { sqlite3_close(database) }

  func replaceSourceFiles(sourceId: String, files: [IosQueuedSourceFile]) throws -> Int {
    try execute("BEGIN IMMEDIATE")
    do {
      try execute("DELETE FROM queued_source_file WHERE source_id = ?", values: [sourceId])
      for file in files {
        try execute(
          "INSERT INTO queued_source_file (source_id, reference, relative_path, revision, size_bytes, status) VALUES (?, ?, ?, ?, ?, 'queued')",
          values: [sourceId, file.reference, file.relativePath, file.revision, file.size]
        )
      }
      try execute("COMMIT")
      return files.count
    } catch {
      try? execute("ROLLBACK")
      throw error
    }
  }

  func removeSource(sourceId: String) throws {
    try execute("DELETE FROM queued_source_file WHERE source_id = ?", values: [sourceId])
  }

  private func execute(_ sql: String, values: [Any] = []) throws {
    guard let database else { throw journalError("The sync journal is closed.") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
      throw journalError(sqliteMessage(database))
    }
    defer { sqlite3_finalize(statement) }
    for (index, value) in values.enumerated() {
      let parameter = Int32(index + 1)
      if let string = value as? String {
        sqlite3_bind_text(statement, parameter, string, -1, sqliteTransient)
      } else if let integer = value as? Int64 {
        sqlite3_bind_int64(statement, parameter, integer)
      } else {
        throw journalError("Unsupported sync journal value.")
      }
    }
    guard sqlite3_step(statement) == SQLITE_DONE else { throw journalError(sqliteMessage(database)) }
  }

  private func sqliteMessage(_ database: OpaquePointer?) -> String {
    String(cString: sqlite3_errmsg(database))
  }

  private func journalError(_ message: String) -> NSError {
    NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
