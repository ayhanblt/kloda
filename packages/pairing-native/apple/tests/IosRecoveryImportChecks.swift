import Foundation

// ADR0029 29/3: the typed code, the PROPFIND listing parser and the importer against the deltas the 29/2 writer left in
// the in-memory destination, then tampered copies (altered byte, missing/injected/replayed delta, unsafe path).
enum IosRecoveryImportChecks {
  static func code() throws {
    let secret = Data((0..<32).map { UInt8($0) })
    let shown = IosRecoveryCode.format(secret)
    let parsed = try IosRecoveryCode.parse(shown)
    precondition(parsed == secret, "round trip")
    let loose = " " + shown.lowercased().replacingOccurrences(of: "-", with: " ").replacingOccurrences(of: "0", with: "o")
      .replacingOccurrences(of: "1", with: "l") + " "
    let relaxed = try IosRecoveryCode.parse(loose)
    precondition(relaxed == secret, "case, spaces and Crockford aliases")
    var wrong = Array(shown); let last = wrong.count - 1
    wrong[last] = wrong[last] == "0" ? "1" : "0"
    for typed in [String(wrong), String(shown.dropLast()), shown + "0", "U" + shown.dropFirst(), ""] {
      IosRecoveryCatalogChecks.fails("recovery_code_invalid") { _ = try IosRecoveryCode.parse(typed) }
    }
    print("PASS recovery code parse: round trip, aliases; check, length and alphabet refused")
  }

  static func listing() throws {
    let folder = URL(string: "https://dav.example/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/")!
    let xml = """
      <?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      <d:response><d:href>/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/abc/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      <d:response><d:href>https://dav.example/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/1.json</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response>
      <d:response><d:href>/remote.php/dav/files/u/Other/x/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      <d:response><d:href>https://evil.example/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/y/</d:href></d:response>
      </d:multistatus>
      """
    let children = try IosWebDavListing.children(Data(xml.utf8), of: folder)
    precondition(children == [IosRemoteChild(name: "abc", folder: true), IosRemoteChild(name: "1.json", folder: false)], "\(children)")
    print("PASS PROPFIND listing: direct children only (self, other folder, other host ignored)")
  }

  static func run(url: URL, origin: IosWebDavJournal, remote: MemoryDestination, old: IosRecoveryCatalog.Keys,
    renewed: IosRecoveryCatalog.Keys, target: String, twin: String) throws {
    try code(); try listing()
    let fresh = IosRecoveryCatalogChecks.sha("new-device-target")
    func journal(_ name: String) throws -> IosWebDavJournal {
      try IosWebDavJournal(database: IosSyncJournal(databaseURL: url.deletingLastPathComponent().appendingPathComponent(name)))
    }
    func importer(_ journal: IosWebDavJournal, _ keys: IosRecoveryCatalog.Keys, _ destination: MemoryDestination) -> IosRecoveryImport {
      IosRecoveryImport(journal: journal, target: fresh, keys: keys, transport: destination, check: {})
    }
    let device = try journal("new-device.sqlite")
    let own = try device.catalogInstallation(), first = try origin.catalogInstallation()
    precondition(own != first, "own installation")
    var result = try importer(device, old, remote).run()
    precondition(result.chains == 2 && result.deltas == 3 && result.entries == 4 && result.unverified == 0, "\(result)")
    let bound = try device.importedCount(target: fresh), other = try device.importedCount(target: target)
    let completed = try device.uncatalogued(target: fresh, chain: old.chain)
    precondition(bound == 4 && other == 0 && completed.isEmpty, "bound to this destination, never a Completed receipt")
    result = try importer(device, old, remote).run()
    let again = try device.importedCount(target: fresh)
    precondition(result.deltas == 3 && again == 4, "re-import adds nothing")
    print("PASS import: both chains of the old code verified into 4 restore-only receipts of this destination; idempotent")

    let renewal = try importer(device, renewed, remote).run()
    let stranger = try importer(device, IosRecoveryCatalog.keys(Data(repeating: 7, count: 32)), remote).run()
    let itself = try importer(origin, old, remote).run()
    precondition(renewal.chains == 1 && renewal.entries == 3, "renewed code reads only its own chain")
    precondition(stranger.chains == 0 && itself.chains == 0, "wrong code finds nothing; own catalog skipped")
    print("PASS renewed code reads its chain only; wrong code finds nothing; own installation skipped")

    let installation = try origin.catalogInstallation()
    let folder = IosRecoveryCatalog.folder(installation: installation, chain: old.chain, target: target)
    func tampered(_ change: (MemoryDestination) throws -> Void) throws -> IosRecoveryImport.Summary {
      let copy = MemoryDestination(); copy.files = remote.files.filter { $0.key.hasPrefix(folder + "/") }
      try change(copy)
      return try importer(try journal("tamper-\(UUID().uuidString).sqlite"), old, copy).run()
    }
    var altered = Array(remote.files[folder + "/2.json"]!); altered[altered.count / 2] ^= 1
    let cases: [(String, (MemoryDestination) throws -> Void, Int, Int)] = [
      ("altered byte", { $0.files[folder + "/2.json"] = Data(altered) }, 1, 1),
      ("missing first delta", { $0.files[folder + "/1.json"] = nil }, 0, 1),
      ("injected delta", { $0.files[folder + "/3.json"] = Data("{}".utf8) }, 2, 1),
      ("replayed delta", { $0.files[folder + "/2.json"] = $0.files[folder + "/1.json"] }, 1, 1),
      ("oversized delta", { $0.files[folder + "/2.json"] = Data(count: IosRecoveryCatalog.limit + 1) }, 1, 1),
      ("authentic unsafe path", { copy in
        let head = IosRecoveryCatalog.digest(copy.files[folder + "/2.json"]!)
        copy.files[folder + "/3.json"] = try IosRecoveryCatalog.encode(keys: old, installation: installation, target: target, sequence: 3,
          previous: head, entries: [.init(job: "", path: "../x", sha256: IosRecoveryCatalogChecks.sha("x"), size: 1, kind: "file",
            identity: nil, completed: nil)])
      }, 2, 1),
    ]
    for (name, change, deltas, unverified) in cases {
      let summary = try tampered(change)
      precondition(summary.deltas == deltas && summary.unverified == unverified, "\(name): \(summary)")
    }
    print("PASS tamper: altered, missing, injected, replayed, oversized and unsafe deltas end the chain and count as unverified")
  }
}
