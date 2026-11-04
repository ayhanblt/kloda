import UIKit
import UniformTypeIdentifiers
import CryptoKit

// Owned Simulator fixture: actual picker bookmarks/native pipeline; no Photos or fabricated receipts.
@main final class FtpsLoopbackFilesApp: UIResponder, UIApplicationDelegate, UIDocumentPickerDelegate {
  var window: UIWindow?
  var selectingSource = true
  let restore = IosFtpsFilesRestore()
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  var nonce: String { Bundle.main.object(forInfoDictionaryKey: "FixtureNonce") as! String }
  static let payload = Data((0..<4097).map { UInt8($0 % 251) })
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController()
    window.makeKeyAndVisible(); self.window = window
    do {
      try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
      try require(Bundle.main.bundleIdentifier?.hasPrefix("com.kloda.fixture.ftps16c.files.") == true)
      try require(mode == "seed" || mode == "reopen")
      if mode == "seed" {
        for name in ["Source", "Restore"] { try FileManager.default.createDirectory(at: root.appendingPathComponent(name), withIntermediateDirectories: false) }
        try Self.payload.write(to: root.appendingPathComponent("Source/owned.bin"), options: .withoutOverwriting)
        DispatchQueue.main.async { self.pick() }
      } else { DispatchQueue.global().async { self.execute() } }
    } catch { report(error: error) }
    return true
  }
  func require(_ condition: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    guard try condition() else { throw IosFtpsFailure(code: "fixture_assertion_\(line)") }
  }
  func report(error: Error? = nil, phase: String = "finished", details: [String: Any] = [:]) {
    var value = details; value["mode"] = mode; value["phase"] = phase
    value["status"] = error == nil ? "PASS" : "FAIL"
    if let error { value["code"] = (error as? IosFtpsFailure)?.code ?? (error as? IosPairingFailure)?.code ?? "fixture_error" }
    do { try JSONSerialization.data(withJSONObject: value, options: .sortedKeys).write(to: root.appendingPathComponent(mode + "-result.json"), options: .atomic) }
    catch { print("Owned fixture result write failed") }
  }
  func pick() {
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
    picker.delegate = self; picker.directoryURL = root.appendingPathComponent(selectingSource ? "Source" : "Restore")
    report(phase: selectingSource ? "select-source" : "select-restore")
    window!.rootViewController!.present(picker, animated: true)
  }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { report(error: IosFtpsFailure(code: "fixture_picker_cancelled")) }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    do {
      guard let url = urls.first else { throw IosFtpsFailure(code: "fixture_no_selection") }
      let expected = root.appendingPathComponent(selectingSource ? "Source" : "Restore")
      try require(url.resolvingSymlinksInPath().standardizedFileURL == expected.resolvingSymlinksInPath().standardizedFileURL)
      try require(url.startAccessingSecurityScopedResource()); defer { url.stopAccessingSecurityScopedResource() }
      let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil).base64EncodedString()
      if selectingSource {
        try require(Data(contentsOf: url.appendingPathComponent("owned.bin")) == Self.payload)
        try IosWebDavContext.mutate { UserDefaults.standard.set([["id": self.nonce, "kind": "directory", "displayName": "Owned Loopback fixture", "reference": bookmark]], forKey: "kloda.sync.directorySources") }
        selectingSource = false
        controller.dismiss(animated: false) { self.pick() }
      } else {
        UserDefaults.standard.set(bookmark, forKey: "fixture.restoreBookmark")
        DispatchQueue.global().async { self.execute() }
      }
    } catch { report(error: error) }
  }
  func execute() {
    do {
      let journal = try IosFtpsQueue.shared.journal(), profiles = IosFtpsProfiles(journal: journal)
      if mode == "seed" {
        try require(try profiles.capture() == nil)
        let secret = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fixture-password")
        let password = try String(contentsOf: secret, encoding: .utf8)
        defer { try? FileManager.default.removeItem(at: secret) }
        _ = try profiles.save(target: IosFtpsTarget(address: "127.0.0.1", port: 27449, hostname: "localhost", root: "/", username: "probe", profileGeneration: "native", credentialGeneration: "native"), password: password)
      }
      try require(IosFilesSelection.current().count == 1)
      try require((UserDefaults.standard.array(forKey: "kloda.sync.photoSources") ?? []).isEmpty)
      let snapshots = try IosFilesSnapshot.ftps()
      var tracked: [IosFtpsUpload] = []
      let files = try IosFtpsFiles(profiles: profiles, snapshots: snapshots, track: { tracked.append($0) })
      try files.run(cancelled: { false })
      try require(tracked.count == 1)
      let job = tracked[0]
      try require(journal.state(job).completed && job.size == Int64(Self.payload.count))
      let target = try profiles.capture()!.profile.target
      try require(target.root == "/" && target.hostname == "localhost")
      let catalog = try journal.catalog(target: target, after: nil)
      try require(catalog.jobs.count == 1 && catalog.jobs[0].id == job.id && catalog.next == nil)
      if mode == "seed" {
        try files.run(cancelled: { false }); try require(tracked.count == 2 && tracked[1].id == job.id)
        UserDefaults.standard.set(job.id, forKey: "fixture.job")
      } else { try require(UserDefaults.standard.string(forKey: "fixture.job") == job.id) }
      guard let destination = UserDefaults.standard.string(forKey: "fixture.restoreBookmark") else { throw IosFtpsFailure(code: "fixture_missing_destination") }
      try restoreOnce(job.id, destination: destination, profiles: profiles)
      let output = root.appendingPathComponent("Restore/owned.bin")
      try require(Data(contentsOf: output) == Self.payload)
      let before = try FileManager.default.attributesOfItem(atPath: output.path)
      try restoreOnce(job.id, destination: destination, profiles: profiles)
      let after = try FileManager.default.attributesOfItem(atPath: output.path)
      try require((before[.systemFileNumber] as? NSNumber) == (after[.systemFileNumber] as? NSNumber))
      try require(FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("Restore").path) == ["owned.bin"])
      let current = try profiles.capture()!
      try require(profiles.current(current))
      report(details: ["job": job.id, "remoteRoot": target.root, "relativePath": job.relativePath, "bytes": job.size, "hash": job.sha256, "catalogCount": catalog.jobs.count, "unchangedReuse": true, "restoreRepeatSameInode": true, "sourcePicker": true, "restorePicker": true, "photosOperations": 0])
    } catch { report(error: error) }
  }
  func restoreOnce(_ id: String, destination: String, profiles: IosFtpsProfiles) throws {
    let ready = DispatchSemaphore(value: 0); var outcome: Result<[String: Any], Error>?
    restore.restore(id: id, destination: destination, profiles: profiles, ticket: UUID(), visible: { true }) { value in outcome = value; ready.signal() }
    try require(ready.wait(timeout: .now() + 35) == .success)
    guard let outcome else { throw IosFtpsFailure(code: "fixture_restore_timeout") }
    let value = try outcome.get(); try require(value["state"] as? String == "completed")
  }
}
