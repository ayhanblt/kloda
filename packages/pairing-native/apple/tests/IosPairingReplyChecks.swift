import Foundation

@main struct IosPairingReplyChecks {
  static func rejects(_ action: () throws -> Void) {
    do { try action(); fatalError("Unexpected typed reply acceptance") }
    catch IosPairingFailure.invalidReply {}
    catch { fatalError("Unexpected decoder failure") }
  }

  static func main() throws {
    let valid: [String: Any] = ["phase": "idle", "repairRequired": false, "hardwareClass": "secure_enclave"]
    _ = try IosPairingReply.status(valid)
    for field in ["qr", "owner", "path", "trusted"] {
      var value = valid; value[field] = "must-not-cross-JS"
      rejects { _ = try IosPairingReply.status(value) }
    }
    for (field, bad): (String, Any) in [
      ("phase", "unknown"), ("repairRequired", 1), ("hardwareClass", "strongbox"),
      ("recordId", "short"), ("peerFingerprint", String(repeating: "A", count: 22)),
      ("candidateGeneration", "01"), ("remainingMs", true), ("remainingMs", -1),
      ("errorCode", "arbitrary_error"), ("unpairResult", ["state": "pc_confirmed"])
    ] {
      var value = valid; value[field] = bad
      rejects { _ = try IosPairingReply.status(value) }
    }
    var complete = valid; complete["phase"] = "complete"
    complete["recordId"] = "AAAAAAAAAAAAAAAAAAAAAA"
    complete["peerFingerprint"] = String(repeating: "A", count: 43)
    complete["candidateGeneration"] = "18446744073709551615"
    complete["unpairResult"] = ["state": "pc_unconfirmed", "errorCode": "connection_closed"]
    _ = try IosPairingReply.status(complete)
    let owner = try IosPairingReply.owner(["owner": "1"])
    precondition(owner == 1)
    for value: Any in [["owner": "0"], ["owner": "01"], ["owner": "18446744073709551616"],
      ["owner": 1], ["owner": "1", "trusted": true]] {
      rejects { _ = try IosPairingReply.owner(value) }
    }
    try IosPairingReply.empty(NSNull())
    rejects { try IosPairingReply.empty([:]) }
    let epoch = try IosPairingReply.epoch(["epoch": "18446744073709551615"])
    precondition(epoch == UInt64.max)
    let invalidEpochs: [[String: Any]] = [["epoch": "01"], ["epoch": "18446744073709551616"],
      ["epoch": 1], ["epoch": "1", "trusted": true]]
    for value in invalidEpochs {
      rejects { _ = try IosPairingReply.epoch(value) }
    }
    print("PASS typed phone status rejects private/context/QR and malformed fields")
    print("PASS canonical native owner and empty lifecycle replies")
    print("PASS native activation epoch rejects malformed or additional fields")
  }
}
