import CryptoKit
import Foundation

// ADR0029 29/2: shared vectors from tools/recovery-catalog-vectors.py against the production codec, then the
// production journal + writer against an in-memory create-only destination. Keychain custody, the device-lock
// prompt and real DAV/Dropbox transports are runtime checks.
final class MemoryDestination: IosBackupTransport {
  var files: [String: Data] = [:]
  var staged: [String: Data] = [:]
  var failMove: IosWebDavFailure?
  var loseMoveAck = false
  func inspect(_ path: String, _ job: IosWebDavUpload) throws -> String {
    guard let data = files[path] else { return "missing" }
    return IosRecoveryCatalog.digest(data) == job.sha256 && Int64(data.count) == job.size ? "match" : "mismatch"
  }
  func upload(_ path: String, _ job: IosWebDavUpload) throws {
    guard files[path] == nil, let data = staged[job.snapshot] else { throw IosWebDavFailure.code("conflict") }
    files[path] = data
  }
  func move(_ from: String, _ to: String) throws {
    if let failure = failMove { failMove = nil; throw failure }
    guard files[to] == nil, let data = files.removeValue(forKey: from) else { throw IosWebDavFailure.code("conflict") }
    files[to] = data
    if loseMoveAck { loseMoveAck = false; throw IosWebDavFailure.code("connection_unavailable") }
  }
  // Like the clients: a body over the expected size is refused as `review_required`.
  func download(_ path: String, _ job: IosWebDavUpload, receive: @escaping (Data) throws -> Void) throws -> IosWebDavReply {
    guard let data = files[path] else { throw IosWebDavFailure.code("not_found") }
    guard Int64(data.count) <= job.size else { throw IosWebDavFailure.code("review_required") }
    try receive(data)
    return IosWebDavReply(size: Int64(data.count), sha256: IosRecoveryCatalog.digest(data))
  }
  func list(_ folder: String) throws -> [IosRemoteChild] {
    var seen: [String: Bool] = [:]
    for key in files.keys where key.hasPrefix(folder + "/") {
      let rest = key.dropFirst(folder.count + 1).split(separator: "/", maxSplits: 1)
      seen[String(rest[0])] = (seen[String(rest[0])] ?? false) || rest.count > 1
    }
    return seen.map { IosRemoteChild(name: $0.key, folder: $0.value) }
  }
}

@main struct IosRecoveryCatalogChecks {
  static func b64(_ data: Data) -> String { IosRecoveryCatalog.base64url(data) }
  static func sha(_ text: String) -> String { b64(Data(SHA256.hash(data: Data(text.utf8)))) }
  static func fails(_ code: String, _ action: () throws -> Void) {
    do { try action(); fatalError("expected \(code)") } catch IosWebDavFailure.code(let observed) {
      precondition(observed == code, "expected \(code), observed \(observed)")
    } catch { fatalError("expected \(code), observed \(error)") }
  }

  static func vectors() throws {
    let keys = IosRecoveryCatalog.keys(Data((0..<32).map { UInt8($0) }))
    precondition(keys.chain == "c6d1c4897cde441fdbd14d1f1b4e6f75", "chain")
    let installation = "00000000-0000-4000-8000-000000000001", target = sha("fixture-target")
    let source = "11111111-1111-4111-8111-111111111111"
    let entries = [
      IosRecoveryCatalog.Entry(job: "a", path: source + "/Belgeler/Fotoğraf \"ü\".jpg", sha256: sha("one"), size: 3, kind: "file",
        identity: "files:a\tb", completed: 1762128000123),
      IosRecoveryCatalog.Entry(job: "b", path: source + "/photos/x.json", sha256: sha("two"), size: 0, kind: "photo_manifest",
        identity: nil, completed: nil)]
    let first = try IosRecoveryCatalog.encode(keys: keys, installation: installation, target: target, sequence: 1, previous: nil, entries: entries)
    precondition(first.count == 650 && IosRecoveryCatalog.digest(first) == "opP5n9sO-AqIaqgYO4UXJzrRqm2E96TSyw06bbbEBMA", "first delta")
    let fit = try IosRecoveryCatalog.fitting(installation: installation, target: target, chain: keys.chain, sequence: 1, previous: nil, entries: entries)
    precondition(fit == 2, "fitting")
    let second = try IosRecoveryCatalog.encode(keys: keys, installation: installation, target: target, sequence: 2,
      previous: IosRecoveryCatalog.digest(first), entries: [])
    precondition(second.count == 299 && IosRecoveryCatalog.digest(second) == "ofj1ltRYQrBnegLcb3bGF4Dhv0SQ6UV_Hgw19EREYsM", "second delta")
    print("PASS ios catalog vectors (chain, canonical bytes, HMAC, previous hash)")
  }

