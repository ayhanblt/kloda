import Foundation

// Versioned SMB-only custody, independent of PC/WebDAV receipt and identity keys.
struct IosSmbProfile: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
  let version: Int
  let target: IosSmbTarget
  let password: String
  init(target: IosSmbTarget, password: String) {
    version = 1; self.target = target; self.password = password
  }
  var description: String { "IosSmbProfile(target: \(target), password: <redacted>)" }
  var debugDescription: String { description }
  func validate() throws {
    let fields = [target.address, target.share, target.root, target.username, target.domain, password]
    guard version == 1, !target.address.isEmpty, !target.share.isEmpty, !target.username.isEmpty,
      (1...65535).contains(target.port), fields.allSatisfy({ $0.utf8.count <= 4096 && !$0.utf8.contains(0) }),
      [target.profileGeneration, target.credentialGeneration].allSatisfy({ UUID(uuidString: $0)?.uuidString.lowercased() == $0 })
      else { throw IosSmbFailure(code: "invalid_request") }
  }
  static func decode(_ data: Data) throws -> IosSmbProfile {
    do {
      guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        Set(json.keys) == ["version", "target", "password"],
        let target = json["target"] as? [String: Any],
        Set(target.keys) == ["address", "port", "share", "root", "username", "domain", "profileGeneration", "credentialGeneration"]
        else { throw IosSmbFailure(code: "storage_failure") }
      let result = try JSONDecoder().decode(IosSmbProfile.self, from: data)
      try result.validate(); return result
    } catch { throw IosSmbFailure(code: "storage_failure") }
  }
}
