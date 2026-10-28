import Foundation
import CoreFoundation

// Pure native decoder. No UI code, signer handles or writable authority are exposed.
enum IosPairingFailure: Error, Equatable {
  case native(String)
  case invalidReply

  var code: String {
    if case .native(let code) = self { return code }
    return "outcome_unknown"
  }
}

enum IosPairingReply {
  static let maximumBytes = 262_164
  static func decode(_ data: Data) throws -> Any {
    // Existing List replies allow 8192*32 bytes; the Rust envelope adds 20 bytes.
    guard !data.isEmpty, data.count <= maximumBytes else { throw IosPairingFailure.invalidReply }
    let decoded: Any
    do { decoded = try JSONSerialization.jsonObject(with: data) }
    catch { throw IosPairingFailure.invalidReply }
    guard let object = decoded as? [String: Any], let ok = object["ok"] as? NSNumber,
      CFGetTypeID(ok) == CFBooleanGetTypeID() else { throw IosPairingFailure.invalidReply }
    if ok.boolValue {
      guard Set(object.keys) == ["ok", "value"], let value = object["value"] else {
        throw IosPairingFailure.invalidReply
      }
      return value
    }
    guard Set(object.keys) == ["ok", "errorCode"], let code = object["errorCode"] as? String,
      errors.contains(code) else { throw IosPairingFailure.invalidReply }
    throw IosPairingFailure.native(code)
  }

  static func owner(_ value: Any) throws -> UInt64 {
    guard let object = value as? [String: Any], Set(object.keys) == ["owner"],
      let text = object["owner"] as? String, let owner = UInt64(text), owner > 0,
      String(owner) == text else { throw IosPairingFailure.invalidReply }
    return owner
  }

  static func epoch(_ value: Any) throws -> UInt64 {
    guard let object = value as? [String: Any], Set(object.keys) == ["epoch"],
      let text = object["epoch"] as? String, let epoch = UInt64(text), String(epoch) == text else {
      throw IosPairingFailure.invalidReply
    }
    return epoch
  }

  static func empty(_ value: Any) throws {
    guard value is NSNull else { throw IosPairingFailure.invalidReply }
  }

  static func status(_ value: Any) throws -> [String: Any] {
    guard let object = value as? [String: Any], Set(object.keys).isSubset(of: statusKeys),
      let phase = object["phase"] as? String, phases.contains(phase),
      let repair = object["repairRequired"] as? NSNumber,
      CFGetTypeID(repair) == CFBooleanGetTypeID(),
      object["hardwareClass"] as? String == "secure_enclave" else {
      throw IosPairingFailure.invalidReply
    }
    for field in ["operationId", "recordId", "peerFingerprint"] {
      if let value = object[field] {
        guard let text = value as? String,
          canonicalReference(text, bytes: field == "peerFingerprint" ? 32 : 16) else {
          throw IosPairingFailure.invalidReply
        }
      }
    }
    if let value = object["candidateGeneration"] {
      guard let text = value as? String, let generation = UInt64(text), String(generation) == text else {
        throw IosPairingFailure.invalidReply
      }
    }
    if let value = object["remainingMs"] {
      guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
        number.doubleValue.isFinite, number.doubleValue >= 0 else { throw IosPairingFailure.invalidReply }
    }
    if let value = object["errorCode"] {
      guard let code = value as? String, errors.contains(code) else { throw IosPairingFailure.invalidReply }
    }
    if let value = object["unpairResult"] {
      guard let result = value as? [String: Any], Set(result.keys).isSubset(of: ["state", "errorCode"]),
        let state = result["state"] as? String,
        ["pc_confirmed", "pc_unconfirmed", "local_only"].contains(state),
        state == "pc_unconfirmed" ? phase == "complete" : phase == "revoked" else {
        throw IosPairingFailure.invalidReply
      }
      if let value = result["errorCode"] {
        guard let code = value as? String, errors.contains(code) else { throw IosPairingFailure.invalidReply }
      }
    }
    return object
  }

  private static func canonicalReference(_ text: String, bytes: Int) -> Bool {
    guard text.utf8.allSatisfy({ (65...90).contains($0) || (97...122).contains($0)
      || (48...57).contains($0) || $0 == 45 || $0 == 95 }) else { return false }
    let normalized = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    let padded = normalized + String(repeating: "=", count: (4 - normalized.count % 4) % 4)
    guard let data = Data(base64Encoded: padded), data.count == bytes else { return false }
    return data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") == text
  }

  private static let phases: Set<String> = [
    "idle", "open", "connecting", "reserved", "consumed_pending_ack", "complete", "pending", "invalid", "revoked"
  ]
  private static let statusKeys: Set<String> = [
    "phase", "operationId", "candidateGeneration", "peerFingerprint", "remainingMs", "recordId",
    "repairRequired", "errorCode", "hardwareClass", "unpairResult"
  ]
  private static let errors: Set<String> = [
    "invalid_qr", "invalid_request", "unsupported_version", "lan_unavailable", "native_unsupported",
    "identity_unavailable", "continuity_lost", "tls_rejected", "proof_rejected", "invitation_expired",
    "candidate_stale", "already_paired", "storage_failure", "connection_closed", "outcome_unknown",
    "cancelled", "revoked", "acl_busy", "acl_unavailable", "backup_unavailable", "backup_full",
    "backup_busy", "backup_permission_denied", "backup_path_rejected", "backup_scope_changed"
  ]
}
