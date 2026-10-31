import Foundation
import Security

// App-bound password custody; unrelated Kloda device identity/key/pins are never used.
enum IosWebDavVault {
  private static func query() throws -> [String: Any] {
    guard let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty else { throw IosWebDavFailure.code("webdav_storage") }
    return [kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: bundle + ".webdav.native.v1",
      kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
  }
  static func read() throws -> IosWebDavProfile? {
    var request = try query()
    request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data, data.count <= 65536 else { throw failure(status) }
    do { let profile = try JSONDecoder().decode(IosWebDavProfile.self, from: data); try profile.validate(); return profile }
    catch { throw IosWebDavFailure.code("webdav_storage") }
  }
  static func write(_ profile: IosWebDavProfile) throws {
    try profile.validate()
    let data = try JSONEncoder().encode(profile)
    guard data.count <= 65536 else { throw IosWebDavFailure.code("webdav_storage") }
    var attributes: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
    let identity = try query()
    var status = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      for (key, value) in identity { attributes[key] = value }
      status = SecItemAdd(attributes as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw failure(status) }
    guard try read() == profile else { throw IosWebDavFailure.code("webdav_storage") }
  }
  private static func failure(_ status: OSStatus) -> IosWebDavFailure {
    .code(status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "credential_locked" : "webdav_storage")
  }
}
