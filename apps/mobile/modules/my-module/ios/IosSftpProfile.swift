#if KLODA_SFTP_NATIVE
import Foundation

// Versioned SFTP-only custody, independent of PC/WebDAV receipt and identity keys.
struct IosSftpProfile: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
  let version: Int
  let target: IosSftpTarget
  let password: String
  init(target: IosSftpTarget, password: String) {
    version = 1; self.target = target; self.password = password
  }
  var description: String { "IosSftpProfile(target: \(target), password: <redacted>)" }
  var debugDescription: String { description }
  func validate() throws {
    try target.validate()
    let fields = [target.address, target.fingerprint, target.root, target.username, password]
    guard version == 1, !password.isEmpty, !target.address.isEmpty, !target.fingerprint.isEmpty, !target.username.isEmpty,
      (1...65535).contains(target.port), fields.allSatisfy({ $0.utf8.count <= 4096 && !$0.utf8.contains(0) }),
      [target.profileGeneration, target.credentialGeneration].allSatisfy({ UUID(uuidString: $0)?.uuidString.lowercased() == $0 })
      else { throw IosSftpFailure(code: "invalid_request") }
  }
  static func decode(_ data: Data) throws -> IosSftpProfile {
    do {
      guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        Set(json.keys) == ["version", "target", "password"],
        let target = json["target"] as? [String: Any],
        Set(target.keys) == ["address", "port", "fingerprint", "root", "username", "profileGeneration", "credentialGeneration"]
        else { throw IosSftpFailure(code: "storage_failure") }
      let result = try JSONDecoder().decode(IosSftpProfile.self, from: data)
      try result.validate(); return result
    } catch { throw IosSftpFailure(code: "storage_failure") }
  }
}

#endif
