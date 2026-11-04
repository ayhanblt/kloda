import UIKit
import Darwin
import Security

@main final class S3WireApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private var started = false
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  func require(_ condition: @autoclosure () throws -> Bool, line: UInt = #line) throws {
    if try !condition() { throw IosS3Failure(code: "fixture_assertion_\(line)") }
  }
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    setenv("KLODA_S3_FIXTURE_CA_DER", Bundle.main.url(forResource: "owned-ca", withExtension: "der")!.path, 1)
    return true
  }
  func applicationDidBecomeActive(_ application: UIApplication) {
    guard !started else { return }; started = true
    DispatchQueue.global().async {
      var result: [String: Any] = ["mode": self.mode, "sourceHash": Bundle.main.object(forInfoDictionaryKey: "KLODAFixtureSourceHash") as! String, "status": "PASS"]
      do { try self.execute() } catch { result["status"] = "FAIL"; result["code"] = (error as? IosS3Failure)?.code ?? "fixture_error" }
      try? JSONSerialization.data(withJSONObject: result).write(to: self.root.appendingPathComponent(self.mode + "-result.json"), options: .atomic)
    }
  }
  func execute() throws {
    try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
    try require(Bundle.main.bundleIdentifier!.hasPrefix("com.kloda.fixture.s3wire17."))
    let journal = try IosS3Journal(url: root.appendingPathComponent("wire.sqlite"), provider: "s3-compatible")
    let profiles = IosS3Profiles(journal: journal)
    if mode == "cleanup" {
      if let profile = try IosS3Vault.read("s3-compatible") { try require(profile.accessKey == "kloda17fixture") }
      let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1", kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
      let deleted = SecItemDelete(query as CFDictionary); try require(deleted == errSecSuccess || deleted == errSecItemNotFound)
      var item: CFTypeRef?; try require(SecItemCopyMatching(query as CFDictionary, &item) == errSecItemNotFound); return
    }
    if mode == "reopen" {
      for (index, phase) in [(0, "completed"), (1, "review")] {
        let job = try JSONDecoder().decode(IosS3Job.self, from: Data(contentsOf: root.appendingPathComponent("job-\(index).json")))
        try require(try journal.state(job) == phase)
      }
      try journal.recoverInterrupted()
      let good = try JSONDecoder().decode(IosS3Job.self, from: Data(contentsOf: root.appendingPathComponent("job-0.json")))
      try require(try journal.state(good) == "completed"); return
    }
    try require(mode == "seed")
    let endpoint = Bundle.main.object(forInfoDictionaryKey: "NativeWireEndpoint") as! String
    let nonce = Bundle.main.object(forInfoDictionaryKey: "FixtureNonce") as! String
    let generation = UUID().uuidString.lowercased()
    let target = IosS3Target(provider: "s3-compatible", endpoint: endpoint, region: "us-east-1", bucket: "kloda17-native", prefix: "owned/" + nonce,
      pathStyle: true, accountBinding: IosS3Target.hash(Data("kloda17fixture".utf8)), profileGeneration: generation, credentialGeneration: generation)
    try profiles.save(target, accessKey: "kloda17fixture", secret: "synthetic-only-kloda17-fixture", token: nil, check: {})
    try journal.setEnabled(true)
    let capture = try profiles.capture()!, installation = try journal.installation()
    let data = Data((0..<4097).map { UInt8($0 % 251) })
    for index in 0...1 {
      let id = UUID().uuidString.lowercased()
      let source = root.appendingPathComponent(id + ".snapshot"); try data.write(to: source, options: .withoutOverwriting)
      let fd = source.path.withCString { Darwin.open($0, O_RDONLY | O_NOFOLLOW) }; try require(fd >= 0); defer { Darwin.close(fd) }
      let job = IosS3Job(id: id, installation: installation, context: capture.context, target: capture.profile.target,
        source: UUID().uuidString.lowercased(), reference: "owned-wire-source-\(index)", revision: "revision1", sourceGeneration: nonce,
        snapshot: id + ".snapshot", key: "objects/" + installation + "/" + id, sha256: IosS3Target.hash(data), size: Int64(data.count))
      try journal.insert(job); try JSONEncoder().encode(job).write(to: root.appendingPathComponent("job-\(index).json"), options: .atomic)
      if index == 0 {
        try IosS3Publisher(profiles: profiles).publish(job, snapshot: fd, currentSource: { UIApplication.shared.applicationState == .active })
        try require(try journal.state(job) == "completed")
        try require(try journal.events(job, kind: "complete-ack").count == 1)
      } else {
        do { try IosS3Publisher(profiles: profiles).publish(job, snapshot: fd, currentSource: { UIApplication.shared.applicationState == .active }); throw IosS3Failure(code: "unknown_completed") }
        catch { try require(try journal.state(job) == "review") }
        try require(try journal.events(job, kind: "complete-ack").isEmpty)
        let readback = try IosS3Client.send(profile: capture.profile, key: job.key, operation: ["kind": "get", "version": NSNull()], maximum: job.size, receive: { _ in }, check: {})
        try require(readback.status == 200 && readback.size == job.size && readback.sha256 == job.sha256)
        try require(try journal.state(job) == "review")
      }
    }
  }
}
