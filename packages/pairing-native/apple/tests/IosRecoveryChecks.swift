import Foundation

// ADR0029 29/1: the shared vectors from tools/recovery-code-vectors.py against the production IosRecoveryCode.
// Keychain custody and the LAContext prompt need the app bundle; they are runtime checks.
@main
struct IosRecoveryChecks {
  static func hex(_ data: Data) -> String { data.map { String(format: "%02x", $0) }.joined() }
  static func main() {
    let sequence = Data((0..<32).map { UInt8($0) })
    precondition(IosRecoveryCode.format(sequence) == "000G-40R4-0M30-E209-185G-R38E-1W81-24GK-2GAH-C5RR-34D1-P70X-3RFG-F3V8", "sequence code")
    precondition(hex(IosRecoveryCode.hkdf(sequence, label: "kloda-catalog-mac-v1")) == "0e9740aa9b8e0ac30b45a75a892ea24174a29d41bd545a2441dda63de62e306a", "sequence hkdf")
    let ones = Data(repeating: 0xff, count: 32)
    precondition(IosRecoveryCode.format(ones) == "ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZG-SCBA", "ones code")
    precondition(hex(IosRecoveryCode.hkdf(ones, label: "kloda-catalog-mac-v1")) == "c76950639e311eb81b58b56055515881476713b6f7310f5f1e3d395b18a6b12b", "ones hkdf")
    print("PASS ios recovery code vectors + hkdf")
  }
}