  static func completed(_ journal: IosWebDavJournal, target: String, source: String, name: String, phase: String = "completed") throws -> IosWebDavUpload {
    var job = IosWebDavUpload(id: UUID().uuidString.lowercased(), target: target, binding: "b", source: source, reference: name,
      relativePath: source + "/" + name, revision: "1", snapshot: UUID().uuidString.lowercased() + ".snapshot",
      sha256: sha(name), size: Int64(name.utf8.count), kind: "file", sourceIdentity: "files:" + name)
    try journal.insert(job)
    for next in ["uploaded", "moving", "moved", "completed"] {
      if job.phase == phase { break }
      try journal.advance(job, phase: next); job.phase = next
    }
    return job
  }
  static func json(_ data: Data) -> [String: Any] { try! JSONSerialization.jsonObject(with: data) as! [String: Any] }

  static func main() throws {
    try vectors()
    guard CommandLine.arguments.count == 2 else { fatalError("Expected disposable DB path") }
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    guard url.deletingLastPathComponent().lastPathComponent.hasPrefix("kloda-catalog-") else { fatalError("Disposable path required") }
    let journal = try IosWebDavJournal(database: IosSyncJournal(databaseURL: url))
    let installation = try journal.catalogInstallation()
    let target = sha("catalog-target"), source = "22222222-2222-4222-8222-222222222222"
    let old = IosRecoveryCatalog.keys(Data((0..<32).map { UInt8($0) }))
    let remote = MemoryDestination()
    var counter = 0
    func writer(_ keys: IosRecoveryCatalog.Keys, _ target: String, _ destination: MemoryDestination) -> IosRecoveryCatalogWriter {
      IosRecoveryCatalogWriter(journal: journal, target: target, keys: keys, transport: destination, check: {}, stage: { bytes in
        counter += 1; let name = "stage-\(counter)"; destination.staged[name] = bytes; return name
      }, discard: { destination.staged.removeValue(forKey: $0) })
    }
    let a = try completed(journal, target: target, source: source, name: "a.txt")
    let b = try completed(journal, target: target, source: source, name: "b.txt")
    _ = try completed(journal, target: target, source: source, name: "pending.txt", phase: "moved")
    try writer(old, target, remote).publish()
    let folder = IosRecoveryCatalog.folder(installation: installation, chain: old.chain, target: target)
    let first = remote.files[folder + "/1.json"]!
    precondition(remote.files.count == 1 && remote.staged.isEmpty, "only the delta, staging discarded")
    let firstEntries = json(first)["entries"] as! [[String: Any]]
    precondition(firstEntries.map { $0["path"] as! String } == [a.relativePath, b.relativePath], "backfill lists completed receipts only")
    precondition(firstEntries.allSatisfy { $0["completed"] is NSNumber }, "completion time recorded")
    try writer(old, target, remote).publish()
    precondition(remote.files.count == 1, "nothing new, no second delta")
    print("PASS backfill: one create-only delta of the Completed receipts, idempotent")

    let c = try completed(journal, target: target, source: source, name: "c.txt")
    remote.failMove = .code("connection_unavailable")
    fails("connection_unavailable") { try writer(old, target, remote).publish() }
    precondition(remote.files[folder + "/2.json"] == nil, "interrupted before move")
    try writer(old, target, remote).publish()
    let second = json(remote.files[folder + "/2.json"]!)
    precondition(second["previous"] as? String == IosRecoveryCatalog.digest(first) && second["sequence"] as? Int == 2, "chain")
    precondition((second["entries"] as! [[String: Any]]).map { $0["path"] as! String } == [c.relativePath])
    precondition(!remote.files.keys.contains { $0.contains(".kloda-upload-") }, "temp consumed by the move")
    print("PASS chain: delta 2 names delta 1's hash; an interrupted move resumes from the journal")

    let lost = sha("lost-ack-target"), lostRemote = MemoryDestination()
    _ = try completed(journal, target: lost, source: source, name: "x.txt")
    lostRemote.loseMoveAck = true
    fails("connection_unavailable") { try writer(old, lost, lostRemote).publish() }
    fails("outcome_unknown") { try writer(old, lost, lostRemote).publish() }
    fails("outcome_unknown") { try writer(old, lost, lostRemote).publish() }
    print("PASS lost move ACK stays unknown (issue kept, never assumed published)")

    let clash = sha("conflict-target"), clashRemote = MemoryDestination()
    _ = try completed(journal, target: clash, source: source, name: "y.txt")
    let foreign = Data("foreign".utf8)
    let clashPath = IosRecoveryCatalog.path(installation: installation, chain: old.chain, target: clash, sequence: 1)
    clashRemote.files[clashPath] = foreign
    fails("outcome_unknown") { try writer(old, clash, clashRemote).publish() }
    precondition(clashRemote.files[clashPath] == foreign, "existing file never replaced")
    print("PASS existing delta path is a conflict; nothing overwritten")

    let twin = sha("twin-target")
    _ = try completed(journal, target: twin, source: source, name: "a.txt")
    try writer(old, twin, remote).publish()
    precondition(remote.files[IosRecoveryCatalog.path(installation: installation, chain: old.chain, target: twin, sequence: 1)] != nil
      && remote.files.count == 3, "own folder")
    print("PASS two destinations sharing one remote folder keep separate chains")

    let renewed = IosRecoveryCatalog.keys(Data(repeating: 0xff, count: 32))
    precondition(renewed.chain != old.chain)
    let before = remote.files
    try writer(renewed, target, remote).publish()
    let fresh = json(remote.files[IosRecoveryCatalog.path(installation: installation, chain: renewed.chain, target: target, sequence: 1)]!)
    precondition(fresh["previous"] is NSNull && (fresh["entries"] as! [[String: Any]]).count == 3, "full re-sign under the new chain")
    precondition(before.allSatisfy { remote.files[$0.key] == $0.value } && remote.files.count == before.count + 1, "old chain untouched")
    print("PASS regeneration: every Completed receipt catalogued again in a new chain; old deltas kept")

    let bulk = sha("bulk-target"), bulkRemote = MemoryDestination()
    for index in 0..<300 { _ = try completed(journal, target: bulk, source: source, name: String(repeating: "n", count: 200) + "\(index).bin") }
    try writer(old, bulk, bulkRemote).publish()
    var listed = 0, previous: String?
    for sequence in 1...bulkRemote.files.count {
      let data = bulkRemote.files[IosRecoveryCatalog.path(installation: installation, chain: old.chain, target: bulk, sequence: Int64(sequence))]!
      precondition(data.count <= IosRecoveryCatalog.limit && json(data)["previous"] as? String == previous, "bounded, chained")
      listed += (json(data)["entries"] as! [Any]).count; previous = IosRecoveryCatalog.digest(data)
    }
    precondition(bulkRemote.files.count > 1 && listed == 300, "split and complete")
    print("PASS bulk backfill split into \(bulkRemote.files.count) chained deltas of at most 64 KiB")
    try IosRecoveryImportChecks.run(url: url, origin: journal, remote: remote, old: old, renewed: renewed, target: target, twin: twin)
    try IosRecoveryRestoreChecks.run(url: url, origin: journal, remote: remote, old: old, target: target, source: source)
  }
}
