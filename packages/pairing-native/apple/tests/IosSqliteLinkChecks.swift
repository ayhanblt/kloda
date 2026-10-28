import Foundation
import SQLite3
import Darwin

// Disposable simulator only; exercises the existing Swift journal with the real Rust ABI linked.
@main struct IosSqliteLinkChecks {
  static func main() throws {
    #if !targetEnvironment(simulator)
    fatalError("Simulator fixture only")
    #endif
    guard CommandLine.arguments.count == 2,
      NSHomeDirectory().hasPrefix(CommandLine.arguments[1]) else { fatalError("Unexpected simulator home") }
    let journal = try IosSyncJournal()
    let rows = [IosQueuedSourceFile(reference: "fixture-only", relativePath: "test.bin", revision: "1", size: 4)]
    let inserted = try journal.replaceSourceFiles(sourceId: "disposable-source", files: rows)
    precondition(inserted == 1)
    try journal.removeSource(sourceId: "disposable-source")
    let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
      appropriateFor: nil, create: false)
    var db: OpaquePointer?
    precondition(sqlite3_open_v2(support.appendingPathComponent("kloda-sync.sqlite").path,
      &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK)
    defer { sqlite3_close(db) }
    var query: OpaquePointer?
    precondition(sqlite3_prepare_v2(db, "SELECT count(*) FROM queued_source_file", -1, &query, nil) == SQLITE_OK)
    defer { sqlite3_finalize(query) }
    precondition(sqlite3_step(query) == SQLITE_ROW && sqlite3_column_int64(query, 0) == 0)
    do {
      _ = try IosPairingNativeCall.consume(kloda_ios_suspend(UInt64.max))
      fatalError("Stale native owner unexpectedly succeeded")
    } catch IosPairingFailure.native(let code) { precondition(code == "candidate_stale") }
    let version = String(cString: sqlite3_libversion())
    var location = Dl_info()
    let symbol = dlsym(dlopen(nil, RTLD_NOW), "sqlite3_open_v2")
    precondition(symbol != nil && dladdr(symbol, &location) != 0)
    let image = String(cString: location.dli_fname)
    print("PASS linked Swift journal insert/remove/readback and real Rust ABI refusal")
    print("SQLITE_VERSION " + version)
    print("SQLITE_IMAGE " + (image.hasSuffix("sqlite-link-checks") ? "fixture-executable" : "system-or-other-image"))
  }
}
