import Foundation

private func check(_ value: @autoclosure () throws -> Bool) throws {
  guard try value() else { throw IosSftpFailure(code: "fixture_assertion") }
}
private func rejected(_ action: () throws -> Void) throws {
  do { try action() } catch { return }
  throw IosSftpFailure(code: "fixture_expected_rejection")
}
@main struct PhotosChecks {
  static func main() throws {
    let root = URL(fileURLWithPath: CommandLine.arguments[1])
    let journal = try IosSftpJournal(databaseURL: root.appendingPathComponent("photos.sqlite"))
    let source = "11111111-1111-4111-8111-111111111111"
    let target = IosSftpTarget(address: "192.168.1.10", port: 22, fingerprint: "SHA256:" + String(repeating: "A", count: 43), root: "/owned", username: "owned",
      profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    let golden = try IosSftpPhotoManifestCodec.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))
    try check(IosSftpPhotoManifestCodec.decode(IosSftpPhotoManifestCodec.encode(golden)) == golden)
    let device = try journal.installation()
    let asset = try journal.photoIdentity("asset", "native-owned-fixture")
    try check(asset == journal.photoIdentity("asset", "native-owned-fixture"))
    try check(asset != journal.photoIdentity("album", "native-owned-fixture"))
    let hash = String(repeating: "A", count: 43)
    let resource = IosSftpPhotoResource(relativePath: source + "/media/owned.bin", role: "original", name: "Original ?.png", mimeType: "image/png", sha256: hash, size: 0)
    let manifest = IosSftpPhotoManifest(sourceDeviceId: device, assetId: asset, revision: 1, resources: [resource], albums: [], favorite: false)
    let encoded = try IosSftpPhotoManifestCodec.encode(manifest)
    try check(IosSftpPhotoManifestCodec.decode(encoded) == manifest)
    try rejected { try IosSftpPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal) }
    let id = UUID().uuidString.lowercased()
    let upload = IosSftpUpload(id: id, installation: device, target: target, context: try journal.context(), source: source,
      reference: asset + ":original", revision: hash, relativePath: resource.relativePath, snapshot: id + ".snapshot", sha256: hash,
      size: 0, kind: "photo_resource", asset: asset, name: resource.name, logicalPath: asset + "/original", mimeType: resource.mimeType)
    try journal.insert(upload)
    for event in 1...5 { try journal.record(upload, event: Int32(event), bytes: 0) }
    try rejected { try IosSftpPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal) }
    // Synthetic ACKs test local authority only, never remote backup acceptance.
    try journal.complete(upload, current: { true })
    try IosSftpPhotoManifestCodec.requireReceipts(manifest, target: target, journal: journal)
    let foreign = IosSftpPhotoManifest(sourceDeviceId: "foreign", assetId: asset, revision: 1, resources: [resource], albums: [], favorite: false)
    try rejected { try IosSftpPhotoManifestCodec.requireReceipts(foreign, target: target, journal: journal) }
    for path in ["../escape", source + "/CON.txt", source + "/bad?name", source + "/tail.", source + "/tail ", source + "/a:b", source + "/LPT1.txt"] {
      let row = IosSftpPhotoResource(relativePath: path, role: "original", name: "owned.png", mimeType: "image/png", sha256: hash, size: 0)
      try rejected { _ = try IosSftpPhotoManifestCodec.encode(IosSftpPhotoManifest(sourceDeviceId: device, assetId: asset, revision: 1, resources: [row], albums: [], favorite: nil)) }
    }
    let text = String(data: encoded, encoding: .utf8)!
    for malformed in [text.replacingOccurrences(of: "kloda-sftp-photo", with: "kloda-smb-photo"), text.replacingOccurrences(of: "kloda-sftp-photo", with: "kloda-photo"), text.replacingOccurrences(of: "\"version\":1", with: "\"version\":1,\"version\":1"),
      text.replacingOccurrences(of: "\"size\":\"0\"", with: "\"size\":\"00\""),
      text.replacingOccurrences(of: "\"version\":1", with: "\"version\":1,\"unknown\":true")] {
      try rejected { _ = try IosSftpPhotoManifestCodec.decode(Data(malformed.utf8)) }
    }
    try check(journal.photoRevision(asset: asset, signature: "first") == 1)
    try check(journal.photoRevision(asset: asset, signature: "first") == 1)
    try check(journal.photoRevision(asset: asset, signature: "metadata-only") == 2)
    try check(journal.photoRevision(asset: asset, signature: "first") == 3)
    try journal.database.execute("UPDATE sftp_photo_revision SET revision=9223372036854775807 WHERE asset=?", values: [asset])
    try rejected { _ = try journal.photoRevision(asset: asset, signature: "overflow") }
    let pendingId = UUID().uuidString.lowercased()
    let pending = IosSftpUpload(id: pendingId, installation: device, target: target, context: try journal.context(), source: source,
      reference: "uncertain-create", revision: hash, relativePath: source + "/uncertain.bin", snapshot: pendingId + ".snapshot", sha256: hash,
      size: 0, kind: "file", asset: nil)
    try journal.insert(pending); try journal.markIssue(pending, code: 4)
    try check(journal.unresolved(pending) == pending)
    let copies = try IosSftpCopyRequests(journal: journal), request = UUID(), copyId = UUID().uuidString.lowercased()
    let path = try IosSftpCopyRequests.path(pending.relativePath, hash: hash, id: copyId)
    try check(path.contains(" (Kloda ") && path.hasSuffix(".bin"))
    let copy = IosSftpUpload(id: copyId, installation: device, target: target, context: try journal.context(), source: source,
      reference: pending.reference, revision: hash, relativePath: path, snapshot: copyId + ".snapshot", sha256: hash, size: 0, kind: "file", asset: nil)
    try check(copies.result(request: request, original: pending.id, target: target) == nil)
    try copies.reserve(request: request, original: pending.id, job: copy)
    try rejected { _ = try copies.result(request: request, original: pending.id, target: target) }
    try rejected { try copies.reserve(request: request, original: pending.id, job: copy) }
    try journal.insert(copy)
    for event in 1...5 { try journal.record(copy, event: Int32(event), bytes: 0) }
    try journal.complete(copy, current: { true })
    try check(copies.result(request: request, original: pending.id, target: target) == copy)
    try rejected { _ = try copies.result(request: request, original: copy.id, target: target) }
    try rejected { try journal.database.execute("DELETE FROM sftp_copy_request") }
    try check(journal.state(pending).step == 0 && journal.state(pending).issue == "native_4")
    try journal.createRuns(); try journal.createPlan()
    let run = IosSftpRun(id: UUID().uuidString.lowercased(), target: try target.archiveId(), binding: try journal.context(), automatic: false, occurrence: 1000)
    try journal.saveRun(run); try journal.track(run: run, job: copy)
    try check(journal.runCounts(run.id)["completedOperations"] == "1" && journal.runCounts(run.id)["completedFiles"] == "1")
    let clock: (now: Int64, uptime: Int64, boot: String?) = (1000, 1000, "owned-boot")
    for code in ["native_3", "native_4", "native_5", "review_required"] {
      try check(run.failed(code, clock: clock).phase == "needs_attention")
    }
    let waiting = try run.failed("lan_unavailable", clock: clock)
    try check(waiting.phase == "waiting" && waiting.attempts == 1 && waiting.osAttempts == 1)
    try check(waiting.retried(clock: clock) == nil)
    let retried = try waiting.retried(clock: (waiting.retryAt!, waiting.retryUptime!, clock.boot))!
    try check(retried.attempts == 2 && retried.osAttempts == 1 && retried.phase == "running")
    let os = try run.failed("os_interrupted", clock: clock)
    try check(os.retried(clock: (os.retryAt!, os.retryUptime!, clock.boot))!.osAttempts == 2)
    var done = run; done.phase = "finished"; try journal.saveRun(done)
    try rejected { try journal.saveRun(run) }
    let plan = IosSftpPlan(target: run.target, binding: run.binding, occurrence: 1000, due: 1000)
    try journal.savePlan(plan)
    var claimed = plan; claimed.run = run.id; try journal.savePlan(claimed, expected: plan)
    try rejected { try journal.savePlan(plan, expected: plan) }
    try journal.reviewMismatch(copy)
    try check(journal.issues(target: target).jobs.contains(where: { $0.id == copy.id }))
    try journal.reviewVerified(copy)
    try check(!journal.issues(target: target).jobs.contains(where: { $0.id == copy.id || $0.id == pending.id }))
    var stopped: [Int] = []
    try rejected { try IosAutomaticPause.stop([
      { stopped.append(1); throw IosSftpFailure(code: "storage_failure") },
      { stopped.append(2); throw IosSftpFailure(code: "other_failure") },
      { stopped.append(3) }
    ]) }
    try check(stopped == [1, 2, 3] && IosAutomaticPause.requested)
    IosAutomaticPause.requested = false
    let ui = IosSftpUi(), uiOwner = UUID()
    ui.attach(uiOwner); ui.activate(uiOwner, protected: true)
    try check(ui.interactive(uiOwner) && ui.protectedData)
    let invalidated = DispatchSemaphore(value: 0)
    IosSftpJournal.ownerLock.lock()
    DispatchQueue.global().async { _ = ui.deactivate(uiOwner); invalidated.signal() }
    let delivered = invalidated.wait(timeout: .now() + 1) == .success
    IosSftpJournal.ownerLock.unlock()
    try check(delivered && !ui.interactive(uiOwner))
    let reopened = try IosSftpJournal(databaseURL: root.appendingPathComponent("photos.sqlite"))
    try check(reopened.photoIdentity("asset", "native-owned-fixture") == asset)
    try IosSftpPhotoManifestCodec.requireReceipts(manifest, target: target, journal: reopened)
    print("PASS SFTP Photos codec/golden/strict paths/native own Completed authority/revision/reopen/run-retry/CAS; no media mutation")
  }
}
