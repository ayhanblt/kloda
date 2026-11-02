import Foundation
import Security
import CryptoKit

// One OAuth destination (ADR0028): the refresh token and the account it was issued for. Access tokens are never stored,
// except Yandex's long-lived one with its expiry (ADR0028 §2 exception).
struct IosOAuthProfile: Codable, Equatable {
  static let providers: Set<String> = ["dropbox", "onedrive", "yandex", "google-drive"]
  let revision: String
  let provider: String
  let accountId: String
  let targetPath: String
  let refreshToken: String
  var expiresAt: Int64? = nil

  func validate() throws {
    let parts = targetPath.split(separator: "/").map(String.init)
    guard Self.providers.contains(provider), (provider == "yandex") == (expiresAt.map { $0 > 0 } ?? false), UUID(uuidString: revision) != nil, !parts.isEmpty,
      !targetPath.contains("\\"), !parts.contains(where: { $0 == "." || $0 == ".." || $0.utf8.count > 255 }),
      [accountId, targetPath, refreshToken].allSatisfy({ !$0.isEmpty && $0.utf8.count <= 8192 &&
        !$0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }) else {
      throw IosWebDavFailure.code("webdav_fields")
    }
  }
  // Provider, stable account ID and normalized root; another account or root is another destination.
  func targetId() throws -> String {
    try validate()
    let root = targetPath.split(separator: "/").joined(separator: "/")
    let bytes = try JSONSerialization.data(withJSONObject: [provider, accountId, root])
    return Data(SHA256.hash(data: bytes)).base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
}

// Same Keychain policy as IosWebDavVault, in its own service so DAV and OAuth custody never share an entry.
enum IosOAuthVault {
  private static func service() throws -> String {
    guard let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty else { throw IosWebDavFailure.code("webdav_storage") }
    return bundle + ".oauth.native.v1"
  }
  private static func query(_ slot: String) throws -> [String: Any] {
    guard slot.range(of: "^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$", options: .regularExpression) != nil else {
      throw IosWebDavFailure.code("invalid_request")
    }
    return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: try service(),
      kSecAttrAccount as String: "oauth." + slot, kSecAttrSynchronizable as String: false]
  }
  static func read(slot: String) throws -> IosOAuthProfile? {
    var request = try query(slot)
    request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data, data.count <= 65536 else { throw failure(status) }
    guard let profile = try? JSONDecoder().decode(IosOAuthProfile.self, from: data), (try? profile.targetId()) == slot else {
      throw IosWebDavFailure.code("webdav_storage")
    }
    return profile
  }
  // Add only: an existing entry is never replaced.
  static func add(_ profile: IosOAuthProfile) throws {
    let slot = try profile.targetId()
    let data = try JSONEncoder().encode(profile)
    guard data.count <= 65536 else { throw IosWebDavFailure.code("webdav_storage") }
    var attributes = try query(slot)
    attributes[kSecValueData as String] = data
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    let status = SecItemAdd(attributes as CFDictionary, nil)
    if status == errSecDuplicateItem { throw IosWebDavFailure.code("destination_exists") }
    guard status == errSecSuccess else { throw failure(status) }
    guard try read(slot: slot) == profile else { throw IosWebDavFailure.code("webdav_storage") }
  }
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
    return rows.compactMap { $0[kSecAttrAccount as String] as? String }.filter { $0.hasPrefix("oauth.") }
      .map { String($0.dropFirst(6)) }.filter { (try? query($0)) != nil }.sorted()
  }
  private static func failure(_ status: OSStatus) -> IosWebDavFailure {
    .code(status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "credential_locked" : "webdav_storage")
  }
}
