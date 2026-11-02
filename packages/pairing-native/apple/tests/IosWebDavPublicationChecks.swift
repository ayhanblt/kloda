import Foundation
import CryptoKit

@main struct IosWebDavPublicationChecks {
  static func rejects(_ action: () throws -> Void) {
    do { try action(); fatalError("Unsafe WebDAV transition accepted") } catch {}
  }
  static func main() throws {
    guard CommandLine.arguments.count == 3, ["seed", "reopen"].contains(CommandLine.arguments[1]) else { fatalError("Expected seed/reopen and disposable DB") }
    let url = URL(fileURLWithPath: CommandLine.arguments[2])
    guard url.deletingLastPathComponent().lastPathComponent.hasPrefix("kloda-webdav-") else { fatalError("Disposable path required") }
    let database = try IosSyncJournal(databaseURL: url), journal = try IosWebDavJournal(database: database)
    let target = IosWebDavClient.encode(Data(SHA256.hash(data: Data("fixture-target".utf8)))), source = "11111111-1111-4111-8111-111111111111"
    if CommandLine.arguments[1] == "reopen" {
      let rows = try journal.uploads(target: target)
      precondition(rows.count == 5)
      precondition(rows.filter { $0.phase == "completed" }.count == 1)
      precondition(rows.contains { $0.phase == "moved" && $0.binding == "cancel-after-ack" })
      precondition(rows.contains { $0.phase == "moving" && $0.binding == "lost-move" })
      precondition(rows.contains { $0.phase == "prepared" && $0.binding == "lost-put" })
      let aliasTarget = IosWebDavClient.encode(Data(SHA256.hash(data: Data("owned-copy-target".utf8))))
      let copy = try journal.uploads(target: aliasTarget).first!
      let restored = try journal.restoreIntent(target: aliasTarget, job: copy.id)!
      precondition(restored.state == "completed" && restored.inode == 2 && restored.target == aliasTarget)
      print("PASS fresh-process typed DAV restore receipt retains exact target/job and local publication identity")
      print("PASS fresh-process phases retain lost PUT/MOVE and received ACK; no false completion")
      return
    }
    let originalPlan = IosWebDavPlan(target: target, binding: "owned-plan", occurrence: 1000, due: 2000)
    try journal.savePlan(originalPlan)
    var updatedPlan = originalPlan; updatedPlan.due = 3000
    try journal.savePlan(updatedPlan, expected: originalPlan)
    rejects { try journal.savePlan(originalPlan, expected: originalPlan) }
    let retainedPlan = try journal.plan(target: target); precondition(retainedPlan == updatedPlan)
    print("PASS stale schedule callback cannot overwrite a newer target plan")
    var run = IosWebDavRun(id: UUID().uuidString, target: target, binding: "run-context", automatic: false, occurrence: 1000)
    try journal.saveRun(run)
    for attempt in 1...5 {
      precondition(run.attempts == attempt)
      run = try run.failed("connection_unavailable", clock: (1000, 1000, "boot"))
      try journal.saveRun(run)
      if attempt < 5 {
        precondition(run.phase == "waiting" && run.retryAt == 61000)
        let early = try run.retried(clock: (999999, 60999, "boot")); precondition(early == nil)
        run = try run.retried(clock: (61000, 61000, "boot"))!; try journal.saveRun(run)
      } else { precondition(run.phase == "exhausted") }
    }
    let retainedRun = try journal.run(id: run.id); precondition(retainedRun == run)
    var wrongRun = run; wrongRun.attempts = 1
    rejects { try journal.saveRun(wrongRun) }
    var os = IosWebDavRun(id: UUID().uuidString, target: target, binding: "os-context", automatic: true, occurrence: 1000)
    for attempt in 1...5 {
      os = try os.failed("os_interrupted", clock: (1000, 1000, "boot"))
      if attempt < 5 {
        precondition(os.retryAt == 301000)
        os = try os.retried(clock: (301000, 301000, "boot"))!
      } else { precondition(os.phase == "exhausted" && os.attempts == 1) }
    }
    let waiting = try IosWebDavRun(id: UUID().uuidString, target: target, binding: "clock-context", automatic: true, occurrence: 1000)
      .failed("connection_unavailable", clock: (1000, 1000, "old-boot"))
    let rebooted = try waiting.retried(clock: (900000, 100, "new-boot"))!
    precondition(rebooted.phase == "waiting" && rebooted.retryUptime == 60100 && rebooted.attempts == 1)
    print("PASS independent durable access5/60s, OS5/300s, monotonic/reboot retry and retained run history")
    let profile = IosWebDavProfile(revision: UUID().uuidString, endpoint: "https://fixture.invalid/dav", targetPath: "Kloda", username: "owned", password: "disposable")
    try profile.validate()
    let path = try profile.url(source + "/safe # ü.png")
    precondition(path.absoluteString.contains("%23") && path.host == "fixture.invalid")
    rejects { _ = try profile.url(source + "/../outside") }
    rejects { _ = try profile.url(source + "/..\\outside") }
    let enabledBefore = try journal.enabled(kind: "pc", id: "real-pc")
    precondition(!enabledBefore)
    try journal.setEnabled(kind: "webdav", id: target, enabled: true, revision: "current")
    let independent = try journal.enabled(kind: "pc", id: "real-pc")
    precondition(!independent)
    func row(_ binding: String) -> IosWebDavUpload {
      IosWebDavUpload(id: UUID().uuidString, target: target, binding: binding, source: source,
        reference: source + "/owned.bin", relativePath: source + "/owned.bin", revision: "sha", snapshot: UUID().uuidString.lowercased() + ".snapshot",
        sha256: IosWebDavClient.encode(Data(SHA256.hash(data: Data("owned".utf8)))), size: 5)
    }
    let fixture = URL(fileURLWithPath: ProcessInfo.processInfo.environment["KLODA_WEBDAV_PHOTO_FIXTURE"]!)
    let golden = try Data(contentsOf: fixture)
    let manifest = try IosWebDavPhotoManifestCodec.decode(golden)
    let encoded = try IosWebDavPhotoManifestCodec.encode(manifest)
    let roundtrip = try IosWebDavPhotoManifestCodec.decode(encoded); precondition(roundtrip == manifest)
    rejects { _ = try IosPhotoManifestCodec.decode(encoded) }
    rejects { _ = try IosWebDavPhotoManifestCodec.decode(Data([255])) }
    rejects { _ = try IosWebDavPhotoManifestCodec.decode(Data(repeating: 32, count: 65537)) }
    let text = String(data: encoded, encoding: .utf8)!
    rejects { _ = try IosWebDavPhotoManifestCodec.decode(Data(text.replacingOccurrences(of: "\"format\":", with: "\"format\":\"duplicate\",\"format\":").utf8)) }
    rejects { _ = try IosWebDavPhotoManifestCodec.decode(Data(text.replacingOccurrences(of: "\"revision\":\"1\"", with: "\"revision\":\"01\"").utf8)) }
    rejects { _ = try IosWebDavPhotoManifestCodec.decode(Data(text.replacingOccurrences(of: source + "/owned.bin", with: "../outside").utf8)) }
    rejects { try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal) }
    var remote: [String: String] = [:]
    var lostPut = false, lostMove = false, cancelAfterAck = false
    var current = "normal", checkedAfterMove = false
    let sender = IosWebDavPublication(journal: journal, inspect: { path, _ in remote[path] ?? "missing" }, upload: { path, _ in
      remote[path] = "match"
      if lostPut { throw IosWebDavFailure.code("connection_unavailable") }
    }, move: { from, to in
      remote[from] = nil; remote[to] = "match"; checkedAfterMove = true
      if lostMove { throw IosWebDavFailure.code("connection_unavailable") }
    }, check: {
      if cancelAfterAck && checkedAfterMove { throw IosWebDavFailure.code("settings_changed") }
    }, complete: { try journal.advance($0, phase: "completed") })
    var first = row(current)
    first.kind = "photo_resource"; first.sourceIdentity = "photos:" + manifest.sourceDeviceId + ":" + manifest.assetId + ":" + manifest.resources[0].role
    try journal.insert(first); let verified = try sender.execute(first.id); precondition(verified)
    try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal)
    rejects { try IosWebDavPhotoManifestCodec.requireReceipts(manifest, target: "other-destination", journal: journal) }
    print("PASS shared DAV Photos golden, strict parsing, PC schema separation and local target-bound Completed receipts")
    current = "lost-put"; let put = row(current); try journal.insert(put); remote = [:]; lostPut = true
    rejects { _ = try sender.execute(put.id) }; lostPut = false
    rejects { _ = try sender.execute(put.id) }
    current = "lost-move"; let move = row(current); try journal.insert(move); remote = [:]; lostMove = true
    rejects { _ = try sender.execute(move.id) }; lostMove = false
    let moving = try journal.uploads(target: target).first { $0.id == move.id }!
    rejects { _ = try sender.execute(moving.id) }
    current = "cancel-after-ack"; let changed = row(current); try journal.insert(changed); remote = [:]
    cancelAfterAck = true; checkedAfterMove = false
    rejects { _ = try sender.execute(changed.id) }; cancelAfterAck = false
    current = "foreign-final"; let conflict = row(current); try journal.insert(conflict); remote = [conflict.relativePath: "match"]
    rejects { _ = try sender.execute(conflict.id) }
    try journal.issue(try journal.find(conflict.id)!, code: "conflict", skipped: true)
    let skipped = try sender.execute(conflict.id); precondition(!skipped)
    rejects { try database.execute("UPDATE webdav_upload SET payload='{}' WHERE id=?", values: [first.id]) }
    rejects { try database.execute("DELETE FROM webdav_upload") }
    rejects { try journal.advance(conflict, phase: "completed") }
    let aliasTarget = IosWebDavClient.encode(Data(SHA256.hash(data: Data("owned-copy-target".utf8))))
    let copy = IosWebDavUpload(id: UUID().uuidString.lowercased(), target: aliasTarget, binding: "owned-copy", source: source,
      reference: source + "/copy.bin", relativePath: source + "/copy.bin", revision: "sha", snapshot: UUID().uuidString.lowercased() + ".snapshot",
      sha256: first.sha256, size: first.size, kind: "file", sourceIdentity: "owned-file-fixture")
    try journal.insert(copy); remote = [copy.relativePath: "match"]
    rejects { _ = try sender.execute(copy.id) }
    rejects { try journal.choosePublication(try journal.find(copy.id)!, path: source + "/copy-alias.bin") }
    try journal.issue(try journal.find(copy.id)!, code: "conflict")
    let request = UUID()
    rejects { try journal.authorizeReview(copy, request: request, binding: "") }
    try journal.authorizeReview(copy, request: request, binding: "new-owned-context")
    try journal.requireReviewAuthority(copy, request: request, binding: "new-owned-context")
    rejects { try journal.requireReviewAuthority(copy, request: UUID(), binding: "new-owned-context") }
    rejects { try journal.requireReviewAuthority(copy, request: request, binding: "other-context") }
    rejects { try journal.authorizeReview(copy, request: request, binding: "new-owned-context") }
    rejects { try database.execute("UPDATE webdav_review_authorization SET current_binding='forged'") }
    rejects { try database.execute("DELETE FROM webdav_review_authorization") }
    let retainedCopy = try journal.find(copy.id)!; precondition(retainedCopy.binding == "owned-copy")
    let kept = try sender.review(copy.id, action: "keep_both", validate: { precondition($0.binding == "owned-copy") })
    precondition(kept)
    let alias = try journal.publication(copy)
    precondition(alias.range(of: #" \(Kloda [0-9]{8}-[0-9]{6} "# + String(copy.sha256.prefix(8)) + #" [0-9a-f]{8}\)\.bin$"#, options: .regularExpression) != nil)
    precondition(alias != copy.relativePath && remote[alias] == "match" && remote[copy.relativePath] == "match")
    var restored = IosWebDavRestoreIntent(id: UUID().uuidString.lowercased(), target: copy.target, job: copy.id,
      name: "own.bin", sha256: copy.sha256, size: copy.size, staging: "own.snapshot", offset: copy.size,
      destination: Data("owned-folder-bookmark".utf8).base64EncodedString(), state: "verified")
    try journal.saveRestoreIntent(restored)
    restored.device = 1; restored.inode = 2; restored.state = "completed"
    try journal.saveRestoreIntent(restored)
    let durableRestore = try journal.restoreIntent(target: copy.target, job: copy.id)!
    precondition(durableRestore == restored)
    restored.state = "verified"; rejects { try journal.saveRestoreIntent(restored) }
    rejects { try database.execute("DELETE FROM webdav_restore") }
    restored = durableRestore; restored.target = target; rejects { try journal.saveRestoreIntent(restored) }
    remote[copy.relativePath] = "different"
    let copyVerified = try sender.execute(copy.id); precondition(copyVerified)
    rejects { try journal.choosePublication(try journal.find(copy.id)!, path: source + "/changed.bin") }
    try IosWebDavPublication.withJob(copy.id) { rejects { _ = try sender.execute(copy.id) } }
    let wrongRole = try journal.photoReceipt(target: target, source: source, path: first.relativePath,
      identity: "photos:wrong-device:wrong-asset:original", hash: first.sha256, size: first.size)
    precondition(wrongRole == nil)
    print("PASS keep-both preserves foreign original, durable alias and immutable Completed receipt; per-job concurrency and role identity fences")
    let countTarget = IosWebDavClient.encode(Data(SHA256.hash(data: Data("count-fixture".utf8))))
    let countRun = IosWebDavRun(id: UUID().uuidString, target: countTarget, binding: "counts", automatic: false, occurrence: 1000)
    try journal.saveRun(countRun)
    for revision in 1...2 {
      var item = row("counts")
      item = IosWebDavUpload(id: item.id, target: countTarget, binding: "counts", source: source,
        reference: source + "/manifest-" + String(revision), relativePath: source + "/manifest-" + String(revision), revision: String(revision),
        snapshot: item.snapshot, sha256: item.sha256, size: item.size, kind: "photo_manifest", sourceIdentity: "photos:owned:asset:manifest")
      try journal.insert(item); try journal.track(run: countRun, job: item)
      if revision == 1 {
        for phase in ["uploaded", "moving", "moved", "completed"] { try journal.advance(item, phase: phase); item.phase = phase }
      }
    }
    let counts = try journal.runCounts(countRun.id)
    precondition(counts["photos"] == "1" && counts["completedPhotos"] == "0")
    precondition(counts["operations"] == "2" && counts["completedOperations"] == "1")
    print("PASS latest revision item totals retain every operation and never count an unfinished replacement as completed")
    print("PASS no-overwrite, no hash-only adoption, ACK-before-context fence, immutable journal and independent opt-in")
  }
}
