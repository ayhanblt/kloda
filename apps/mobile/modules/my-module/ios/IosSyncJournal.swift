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

  init(databaseURL: URL? = nil) throws {
    let databasePath: String
    if let databaseURL {
      guard databaseURL.isFileURL else { throw journalError("storage_failure") }
      databasePath = databaseURL.path
    } else {
      let applicationSupport = try FileManager.default.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      try FileManager.default.createDirectory(at: applicationSupport, withIntermediateDirectories: true)
      databasePath = applicationSupport.appendingPathComponent("kloda-sync.sqlite").path
    }
    guard sqlite3_open_v2(databasePath, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      sqlite3_close(database)
      database = nil
      throw journalError("Could not open the sync journal.")
    }
    do {
      guard sqlite3_busy_timeout(database, 1500) == SQLITE_OK else { throw journalError("storage_failure") }
      try statement("PRAGMA journal_mode=WAL") { statement in
        guard sqlite3_step(statement) == SQLITE_ROW,
          let mode = sqlite3_column_text(statement, 0), String(cString: mode) == "wal",
          sqlite3_step(statement) == SQLITE_DONE else { throw journalError("storage_failure") }
      }
      try execute("PRAGMA synchronous=FULL")
      try execute("PRAGMA foreign_keys=ON")
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
      try createFilesJobs()
      try createRestoreIntents()
      try createFilesRuns()
      try createPhotos()
      try createAutomatic()
      try createAutomaticPlan()
    } catch {
      sqlite3_close(database)
      database = nil
      throw error
    }
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

  func execute(_ sql: String, values: [Any] = []) throws {
    try statement(sql, values: values) { statement in
      guard sqlite3_step(statement) == SQLITE_DONE else { throw journalError(sqliteMessage(database)) }
    }
  }

  func statement<T>(_ sql: String, values: [Any] = [], body: (OpaquePointer) throws -> T) throws -> T {
    guard let database else { throw journalError("The sync journal is closed.") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
      throw journalError(sqliteMessage(database))
    }
    guard let statement else { throw journalError("storage_failure") }
    defer { sqlite3_finalize(statement) }
    for (index, value) in values.enumerated() {
      let parameter = Int32(index + 1)
      let result: Int32
      if let string = value as? String {
        guard string.utf8.count <= Int(Int32.max) else { throw journalError("storage_failure") }
        result = sqlite3_bind_text(statement, parameter, string, Int32(string.utf8.count), sqliteTransient)
      } else if let integer = value as? Int64 {
        result = sqlite3_bind_int64(statement, parameter, integer)
      } else if value is NSNull {
        result = sqlite3_bind_null(statement, parameter)
      } else {
        throw journalError("Unsupported sync journal value.")
      }
      guard result == SQLITE_OK else { throw journalError("storage_failure") }
    }
    return try body(statement)
  }

  private func sqliteMessage(_ database: OpaquePointer?) -> String {
    String(cString: sqlite3_errmsg(database))
  }

  func journalError(_ message: String) -> NSError {
    NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
