import Foundation

// Links the real Rust simulator library. No test key, owner fixture or network.
@main struct IosPairingSimulatorChecks {
  static func expectError(_ code: String, _ call: () -> UnsafeMutablePointer<CChar>?) throws {
    do {
      _ = try IosPairingNativeCall.consume(call())
      fatalError("Unexpected native success")
    } catch IosPairingFailure.native(let actual) {
      precondition(actual == code, "Unexpected sanitized error")
    }
  }

  static func request(_ bytes: [UInt8], _ code: String) throws {
    try bytes.withUnsafeBufferPointer { buffer in
      try expectError(code) { kloda_ios_request(UInt64.max, buffer.baseAddress, buffer.count, 0) }
    }
  }

  static func main() throws {
    #if !targetEnvironment(simulator)
    fatalError("This harness is simulator-only")
    #endif
    try expectError("invalid_request") { kloda_ios_request(1, nil, 1, 0) }
    try expectError("invalid_request") { kloda_ios_open(nil, 1) }
    try Array(repeating: UInt8(120), count: 8193).withUnsafeBufferPointer { bytes in
      try expectError("invalid_request") { kloda_ios_request(1, bytes.baseAddress, bytes.count, 0) }
    }
    print("PASS simulator ABI input pointer/length bounds")

    for bytes in [[UInt8(255)], [], Array("{\"kind\":\"status\"} true".utf8)] {
      try request(bytes, "invalid_request")
    }
    print("PASS simulator ABI UTF8/JSON rejection")

    for kind in ["createInvitation", "approveBackup", "revokeBackup", "removeDevice", "sign", "openPc", "suspend", "setForeground"] {
      try request(Array("{\"kind\":\"\(kind)\"}".utf8), "invalid_request")
    }
    try request(Array(#"{"kind":"status","trusted":true}"#.utf8), "invalid_request")
    print("PASS simulator phone command boundary")

    for kind in ["status", "close"] {
      try request(Array("{\"kind\":\"\(kind)\"}".utf8), "candidate_stale")
    }
    try expectError("candidate_stale") { kloda_ios_suspend(UInt64.max) }
    try expectError("invalid_request") { kloda_ios_set_foreground(UInt64.max, 2) }
    try expectError("candidate_stale") { kloda_ios_set_foreground(UInt64.max, 0) }
    try expectError("candidate_stale") { kloda_ios_set_foreground(UInt64.max, 1) }
    print("PASS simulator stale owner and lifecycle rejection")

    let record = Array("AAAAAAAAAAAAAAAAAAAAAA".utf8)
    let command = Array(#"{"kind":"status","id":"AAAAAAAAAAAAAAAAAAAAAA"}"#.utf8)
    try record.withUnsafeBufferPointer { record in
      try command.withUnsafeBufferPointer { command in
        try expectError("candidate_stale") {
          kloda_ios_transfer(UInt64.max, record.baseAddress, record.count,
            command.baseAddress, command.count, Int32.max, 0)
        }
      }
    }
    print("PASS simulator transfer rejects stale owner before descriptor use")

    let path = NSTemporaryDirectory() + "kloda-abi-unsupported-" + UUID().uuidString
    precondition(!FileManager.default.fileExists(atPath: path))
    try Array(path.utf8).withUnsafeBufferPointer { pathBytes in
      try expectError("native_unsupported") { kloda_ios_open(pathBytes.baseAddress, pathBytes.count) }
    }
    precondition(!FileManager.default.fileExists(atPath: path))
    print("PASS simulator unsupported storage creates no authority directory")

    kloda_ios_reply_free(nil)
    for _ in 0..<100 {
      try request(Array(#"{"kind":"status"}"#.utf8), "candidate_stale")
    }
    print("PASS simulator real Rust reply consumption/free repeated 100 times")
    print("IOS_ABI_SIMULATOR_CHECKS_COMPLETED_NOT_PRODUCT_ACCEPTANCE")
  }
}
