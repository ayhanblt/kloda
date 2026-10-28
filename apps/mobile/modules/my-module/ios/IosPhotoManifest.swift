import Foundation

struct IosPhotoResource: Codable, Equatable {
  let operationId: String
  let role: String
  let name: String
  let mimeType: String
  let sha256: String
  let size: Int64
}
struct IosPhotoAlbum: Codable, Equatable {
  let id: String
  let name: String
}
struct IosPhotoManifest: Codable, Equatable {
  let sourceDeviceId: String
  let assetId: String
  let revision: Int64
  let resources: [IosPhotoResource]
  let albums: [IosPhotoAlbum]
  let favorite: Bool?
  var filename: String { "\(IosPhotoManifestCodec.prefix)\(sourceDeviceId)-\(assetId)-\(revision).json" }
}

enum IosPhotoManifestCodec {
  static let prefix = "kloda-photo-v1-"
  private static let invalid = IosPairingFailure.native("manifest_invalid")

  static func encode(_ value: IosPhotoManifest) throws -> Data {
    try validate(value)
    let resources: [[String: Any]] = value.resources.map {
      ["operationId": $0.operationId, "role": $0.role, "name": $0.name, "mimeType": $0.mimeType,
        "sha256": $0.sha256, "size": String($0.size)]
    }
    let object: [String: Any] = ["version": 1, "sourceDeviceId": value.sourceDeviceId, "assetId": value.assetId,
      "revision": String(value.revision), "resources": resources,
      "albums": value.albums.map { ["id": $0.id, "name": $0.name] }, "favorite": value.favorite as Any? ?? NSNull()]
    let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes])
    guard data.count <= 65_536 else { throw invalid }
    return data
  }
  static func decode(_ data: Data) throws -> IosPhotoManifest {
    do {
      var reader = try IosPhotoJson.Reader(data)
      let root = try object(reader.read(), keys: ["version", "sourceDeviceId", "assetId", "revision", "resources", "albums", "favorite"])
      guard case .version = root["version"], case .array(let resourceValues) = root["resources"],
        case .array(let albumValues) = root["albums"] else { throw invalid }
      let resources = try resourceValues.map { value -> IosPhotoResource in
        let row = try object(value, keys: ["operationId", "role", "name", "mimeType", "sha256", "size"])
        return try IosPhotoResource(operationId: string(row, "operationId"), role: string(row, "role"),
          name: string(row, "name"), mimeType: string(row, "mimeType"), sha256: string(row, "sha256"), size: number(row, "size"))
      }
      let albums = try albumValues.map { value -> IosPhotoAlbum in
        let row = try object(value, keys: ["id", "name"])
        return try IosPhotoAlbum(id: string(row, "id"), name: string(row, "name"))
      }
      let favorite: Bool?
      switch root["favorite"] {
      case .null: favorite = nil
      case .bool(let value): favorite = value
      default: throw invalid
      }
      let result = try IosPhotoManifest(sourceDeviceId: string(root, "sourceDeviceId"), assetId: string(root, "assetId"),
        revision: number(root, "revision"), resources: resources, albums: albums, favorite: favorite)
      try validate(result)
      return result
    } catch { throw invalid }
  }
  private static func object(_ value: IosPhotoJson, keys: Set<String>) throws -> [String: IosPhotoJson] {
    guard case .object(let row) = value, Set(row.keys) == keys else { throw invalid }
    return row
  }
  private static func string(_ row: [String: IosPhotoJson], _ key: String) throws -> String {
    guard case .string(let text) = row[key] else { throw invalid }
    return text
  }
  private static func number(_ row: [String: IosPhotoJson], _ key: String) throws -> Int64 {
    let text = try string(row, key)
    guard matches(text, "0|[1-9][0-9]{0,18}"), let number = Int64(text) else { throw invalid }
    return number
  }
  private static func matches(_ text: String, _ pattern: String) -> Bool {
    text.range(of: "\\A(?:" + pattern + ")\\z", options: .regularExpression) != nil
  }
  private static func fixed(_ text: String, bytes: Int) -> Bool {
    guard text.utf8.count == (bytes * 8 + 5) / 6, matches(text, "[A-Za-z0-9_-]+") else { return false }
    let padded = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
      + String(repeating: "=", count: (4 - text.utf8.count % 4) % 4)
    guard let data = Data(base64Encoded: padded), data.count == bytes else { return false }
    return data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") == text
  }
  private static func name(_ text: String) -> Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text.utf16.count <= 255 && text != "." && text != ".."
      && !text.unicodeScalars.contains { $0 == "/" || $0 == "\\" || $0.value < 32 || (127...159).contains($0.value) }
  }
  private static func validate(_ value: IosPhotoManifest) throws {
    guard matches(value.sourceDeviceId, "[A-Za-z0-9_-]{1,128}"), matches(value.assetId, "[A-Za-z0-9_-]{1,128}"),
      value.revision > 0, (1...8).contains(value.resources.count), value.albums.count <= 32,
      Set(value.resources.map(\.operationId)).count == value.resources.count,
      Set(value.resources.map(\.role)).count == value.resources.count,
      Set(value.albums.map(\.id)).count == value.albums.count else { throw invalid }
    for row in value.resources {
      guard fixed(row.operationId, bytes: 16), fixed(row.sha256, bytes: 32), matches(row.role, "[a-z][a-z0-9_-]{0,31}"),
        name(row.name), row.mimeType.utf16.count <= 127,
        matches(row.mimeType, "[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+"), row.size >= 0 else { throw invalid }
    }
    for row in value.albums {
      guard matches(row.id, "[A-Za-z0-9_-]{1,128}"), name(row.name) else { throw invalid }
    }
  }
}
