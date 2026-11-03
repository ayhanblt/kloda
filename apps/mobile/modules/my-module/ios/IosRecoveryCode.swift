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
  static func hkdf(_ secret: Data, label: String) -> Data {
    HKDF<SHA256>.deriveKey(inputKeyMaterial: SymmetricKey(data: secret), info: Data(label.utf8), outputByteCount: 32)
      .withUnsafeBytes { Data($0) }
  }
}
