import Foundation

@main struct ProfileChecks {
  static func main() throws {
    let target = IosSmbTarget(address: "192.168.1.10", port: 445, share: "owned", root: "backup", username: "fixture", domain: "",
      profileGeneration: "11111111-1111-4111-8111-111111111111", credentialGeneration: "22222222-2222-4222-8222-222222222222")
    let profile = IosSmbProfile(target: target, password: "fictional-test-password")
    try profile.validate()
    let encoded = try JSONEncoder().encode(profile)
    let decoded = try IosSmbProfile.decode(encoded)
    precondition(decoded == profile)
    let base = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
    var rejected = 0
    for (key, value) in [("version", 2 as Any), ("password", 7 as Any), ("unexpected", "no" as Any), ("password", String(repeating: "a", count: 4097) as Any), ("password", "x\0y" as Any)] {
      var invalid = base; invalid[key] = value
      do { _ = try IosSmbProfile.decode(JSONSerialization.data(withJSONObject: invalid)); fatalError("accepted invalid field") }
      catch let failure as IosSmbFailure { precondition(failure.code == "storage_failure"); rejected += 1 }
    }
    for (key, value) in [("port", 0 as Any), ("port", "445" as Any), ("share", "" as Any), ("profileGeneration", "old-generation" as Any), ("unexpected", true as Any)] {
      var invalid = base; var t = base["target"] as! [String: Any]; t[key] = value; invalid["target"] = t
      do { _ = try IosSmbProfile.decode(JSONSerialization.data(withJSONObject: invalid)); fatalError("accepted invalid target") }
      catch let failure as IosSmbFailure { precondition(failure.code == "storage_failure"); rejected += 1 }
    }
    precondition(!String(describing: profile).contains(profile.password))
    precondition(!String(reflecting: profile).contains(profile.password))
    print("PASS smb-profile-codec roundtrip, 10 rejected mutations, redacted descriptions; no Keychain operations")
  }
}
