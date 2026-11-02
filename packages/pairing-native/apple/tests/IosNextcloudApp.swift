import UIKit
import Foundation
import CryptoKit

// Login Flow v2, per-destination Keychain custody and DAV no-overwrite, only against the owned loopback Nextcloud fixture (ADR0027).
@main final class NextcloudChecksApp: UIResponder, UIApplicationDelegate {
  static let server = "https://127.0.0.1:18443"
  static let BUNDLE = "com.kloda.fixture.cloud18"
  var window: UIWindow?
  static var documents: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    let controller = UIViewController(); controller.view.backgroundColor = .systemBackground
    window.rootViewController = controller; window.makeKeyAndVisible(); self.window = window
    Self.write("nextcloud-result.json", ["status": "RUNNING"])
    DispatchQueue.global().async {
      var report: [String: Any]
      do {
        try Self.origins(); try Self.custody(); try Self.granted(); try Self.refused()
        report = ["status": "PASS", "scope": "Login Flow v2 grant/expiry/cancel, origin guards, per-destination Keychain custody/limit, owned DAV no-overwrite/revoke; queue, Expo UI, Android and physical hardware NOT_RUN"]
      } catch {
        let code: String
        if case IosWebDavFailure.code(let value) = error { code = value } else { code = String(describing: error) }
        report = ["status": "FAIL", "code": code]
      }
      Self.write("nextcloud-result.json", report)
    }
    return true
  }

  static func write(_ name: String, _ value: [String: Any]) {
    try? JSONSerialization.data(withJSONObject: value).write(to: documents.appendingPathComponent(name), options: .atomic)
  }
  struct Check: Error { let reason: String }
  static func expect(_ condition: Bool, _ reason: String) throws { if !condition { throw Check(reason: reason) } }
  static func rejects(_ code: String, _ action: () throws -> Void) throws {
    var observed: String?
    do { try action() } catch IosWebDavFailure.code(let value) { observed = value }
    try expect(observed == code, "expected \(code), observed \(observed ?? "none")")
  }
  // The host runner reads this file and plays the browser part with tools/nextcloud-login-driver.py.
  static func announce(_ line: String) { write("nextcloud-login.json", ["line": line]) }

  static func origins() throws {
    let server = try IosNextcloudLogin.server(Self.server + "/")
    try expect(server == (try IosNextcloudLogin.server(Self.server)) && server.absoluteString == Self.server, "server normalisation")
    try expect((try IosNextcloudLogin.server(Self.server + "/cloud/")).absoluteString == Self.server + "/cloud", "sub-path")
    for value in ["http://127.0.0.1:18443", "https://owned:secret@127.0.0.1:18443", "https://127.0.0.1:18443/?a=b", "https://127.0.0.1:18443/#x", "https://127.0.0.1:18443/a/../b"] {
      try rejects("webdav_fields") { _ = try IosNextcloudLogin.server(value) }
    }
    try expect((try IosNextcloudLogin.sameOrigin(server, Self.server + "/login/v2/poll")).path == "/login/v2/poll", "same origin")
    for value in ["http://127.0.0.1:18443/login/v2/poll", "https://localhost:18443/login/v2/poll", "https://127.0.0.1:443/login/v2/poll", "https://owned@127.0.0.1:18443/login/v2/poll"] {
      try rejects("nextcloud_server_mismatch") { _ = try IosNextcloudLogin.sameOrigin(server, value) }
    }
    let nested = try IosNextcloudLogin.server(Self.server + "/cloud")
    try rejects("nextcloud_server_mismatch") { _ = try IosNextcloudLogin.sameOrigin(nested, Self.server + "/other/login/v2/poll") }
  }

  static func custody() throws {
    for slot in try IosWebDavVault.slots() { try IosWebDavVault.delete(slot: slot) }
    // Fixture-only reset of this app's original entry; product code never deletes it.
    SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: BUNDLE + ".webdav.native.v1",
      kSecAttrAccount as String: "profile"] as CFDictionary)
    let legacy = IosWebDavProfile(revision: UUID().uuidString, endpoint: server + "/remote.php/dav/files/owned", targetPath: "Kloda",
      username: "owned", password: "fixture-password")
    // A new original WebDAV entry also counts toward the limit.
    let full = try (1...8).map { index -> IosWebDavProfile in
      let profile = IosWebDavProfile(revision: UUID().uuidString, endpoint: legacy.endpoint, targetPath: "Fresh\(index)",
        username: "owned", password: "fixture-password", provider: "nextcloud")
      try IosWebDavVault.write(profile, slot: try profile.targetId())
      return profile
    }
    try rejects("destination_limit") { try IosWebDavVault.write(legacy) }
    for profile in full { try IosWebDavVault.delete(slot: try profile.targetId()) }
    let identity = try JSONSerialization.data(withJSONObject: [try legacy.url().absoluteString, "owned"])
    try expect(try legacy.targetId() == IosWebDavClient.encode(Data(SHA256.hash(data: identity))), "original WebDAV identity changed")
    var cloud = legacy; cloud.provider = "nextcloud"
    var cloudme = cloud; cloudme.provider = "cloudme"
    try expect(try cloud.targetId() != legacy.targetId() && cloudme.targetId() != cloud.targetId(), "provider-bound identity")
    var unknown = legacy; unknown.provider = "dropbox"
    try rejects("webdav_fields") { try unknown.validate() }
    let legacyJson = try JSONSerialization.jsonObject(with: JSONEncoder().encode(legacy)) as? [String: Any]
    try expect(legacyJson?.keys.contains("provider") == false, "original entry encoding unchanged")
    try IosWebDavVault.write(legacy)
    let slot = try cloud.targetId()
    try IosWebDavVault.write(cloud, slot: slot)
    try expect(try IosWebDavVault.read() == legacy && IosWebDavVault.read(slot: slot) == cloud, "round trip")
    try rejects("invalid_request") { try IosWebDavVault.write(legacy, slot: slot) }
    try rejects("invalid_request") { try IosWebDavVault.write(cloud) }
    try rejects("invalid_request") { _ = try IosWebDavVault.read(slot: "not-a-target") }
    let extra = try (1...6).map { index -> IosWebDavProfile in
      IosWebDavProfile(revision: UUID().uuidString, endpoint: cloud.endpoint, targetPath: "Kloda\(index)", username: "owned",
        password: "fixture-password", provider: "nextcloud")
    }
    for profile in extra { try IosWebDavVault.write(profile, slot: try profile.targetId()) }
    try expect(try IosWebDavVault.count() == IosWebDavVault.limit, "limit count")
    let ninth = IosWebDavProfile(revision: UUID().uuidString, endpoint: cloud.endpoint, targetPath: "Kloda9", username: "owned",
      password: "fixture-password", provider: "nextcloud")
    try rejects("destination_limit") { try IosWebDavVault.write(ninth, slot: try ninth.targetId()) }
    let renewed = IosWebDavProfile(revision: UUID().uuidString, endpoint: cloud.endpoint, targetPath: cloud.targetPath,
      username: "owned", password: "rotated", provider: "nextcloud")
    try IosWebDavVault.write(renewed, slot: slot)
    try expect(try IosWebDavVault.read(slot: slot) == renewed, "rotation")
    for profile in extra + [cloud] { try IosWebDavVault.delete(slot: try profile.targetId()) }
    try expect(try IosWebDavVault.slots().isEmpty && IosWebDavVault.read(slot: slot) == nil, "delete")
    try expect(try IosWebDavVault.read() == legacy, "original entry kept")
  }

  static func granted() throws {
    let login = IosNextcloudLogin()
    let start = try login.start(server)
    try expect(start.login.host == "127.0.0.1" && start.poll.path == "/login/v2/poll", "start urls")
    try expect(try login.poll(start) == nil, "pending poll")
    announce("GRANT " + start.login.absoluteString)
    let credential = try login.waitForGrant(start, interval: 1, limit: 120)
    try expect(credential.loginName == "owned" && credential.appPassword.count >= 32, "credential")
    try expect(try login.poll(start) == nil, "poll token must be single use")
    let profile = try login.profile(start, credential, folder: "KlodaCloud18-" + UUID().uuidString.prefix(8))
    try expect(profile.provider == "nextcloud" && profile.endpoint == server + "/remote.php/dav/files/owned", "profile")
    let slot = try profile.targetId()
    try IosWebDavVault.write(profile, slot: slot)
    try expect(try IosWebDavVault.read(slot: slot) == profile, "stored")
    func send(_ path: String, _ method: String, _ headers: [String: String] = [:], upload: URL? = nil, size: Int64 = 65536) throws -> IosWebDavReply {
      try IosWebDavClient.send(profile: profile, path: path, method: method, headers: headers, upload: upload, size: size, check: {})
    }
    try IosWebDavClient.require(try send("", "MKCOL"), [201])
    let first = Data((0..<65537).map { UInt8($0 % 251) }), second = Data(repeating: 7, count: 17)
    let a = documents.appendingPathComponent("a.bin"), b = documents.appendingPathComponent("b.bin")
    try first.write(to: a); try second.write(to: b)
    let destination = try profile.url("photo.bin").absoluteString
    try IosWebDavClient.require(try send(".kloda-upload-a", "PUT", ["If-None-Match": "*"], upload: a), [201])
    try rejects("conflict") { try IosWebDavClient.require(try send(".kloda-upload-a", "PUT", ["If-None-Match": "*"], upload: b), [201]) }
    try IosWebDavClient.require(try send(".kloda-upload-a", "MOVE", ["Destination": destination, "Overwrite": "F"]), [201])
    try IosWebDavClient.require(try send(".kloda-upload-b", "PUT", ["If-None-Match": "*"], upload: b), [201])
    try rejects("conflict") { try IosWebDavClient.require(try send(".kloda-upload-b", "MOVE", ["Destination": destination, "Overwrite": "F"]), [201]) }
    let read = try send("photo.bin", "GET", size: Int64(first.count))
    try expect(read.status == 200 && read.size == Int64(first.count) && read.sha256 == IosWebDavClient.encode(Data(SHA256.hash(data: first))), "overwrite was not refused")
    try login.revoke(profile)
    try IosWebDavVault.delete(slot: slot)
    try expect(try IosWebDavVault.read(slot: slot) == nil, "custody deleted")
    try rejects("webdav_auth") { try IosWebDavClient.require(try send("photo.bin", "GET"), [200]) }
  }

  static func refused() throws {
    let ignored = IosNextcloudLogin()
    let start = try ignored.start(server)
    announce("DENY " + start.login.absoluteString)
    try rejects("nextcloud_login_expired") { _ = try ignored.waitForGrant(start, interval: 1, limit: 6) }
    let cancelled = IosNextcloudLogin()
    let pending = try cancelled.start(server)
    DispatchQueue.global().asyncAfter(deadline: .now() + 1.5) { cancelled.cancel() }
    try rejects("cancelled") { _ = try cancelled.waitForGrant(pending, interval: 0.5, limit: 60) }
    try rejects("cancelled") { _ = try cancelled.start(server) }
  }
}
