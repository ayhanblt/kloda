import Foundation
import Security

// Same Keychain policy as IosOAuthVault (WhenUnlockedThisDeviceOnly, never synchronized), in its own service.
// The secret is created once; only the confirmed flag changes, and regeneration (29/2, user decision 3) keeps the old
// secret until the new one is confirmed. Reading it never asks for the device lock: the reveal in KlodaCloudModule does.
enum IosRecoveryVault {
  private struct Record: Codable { let secret: Data; let confirmed: Bool; var next: Data? = nil }
  private static let lock = NSLock()

  static func state() throws -> String {
    lock.lock(); defer { lock.unlock() }
    guard let record = try read() else { return "none" }
    return record.confirmed ? "confirmed" : "pending"
  }
  static func requireConfirmed() throws {
    guard try state() == "confirmed" else { throw IosWebDavFailure.code("recovery_required") }
  }
  // Called only after a successful device-lock check.
  static func reveal() throws -> String {
    lock.lock(); defer { lock.unlock() }
    if let record = try read() { return IosRecoveryCode.format(record.secret) }
    var secret = Data(count: 32)
    let status = secret.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
    guard status == errSecSuccess else { throw IosWebDavFailure.code("webdav_storage") }
    try write(Record(secret: secret, confirmed: false), add: true)
    guard let stored = try read(), stored.secret == secret else { throw IosWebDavFailure.code("webdav_storage") }
    return IosRecoveryCode.format(stored.secret)
  }
  // Called only after a successful device-lock check. A new secret waits beside the confirmed one and replaces it
  // only when confirmed; until then the old code and catalog chain stay in force. Asking again shows the same new code.
  static func renew() throws -> String {
    lock.lock(); defer { lock.unlock() }
    guard var record = try read(), record.confirmed else { throw IosWebDavFailure.code("recovery_required") }
    if let next = record.next { return IosRecoveryCode.format(next) }
    var secret = Data(count: 32)
    let status = secret.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
    guard status == errSecSuccess else { throw IosWebDavFailure.code("webdav_storage") }
    record.next = secret
    try write(record, add: false)
    guard let stored = try read(), stored.next == secret else { throw IosWebDavFailure.code("webdav_storage") }
    return IosRecoveryCode.format(secret)
  }
  // A code `reveal`/`renew` can show after the lock check: the current one (still in force while a renewal is
  // pending, shown in Settings) or the pending new one. The caller must already hold the exact code.
  static func shown(_ code: String) throws -> Bool {
    lock.lock(); defer { lock.unlock() }
    guard let record = try read() else { return false }
    return [record.secret, record.next].compactMap { $0 }.contains { IosRecoveryCode.format($0) == code }
  }
  // Two distinct groups of the shown code, compared after upper-casing; a wrong answer changes nothing.
  static func confirm(_ answers: [Int: String]) throws -> String {
    lock.lock(); defer { lock.unlock() }
    guard let record = try read() else { throw IosWebDavFailure.code("recovery_required") }
    guard answers.count >= 2, answers.keys.allSatisfy({ (0..<IosRecoveryCode.groups).contains($0) }) else {
      throw IosWebDavFailure.code("invalid_request")
    }
    let groups = IosRecoveryCode.format(record.next ?? record.secret).split(separator: "-").map(String.init)
    guard answers.allSatisfy({ $0.value.trimmingCharacters(in: .whitespaces).uppercased() == groups[$0.key] }) else {
      throw IosWebDavFailure.code("recovery_mismatch")
    }
    if let next = record.next { try write(Record(secret: next, confirmed: true), add: false) }
    else if !record.confirmed { try write(Record(secret: record.secret, confirmed: true), add: false) }
    return "confirmed"
  }
  // Background catalog writes (29/2): keys of the confirmed secret only; nil before confirmation or while the
  // Keychain item is unavailable (locked device), so the run continues and the next run catches up.
  static func catalogKeys() throws -> IosRecoveryCatalog.Keys? {
    lock.lock(); defer { lock.unlock() }
    do {
      guard let record = try read(), record.confirmed else { return nil }
      return IosRecoveryCatalog.keys(record.secret)
    } catch IosWebDavFailure.code("credential_locked") { return nil }
  }

  private static func query() throws -> [String: Any] {
    guard let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty else { throw IosWebDavFailure.code("webdav_storage") }
    return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: bundle + ".recovery.v1",
      kSecAttrAccount as String: "recovery", kSecAttrSynchronizable as String: false]
  }
  private static func read() throws -> Record? {
    var request = try query()
    request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data, data.count <= 4096 else { throw failure(status) }
    guard let record = try? JSONDecoder().decode(Record.self, from: data), record.secret.count == 32 else {
      throw IosWebDavFailure.code("webdav_storage")
    }
    return record
  }
  private static func write(_ record: Record, add: Bool) throws {
    let data = try JSONEncoder().encode(record)
    let status: OSStatus
    if add {
      var attributes = try query()
      attributes[kSecValueData as String] = data
      attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
      status = SecItemAdd(attributes as CFDictionary, nil)
    } else {
      status = SecItemUpdate(try query() as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    }
    guard status == errSecSuccess else { throw failure(status) }
  }
  private static func failure(_ status: OSStatus) -> IosWebDavFailure {
    .code(status == errSecInteractionNotAllowed || status == errSecNotAvailable ? "credential_locked" : "webdav_storage")
  }
}
