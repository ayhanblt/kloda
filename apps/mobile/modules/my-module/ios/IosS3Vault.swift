#if KLODA_S3_NATIVE
import Foundation
import Security

// App-bound password custody; unrelated Kloda device identity/key/pins are never used.
enum IosS3Vault {
  private static func query(_ provider: String) throws -> [String: Any] {
    guard ["amazon-s3", "s3-compatible"].contains(provider) else { throw IosS3Failure(code: "invalid_request") }
    guard let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty else { throw IosS3Failure(code: "storage_failure") }
    return [kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: bundle + ".s3." + provider + ".native.v1",
      kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
  }
  static func read(_ provider: String) throws -> IosS3Profile? {
    var request = try query(provider)
    request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data, data.count <= 65536 else { throw failure(status) }
    do { let profile = try IosS3Profile.decode(data); guard profile.target.provider == provider else { throw IosS3Failure(code: "storage_failure") }; return profile }
    catch { throw IosS3Failure(code: "storage_failure") }
  }
  static func write(_ profile: IosS3Profile) throws {
    try profile.validate()
    _ = try read(profile.target.provider) // Refuse to overwrite unreadable custody.
    let data = try JSONEncoder().encode(profile)
    guard data.count <= 65536 else { throw IosS3Failure(code: "storage_failure") }
    var attributes: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
    let identity = try query(profile.target.provider)
    var status = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      for (key, value) in identity { attributes[key] = value }
      status = SecItemAdd(attributes as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw failure(status) }
    guard try read(profile.target.provider) == profile else { throw IosS3Failure(code: "storage_failure") }
  }
  private static func failure(_ status: OSStatus) -> IosS3Failure {
    IosS3Failure(code: status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "credential_locked" : "storage_failure")
  }
}

#endif
