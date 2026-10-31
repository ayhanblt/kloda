import Foundation
import CryptoKit

enum IosWebDavFailure: Error { case code(String) }

struct IosWebDavProfile: Codable, Equatable {
  let revision: String
  let endpoint: String
  let targetPath: String
  let username: String
  let password: String

  func validate() throws {
    guard UUID(uuidString: revision) != nil,
      let url = URLComponents(string: endpoint), url.scheme == "https", url.host?.isEmpty == false,
      url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
      !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !username.contains(":"), !password.isEmpty,
      [endpoint, targetPath, username, password].allSatisfy({ !$0.utf8.contains(0) && $0.utf8.count <= 8192 }),
      !targetPath.split(separator: "/").isEmpty else { throw IosWebDavFailure.code("webdav_fields") }
    _ = try pathComponents(targetPath)
  }
  func url(_ relative: String = "") throws -> URL {
    try validate()
    guard var url = URLComponents(string: endpoint) else { throw IosWebDavFailure.code("webdav_fields") }
    let base = url.percentEncodedPath.hasSuffix("/") ? url.percentEncodedPath : url.percentEncodedPath + "/"
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    let parts = try pathComponents(targetPath) + pathComponents(relative)
    url.percentEncodedPath = base + parts.map { $0.addingPercentEncoding(withAllowedCharacters: allowed)! }.joined(separator: "/")
    guard let value = url.url else { throw IosWebDavFailure.code("webdav_fields") }
    return value
  }
  private func pathComponents(_ value: String) throws -> [String] {
    let parts = value.split(separator: "/").map(String.init)
    guard !value.contains("\\"), !value.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }), !parts.contains(where: { $0 == "." || $0 == ".." || $0.utf8.count > 255 }) else {
      throw IosWebDavFailure.code("backup_path_rejected")
    }
    return parts
  }
  func targetId() throws -> String {
    let bytes = try JSONSerialization.data(withJSONObject: [url().absoluteString, username])
    return Data(SHA256.hash(data: bytes)).base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  var authorization: String { "Basic " + Data((username + ":" + password).utf8).base64EncodedString() }
}
