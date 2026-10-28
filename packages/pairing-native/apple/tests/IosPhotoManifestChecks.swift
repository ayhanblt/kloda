import Foundation

@main struct IosPhotoManifestChecks {
  static func main() throws {
    let vector = #"{"version":1,"sourceDeviceId":"phone_1","assetId":"asset-1","revision":"9223372036854775807","resources":[{"operationId":"AAAAAAAAAAAAAAAAAAAAAA","role":"original","name":"photo.jpg","mimeType":"image/jpeg","sha256":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","size":"123"}],"albums":[{"id":"album_1","name":"Holiday"}],"favorite":null}"#
    let manifest = try IosPhotoManifestCodec.decode(Data(vector.utf8))
    precondition(manifest.revision == Int64.max && manifest.favorite == nil && manifest.resources[0].size == 123)
    precondition(manifest.filename == "kloda-photo-v1-phone_1-asset-1-9223372036854775807.json")
    let roundtrip = try IosPhotoManifestCodec.decode(IosPhotoManifestCodec.encode(manifest))
    precondition(roundtrip == manifest)
    var rejected = 0
    func bad(_ text: String) {
      do { _ = try IosPhotoManifestCodec.decode(Data(text.utf8)); fatalError("accepted invalid vector") }
      catch { precondition(error as? IosPairingFailure == .native("manifest_invalid")); rejected += 1 }
    }
    bad(vector.replacingOccurrences(of: #""version":1"#, with: #""version":1,"version":1"#))
    bad(vector.replacingOccurrences(of: #""version":1"#, with: #""version":1,"\u0076ersion":1"#))
    bad(vector.replacingOccurrences(of: #""size":"123""#, with: #""size":"123","size":"123""#))
    bad(vector.replacingOccurrences(of: #""version":1"#, with: #""version":1,"extra":null"#))
    bad(vector.replacingOccurrences(of: #""version":1"#, with: #""version":1.0"#))
    bad(vector.replacingOccurrences(of: #""version":1"#, with: #""version":true"#))
    bad(vector.replacingOccurrences(of: #""size":"123""#, with: #""size":123"#))
    bad(vector.replacingOccurrences(of: #""size":"123""#, with: #""size":"01""#))
    bad(vector.replacingOccurrences(of: #""size":"123""#, with: #""size":"9223372036854775808""#))
    bad(vector.replacingOccurrences(of: #""revision":"9223372036854775807""#, with: #""revision":"0""#))
    bad(vector.replacingOccurrences(of: #""favorite":null"#, with: #""favorite":1"#))
    bad(vector.replacingOccurrences(of: #""favorite":null"#, with: #""favorite":"true""#))
    bad(vector.replacingOccurrences(of: "photo.jpg", with: #"\ud800"#))
    bad(vector.replacingOccurrences(of: "photo.jpg", with: #"\udc00"#))
    bad(vector.replacingOccurrences(of: "photo.jpg", with: #"\ud800\u0041"#))
    bad(vector.replacingOccurrences(of: "photo.jpg", with: #"..\u002fsecret"#))
    bad(vector.replacingOccurrences(of: "AAAAAAAAAAAAAAAAAAAAAA", with: "AAAAAAAAAAAAAAAAAAAAAB"))
    bad(vector + "null")
    bad(String(vector.dropLast()))
    bad(vector.replacingOccurrences(of: #""favorite":null"#, with: #""favorite":{"nested":{"nested":null}}"#))
    bad(vector + String(repeating: " ", count: 65_537))
    let resource = #"{"operationId":"AAAAAAAAAAAAAAAAAAAAAA","role":"original","name":"photo.jpg","mimeType":"image/jpeg","sha256":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","size":"123"}"#
    bad(vector.replacingOccurrences(of: resource, with: Array(repeating: resource, count: 9).joined(separator: ",")))
    let album = #"{"id":"album_1","name":"Holiday"}"#
    bad(vector.replacingOccurrences(of: album, with: Array(repeating: album, count: 33).joined(separator: ",")))
    bad(vector.replacingOccurrences(of: resource, with: resource + "," + resource))
    bad(vector.replacingOccurrences(of: album, with: album + "," + album))
    do { _ = try IosPhotoManifestCodec.decode(Data([0x7b, 0xff, 0x7d])); fatalError("accepted malformed UTF8") }
    catch { precondition(error as? IosPairingFailure == .native("manifest_invalid")); rejected += 1 }
    for favorite in ["true", "false"] {
      let decoded = try IosPhotoManifestCodec.decode(Data(vector.replacingOccurrences(of: #""favorite":null"#,
        with: #""favorite":"# + favorite).utf8))
      precondition(decoded.favorite == (favorite == "true"))
    }
    let favoriteManifest = IosPhotoManifest(sourceDeviceId: manifest.sourceDeviceId, assetId: manifest.assetId,
      revision: manifest.revision, resources: manifest.resources, albums: manifest.albums, favorite: true)
    let favoriteRoundtrip = try IosPhotoManifestCodec.decode(IosPhotoManifestCodec.encode(favoriteManifest))
    precondition(favoriteRoundtrip == favoriteManifest)
    let invalidManifest = IosPhotoManifest(sourceDeviceId: manifest.sourceDeviceId, assetId: manifest.assetId,
      revision: 0, resources: manifest.resources, albums: manifest.albums, favorite: nil)
    do { _ = try IosPhotoManifestCodec.encode(invalidManifest); fatalError("encoded zero revision") }
    catch { precondition(error as? IosPairingFailure == .native("manifest_invalid")) }
    let unicode = try IosPhotoManifestCodec.decode(Data(vector.replacingOccurrences(of: "photo.jpg", with: #"\ud83d\udcf7.jpg"#).utf8))
    precondition(unicode.resources[0].name == "📷.jpg")
    print("IOS_PHOTO_MANIFEST_CHECKS_PASS invalid=\(rejected) vector=android-v1-contract bounds=strict")
  }
}
