import Foundation
import CoreFoundation

struct IosFilesConnection {
  let check: () throws -> Void
  let send: ([String: Any], Int32) throws -> [String: Any]
}

struct IosFileAck {
  let id: String
  let offset: Int64
  let state: String
}

// Strict native evidence only; neither a successful request nor sent bytes are completion.
enum IosFilesTransfer {
  static let operationFields: Set<String> = ["id", "requestId", "sourceId", "sourceRevision", "name", "sha256", "size", "offset", "state"]
  static func fixed(_ text: String, bytes: Int) throws {
    let standard = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    guard let data = Data(base64Encoded: standard + String(repeating: "=", count: (4 - standard.count % 4) % 4)),
      data.count == bytes, encode(data) == text else { throw IosPairingFailure.native("outcome_unknown") }
  }
  static func encode(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  static func identifier() -> String {
    var uuid = UUID().uuid
    return withUnsafeBytes(of: &uuid) { encode(Data($0)) }
  }
  static func number(_ object: [String: Any], _ key: String) throws -> Int64 {
    guard let n = object[key] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(),
      let value = Int64(n.stringValue), value >= 0 else { throw IosPairingFailure.native("outcome_unknown") }
    return value
  }
  static func response(_ value: [String: Any], fields: Set<String>) throws -> [String: Any] {
    let status = try number(value, "status")
    if let code = value["errorCode"] as? String {
      let codes = ["invalid_request", "lan_unavailable", "native_unsupported", "identity_unavailable", "continuity_lost", "tls_rejected", "candidate_stale", "storage_failure", "connection_closed", "outcome_unknown", "cancelled", "revoked", "denied", "owner_deleted", "not_found", "conflict", "hash_mismatch", "acl_busy", "acl_unavailable", "backup_unavailable", "backup_full", "backup_busy", "backup_permission_denied", "backup_path_rejected", "backup_scope_changed"]
      guard Set(value.keys) == ["status", "errorCode"], status == 0 || (400...599).contains(status), codes.contains(code) else {
        throw IosPairingFailure.native("outcome_unknown")
      }
      throw IosPairingFailure.native(code)
    }
    guard status == 200, Set(value.keys) == fields.union(["status"]) else { throw IosPairingFailure.native("outcome_unknown") }
    return value
  }
  static func ack(_ value: [String: Any], job: IosFilesJob) throws -> IosFileAck {
    let response = try response(value, fields: ["operation"])
    guard let op = response["operation"] as? [String: Any], Set(op.keys) == operationFields,
      let id = op["id"] as? String, job.operationId == nil || job.operationId == id,
      op["requestId"] as? String == job.requestId, op["sourceId"] as? String == job.wireSourceId,
      op["sourceRevision"] as? String == job.sha256, op["sha256"] as? String == job.sha256,
      op["name"] as? String == job.name, try number(op, "size") == job.size,
      let state = op["state"] as? String, ["receiving", "validating", "publishing", "completed"].contains(state) else {
      throw IosPairingFailure.native("outcome_unknown")
    }
    try fixed(id, bytes: 16)
    let offset = try number(op, "offset")
    guard offset >= job.acknowledged, offset <= job.size, state == "receiving" || offset == job.size else {
      throw IosPairingFailure.native("outcome_unknown")
    }
    return IosFileAck(id: id, offset: offset, state: state)
  }
  static func create(_ job: IosFilesJob) -> [String: Any] {
    var upload: [String: Any] = ["requestId": job.requestId, "sourceId": job.wireSourceId,
      "sourceRevision": job.sha256, "name": job.name, "sha256": job.sha256, "size": job.size]
    if let previous = job.rebackupOf { upload["rebackupOf"] = previous }
    return ["kind": "create", "upload": upload]
  }
}
