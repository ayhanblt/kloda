import Foundation
import CryptoKit
import SQLite3

struct IosPhotoImport: Codable, Equatable {
  let key: String
  let manifest: Data
  var target: String? = nil
  var state = "prepared"
  var errorCode: String? = nil
  func validate() throws {
    _ = try IosPhotoManifestCodec.decode(manifest)
    guard !key.isEmpty, key.utf8.count <= 4096, !key.utf8.contains(0),
      ["prepared", "creating", "completed", "review_required", "organization_review"].contains(state),
      target == nil || (!target!.isEmpty && target!.utf8.count <= 4096 && !target!.utf8.contains(0)),
      state != "completed" || target != nil,
      state != "prepared" || target == nil else {
      throw NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: "outcome_unknown"])
    }
  }
}

extension IosSyncJournal {
  func createPhotos() throws {
    try execute("CREATE TABLE IF NOT EXISTS photos_identity (kind TEXT NOT NULL, locator TEXT NOT NULL, id TEXT NOT NULL UNIQUE, PRIMARY KEY(kind,locator))")
    try execute("CREATE TABLE IF NOT EXISTS photos_revision (asset TEXT PRIMARY KEY NOT NULL, signature TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0))")
    try execute("CREATE TABLE IF NOT EXISTS photos_import (key TEXT PRIMARY KEY NOT NULL, manifest TEXT NOT NULL, target TEXT, state TEXT NOT NULL CHECK(state IN ('prepared','creating','completed','review_required','organization_review')), error_code TEXT)")
    try execute("CREATE TABLE IF NOT EXISTS photos_album (key TEXT PRIMARY KEY NOT NULL, target TEXT, state TEXT NOT NULL CHECK(state IN ('creating','completed','review_required')))")
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_photos_import BEFORE UPDATE ON photos_import
      WHEN NEW.key IS NOT OLD.key OR NEW.manifest IS NOT OLD.manifest
        OR (OLD.target IS NOT NULL AND NEW.target IS NOT OLD.target)
        OR (OLD.state!='prepared' AND NEW.state='prepared')
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_photos_album BEFORE UPDATE ON photos_album
      WHEN NEW.key IS NOT OLD.key OR (OLD.target IS NOT NULL AND NEW.target IS NOT OLD.target)
      BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
    for table in ["photos_identity", "photos_import", "photos_album"] {
      try execute("CREATE TRIGGER IF NOT EXISTS retain_\(table) BEFORE DELETE ON \(table) BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }

  // Private native locators never become cross-device PhotoKit identifiers.
  func photoIdentity(_ kind: String, _ locator: String) throws -> String {
    try execute("INSERT OR IGNORE INTO photos_identity(kind,locator,id) VALUES (?,?,?)", values: [kind, locator, IosFilesTransfer.identifier()])
    guard let id = try photoText("SELECT id FROM photos_identity WHERE kind=? AND locator=?", [kind, locator]) else { throw journalError("outcome_unknown") }
    try IosFilesTransfer.fixed(id, bytes: 16); return id
  }

  func photoRevision(asset: String, signature: String) throws -> Int64 {
    try execute("BEGIN IMMEDIATE")
    do {
      try execute("INSERT OR IGNORE INTO photos_revision(asset,signature,revision) VALUES (?,?,1)", values: [asset, signature])
      try execute("UPDATE photos_revision SET signature=?,revision=revision+1 WHERE asset=? AND signature!=? AND revision<9223372036854775807", values: [signature, asset, signature])
      let value: Int64 = try statement("SELECT signature,revision FROM photos_revision WHERE asset=?", values: [asset]) { row in
        guard sqlite3_step(row) == SQLITE_ROW, sqlite3_column_type(row, 0) == SQLITE_TEXT,
          let text = sqlite3_column_text(row, 0), String(cString: text) == signature,
          sqlite3_column_type(row, 1) == SQLITE_INTEGER else { throw journalError("outcome_unknown") }
        return sqlite3_column_int64(row, 1)
      }
      try execute("COMMIT"); return value
    } catch { try? execute("ROLLBACK"); throw error }
  }

  static func photoKey(_ values: [String]) throws -> String {
    IosFilesTransfer.encode(Data(SHA256.hash(data: try JSONSerialization.data(withJSONObject: values))))
  }

  func photoImport(_ key: String) throws -> IosPhotoImport? {
    try statement("SELECT manifest,target,state,error_code FROM photos_import WHERE key=?", values: [key]) { row in
      let result = sqlite3_step(row)
      if result == SQLITE_DONE { return nil }
      guard result == SQLITE_ROW, let encoded = sqlite3_column_text(row, 0),
        let data = Data(base64Encoded: String(cString: encoded)), let state = sqlite3_column_text(row, 2) else { throw journalError("outcome_unknown") }
      _ = try IosPhotoManifestCodec.decode(data)
      let value = IosPhotoImport(key: key, manifest: data, target: sqlite3_column_text(row, 1).map { String(cString: $0) },
        state: String(cString: state), errorCode: sqlite3_column_text(row, 3).map { String(cString: $0) })
      try value.validate(); return value
    }
  }

  func savePhotoImport(_ value: IosPhotoImport) throws {
    try value.validate()
    try execute("""
      INSERT INTO photos_import(key,manifest,target,state,error_code) VALUES (?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET manifest=excluded.manifest,target=excluded.target,state=excluded.state,error_code=excluded.error_code
      """, values: [value.key, value.manifest.base64EncodedString(), value.target as Any? ?? NSNull(), value.state, value.errorCode as Any? ?? NSNull()])
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

  func photoImportStatus() throws -> [String: Any] {
    var total: Int64 = 0, completed: Int64 = 0, review: Int64 = 0
    var hard = false, organization = false
    guard try photoText("SELECT key FROM photos_import WHERE state='completed' AND target IS NULL LIMIT 1", []) == nil else { throw journalError("outcome_unknown") }
    try statement("SELECT CASE WHEN state='prepared' AND error_code IS NOT NULL THEN 'review_required' ELSE state END AS phase,COUNT(*) FROM photos_import GROUP BY phase") { row in
      while true {
        let result = sqlite3_step(row)
        if result == SQLITE_DONE { break }
        guard result == SQLITE_ROW, let text = sqlite3_column_text(row, 0) else { throw journalError("storage_failure") }
        let state = String(cString: text), count = sqlite3_column_int64(row, 1)
        total += count
        if state == "completed" { completed += count }
        if ["creating", "review_required"].contains(state) { review += count; hard = true }
        if state == "organization_review" { review += count; organization = true }
      }
    }
    return ["state": total == 0 ? "idle" : hard ? "review_required" : organization ? "organization_review" : completed == total ? "completed" : "pending",
      "total": String(total), "completed": String(completed), "review": String(review)]
  }
}
