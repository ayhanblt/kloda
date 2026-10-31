import Foundation

struct IosWebDavPhotoResource: Equatable, IosPhotoMediaResource {
  let relativePath: String
  let role: String
  let name: String
  let mimeType: String
  let sha256: String
  let size: Int64
}
struct IosWebDavPhotoManifest: Equatable {
  let sourceDeviceId: String
  let assetId: String
  let revision: Int64
  let resources: [IosWebDavPhotoResource]
  let albums: [IosPhotoAlbum]
  let favorite: Bool?
  var filename: String { "kloda-webdav-photo-v1-\(sourceDeviceId)-\(assetId)-\(revision).json" }
}

// ADR0024: paths and this device's DAV receipts, never fabricated PC operation IDs.
enum IosWebDavPhotoManifestCodec {
  private static let invalid = IosWebDavFailure.code("manifest_invalid")
  static func encode(_ value: IosWebDavPhotoManifest) throws -> Data {
    try validate(value)
    let resources: [[String: Any]] = value.resources.map {
      ["relativePath": $0.relativePath, "role": $0.role, "name": $0.name, "mimeType": $0.mimeType,
        "sha256": $0.sha256, "size": String($0.size)]
    }
    let data = try JSONSerialization.data(withJSONObject: ["format": "kloda-webdav-photo", "version": 1,
      "sourceDeviceId": value.sourceDeviceId, "assetId": value.assetId, "revision": String(value.revision),
      "resources": resources, "albums": value.albums.map { ["id": $0.id, "name": $0.name] },
      "favorite": value.favorite as Any? ?? NSNull()], options: [.sortedKeys, .withoutEscapingSlashes])
    guard data.count <= 65536 else { throw invalid }; return data
  }
  static func decode(_ data: Data) throws -> IosWebDavPhotoManifest {
    do {
      var reader = try IosPhotoJson.Reader(data)
      let root = try IosPhotoManifestCodec.object(reader.read(), keys: ["format", "version", "sourceDeviceId", "assetId", "revision", "resources", "albums", "favorite"])
      guard try IosPhotoManifestCodec.string(root, "format") == "kloda-webdav-photo", case .version = root["version"],
        case .array(let rawResources) = root["resources"], case .array(let rawAlbums) = root["albums"] else { throw invalid }
      let resources = try rawResources.map { raw -> IosWebDavPhotoResource in
        let row = try IosPhotoManifestCodec.object(raw, keys: ["relativePath", "role", "name", "mimeType", "sha256", "size"])
        return try IosWebDavPhotoResource(relativePath: IosPhotoManifestCodec.string(row, "relativePath"),
          role: IosPhotoManifestCodec.string(row, "role"), name: IosPhotoManifestCodec.string(row, "name"),
          mimeType: IosPhotoManifestCodec.string(row, "mimeType"), sha256: IosPhotoManifestCodec.string(row, "sha256"), size: IosPhotoManifestCodec.number(row, "size"))
      }
      let albums = try rawAlbums.map { raw -> IosPhotoAlbum in
        let row = try IosPhotoManifestCodec.object(raw, keys: ["id", "name"])
        return try IosPhotoAlbum(id: IosPhotoManifestCodec.string(row, "id"), name: IosPhotoManifestCodec.string(row, "name"))
      }
      let favorite: Bool?
      switch root["favorite"] { case .null: favorite = nil; case .bool(let value): favorite = value; default: throw invalid }
      let value = try IosWebDavPhotoManifest(sourceDeviceId: IosPhotoManifestCodec.string(root, "sourceDeviceId"),
        assetId: IosPhotoManifestCodec.string(root, "assetId"), revision: IosPhotoManifestCodec.number(root, "revision"),
        resources: resources, albums: albums, favorite: favorite)
      try validate(value); return value
    } catch { throw invalid }
  }
  static func validate(_ value: IosWebDavPhotoManifest) throws {
    guard IosPhotoManifestCodec.matches(value.sourceDeviceId, "[A-Za-z0-9_-]{1,128}"),
      IosPhotoManifestCodec.matches(value.assetId, "[A-Za-z0-9_-]{1,128}"), value.revision > 0,
      (1...8).contains(value.resources.count), value.albums.count <= 32,
      Set(value.resources.map(\.relativePath)).count == value.resources.count,
      Set(value.resources.map(\.role)).count == value.resources.count,
      Set(value.albums.map(\.id)).count == value.albums.count else { throw invalid }
    for row in value.resources {
      let parts = row.relativePath.components(separatedBy: "/")
      guard row.relativePath.utf16.count <= 1024, parts.count >= 2, UUID(uuidString: parts[0]) != nil,
        !row.relativePath.contains("\\"), !row.relativePath.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }),
        parts.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && $0.utf8.count <= 255 }),
        IosPhotoManifestCodec.matches(row.role, "[a-z][a-z0-9_-]{0,31}"), IosPhotoManifestCodec.name(row.name),
        IosPhotoManifestCodec.fixed(row.sha256, bytes: 32), row.size >= 0, row.mimeType.utf16.count <= 127,
        IosPhotoManifestCodec.matches(row.mimeType, "[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+") else { throw invalid }
    }
    for album in value.albums {
      guard IosPhotoManifestCodec.matches(album.id, "[A-Za-z0-9_-]{1,128}"), IosPhotoManifestCodec.name(album.name) else { throw invalid }
    }
  }
  static func requireReceipts(_ value: IosWebDavPhotoManifest, target: String, journal: IosWebDavJournal) throws {
    try validate(value)
    for resource in value.resources {
      let source = String(resource.relativePath.split(separator: "/")[0])
      guard try journal.photoReceipt(target: target, source: source, path: resource.relativePath,
        identity: "photos:" + value.sourceDeviceId + ":" + value.assetId + ":" + resource.role,
        hash: resource.sha256, size: resource.size) != nil else { throw invalid }
    }
  }
}
