#if KLODA_S3_NATIVE
import Foundation
import SQLite3

struct IosS3PhotoResource: Equatable, IosPhotoMediaResource {
  let relativePath: String
  let role: String
  let name: String
  let mimeType: String
  let sha256: String
  let size: Int64
}
struct IosS3PhotoManifest: Equatable {
  let sourceDeviceId: String
  let assetId: String
  let revision: Int64
  let resources: [IosS3PhotoResource]
  let albums: [IosPhotoAlbum]
  let favorite: Bool?
  var filename: String { "kloda-s3-photo-v1-\(sourceDeviceId)-\(assetId)-\(revision).json" }
}

// ADR0022/D2; separate S3 resource/manifest receipt contract: same-installation Completed S3 resources only; no PC/DAV authority.
enum IosS3PhotoManifestCodec {
  private static let invalid = IosS3Failure(code: "manifest_invalid")
  static func encode(_ value: IosS3PhotoManifest) throws -> Data {
    try validate(value)
    let resources: [[String: Any]] = value.resources.map {
      ["relativePath": $0.relativePath, "role": $0.role, "name": $0.name, "mimeType": $0.mimeType,
        "sha256": $0.sha256, "size": String($0.size)]
    }
    let data = try JSONSerialization.data(withJSONObject: ["format": "kloda-s3-photo", "version": 1,
      "sourceDeviceId": value.sourceDeviceId, "assetId": value.assetId, "revision": String(value.revision),
      "resources": resources, "albums": value.albums.map { ["id": $0.id, "name": $0.name] },
      "favorite": value.favorite as Any? ?? NSNull()], options: [.sortedKeys, .withoutEscapingSlashes])
    guard data.count <= 65536 else { throw invalid }; return data
  }
  static func decode(_ data: Data) throws -> IosS3PhotoManifest {
    do {
      var reader = try IosPhotoJson.Reader(data)
      let root = try IosPhotoManifestCodec.object(reader.read(), keys: ["format", "version", "sourceDeviceId", "assetId", "revision", "resources", "albums", "favorite"])
      guard try IosPhotoManifestCodec.string(root, "format") == "kloda-s3-photo", case .version = root["version"],
        case .array(let rawResources) = root["resources"], case .array(let rawAlbums) = root["albums"] else { throw invalid }
      let resources = try rawResources.map { raw -> IosS3PhotoResource in
        let row = try IosPhotoManifestCodec.object(raw, keys: ["relativePath", "role", "name", "mimeType", "sha256", "size"])
        return try IosS3PhotoResource(relativePath: IosPhotoManifestCodec.string(row, "relativePath"),
          role: IosPhotoManifestCodec.string(row, "role"), name: IosPhotoManifestCodec.string(row, "name"),
          mimeType: IosPhotoManifestCodec.string(row, "mimeType"), sha256: IosPhotoManifestCodec.string(row, "sha256"), size: IosPhotoManifestCodec.number(row, "size"))
      }
      let albums = try rawAlbums.map { raw -> IosPhotoAlbum in
        let row = try IosPhotoManifestCodec.object(raw, keys: ["id", "name"])
        return try IosPhotoAlbum(id: IosPhotoManifestCodec.string(row, "id"), name: IosPhotoManifestCodec.string(row, "name"))
      }
      let favorite: Bool?
      switch root["favorite"] { case .null: favorite = nil; case .bool(let value): favorite = value; default: throw invalid }
      let value = try IosS3PhotoManifest(sourceDeviceId: IosPhotoManifestCodec.string(root, "sourceDeviceId"),
        assetId: IosPhotoManifestCodec.string(root, "assetId"), revision: IosPhotoManifestCodec.number(root, "revision"),
        resources: resources, albums: albums, favorite: favorite)
      try validate(value); return value
    } catch { throw invalid }
  }
  static func validate(_ value: IosS3PhotoManifest) throws {
    guard IosPhotoManifestCodec.matches(value.sourceDeviceId, "[A-Za-z0-9_-]{1,128}"),
      IosPhotoManifestCodec.matches(value.assetId, "[A-Za-z0-9_-]{1,128}"), value.revision > 0,
      (1...8).contains(value.resources.count), value.albums.count <= 32,
      Set(value.resources.map { $0.relativePath.lowercased() }).count == value.resources.count,
      Set(value.resources.map(\.role)).count == value.resources.count,
      Set(value.albums.map(\.id)).count == value.albums.count else { throw invalid }
    for row in value.resources {
      let parts = row.relativePath.components(separatedBy: "/")
      guard row.relativePath.unicodeScalars.allSatisfy({ $0.value < 128 }), row.relativePath.utf16.count <= 1024, parts.count == 3, parts[0] == "objects", UUID(uuidString: parts[1]) != nil, UUID(uuidString: parts[2]) != nil,
        !row.relativePath.contains("\\"), !row.relativePath.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }),
        parts.allSatisfy(validPart),
        IosPhotoManifestCodec.matches(row.role, "[a-z][a-z0-9_-]{0,31}"), IosPhotoManifestCodec.name(row.name),
        IosPhotoManifestCodec.fixed(row.sha256, bytes: 32), row.size >= 0, row.mimeType.utf16.count <= 127,
        IosPhotoManifestCodec.matches(row.mimeType, "[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+") else { throw invalid }
    }
    for album in value.albums {
      guard IosPhotoManifestCodec.matches(album.id, "[A-Za-z0-9_-]{1,128}"), IosPhotoManifestCodec.name(album.name) else { throw invalid }
    }
  }
  private static func validPart(_ part: String) -> Bool {
    let reserved = ["CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$"]
      + (1...9).flatMap { ["COM\($0)", "LPT\($0)"] }
    let base = String(part.split(separator: ".", omittingEmptySubsequences: false)[0]).trimmingCharacters(in: .whitespaces).uppercased()
    return !part.isEmpty && part != "." && part != ".." && part.utf8.count <= 255
      && !part.hasSuffix(".") && !part.hasSuffix(" ") && !reserved.contains(base)
      && !part.contains(where: { "<>:\"|?*".contains($0) })
  }
  static func requireReceipts(_ value: IosS3PhotoManifest, target: IosS3Target, journal: IosS3Journal) throws {
    try validate(value)
    guard try value.sourceDeviceId == journal.installation() else { throw invalid }
    for resource in value.resources {
      guard try journal.catalogResource(resource, manifest: value, target: target) != nil else { throw invalid }
    }
  }
}

