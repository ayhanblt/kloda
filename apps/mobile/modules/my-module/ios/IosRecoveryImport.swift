import Foundation

// ADR0029 §4/§6 (29/3): with the old phone's recovery code, a new device reads the catalog in this destination's folder.
// Every chain (installation/chain/target folder) must start at sequence 1, and each delta must be authentic under the
// code's keys, name its own folder and sequence and the previous delta's hash. The first gap, unreadable or unauthentic
// delta ends that chain; it and every later sequence are counted as unverified and never imported. This installation's
// own catalog is skipped. The code's keys live only for the call; nothing is uploaded or written remotely.
final class IosRecoveryImport {
  struct Summary { var chains = 0; var deltas = 0; var entries = 0; var unverified = 0 }
  static let kinds: Set<String> = ["file", "photo_resource", "photo_manifest"]
  static let identifier = "\\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\z"
  let journal: IosWebDavJournal
  let target: String
  let keys: IosRecoveryCatalog.Keys
  let transport: IosBackupTransport
  let check: () throws -> Void

  init(journal: IosWebDavJournal, target: String, keys: IosRecoveryCatalog.Keys, transport: IosBackupTransport, check: @escaping () throws -> Void) {
    self.journal = journal; self.target = target; self.keys = keys; self.transport = transport; self.check = check
  }

  func run() throws -> Summary {
    let own = try journal.catalogInstallation()
    var summary = Summary()
    try check()
    for installation in try transport.list(".kloda/catalog") where installation.folder && installation.name != own
      && UUID(uuidString: installation.name)?.uuidString.lowercased() == installation.name {
      try check()
      for source in try transport.list(".kloda/catalog/" + installation.name + "/" + keys.chain)
        where source.folder && Self.matches(source.name, Self.identifier) {
        summary.chains += 1
        try chain(installation: installation.name, source: source.name, summary: &summary)
      }
    }
    return summary
  }

  private func chain(installation: String, source: String, summary: inout Summary) throws {
    try check()
    let sequences = Set(try transport.list(IosRecoveryCatalog.folder(installation: installation, chain: keys.chain, target: source))
      .compactMap { child -> Int64? in
        guard !child.folder, Self.matches(child.name, "\\A[1-9][0-9]{0,17}\\.json\\z") else { return nil }
        return Int64(child.name.dropLast(5))
      })
    var sequence: Int64 = 1, previous: String?
    while sequences.contains(sequence) {
      try check()
      guard let bytes = try read(IosRecoveryCatalog.path(installation: installation, chain: keys.chain, target: source, sequence: sequence)),
        let delta = try? IosRecoveryCatalog.decode(bytes, keys: keys), delta.installation == installation, delta.target == source,
        delta.sequence == sequence, delta.previous == previous, delta.entries.allSatisfy(Self.valid) else { break }
      let hash = IosRecoveryCatalog.digest(bytes)
      try check()
      guard try journal.importDelta(target: target, installation: installation, chain: keys.chain, source: source, sequence: sequence,
        sha256: hash, entries: delta.entries) else { break }
      summary.deltas += 1; summary.entries += delta.entries.count
      previous = hash; sequence += 1
    }
    summary.unverified += sequences.filter { $0 >= sequence }.count
  }

  // nil for a file larger than any delta (the client refuses it as `review_required`); other failures propagate.
  private func read(_ path: String) throws -> Data? {
    var data = Data()
    let probe = IosWebDavUpload(id: UUID().uuidString.lowercased(), target: target, binding: "catalog", source: "import", reference: path,
      relativePath: path, revision: "0", snapshot: "", sha256: "", size: Int64(IosRecoveryCatalog.limit))
    do {
      let reply = try transport.download(path, probe) { data.append($0) }
      guard reply.size == Int64(data.count) else { throw IosWebDavFailure.code("outcome_unknown") }
      return data
    } catch IosWebDavFailure.code("review_required") { return nil }
  }

  // A restore later writes to `path` under the destination root: one plain relative path outside `.kloda`.
  static func valid(_ entry: IosRecoveryCatalog.Entry) -> Bool {
    let parts = entry.path.split(separator: "/", omittingEmptySubsequences: false)
    return kinds.contains(entry.kind) && entry.size >= 0 && matches(entry.sha256, identifier) && entry.path.utf8.count <= 4096
      && parts.first != ".kloda" && !entry.path.contains("\\") && parts.allSatisfy { $0 != "" && $0 != "." && $0 != ".." && $0.utf8.count <= 255 }
      && !entry.path.unicodeScalars.contains { $0.value < 32 || (127...159).contains($0.value) }
      && (entry.identity.map { !$0.isEmpty && $0.utf8.count <= 8192 && !$0.utf8.contains(0) } ?? true)
  }
  private static func matches(_ value: String, _ pattern: String) -> Bool { value.range(of: pattern, options: .regularExpression) != nil }
}
