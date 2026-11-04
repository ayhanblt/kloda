import CryptoKit
import Foundation

// ADR0029 §3 and user decision 3: canonical catalog delta bytes (tools/recovery-catalog-vectors.py is the reference).
// The chain folder is derived from the secret, so a regenerated secret starts a new chain and never meets the
// create-only paths of the old one. The destination's targetId is part of the folder: two destinations of this phone
// may share one remote folder (the original WebDAV entry and an added Nextcloud entry for the same account).
enum IosRecoveryCatalog {
  static let limit = 65536
  struct Keys { let mac: Data; let chain: String }
  struct Entry: Equatable {
    let job: String
    let path: String
    let sha256: String
    let size: Int64
    let kind: String
    let identity: String?
    let completed: Int64?
  }

  static func keys(_ secret: Data) -> Keys {
    let chain = IosRecoveryCode.hkdf(secret, label: "kloda-catalog-id-v1").prefix(16).map { String(format: "%02x", $0) }.joined()
    return Keys(mac: IosRecoveryCode.hkdf(secret, label: "kloda-catalog-mac-v1"), chain: chain)
  }
  static func folder(installation: String, chain: String, target: String) -> String {
    ".kloda/catalog/" + installation + "/" + chain + "/" + target
  }
  static func path(installation: String, chain: String, target: String, sequence: Int64) -> String {
    folder(installation: installation, chain: chain, target: target) + "/" + String(sequence) + ".json"
  }
  static func base64url(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
  static func digest(_ data: Data) -> String { base64url(Data(SHA256.hash(data: data))) }

  static func text(_ value: String) -> String {
    var out = "\""
    for scalar in value.unicodeScalars {
      switch scalar {
      case "\"", "\\": out += "\\" + String(scalar)
      case _ where scalar.value < 0x20: out += String(format: "\\u%04x", scalar.value)
      default: out.unicodeScalars.append(scalar)
      }
    }
    return out + "\""
  }
  private static func optional(_ value: String?) -> String { value.map(text) ?? "null" }
  private static func optional(_ value: Int64?) -> String { value.map { String($0) } ?? "null" }
  static func entry(_ value: Entry) -> String {
    "{\"path\":" + text(value.path) + ",\"sha256\":" + text(value.sha256) + ",\"size\":" + String(value.size)
      + ",\"kind\":" + text(value.kind) + ",\"identity\":" + optional(value.identity) + ",\"completed\":" + optional(value.completed) + "}"
  }
  private static func body(installation: String, target: String, chain: String, sequence: Int64, previous: String?, entries: [String]) -> String {
    "{\"format\":1,\"installation\":" + text(installation) + ",\"target\":" + text(target) + ",\"chain\":" + text(chain)
      + ",\"sequence\":" + String(sequence) + ",\"previous\":" + optional(previous) + ",\"entries\":[" + entries.joined(separator: ",") + "]}"
  }
  // `,"mac":"` + 43 base64url characters + `"`.
  private static let macBytes = 52

  // How many of `entries` (in order) fit one delta; at least one, or a single oversized entry is refused.
  static func fitting(installation: String, target: String, chain: String, sequence: Int64, previous: String?, entries: [Entry]) throws -> Int {
    var total = body(installation: installation, target: target, chain: chain, sequence: sequence, previous: previous, entries: []).utf8.count + macBytes
    var count = 0
    for value in entries {
      let next = total + entry(value).utf8.count + (count == 0 ? 0 : 1)
      if next > limit { break }
      total = next; count += 1
    }
    guard count > 0 || entries.isEmpty else { throw IosWebDavFailure.code("invalid_request") }
    return count
  }
  static func encode(keys: Keys, installation: String, target: String, sequence: Int64, previous: String?, entries: [Entry]) throws -> Data {
    let unsigned = Data(body(installation: installation, target: target, chain: keys.chain, sequence: sequence, previous: previous,
      entries: entries.map(entry)).utf8)
    let mac = Data(HMAC<SHA256>.authenticationCode(for: unsigned, using: SymmetricKey(data: keys.mac)))
    let bytes = unsigned.dropLast() + Data((",\"mac\":" + text(base64url(mac)) + "}").utf8)
    guard bytes.count <= limit else { throw IosWebDavFailure.code("invalid_request") }
    return Data(bytes)
  }

  struct Delta { let installation: String; let target: String; let sequence: Int64; let previous: String?; let entries: [Entry] }
  // 29/3: a downloaded delta stands only if re-encoding its fields under these keys gives back exactly its bytes, which
  // checks canonical form, chain and MAC at once. A wrong type decodes as nil/absent and therefore fails the comparison.
  static func decode(_ data: Data, keys: Keys) throws -> Delta {
    let unverified = IosWebDavFailure.code("catalog_unverified")
    guard data.count <= limit, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let installation = object["installation"] as? String, let target = object["target"] as? String,
      let sequence = (object["sequence"] as? NSNumber)?.int64Value, sequence > 0, let rows = object["entries"] as? [[String: Any]] else {
      throw unverified
    }
    let entries = try rows.map { row -> Entry in
      guard let path = row["path"] as? String, let sha256 = row["sha256"] as? String, let size = (row["size"] as? NSNumber)?.int64Value,
        let kind = row["kind"] as? String else { throw unverified }
      return Entry(job: "", path: path, sha256: sha256, size: size, kind: kind, identity: row["identity"] as? String,
        completed: (row["completed"] as? NSNumber)?.int64Value)
    }
    let previous = object["previous"] as? String
    guard let expected = try? encode(keys: keys, installation: installation, target: target, sequence: sequence, previous: previous,
      entries: entries), expected.count == data.count, zip(expected, data).reduce(UInt8(0), { $0 | ($1.0 ^ $1.1) }) == 0 else { throw unverified }
    return Delta(installation: installation, target: target, sequence: sequence, previous: previous, entries: entries)
  }
}
