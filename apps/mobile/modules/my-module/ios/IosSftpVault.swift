#if KLODA_SFTP_NATIVE
import Foundation
import Security

// App-bound password custody; unrelated Kloda device identity/key/pins are never used.
enum IosSftpVault {
  private static func query() throws -> [String: Any] {
    guard let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty else { throw IosSftpFailure(code: "storage_failure") }
    return [kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: bundle + ".sftp.native.v1",
      kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
  }
  static func read() throws -> IosSftpProfile? {
    var request = try query()
    request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data, data.count <= 65536 else { throw failure(status) }
    do { return try IosSftpProfile.decode(data) }
    catch { throw IosSftpFailure(code: "storage_failure") }
  }
  static func write(_ profile: IosSftpProfile) throws {
    try profile.validate()
    _ = try read() // Refuse to overwrite unreadable custody.
    let data = try JSONEncoder().encode(profile)
    guard data.count <= 65536 else { throw IosSftpFailure(code: "storage_failure") }
    var attributes: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
    let identity = try query()
    var status = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      for (key, value) in identity { attributes[key] = value }
      status = SecItemAdd(attributes as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw failure(status) }
    guard try read() == profile else { throw IosSftpFailure(code: "storage_failure") }
  }
  private static func failure(_ status: OSStatus) -> IosSftpFailure {
    IosSftpFailure(code: status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "credential_locked" : "storage_failure")
  }
}

#endif
