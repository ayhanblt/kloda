import UIKit
import Foundation
import CryptoKit
import Darwin

@main final class WebDavChecksApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    // Persist the real automatic pause before registering; no old fixture source may dispatch.
    var startupFailure: Error?
    do { try IosSyncJournal().setAutomaticPaused(true) } catch { startupFailure = error }
    IosWebDavAutomaticCoordinator.shared.register()
    let window = UIWindow(frame: UIScreen.main.bounds)
    let controller = UIViewController(); controller.view.backgroundColor = .systemBackground
    let label = UILabel(frame: controller.view.bounds); label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    label.textAlignment = .center; label.numberOfLines = 0; label.text = "Owned native HTTPS checks"
    controller.view.addSubview(label); window.rootViewController = controller; window.makeKeyAndVisible(); self.window = window
    let reportRoot = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let run = UUID().uuidString.lowercased()
    try? JSONSerialization.data(withJSONObject: ["status": "RUNNING", "run": run,
      "sourceHash": Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureSourceHash") as? String ?? "missing"]).write(to: reportRoot.appendingPathComponent("webdav-result.json"), options: .atomic)
    DispatchQueue.global().async {
      var report: [String: Any]
      do {
        if let startupFailure { throw startupFailure }
        try Self.checks()
        let photos = Bundle.main.object(forInfoDictionaryKey: "KLODAFixturePhotos") as? Bool == true
        if photos { try IosWebDavPhotosAppChecks.run() }
        report = ["status": "PASS", "scope": "actual native core HTTPS/client/snapshot/SQLite/keep-both and DAV verified-download/local-publication component; Expo UI, picker, BG delivery and physical hardware NOT_RUN", "photos": photos ? "PASS owned metadata-only/explicit review" : "NOT_RUN separate keychain experiment required"]
      }
      catch {
        let code: String
        if case IosWebDavFailure.code(let value) = error { code = value }
        else if case IosPairingFailure.native(let value) = error { code = value }
        else { code = (error as NSError).domain + ":" + String((error as NSError).code) }
        report = ["status": "FAIL", "code": code]
      }
      report["run"] = run
      report["sourceHash"] = Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureSourceHash") as? String ?? "missing"
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      do { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]).write(to: root.appendingPathComponent("webdav-result.json"), options: .atomic) }
      catch { print("Fixture result persistence failed") }
      let outcome = report["status"] as? String ?? "FAIL"
      DispatchQueue.main.async { label.text = outcome }
    }
    return true
  }
  static func rejects(_ expected: String, _ action: () throws -> Void) throws {
    do { try action() } catch IosWebDavFailure.code(let code) {
      guard code == expected else { throw IosWebDavFailure.code("expected_" + expected + "_got_" + code) }; return
    }
    throw IosWebDavFailure.code("missing_" + expected)
  }
  static func checks() throws {
    let profile = IosWebDavProfile(revision: UUID().uuidString, endpoint: "https://127.0.0.1:26443/dav",
      targetPath: "ios-" + UUID().uuidString.lowercased(), username: "owned", password: "disposable-https-fixture")
    let journal = try IosWebDavJournal.open(), snapshots = try IosFilesSnapshot.webdav()
    let source = UUID().uuidString.lowercased()
    let bytes = Data((0..<1048576).map { UInt8($0 % 251) })
    let hash = IosWebDavClient.encode(Data(SHA256.hash(data: bytes)))
    func row(_ mode: String) throws -> IosWebDavUpload {
      let (name, file) = try snapshots.createStaging()
      try file.write(contentsOf: bytes); try file.synchronize()
      guard fcntl(file.fileDescriptor, F_FULLFSYNC) == 0 else { throw IosWebDavFailure.code("storage_failure") }
      try file.close()
      let value = try IosWebDavUpload(id: UUID().uuidString.lowercased(), target: profile.targetId(), binding: "owned-ios-fixture",
        source: source, reference: source + "/" + mode + "/payload.bin", relativePath: source + "/" + mode + "/payload.bin",
        revision: hash, snapshot: name, sha256: hash, size: Int64(bytes.count), kind: "file", sourceIdentity: "owned-fixture-source")
      try journal.insert(value); return value
    }
    let transport = IosWebDavTransport(profile: profile, snapshots: snapshots, check: {})
    let sender = IosWebDavPublication(journal: journal, inspect: transport.inspect, upload: transport.upload, move: transport.move,
      check: {}, complete: { try journal.advance($0, phase: "completed") })
    let validation = IosWebDavSourceValidation(journal: journal, snapshots: snapshots, transport: transport, check: {})
    let unselected = try row("unselected-source")
    try rejects("source_changed") { try validation.validate(unselected) }
    let pcMedia = IosPhotoResource(operationId: String(repeating: "A", count: 22), role: "original", name: "owned.png", mimeType: "image/png", sha256: hash, size: Int64(bytes.count))
    let davMedia = IosWebDavPhotoResource(relativePath: source + "/owned.png", role: "original", name: "owned.png", mimeType: "image/png", sha256: hash, size: Int64(bytes.count))
    guard try IosPhotosImportMedia.resourceType(pcMedia, single: true) == .photo,
      try IosPhotosImportMedia.resourceType(davMedia, single: true) == .photo else { throw IosWebDavFailure.code("fixture_media_role") }
    let normal = try row("normal"); guard try sender.execute(normal.id) else { throw IosWebDavFailure.code("normal_not_completed") }
    try IosPhotosImportMedia.verifyStage(snapshots.verifiedURL(normal.snapshot, sha256: hash, size: Int64(bytes.count), check: {}), resource: pcMedia, check: {})
    try IosPhotosImportMedia.verifyStage(snapshots.verifiedURL(normal.snapshot, sha256: hash, size: Int64(bytes.count), check: {}), resource: davMedia, check: {})
    guard try transport.inspect(normal.relativePath, normal) == "match" else { throw IosWebDavFailure.code("normal_bytes") }
    let put = try row("lost-put")
    try rejects("connection_unavailable") { _ = try sender.execute(put.id) }
    guard try journal.find(put.id)?.phase == "prepared" else { throw IosWebDavFailure.code("put_phase") }
    try rejects("review_required") { _ = try sender.execute(put.id) }
    let move = try row("lost-move")
    try rejects("connection_unavailable") { _ = try sender.execute(move.id) }
    guard try journal.find(move.id)?.phase == "moving", try transport.inspect(move.relativePath, move) == "match" else { throw IosWebDavFailure.code("move_phase") }
    try rejects("review_required") { _ = try sender.execute(move.id) }
    let conflict = try row("foreign-final")
    try rejects("conflict") { _ = try sender.execute(conflict.id) }
    try journal.issue(journal.find(conflict.id)!, code: "conflict")
    let kept = try sender.review(conflict.id, action: "keep_both", validate: { value in
      let file = try snapshots.open(value.snapshot, sha256: value.sha256, size: value.size, cancelled: { false }); try file.close()
    })
    let copyPath = try journal.publication(conflict)
    guard kept, copyPath != conflict.relativePath, try transport.inspect(copyPath, conflict) == "match",
      try transport.inspect(conflict.relativePath, conflict) == "match" else { throw IosWebDavFailure.code("keep_both_lost_original") }
    let restore = IosWebDavDownload(journal: journal, profile: profile, snapshots: snapshots, check: {})
    try rejects("review_required") { _ = try restore.stage(move.id) }
    let downloaded = try restore.stage(conflict.id)
    let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("owned-dav-restore-" + UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: false)
    let directory = Darwin.open(output.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
    guard directory >= 0 else { throw IosWebDavFailure.code("fixture_restore_directory") }
    defer { Darwin.close(directory) }
    var intent = IosWebDavRestoreIntent(id: UUID().uuidString.lowercased(), target: conflict.target, job: conflict.id,
      name: "owned.bin", sha256: conflict.sha256, size: conflict.size, staging: downloaded, offset: conflict.size,
      destination: Data("owned-fixture-only-component".utf8).base64EncodedString(), state: "verified")
    try journal.saveRestoreIntent(intent)
    let downloadedFile = try snapshots.open(downloaded, sha256: intent.sha256, size: intent.size, cancelled: { false })
    defer { try? downloadedFile.close() }
    try IosRestoreDestination.publishVerified(&intent, source: downloadedFile, directory: directory, check: {}, save: journal.saveRestoreIntent)
    try IosRestoreDestination.verifyCompleted(intent, directory: directory, check: {})
    guard try journal.restoreIntent(target: conflict.target, job: conflict.id)?.state == "completed" else { throw IosWebDavFailure.code("fixture_restore_receipt") }
    try snapshots.discard(downloaded)
    let scopedImport = try IosWebDavPhotoManifestCodec.encode(IosWebDavPhotoManifest(sourceDeviceId: String(repeating: "A", count: 22), assetId: String(repeating: "A", count: 22), revision: 1,
      resources: [IosWebDavPhotoResource(relativePath: source + "/own.png", role: "original", name: "own.png", mimeType: "image/png", sha256: hash, size: Int64(bytes.count))], albums: [], favorite: false))
    var allowImportCommit = false
    let importJournal = try IosWebDavPhotosJournal(database: journal.database, target: profile.targetId(), commit: { action in
      guard allowImportCommit else { throw IosWebDavFailure.code("cancelled") }; try action()
    })
    var imported = IosWebDavPhotoImport(key: try importJournal.photoKey([String(repeating: "A", count: 22), String(repeating: "A", count: 22)]), manifest: scopedImport)
    try importJournal.savePhotoImport(imported)
    imported.state = "creating"; imported.target = "owned-fixture-target"; try importJournal.savePhotoImport(imported)
    imported.state = "completed"
    try rejects("cancelled") { try importJournal.savePhotoImport(imported) }
    guard try importJournal.photoImport(imported.key)?.state == "creating" else { throw IosWebDavFailure.code("fixture_import_commit_fence") }
    allowImportCommit = true; try importJournal.savePhotoImport(imported)
    guard try importJournal.photoImport(imported.key)?.state == "completed" else { throw IosWebDavFailure.code("fixture_import_journal") }
    let disk = try row("disk-full")
    try rejects("disk_full") { _ = try sender.execute(disk.id) }
    let excess = try row("excess")
    try rejects("review_required") { _ = try sender.execute(excess.id) }
    let auth = IosWebDavProfile(revision: profile.revision, endpoint: profile.endpoint, targetPath: profile.targetPath, username: profile.username, password: "wrong-owned-fixture")
    try rejects("webdav_auth") { _ = try IosWebDavClient.send(profile: auth, path: normal.relativePath, method: "GET", size: normal.size, check: {}) }
    let wrong = IosWebDavProfile(revision: profile.revision, endpoint: "https://127.0.0.1:26445/dav", targetPath: profile.targetPath, username: profile.username, password: profile.password)
    try rejects("connection_unavailable") { _ = try IosWebDavClient.send(profile: wrong, path: normal.relativePath, method: "GET", size: normal.size, check: {}) }
    let ack = try row("ack-body")
    guard try sender.execute(ack.id) else { throw IosWebDavFailure.code("known_ack_not_completed") }
    let redirect = try IosWebDavClient.send(profile: profile, path: source + "/redirect/payload.bin", method: "GET", check: {})
    guard redirect.status == 302 else { throw IosWebDavFailure.code("redirect_followed") }
    var cancelled = false
    let afterAck = try row("cancel-after-ack")
    let fenced = IosWebDavPublication(journal: journal, inspect: transport.inspect, upload: transport.upload,
      move: { from, to in try transport.move(from, to); cancelled = true },
      check: { if cancelled { throw IosWebDavFailure.code("settings_changed") } }, complete: { try journal.advance($0, phase: "completed") })
    try rejects("settings_changed") { _ = try fenced.execute(afterAck.id) }
    guard try journal.find(afterAck.id)?.phase == "moved" else { throw IosWebDavFailure.code("ack_not_retained") }
  }
}
