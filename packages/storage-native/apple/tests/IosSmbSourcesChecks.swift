// Real SMB source binding/SQLite; selection metadata is an isolated fixture, not a bookmark grant.
import Foundation

enum IosWebDavContext {
  static func synchronized<T>(_ action: () throws -> T) rethrows -> T {
    IosSmbJournal.ownerLock.lock(); defer { IosSmbJournal.ownerLock.unlock() }; return try action()
  }
}
struct IosFilesSelection {
  let id: String
  let bookmark: String
  static var rows = [IosFilesSelection]()
  static func current() throws -> [IosFilesSelection] { rows }
  static func binding() throws -> Data {
    try JSONSerialization.data(withJSONObject: rows.map { [$0.id, $0.bookmark] })
  }
}
final class IosWebDavJournal {
  let database: IosSyncJournal
  static var fixture: IosWebDavJournal!
  init(_ database: IosSyncJournal) { self.database = database }
  static func open() throws -> IosWebDavJournal { fixture }
}
private func check(_ value: @autoclosure () throws -> Bool) throws {
  if try !value() { throw IosSmbFailure(code: "fixture_assertion") }
}
private func rejected(_ block: () throws -> Void) throws {
  do { try block() } catch { return }
  throw IosSmbFailure(code: "fixture_expected_rejection")
}
@main struct SourcesChecks {
  static func main() throws {
    let root = URL(fileURLWithPath: CommandLine.arguments[2])
    let mode = CommandLine.arguments[1]
    let journal = try IosSmbJournal(databaseURL: root.appendingPathComponent("smb.sqlite"))
    let shared = try IosSyncJournal(databaseURL: root.appendingPathComponent("sources.sqlite"))
    IosWebDavJournal.fixture = IosWebDavJournal(shared)
    let selection = IosFilesSelection(id: "11111111-1111-4111-8111-111111111111", bookmark: "fixture-metadata-only")
    IosFilesSelection.rows = [selection]
    if mode == "seed" {
      try shared.execute("CREATE TABLE backup_context(id INTEGER PRIMARY KEY, revision TEXT NOT NULL)")
      try shared.execute("INSERT INTO backup_context VALUES(1,?)", values: [UUID().uuidString])
      let original = try journal.context()
      let sources = try IosSmbSources.capture(journal: journal)
      try check(original != sources.context && IosSmbSources.capture(journal: journal).context == sources.context)
      let id = UUID().uuidString.lowercased()
      let target = IosSmbTarget(address: "192.168.1.10", port: 445, share: "owned", root: "", username: "owned", domain: "",
        profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
      let job = IosSmbUpload(id: id, installation: UUID().uuidString.lowercased(), target: target, context: sources.context,
        source: selection.id, reference: "owned.bin", revision: "1", relativePath: "owned.bin", snapshot: id + ".snapshot",
        sha256: String(repeating: "A", count: 43), size: 0, kind: "file", asset: nil)
      try journal.insert(job)
      for event in 1...5 { try journal.record(job, event: Int32(event), bytes: 0) }
      try JSONEncoder().encode(job).write(to: root.appendingPathComponent("old.json"))
      // Catalog is local receipt proof only; synthetic ACKs do not claim a remote backup.
      for index in 0..<106 {
        let copyId = UUID().uuidString.lowercased()
        let completed = IosSmbUpload(id: copyId, installation: index == 105 ? "foreign-installation" : try journal.installation(),
          target: target, context: sources.context, source: selection.id, reference: "owned.bin", revision: "1", relativePath: "owned.bin",
          snapshot: copyId + ".snapshot", sha256: String(repeating: "A", count: 43), size: 0, kind: "file", asset: nil)
        try journal.insert(completed)
        for event in 1...5 { try journal.record(completed, event: Int32(event), bytes: 0) }
        try journal.complete(completed, current: { try sources.check(journal: journal); return true })
        if index == 0 { try JSONEncoder().encode(completed).write(to: root.appendingPathComponent("completed.json")) }
      }
      // Same visible selection after remove/readd, but a new durable mutation generation.
      try IosWebDavContext.synchronized {
        try shared.execute("UPDATE backup_context SET revision=?", values: [UUID().uuidString])
        IosFilesSelection.rows = []; IosFilesSelection.rows = [selection]
      }
      try rejected { try sources.check(journal: journal) }
      try rejected { try journal.complete(job, current: { try sources.check(journal: journal); return true }) }
      let fresh = try IosSmbSources.capture(journal: journal)
      try check(fresh.context != sources.context && !journal.state(job).completed)
    } else if mode == "reopen" {
      let old = try JSONDecoder().decode(IosSmbUpload.self, from: Data(contentsOf: root.appendingPathComponent("old.json")))
      let completed = try JSONDecoder().decode(IosSmbUpload.self, from: Data(contentsOf: root.appendingPathComponent("completed.json")))
      var cursor: String?, ids = Set<String>()
      repeat {
        let page = try journal.catalog(target: completed.target, after: cursor)
        try check(page.jobs.count <= 100)
        for item in page.jobs { try check(ids.insert(item.id).inserted) }
        cursor = page.next
      } while cursor != nil
      try check(ids.count == 105 && ids.contains(completed.id))
      try check(journal.ownReceipt(id: completed.id, target: completed.target) == completed)
      let rotated = IosSmbTarget(address: completed.target.address, port: completed.target.port, share: completed.target.share,
        root: completed.target.root, username: completed.target.username, domain: completed.target.domain,
        profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
      try check(journal.ownReceipt(id: completed.id, target: rotated) == completed)
      try rejected { _ = try journal.ownReceipt(id: old.id, target: old.target) }
      try rejected { _ = try journal.catalog(target: completed.target, after: "bad") }
      var before = try journal.context()
      let fresh = try IosSmbSources.capture(journal: journal)
      try check(fresh.context == before && fresh.context != old.context)
      try fresh.check(journal: journal)
      try rejected { try journal.complete(old, current: { true }) }
      IosFilesSelection.rows = []
      try check(IosSmbSources.capture(journal: journal).files.isEmpty)
      before = try journal.context()
      IosFilesSelection.rows = [selection, selection]
      try rejected { _ = try IosSmbSources.capture(journal: journal) }
      try rejected { _ = try journal.bindSources("invalid") }
      try check(journal.context() == before && !journal.state(old).completed)
      try journal.recoverInterrupted()
      try check(journal.context() != before && journal.state(old).issue == "restart_review_required")
      try rejected { try journal.complete(old, current: { true }) }
      try check(journal.ownReceipt(id: completed.id, target: completed.target) == completed)
    } else { throw IosSmbFailure(code: "fixture_mode") }
    print("PASS SMB selected-source generation " + mode + "; no real bookmark/network grant")
  }
}