extension IosS3Journal {
  func catalogResource(_ resource: IosS3PhotoResource, manifest: IosS3PhotoManifest, target: IosS3Target) throws -> IosS3Job? {
    try IosS3PhotoManifestCodec.validate(manifest)
    guard try manifest.sourceDeviceId == installation(), manifest.resources.contains(resource) else { throw IosS3Failure(code: "manifest_invalid") }
    let jobs = try database.statement("SELECT j.header FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.archive=? AND l.installation=? AND l.reference=? AND l.sha256=? AND j.state='completed' ORDER BY l.rowid DESC LIMIT 100", values: [target.archiveId(), manifest.sourceDeviceId, manifest.assetId + ":" + resource.role, resource.sha256]) { row -> [IosS3Job] in
      var values: [IosS3Job] = [], step = sqlite3_step(row)
      while step == SQLITE_ROW {
        guard let raw = sqlite3_column_text(row, 0) else { throw IosS3Failure(code: "storage_failure") }
        values.append(try JSONDecoder().decode(IosS3Job.self, from: Data(String(cString: raw).utf8))); step = sqlite3_step(row)
      }
      guard step == SQLITE_DONE else { throw IosS3Failure(code: "storage_failure") }; return values
    }
    guard let job = jobs.first(where: { $0.key == resource.relativePath && $0.kind == "photo_resource" && $0.asset == manifest.assetId && $0.name == resource.name && $0.mimeType == resource.mimeType && $0.size == resource.size }) else { return nil }
    return try receipt(job.id, target: target)
  }
}
#endif
