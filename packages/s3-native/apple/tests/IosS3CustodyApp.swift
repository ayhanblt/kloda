import UIKit
import Security

@main final class S3CustodyApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  func require(_ condition: @autoclosure () throws -> Bool) throws { if try !condition() { throw IosS3Failure(code: "fixture_assertion") } }
  func identity(_ provider: String) -> [String: Any] {
    [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:Bundle.main.bundleIdentifier! + ".s3." + provider + ".native.v1",
      kSecAttrAccount as String:"profile",kSecAttrSynchronizable as String:false]
  }
  func profiles(_ provider: String) throws -> IosS3Profiles { IosS3Profiles(journal: try IosS3Journal(url: root.appendingPathComponent(provider + ".sqlite"), provider: provider)) }
  func target(_ provider: String) -> IosS3Target {
    IosS3Target(provider: provider, endpoint: provider == "amazon-s3" ? "https://s3.us-east-1.amazonaws.com" : "https://127.0.0.1:9443",region:"us-east-1",
      bucket:"owned-bucket",prefix:"owned",pathStyle:provider != "amazon-s3",accountBinding:IosS3Target.hash(Data("fixture-key".utf8)),
      profileGeneration:UUID().uuidString.lowercased(),credentialGeneration:UUID().uuidString.lowercased())
  }
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    DispatchQueue.global().async {
      var result:[String:Any] = ["mode":self.mode,"sourceHash":Bundle.main.object(forInfoDictionaryKey:"KLODAFixtureSourceHash") as! String,"status":"PASS"]
      do { try self.execute() } catch { result["status"] = "FAIL"; result["code"] = (error as? IosS3Failure)?.code ?? "fixture_error" }
      try? JSONSerialization.data(withJSONObject:result).write(to:self.root.appendingPathComponent(self.mode + "-result.json"),options:.atomic)
    }
    return true
  }
  func execute() throws {
    try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
    try require(Bundle.main.bundleIdentifier!.hasPrefix("com.kloda.fixture.s3custody17."))
    let amazon = try profiles("amazon-s3"), compatible = try profiles("s3-compatible")
    switch mode {
    case "seed":
      try amazon.save(target("amazon-s3"),accessKey:"fixture-key",secret:"fixture-secret1",token:nil,check:{})
      let previous = try amazon.capture()!
      try compatible.save(target("s3-compatible"),accessKey:"fixture-key",secret:"fixture-secret-p5",token:nil,check:{})
      try amazon.save(target("amazon-s3"),accessKey:"fixture-key",secret:"fixture-secret2",token:"fixture-token",check:{})
      try require(try !amazon.current(previous))
      let capture = try amazon.capture()!
      try require(capture.profile.secret == "fixture-secret2" && capture.profile.token == "fixture-token")
      try require(try compatible.capture()!.profile.secret == "fixture-secret-p5")
      try JSONSerialization.data(withJSONObject:["context":capture.context,"generation":capture.profile.target.credentialGeneration]).write(to:root.appendingPathComponent("expected.json"),options:.atomic)
      var query = identity("amazon-s3"); query[kSecReturnAttributes as String] = true
      var item:CFTypeRef?; try require(SecItemCopyMatching(query as CFDictionary,&item) == errSecSuccess)
      let attrs = item as! [String:Any]; try require(attrs[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)
    case "reopen":
      let expected = try JSONSerialization.jsonObject(with:Data(contentsOf:root.appendingPathComponent("expected.json"))) as! [String:String]
      let capture = try amazon.capture()!; try require(capture.context == expected["context"] && capture.profile.target.credentialGeneration == expected["generation"])
      try require(capture.profile.secret == "fixture-secret2" && capture.profile.token == "fixture-token")
    case "tamper":
      let context = try amazon.journal.context()
      try require(SecItemUpdate(identity("amazon-s3") as CFDictionary,[kSecValueData as String:Data("corrupt-owned-profile".utf8)] as CFDictionary) == errSecSuccess)
      do { _ = try amazon.capture(); throw IosS3Failure(code:"accepted_tampered") } catch let error as IosS3Failure { try require(error.code == "storage_failure") }
      do { try amazon.save(target("amazon-s3"),accessKey:"fixture-key",secret:"replacement",token:nil,check:{}); throw IosS3Failure(code:"overwrote_tampered") }
      catch let error as IosS3Failure { try require(error.code == "storage_failure") }
      try require(try amazon.journal.context() == context)
      try require(try compatible.capture()!.profile.secret == "fixture-secret-p5")
    case "missing":
      try require(SecItemDelete(identity("amazon-s3") as CFDictionary) == errSecSuccess)
      do { _ = try amazon.capture(); throw IosS3Failure(code:"accepted_missing") } catch let error as IosS3Failure { try require(error.code == "storage_failure") }
    case "cleanup":
      for provider in ["amazon-s3","s3-compatible"] {
        let query = identity(provider)
        if provider == "s3-compatible" { try require(try IosS3Vault.read(provider)?.secret == "fixture-secret-p5") }
        let status = SecItemDelete(query as CFDictionary); try require(status == errSecSuccess || status == errSecItemNotFound)
        var item:CFTypeRef?; try require(SecItemCopyMatching(query as CFDictionary,&item) == errSecItemNotFound)
      }
    default: throw IosS3Failure(code:"invalid_mode")
    }
  }
}
