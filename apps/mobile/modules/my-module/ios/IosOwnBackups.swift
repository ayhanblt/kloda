import Foundation

struct IosOwnBackup {
  let id: String
  let name: String
  let sha256: String
  let size: Int64
  var publicValue: [String: String] { ["id": id, "name": name, "sha256": sha256, "size": String(size)] }
  func matches(_ other: IosOwnBackup) -> Bool { id == other.id && name == other.name && sha256 == other.sha256 && size == other.size }
}

enum IosOwnBackups {
  static func operation(_ value: Any) throws -> IosOwnBackup {
    guard let op = value as? [String: Any], Set(op.keys) == IosFilesTransfer.operationFields,
      let id = op["id"] as? String, let name = op["name"] as? String,
      let sha256 = op["sha256"] as? String, let request = op["requestId"] as? String,
      let source = op["sourceId"] as? String, let revision = op["sourceRevision"] as? String,
      !revision.isEmpty, revision.utf8.count <= 1024, op["state"] as? String == "completed",
      !name.isEmpty, name.utf8.count <= 255, name != ".", name != "..", !name.contains("/"), !name.contains("\\"),
      name.unicodeScalars.allSatisfy({ $0.value >= 32 && $0.value != 127 }) else { throw IosPairingFailure.invalidReply }
    try IosFilesTransfer.fixed(id, bytes: 16); try IosFilesTransfer.fixed(request, bytes: 16)
    try IosFilesTransfer.fixed(source, bytes: 16); try IosFilesTransfer.fixed(sha256, bytes: 32)
    let size = try IosFilesTransfer.number(op, "size")
    guard try IosFilesTransfer.number(op, "offset") == size else { throw IosPairingFailure.invalidReply }
    return IosOwnBackup(id: id, name: name, sha256: sha256, size: size)
  }
  static func status(_ connection: IosFilesConnection, id: String) throws -> IosOwnBackup {
    let value = try IosFilesTransfer.response(connection.send(["kind": "status", "id": id], -1), fields: ["operation"])
    let backup = try operation(value["operation"] as Any)
    guard backup.id == id else { throw IosPairingFailure.invalidReply }
    return backup
  }
  static func list(_ connection: IosFilesConnection, after: String?) throws -> [String: Any] {
    if let after { try IosFilesTransfer.fixed(after, bytes: 16) }
    var command: [String: Any] = ["kind": "list"]
    if let after { command["after"] = after }
    let value = try IosFilesTransfer.response(connection.send(command, -1), fields: ["photos"])
    guard let operations = value["photos"] as? [Any], operations.count <= 32 else { throw IosPairingFailure.invalidReply }
    var previous = after
    let items = try operations.map { value -> [String: String] in
      let backup = try operation(value)
      guard previous == nil || previous! < backup.id else { throw IosPairingFailure.invalidReply }
      previous = backup.id
      return backup.publicValue
    }
    return ["items": items, "hasMore": items.count == 32]
  }
}
