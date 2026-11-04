import UIKit
import Security

@main final class S3DiagnosticApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  func require(_ value: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    if try !value() { throw IosS3Failure(code: "fixture_assertion_\(line)") }
  }
  func reject(_ body: () throws -> Void) throws {
    do { try body() } catch { return }
    throw IosS3Failure(code: "fixture_missing_rejection")
  }
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    setenv("KLODA_S3_FIXTURE_CA_DER", Bundle.main.url(forResource: "owned-ca", withExtension: "der")!.path, 1)
    DispatchQueue.global().async { self.execute() }
    return true
  }
  func execute() {
    do {
      try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
      try require(Bundle.main.bundleIdentifier!.hasPrefix("com.kloda.fixture.s3files17."))
      if mode == "cleanup" {
        let service = Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1"
        let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
        try require(status == errSecSuccess || status == errSecItemNotFound)
        try require(IosS3Vault.read("s3-compatible") == nil)
      } else {
        let journal = try IosS3Journal(url: root.appendingPathComponent("profile.sqlite"), provider: "s3-compatible")
        let profiles = IosS3Profiles(journal: journal)
        if mode == "seed" {
          let generation = UUID().uuidString.lowercased()
          let target = IosS3Target(provider: "s3-compatible", endpoint: Bundle.main.object(forInfoDictionaryKey: "NativeWireEndpoint") as! String,
            region: "us-east-1", bucket: "kloda17-native", prefix: "ios-diagnostic-" + generation, pathStyle: true,
            accountBinding: IosS3Target.hash(Data("kloda17fixture".utf8)), profileGeneration: generation, credentialGeneration: generation)
          try profiles.save(target, accessKey: "kloda17fixture", secret: "synthetic-only-kloda17-fixture", token: nil, check: {})
          let captured = try profiles.capture()!, before = try journal.context()
          try require(!journal.enabled())
          // Poison selected-source metadata: the diagnostic must never consult it.
          UserDefaults.standard.set([["id": generation, "reference": "invalid-owned-bookmark"]], forKey: "kloda.sync.directorySources")
          let grant = IosS3TestGrant(), old = UUID()
          try reject { try grant.start(old) }
          grant.activate(protected: false); try reject { try grant.start(old) }
          grant.activate(protected: true); grant.cancel(old); try reject { try grant.start(old) }
          let interrupted = UUID(); try grant.start(interrupted); grant.deactivate(); grant.activate(protected: true)
          try require(!grant.current(interrupted)); grant.finish(interrupted)
          let request = UUID(); try grant.start(request)
          try reject { try grant.start(UUID()) }
          let result = try IosS3Diagnostic.run(profiles: profiles, captured: captured, request: request, root: root, current: { grant.current(request) })
          grant.finish(request); try require(!grant.current(request)); try reject { try grant.start(request) }
          try require(result["state"] as? String == "completed" && result["size"] as? Int == 4097)
          try require(!journal.enabled() && journal.context() == before)
          let test = try IosS3Journal(url: root.appendingPathComponent("kloda-s3-compatible-diagnostic.sqlite"), provider: "s3-compatible")
          let id = result["id"] as! String, job = try test.receipt(id, target: captured.profile.target)
          try require(!test.enabled() && test.state(job) == "completed")
          try reject { _ = try journal.receipt(id, target: captured.profile.target) }
          try reject { _ = try IosS3Diagnostic.run(profiles: profiles, captured: captured, request: request, root: root, current: { true }) }
          try require(!test.enabled())
          try JSONSerialization.data(withJSONObject: result).write(to: root.appendingPathComponent("diagnostic.json"), options: .withoutOverwriting)
        } else {
          try require(mode == "reopen")
          let result = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("diagnostic.json"))) as! [String: Any]
          let captured = try profiles.capture()!
          let test = try IosS3Journal(url: root.appendingPathComponent("kloda-s3-compatible-diagnostic.sqlite"), provider: "s3-compatible")
          let job = try test.receipt(result["id"] as! String, target: captured.profile.target)
          try require(!journal.enabled() && !test.enabled() && test.state(job) == "completed")
          try require(test.events(job, kind: "complete-ack").count == 1)
        }
      }
      try report(["status": "PASS", "phase": "finished", "mode": mode])
    } catch { try? report(["status": "FAIL", "phase": "finished", "mode": mode, "code": (error as? IosS3Failure)?.code ?? "fixture_error"]) }
  }
  func report(_ value: [String: Any]) throws {
    try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: root.appendingPathComponent(mode + "-result.json"), options: .atomic)
  }
}
