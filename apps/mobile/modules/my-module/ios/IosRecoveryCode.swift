import CryptoKit
import Foundation

// ADR0029 §1/§2 and user decisions 1–2: one 256-bit recovery secret per installation, shown as grouped Crockford
// Base32 with 4 check characters (tools/recovery-code-vectors.py is the reference). HKDF-SHA256 derives purpose keys.
enum IosRecoveryCode {
  private static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
  static let groups = 14

  static func format(_ secret: Data) -> String {
    precondition(secret.count == 32)
    var chars: [Character] = []
    var buffer = 0, bits = 0
    for byte in secret {
      buffer = (buffer << 8) | Int(byte); bits += 8
      while bits >= 5 { bits -= 5; chars.append(alphabet[(buffer >> bits) & 31]) }
      buffer &= (1 << bits) - 1
    }
    chars.append(alphabet[(buffer << (5 - bits)) & 31])
    let check = Array(SHA256.hash(data: Data("kloda-recovery-check-v1".utf8) + secret))
    let tail = Int(check[0]) << 16 | Int(check[1]) << 8 | Int(check[2])
    for index in 0..<4 { chars.append(alphabet[(tail >> (19 - 5 * index)) & 31]) }
    return stride(from: 0, to: chars.count, by: 4).map { String(chars[$0..<$0 + 4]) }.joined(separator: "-")
  }
  // 29/3: a typed code back to its secret. Case, spaces and hyphens are free and Crockford's O/I/L aliases are
  // accepted; the 4 padding bits must be zero and the check characters must match, else `recovery_code_invalid`.
  static func parse(_ typed: String) throws -> Data {
    var values: [Int] = []
    for char in typed.uppercased() where char != "-" && !char.isWhitespace {
      let normal: Character = char == "O" ? "0" : (char == "I" || char == "L") ? "1" : char
      guard let index = alphabet.firstIndex(of: normal), values.count < 56 else { throw IosWebDavFailure.code("recovery_code_invalid") }
      values.append(index)
    }
    guard values.count == 56 else { throw IosWebDavFailure.code("recovery_code_invalid") }
    var secret = Data(), buffer = 0, bits = 0
    for value in values.prefix(52) {
      buffer = (buffer << 5) | value; bits += 5
      if bits >= 8 { bits -= 8; secret.append(UInt8((buffer >> bits) & 0xff)) }
      buffer &= (1 << bits) - 1
    }
    let normalized = stride(from: 0, to: 56, by: 4).map { String(values[$0..<$0 + 4].map { alphabet[$0] }) }.joined(separator: "-")
    guard buffer == 0, secret.count == 32, format(secret) == normalized else { throw IosWebDavFailure.code("recovery_code_invalid") }
    return secret
  }
  static func hkdf(_ secret: Data, label: String) -> Data {
    HKDF<SHA256>.deriveKey(inputKeyMaterial: SymmetricKey(data: secret), info: Data(label.utf8), outputByteCount: 32)
      .withUnsafeBytes { Data($0) }
  }
}
