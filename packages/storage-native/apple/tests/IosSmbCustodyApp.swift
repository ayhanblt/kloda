import UIKit
import Security

@main final class SmbCustodyApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    DispatchQueue.global().async {
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let mode = CommandLine.arguments.last ?? "missing-mode"
      var result: [String: Any] = ["mode": mode, "sourceHash": Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureSourceHash") as? String ?? ""]
      do { try Self.run(mode, root: root); result["status"] = "PASS" }
      catch { result["status"] = "FAIL"; result["code"] = (error as? IosSmbFailure)?.code ?? "fixture_error" }
      do {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]).write(
          to: root.appendingPathComponent(mode + "-result.json"), options: .atomic)
      } catch { print("Fixture result persistence failed") }
    }
    return true
  }
  static func check(_ value: @autoclosure () throws -> Bool) throws {
    if try !value() { throw IosSmbFailure(code: "fixture_assertion") }
  }
  static func rejects(_ code: String, _ action: () throws -> Void) throws {
    do { try action() } catch let error as IosSmbFailure {
      try check(error.code == code); return
    }
    throw IosSmbFailure(code: "fixture_expected_rejection")
  }
  static func query() throws -> [String: Any] {
    guard let bundle = Bundle.main.bundleIdentifier, bundle.hasPrefix("com.kloda.fixture.smb16.") else {
      throw IosSmbFailure(code: "fixture_identity")
    }
    return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: bundle + ".smb.native.v1",
      kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
  }
  static func run(_ mode: String, root: URL) throws {
    let identity = try query()
    let journal = try IosSmbJournal(databaseURL: root.appendingPathComponent("custody.sqlite"))
    let owner = IosSmbProfiles(journal: journal)
    let target = IosSmbTarget(address: "192.168.1.10", port: 445, share: "owned", root: "backup",
      username: "fixture", domain: "", profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    let oldURL = root.appendingPathComponent("old.json")
    if mode == "seed" {
      try check(IosSmbVault.read() == nil && !journal.hasProfile() && owner.capture() == nil)
      let profile = try owner.save(target: target, password: "fictional-owned-fixture-only")
      guard let captured = try owner.capture() else { throw IosSmbFailure(code: "fixture_capture") }
      try check(captured.profile == profile && owner.current(captured))
      var request = identity
      request[kSecReturnAttributes as String] = true
      var item: CFTypeRef?
      try check(SecItemCopyMatching(request as CFDictionary, &item) == errSecSuccess)
      let attributes = item as? [String: Any]
      try check(attributes?[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)
      try check((attributes?[kSecAttrSynchronizable as String] as? Bool) != true)
      let id = UUID().uuidString.lowercased()
      let job = IosSmbUpload(id: id, installation: "fixture", target: profile.target, context: captured.context,
        source: UUID().uuidString.lowercased(), reference: "owned.bin", revision: "1", relativePath: "owned.bin",
        snapshot: id + ".snapshot", sha256: String(repeating: "A", count: 43), size: 0, kind: "file", asset: nil)
      try journal.insert(job)
      for event in 1...5 { try journal.record(job, event: Int32(event), bytes: 0) }
      try JSONEncoder().encode(job).write(to: oldURL)
    } else if mode == "reopen" {
      let old = try JSONDecoder().decode(IosSmbUpload.self, from: Data(contentsOf: oldURL))
      guard let captured = try owner.capture() else { throw IosSmbFailure(code: "fixture_capture") }
      try check(captured.profile.target == old.target && captured.context == old.context && owner.current(captured))
      let next = try owner.save(target: captured.profile.target, password: "fictional-owned-replacement")
      try check(next.target.profileGeneration != old.target.profileGeneration && next.target.credentialGeneration != old.target.credentialGeneration)
      try check(!owner.current(captured))
      try rejects("context_changed") { try journal.complete(old, current: { true }) }
      try check(!journal.state(old).completed)
      // Model a crash after durable pending but before Keychain replacement.
      try journal.prepareProfile(target)
      try rejects("context_changed") { _ = try owner.capture() }
      try check(IosSmbVault.read() == next)
      _ = try owner.save(target: target, password: "fictional-owned-recovery")
      try check(owner.capture() != nil)
    } else if mode == "tamper" {
      try check(owner.capture() != nil)
      let corrupt = Data("malformed-owned-custody".utf8)
      try check(SecItemUpdate(identity as CFDictionary, [kSecValueData as String: corrupt] as CFDictionary) == errSecSuccess)
      let before = try journal.context()
      try rejects("storage_failure") { _ = try owner.capture() }
      try rejects("storage_failure") { _ = try owner.save(target: target, password: "must-not-overwrite") }
      try check(journal.context() == before)
      var request = identity
      request[kSecReturnData as String] = true
      var item: CFTypeRef?
      try check(SecItemCopyMatching(request as CFDictionary, &item) == errSecSuccess && item as? Data == corrupt)
    } else if mode == "missing" {
      try check(SecItemDelete(identity as CFDictionary) == errSecSuccess)
      let before = try journal.context()
      try check(IosSmbVault.read() == nil && journal.hasProfile())
      try rejects("storage_failure") { _ = try owner.capture() }
      try check(journal.context() == before)
    } else { throw IosSmbFailure(code: "fixture_mode") }
  }
}
