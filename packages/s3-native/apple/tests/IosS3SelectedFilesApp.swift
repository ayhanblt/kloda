import UIKit
import UniformTypeIdentifiers
import CryptoKit
import Security

// Real selected directory bookmarks + native S3 pipeline. Only this bundle's generated Files are used.
@main final class S3SelectedFilesApp: UIResponder, UIApplicationDelegate, UIDocumentPickerDelegate {
  var window: UIWindow?
  var selectingSource = true
  let restore = IosS3FilesRestore()
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  var nonce: String { Bundle.main.object(forInfoDictionaryKey: "FixtureNonce") as! String }
  static let payload = Data((0..<4097).map { UInt8($0 % 251) })
  func require(_ value: @autoclosure () throws -> Bool, line: UInt = #line) throws { if try !value() { throw IosS3Failure(code: "fixture_assertion_\(line)") } }
  func report(_ error: Error? = nil, phase: String = "finished", details: [String: Any] = [:]) {
    var value = details; value["mode"] = mode; value["phase"] = phase; value["status"] = error == nil ? "PASS" : "FAIL"
    if let error { value["code"] = (error as? IosS3Failure)?.code ?? (error as? IosPairingFailure)?.code ?? "fixture_error" }
    try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: root.appendingPathComponent(mode + "-result.json"), options: .atomic)
  }
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    setenv("KLODA_S3_FIXTURE_CA_DER", Bundle.main.url(forResource: "owned-ca", withExtension: "der")!.path, 1)
    do {
      try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
      try require(Bundle.main.bundleIdentifier!.hasPrefix("com.kloda.fixture.s3files17."))
      if mode == "seed" {
        for name in ["Source", "Restore"] { try FileManager.default.createDirectory(at: root.appendingPathComponent(name), withIntermediateDirectories: false) }
        try Self.payload.write(to: root.appendingPathComponent("Source/owned.bin"), options: .withoutOverwriting)
        DispatchQueue.main.async { self.pick() }
      } else { DispatchQueue.global().async { self.execute() } }
    } catch { report(error) }
    return true
  }
  func pick() {
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
    picker.delegate = self; picker.directoryURL = root.appendingPathComponent(selectingSource ? "Source" : "Restore")
    report(phase: selectingSource ? "select-source" : "select-restore"); window!.rootViewController!.present(picker, animated: true)
  }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { report(IosS3Failure(code: "fixture_picker_cancelled")) }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    do {
      guard let url = urls.first else { throw IosS3Failure(code: "fixture_no_selection") }
      let expected = root.appendingPathComponent(selectingSource ? "Source" : "Restore")
      try require(url.resolvingSymlinksInPath().standardizedFileURL == expected.resolvingSymlinksInPath().standardizedFileURL)
      try require(url.startAccessingSecurityScopedResource()); defer { url.stopAccessingSecurityScopedResource() }
      let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil).base64EncodedString()
      if selectingSource {
        try require(Data(contentsOf: url.appendingPathComponent("owned.bin")) == Self.payload)
        try IosWebDavContext.mutate { UserDefaults.standard.set([["id": self.nonce, "kind": "directory", "displayName": "Owned S3 Files", "reference": bookmark]], forKey: "kloda.sync.directorySources") }
        selectingSource = false; controller.dismiss(animated: false) { self.pick() }
      } else { UserDefaults.standard.set(bookmark, forKey: "fixture.restoreBookmark"); DispatchQueue.global().async { self.execute() } }
    } catch { report(error) }
  }
  func execute() {
    do {
      let journal = try IosS3Journal(url: root.appendingPathComponent("s3.sqlite"), provider: "s3-compatible"), profiles = IosS3Profiles(journal: journal)
      if mode == "cleanup" {
        if let profile = try IosS3Vault.read("s3-compatible") { try require(profile.accessKey == "kloda17fixture") }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1",
          kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
        let deleted = SecItemDelete(query as CFDictionary); try require(deleted == errSecSuccess || deleted == errSecItemNotFound)
        var item: CFTypeRef?; try require(SecItemCopyMatching(query as CFDictionary, &item) == errSecItemNotFound); report(); return
      }
      if mode == "seed" {
        let generation = UUID().uuidString.lowercased()
        let target = IosS3Target(provider: "s3-compatible", endpoint: Bundle.main.object(forInfoDictionaryKey: "NativeWireEndpoint") as! String,
          region: "us-east-1", bucket: "kloda17-native", prefix: "selected/" + nonce, pathStyle: true, accountBinding: IosS3Target.hash(Data("kloda17fixture".utf8)),
          profileGeneration: generation, credentialGeneration: generation)
        try profiles.save(target, accessKey: "kloda17fixture", secret: "synthetic-only-kloda17-fixture", token: nil, check: {})
        try journal.setEnabled(true)
      }
      try require(IosFilesSelection.current().count == 1); try require((UserDefaults.standard.array(forKey: "kloda.sync.photoSources") ?? []).isEmpty)
      let snapshots = try IosFilesSnapshot.s3("s3-compatible"), files = try IosS3Files(profiles: profiles, snapshots: snapshots)
      var tracked: [IosS3Job] = []
      try files.run(cancelled: { false }, completed: { tracked.append($0) }); try require(tracked.count == 1)
      let job = tracked[0]; try require(try journal.state(job) == "completed" && job.size == Int64(Self.payload.count))
      try require(try journal.receipt(job.id, target: profiles.capture()!.profile.target) == job)
      if mode == "seed" { try files.run(cancelled: { false }, completed: { tracked.append($0) }); try require(tracked.count == 2 && tracked[1].id == job.id); UserDefaults.standard.set(job.id, forKey: "fixture.job") }
      else { try require(UserDefaults.standard.string(forKey: "fixture.job") == job.id) }
      guard let bookmark = UserDefaults.standard.string(forKey: "fixture.restoreBookmark") else { throw IosS3Failure(code: "fixture_restore_missing") }
      try restoreOnce(job.id, bookmark: bookmark, profiles: profiles)
      let output = root.appendingPathComponent("Restore/owned.bin"); try require(Data(contentsOf: output) == Self.payload)
      let before = try FileManager.default.attributesOfItem(atPath: output.path)
      try restoreOnce(job.id, bookmark: bookmark, profiles: profiles)
      let after = try FileManager.default.attributesOfItem(atPath: output.path)
      try require((before[.systemFileNumber] as? NSNumber) == (after[.systemFileNumber] as? NSNumber))
      try require(FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("Restore").path) == ["owned.bin"])
      report(details: ["job": job.id, "bytes": job.size, "unchangedReuse": true, "restoreRepeatSameInode": true, "sourcePicker": true, "restorePicker": true, "photosOperations": 0])
    } catch { report(error) }
  }
  func restoreOnce(_ id: String, bookmark: String, profiles: IosS3Profiles) throws {
    let ready = DispatchSemaphore(value: 0); var result: Result<[String: Any], Error>?
    restore.restore(id: id, destination: bookmark, profiles: profiles, ticket: UUID(), visible: { true }) { value in result = value; ready.signal() }
    try require(ready.wait(timeout: .now() + 35) == .success)
    guard let result else { throw IosS3Failure(code: "fixture_restore_timeout") }; _ = try result.get()
  }
}
