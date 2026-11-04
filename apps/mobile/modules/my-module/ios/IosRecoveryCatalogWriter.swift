import Foundation

// ADR0029 §3 (29/2): after a run, every Completed receipt of the destination that the current chain does not list yet
// goes into new create-only deltas. The same call is the backfill (first confirmed secret) and the full re-sign
// (regenerated secret = new chain). Each delta follows the upload contract: create-only temp, inspect, no-overwrite
// move, post-commit verification; anything unexpected is kept as an issue and never assumed published.
final class IosRecoveryCatalogWriter {
  private struct Refused: Error { let code: String }
  let journal: IosWebDavJournal
  let target: String
  let keys: IosRecoveryCatalog.Keys
  let transport: IosBackupTransport
  let check: () throws -> Void
  let stage: (Data) throws -> String
  let discard: (String) -> Void

  init(journal: IosWebDavJournal, target: String, keys: IosRecoveryCatalog.Keys, transport: IosBackupTransport,
    check: @escaping () throws -> Void, stage: @escaping (Data) throws -> String, discard: @escaping (String) -> Void) {
    self.journal = journal; self.target = target; self.keys = keys; self.transport = transport
    self.check = check; self.stage = stage; self.discard = discard
  }

  func publish() throws {
    let installation = try journal.catalogInstallation()
    for delta in try journal.pendingCatalog(target: target, chain: keys.chain) { try execute(delta, installation: installation) }
    while true {
      try check()
      let rows = try journal.uncatalogued(target: target, chain: keys.chain)
      if rows.isEmpty { return }
      let head = try journal.catalogHead(target: target, chain: keys.chain)
      let sequence = (head?.sequence ?? 0) + 1
      let count = try IosRecoveryCatalog.fitting(installation: installation, target: target, chain: keys.chain,
        sequence: sequence, previous: head?.sha256, entries: rows)
      let entries = Array(rows.prefix(count))
      let bytes = try IosRecoveryCatalog.encode(keys: keys, installation: installation, target: target, sequence: sequence,
        previous: head?.sha256, entries: entries)
      let delta = IosCatalogDelta(id: UUID().uuidString.lowercased(), target: target, chain: keys.chain, sequence: sequence,
        payload: bytes, sha256: IosRecoveryCatalog.digest(bytes))
      try check()
      try journal.insertCatalog(delta, jobs: entries.map(\.job))
      try execute(delta, installation: installation)
    }
  }

  private func job(_ delta: IosCatalogDelta, installation: String, path: String, snapshot: String = "") -> IosWebDavUpload {
    IosWebDavUpload(id: delta.id, target: delta.target, binding: "catalog", source: installation, reference: path, relativePath: path,
      revision: String(delta.sequence), snapshot: snapshot, sha256: delta.sha256, size: Int64(delta.payload.count))
  }
  private func execute(_ start: IosCatalogDelta, installation: String) throws {
    guard start.issue == nil else { throw IosWebDavFailure.code("outcome_unknown") }
    var delta = start
    let destination = IosRecoveryCatalog.path(installation: installation, chain: delta.chain, target: delta.target, sequence: delta.sequence)
    let temporary = IosRecoveryCatalog.folder(installation: installation, chain: delta.chain, target: delta.target) + "/.kloda-upload-" + delta.id
    let expected = job(delta, installation: installation, path: destination)
    do {
      try check()
      if delta.phase == "prepared" {
        guard try transport.inspect(temporary, expected) == "missing" else { throw Refused(code: "review_required") }
        try check()
        let snapshot = try stage(delta.payload)
        defer { discard(snapshot) }
        try transport.upload(temporary, job(delta, installation: installation, path: destination, snapshot: snapshot))
        delta = try journal.advanceCatalog(delta, phase: "uploaded")
        try check()
      }
      if delta.phase == "uploaded" || delta.phase == "moving" {
        guard try transport.inspect(temporary, expected) == "match" else { throw Refused(code: "review_required") }
        try check()
        guard try transport.inspect(destination, expected) == "missing" else { throw Refused(code: "conflict") }
        try check()
        if delta.phase == "uploaded" { delta = try journal.advanceCatalog(delta, phase: "moving") }
        try transport.move(temporary, destination)
        delta = try journal.advanceCatalog(delta, phase: "moved")
        try check()
      }
      guard delta.phase == "moved", try transport.inspect(destination, expected) == "match" else { throw Refused(code: "review_required") }
      try check()
      _ = try journal.advanceCatalog(delta, phase: "completed")
    } catch let refused as Refused {
      try journal.issueCatalog(delta, code: refused.code)
      throw IosWebDavFailure.code("outcome_unknown")
    }
  }
}
