import Foundation
import Security

// App-bound password custody; unrelated Kloda device identity/key/pins are never used.
// slot == nil is the original WebDAV entry; other DAV destinations use one account per targetId (ADR0027).
enum IosWebDavVault {
  static let limit = 8
  private static let legacyAccount = "profile"
  private static func service() throws -> String {
    guard let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty else { throw IosWebDavFailure.code("webdav_storage") }
    return bundle + ".webdav.native.v1"
  }
  private static func account(_ slot: String?) throws -> String {
    guard let slot else { return legacyAccount }
    guard slot.range(of: "^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$", options: .regularExpression) != nil else {
      throw IosWebDavFailure.code("invalid_request")
    }
    return "dav." + slot
  }
  private static func query(_ slot: String?) throws -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: try service(),
      kSecAttrAccount as String: try account(slot), kSecAttrSynchronizable as String: false]
  }
  private static func owned(_ profile: IosWebDavProfile, _ slot: String?) throws -> Bool {
    guard let slot else { return profile.provider == nil }
    return try profile.provider != nil && profile.targetId() == slot
  }
  static func read(slot: String? = nil) throws -> IosWebDavProfile? {
    var request = try query(slot)
    request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data, data.count <= 65536 else { throw failure(status) }
    do {
      let profile = try JSONDecoder().decode(IosWebDavProfile.self, from: data)
      try profile.validate()
      guard try owned(profile, slot) else { throw IosWebDavFailure.code("webdav_storage") }
      return profile
    } catch { throw IosWebDavFailure.code("webdav_storage") }
  }
  static func write(_ profile: IosWebDavProfile, slot: String? = nil) throws {
    try profile.validate()
    guard try owned(profile, slot) else { throw IosWebDavFailure.code("invalid_request") }
    // Existence only: the original entry keeps its previous overwrite behaviour; a new entry may not exceed the limit.
    if try !exists(slot), try count() >= limit { throw IosWebDavFailure.code("destination_limit") }
    let data = try JSONEncoder().encode(profile)
    guard data.count <= 65536 else { throw IosWebDavFailure.code("webdav_storage") }
    var attributes: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
    let identity = try query(slot)
    var status = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      for (key, value) in identity { attributes[key] = value }
      status = SecItemAdd(attributes as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw failure(status) }
    guard try read(slot: slot) == profile else { throw IosWebDavFailure.code("webdav_storage") }
  }
  // Removes one added DAV destination's custody; the original WebDAV entry is never deleted here.
  static func delete(slot: String) throws {
    let status = SecItemDelete(try query(slot) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw failure(status) }
  }
  static func slots() throws -> [String] {
    let request: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: try service(),
      kSecAttrSynchronizable as String: false, kSecReturnAttributes as String: true, kSecMatchLimit as String: kSecMatchLimitAll]
    var items: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &items)
    if status == errSecItemNotFound { return [] }
    guard status == errSecSuccess, let rows = items as? [[String: Any]] else { throw failure(status) }
    // Same as Android: an account that is not a valid slot is ignored rather than failing every listing.
    return rows.compactMap { $0[kSecAttrAccount as String] as? String }.filter { $0.hasPrefix("dav.") }
      .map { String($0.dropFirst(4)) }.filter { (try? account($0)) != nil }.sorted()
  }
  private static func exists(_ slot: String?) throws -> Bool {
    var request = try query(slot)
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    let status = SecItemCopyMatching(request as CFDictionary, nil)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw failure(status) }
    return status == errSecSuccess
  }
  // Every configured DAV destination counts, including the original WebDAV entry.
  static func count() throws -> Int { try slots().count + (exists(nil) ? 1 : 0) }
  private static func failure(_ status: OSStatus) -> IosWebDavFailure {
    .code(status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "credential_locked" : "webdav_storage")
  }
}
