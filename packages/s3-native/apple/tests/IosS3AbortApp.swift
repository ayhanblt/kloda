import UIKit
import Security

@main final class S3AbortApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  func require(_ value: @autoclosure () throws -> Bool, line: UInt = #line) throws { if try !value() { throw IosS3Failure(code: "fixture_assertion_\(line)") } }
  func reject(_ body: () throws -> Void) throws { do { try body() } catch { return }; throw IosS3Failure(code: "fixture_missing_rejection") }
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    setenv("KLODA_S3_FIXTURE_CA_DER", Bundle.main.url(forResource: "owned-ca", withExtension: "der")!.path, 1)
    DispatchQueue.global().async { self.execute() }; return true
  }
  func execute() {
    do {
      try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
      try require(Bundle.main.bundleIdentifier!.hasPrefix("com.kloda.fixture.s3files17."))
      if mode == "cleanup" {
        let service = Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1"
        let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
        try require(status == errSecSuccess || status == errSecItemNotFound); try require(IosS3Vault.read("s3-compatible") == nil)
      } else {
        let journal = try IosS3Journal(url: root.appendingPathComponent("abort.sqlite"), provider: "s3-compatible"), profiles = IosS3Profiles(journal: try IosS3Journal(url: root.appendingPathComponent("abort.sqlite"), provider: "s3-compatible"))
        if mode == "seed" {
          let generation = UUID().uuidString.lowercased()
          let target = IosS3Target(provider: "s3-compatible", endpoint: Bundle.main.object(forInfoDictionaryKey: "NativeWireEndpoint") as! String,
            region: "us-east-1", bucket: "kloda17-native", prefix: "ios-abort-" + generation, pathStyle: true,
            accountBinding: IosS3Target.hash(Data("kloda17fixture".utf8)), profileGeneration: generation, credentialGeneration: generation)
          try profiles.save(target, accessKey: "kloda17fixture", secret: "synthetic-only-kloda17-fixture", token: nil, check: {})
          try journal.setEnabled(true); let capture = try profiles.capture()!, id = UUID().uuidString.lowercased(), installation = try journal.installation()
          let job = IosS3Job(id: id, installation: installation, context: capture.context, target: capture.profile.target, source: UUID().uuidString.lowercased(),
            reference: "owned-abort", revision: "revision", sourceGeneration: "generation", snapshot: id + ".snapshot", key: "objects/" + installation + "/" + id, sha256: IosS3Target.hash(Data()), size: 0)
          try journal.insert(job); try journal.record(job, from: "prepared", to: "creating", current: { true })
          let response = try IosS3Client.send(profile: capture.profile, key: job.key, operation: ["kind": "create", "job": id.replacingOccurrences(of: "-", with: "")], check: {})
          let created = try IosS3Bridge.reply(1, status: response.status, body: String(data: response.body, encoding: .utf8)!, target: job.target, key: job.key)
          try require(created["kind"] as? String == "created"); let upload = created["upload"] as! String
          try journal.record(job, from: "creating", to: "created", payload: ["upload": upload], current: { true })
          try reject { try IosS3Abort.run(profiles: profiles, job: job, current: { false }) }
          try require(journal.state(job) == "created" && journal.events(job, kind: "aborting").isEmpty)
          let parts: [String: Any] = ["kind": "parts", "upload": upload, "marker": 0]
          try require(IosS3Client.send(profile: capture.profile, key: job.key, operation: parts, check: {}).status == 200)
          try IosS3Abort.run(profiles: profiles, job: job, current: { true })
          try require(journal.state(job) == "aborted" && journal.events(job, kind: "aborted").count == 1)
          try require(IosS3Client.send(profile: capture.profile, key: job.key, operation: parts, check: {}).status == 404)
          try reject { try IosS3Abort.run(profiles: profiles, job: job, current: { true }) }
          try Data(job.payload().utf8).write(to: root.appendingPathComponent("job.json"), options: .withoutOverwriting)
        } else {
          try require(mode == "reopen"); let job = try JSONDecoder().decode(IosS3Job.self, from: Data(contentsOf: root.appendingPathComponent("job.json")))
          try require(journal.state(job) == "aborted" && journal.events(job, kind: "aborting").count == 1 && journal.events(job, kind: "complete-ack").isEmpty)
        }
      }
      try report(["status": "PASS", "phase": "finished", "mode": mode])
    } catch { try? report(["status": "FAIL", "phase": "finished", "mode": mode, "code": (error as? IosS3Failure)?.code ?? "fixture_error"]) }
  }
  func report(_ value: [String: Any]) throws {
    try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: root.appendingPathComponent(mode + "-result.json"), options: .atomic)
  }
}
