#if KLODA_FTPS_NATIVE
import Foundation

// Versioned FTPS-only custody, independent of PC/WebDAV receipt and identity keys.
struct IosFtpsProfile: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
  let version: Int
  let target: IosFtpsTarget
  let password: String
  init(target: IosFtpsTarget, password: String) {
    version = 1; self.target = target; self.password = password
  }
  var description: String { "IosFtpsProfile(target: \(target), password: <redacted>)" }
  var debugDescription: String { description }
  func validate() throws {
    try target.validate()
    let fields = [target.address, target.hostname, target.root, target.username, password]
    guard version == 1, !password.isEmpty, !target.address.isEmpty, !target.hostname.isEmpty, !target.username.isEmpty,
      (1...65535).contains(target.port), fields.allSatisfy({ $0.utf8.count <= 4096 && !$0.utf8.contains(0) }),
      [target.profileGeneration, target.credentialGeneration].allSatisfy({ UUID(uuidString: $0)?.uuidString.lowercased() == $0 })
      else { throw IosFtpsFailure(code: "invalid_request") }
  }
  static func decode(_ data: Data) throws -> IosFtpsProfile {
    do {
      guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        Set(json.keys) == ["version", "target", "password"],
        let target = json["target"] as? [String: Any],
        Set(target.keys) == ["address", "port", "hostname", "root", "username", "profileGeneration", "credentialGeneration"]
        else { throw IosFtpsFailure(code: "storage_failure") }
      let result = try JSONDecoder().decode(IosFtpsProfile.self, from: data)
      try result.validate(); return result
    } catch { throw IosFtpsFailure(code: "storage_failure") }
  }
}

#endif
