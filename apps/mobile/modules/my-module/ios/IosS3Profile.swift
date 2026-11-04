#if KLODA_S3_NATIVE
import Foundation
import CryptoKit

struct IosS3Failure: Error { let code: String; var jobId: String? = nil }
// Access-key identity, not an inferred AWS account ID; a changed key never silently rebinds old receipts.
struct IosS3Target: Codable, Equatable {
  let provider: String
  let endpoint: String
  let region: String
  let bucket: String
  let prefix: String
  let pathStyle: Bool
  let accountBinding: String
  let profileGeneration: String
  let credentialGeneration: String
  func validate() throws {
    guard ["amazon-s3", "s3-compatible"].contains(provider), accountBinding.utf8.count == 43,
      [endpoint, region, bucket, prefix, accountBinding].allSatisfy({ $0.utf8.count <= 4096 && !$0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }),
      [profileGeneration, credentialGeneration].allSatisfy({ UUID(uuidString: $0)?.uuidString.lowercased() == $0 })
      else { throw IosS3Failure(code: "invalid_request") }
  }
  func archiveId() throws -> String {
    Self.hash(try JSONSerialization.data(withJSONObject: [provider, endpoint, region, bucket, prefix, pathStyle, accountBinding]))
  }
  static func hash(_ data: Data) -> String {
    Data(SHA256.hash(data: data)).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
}
struct IosS3Profile: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
  let version: Int
  let target: IosS3Target
  let accessKey: String
  let secret: String
  let token: String?
  init(target: IosS3Target, accessKey: String, secret: String, token: String?) {
    version = 1; self.target = target; self.accessKey = accessKey; self.secret = secret; self.token = token
  }
  enum CodingKeys: String, CodingKey { case version, target, accessKey, secret, token }
  func encode(to encoder: Encoder) throws {
    var values = encoder.container(keyedBy: CodingKeys.self)
    try values.encode(version, forKey: .version); try values.encode(target, forKey: .target)
    try values.encode(accessKey, forKey: .accessKey); try values.encode(secret, forKey: .secret)
    if let token { try values.encode(token, forKey: .token) } else { try values.encodeNil(forKey: .token) }
  }
  var description: String { "IosS3Profile(provider: \(target.provider), credentials: <redacted>)" }
  var debugDescription: String { description }
  func validate() throws {
    try target.validate()
    guard version == 1, !accessKey.isEmpty, !secret.isEmpty, token?.isEmpty != true,
      [accessKey, secret, token ?? ""].allSatisfy({ $0.utf8.count <= 4096 && !$0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }),
      IosS3Target.hash(Data(accessKey.utf8)) == target.accountBinding else { throw IosS3Failure(code: "invalid_request") }
    _ = try IosS3Bridge.prepare(self, key: "validation", operation: ["kind": "head"])
  }
  static func decode(_ data: Data) throws -> IosS3Profile {
    do {
      guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        Set(json.keys) == ["version", "target", "accessKey", "secret", "token"], let target = json["target"] as? [String: Any],
        Set(target.keys) == ["provider", "endpoint", "region", "bucket", "prefix", "pathStyle", "accountBinding", "profileGeneration", "credentialGeneration"]
        else { throw IosS3Failure(code: "storage_failure") }
      let profile = try JSONDecoder().decode(IosS3Profile.self, from: data); try profile.validate(); return profile
    } catch { throw IosS3Failure(code: "storage_failure") }
  }
}
#endif
