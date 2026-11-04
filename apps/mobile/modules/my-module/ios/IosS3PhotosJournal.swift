#if KLODA_S3_NATIVE
import Foundation
import SQLite3

struct IosS3PhotoImport: Codable, Equatable {
  let key: String
  let manifest: Data
  var target: String? = nil
  var state = "prepared"
  var errorCode: String? = nil
  func validate() throws {
    _ = try IosS3PhotoManifestCodec.decode(manifest)
    guard !key.isEmpty, key.utf8.count <= 4096, !key.utf8.contains(0),
      ["prepared", "creating", "completed", "review_required", "organization_review"].contains(state),
      target == nil || (!target!.isEmpty && target!.utf8.count <= 4096 && !target!.utf8.contains(0)),
      state != "completed" || target != nil, state != "prepared" || target == nil else { throw IosS3Failure(code: "outcome_unknown") }
  }
}

// Separate typed S3 import receipts. Source IDs are never PhotoKit target IDs or PC operation IDs.
final class IosS3PhotosJournal {
  let database: IosSyncJournal
  let target: String
  let provider: String
  let commit: (@escaping () throws -> Void) throws -> Void
  init(database: IosSyncJournal, target: String, provider: String, commit: @escaping (@escaping () throws -> Void) throws -> Void) throws {
    guard target.range(of: "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z", options: .regularExpression) != nil else { throw IosS3Failure(code: "invalid_request") }
    self.database = database; self.target = target; self.provider = provider; self.commit = commit
    try execute("CREATE TABLE IF NOT EXISTS s3_photo_import (key TEXT PRIMARY KEY NOT NULL,manifest TEXT NOT NULL,target TEXT,state TEXT NOT NULL CHECK(state IN ('prepared','creating','completed','review_required','organization_review')),error_code TEXT)")
    try execute("CREATE TABLE IF NOT EXISTS s3_photo_album (key TEXT PRIMARY KEY NOT NULL,target TEXT,state TEXT NOT NULL CHECK(state IN ('creating','completed','review_required')))")
    try execute("""
      CREATE TRIGGER IF NOT EXISTS immutable_s3_photo_import BEFORE UPDATE ON s3_photo_import
      WHEN NEW.key IS NOT OLD.key OR NEW.manifest IS NOT OLD.manifest OR (OLD.target IS NOT NULL AND NEW.target IS NOT OLD.target)
        OR (OLD.state!='prepared' AND NEW.state='prepared') BEGIN SELECT RAISE(ABORT,'binding'); END
      """)
    try execute("CREATE TRIGGER IF NOT EXISTS immutable_s3_photo_album BEFORE UPDATE ON s3_photo_album WHEN NEW.key IS NOT OLD.key OR (OLD.target IS NOT NULL AND NEW.target IS NOT OLD.target) BEGIN SELECT RAISE(ABORT,'binding'); END")
    for table in ["s3_photo_import", "s3_photo_album"] {
      try execute("CREATE TRIGGER IF NOT EXISTS retain_\(table) BEFORE DELETE ON \(table) BEGIN SELECT RAISE(ABORT,'retained'); END")
    }
  }
  func execute(_ sql: String, values: [Any] = []) throws { try database.execute(sql, values: values) }
  func photoKey(_ values: [String]) throws -> String { try IosSyncJournal.photoKey([target] + values) }
  func photoText(_ sql: String, _ values: [Any]) throws -> String? { try database.photoText(sql, values) }
  func photoImport(_ key: String) throws -> IosS3PhotoImport? {
    try database.statement("SELECT manifest,target,state,error_code FROM s3_photo_import WHERE key=?", values: [key]) { row in
      let step = sqlite3_step(row)
      if step == SQLITE_DONE { return nil }
      guard step == SQLITE_ROW, let encoded = sqlite3_column_text(row, 0), let data = Data(base64Encoded: String(cString: encoded)), let state = sqlite3_column_text(row, 2) else { throw IosS3Failure(code: "outcome_unknown") }
      let value = IosS3PhotoImport(key: key, manifest: data, target: sqlite3_column_text(row, 1).map { String(cString: $0) }, state: String(cString: state), errorCode: sqlite3_column_text(row, 3).map { String(cString: $0) })
      try validate(value); return value
    }
  }
  private func validate(_ value: IosS3PhotoImport) throws {
    try value.validate()
    let manifest = try IosS3PhotoManifestCodec.decode(value.manifest)
    guard try value.key == photoKey([manifest.sourceDeviceId, manifest.assetId]) else { throw IosS3Failure(code: "outcome_unknown") }
  }
  func savePhotoImport(_ value: IosS3PhotoImport) throws {
    try validate(value)
    let write = {
      try self.execute("INSERT INTO s3_photo_import(key,manifest,target,state,error_code) VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET manifest=excluded.manifest,target=excluded.target,state=excluded.state,error_code=excluded.error_code",
        values: [value.key, value.manifest.base64EncodedString(), value.target as Any? ?? NSNull(), value.state, value.errorCode as Any? ?? NSNull()])
    }
    if value.state == "completed" { try commit(write) } else { try write() }
  }
}

#endif
