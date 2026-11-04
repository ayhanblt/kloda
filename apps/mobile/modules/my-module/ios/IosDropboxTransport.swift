import Foundation

// Step18B/5 (ADR0028 §5): Dropbox under the DAV publication contract. Writes are create-only (`mode=add`,
// `autorename=false`, `strict_conflict=true`) and `move_v2` never renames; `inspect` downloads and hashes the bytes,
// so Dropbox's own content hash never stands in for Kloda's SHA-256. Files over 150 MiB use an upload session that
// lives only inside this transport (one run); resuming a session across runs needs its own migration.
final class IosDropboxTransport: IosBackupTransport {
  static let single: Int64 = 150 * 1024 * 1024
  static let chunk = 8 * 1024 * 1024
  private static let content = "https://content.dropboxapi.com/2/files/"
  private static let api = "https://api.dropboxapi.com/2/files/"
  let profile: IosOAuthProfile
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  private var access: String?

  init(profile: IosOAuthProfile, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) {
    self.profile = profile; self.snapshots = snapshots; self.check = check
  }

  func inspect(_ path: String, _ job: IosWebDavUpload) throws -> String {
    let arg = try Self.arg(["path": try full(path)])
    let reply = try send(Self.content + "download", mutation: false, headers: ["Dropbox-API-Arg": arg], size: job.size)
    if reply.status == 409 {
      let summary = Self.summary(reply)
      if summary.hasPrefix("path/not_found") { return "missing" }
      if summary.hasPrefix("path/not_file") { return "mismatch" }
    }
    try Self.require(reply)
    return reply.sha256 == job.sha256 && reply.size == job.size ? "match" : "mismatch"
  }
  func upload(_ path: String, _ job: IosWebDavUpload) throws {
    guard snapshots.isWebDav else { throw IosWebDavFailure.code("snapshot_unavailable") }
    let file = try snapshots.verifiedURL(job.snapshot, sha256: job.sha256, size: job.size, check: check)
    let commit: [String: Any] = ["path": try full(path), "mode": "add", "autorename": false, "mute": true, "strict_conflict": true]
    if job.size <= Self.single {
      let reply = try send(Self.content + "upload", mutation: true, headers: ["Dropbox-API-Arg": try Self.arg(commit),
        "Content-Type": "application/octet-stream"], upload: file)
      return try Self.require(reply)
    }
    let handle = try FileHandle(forReadingFrom: file)
    defer { try? handle.close() }
    var offset: Int64 = 0, session: String?
    while offset < job.size {
      try check()
      let data = try handle.read(upToCount: Int(min(Int64(Self.chunk), job.size - offset))) ?? Data()
      guard !data.isEmpty else { throw IosWebDavFailure.code("source_changed") }
      let headers = ["Content-Type": "application/octet-stream"]
      if let id = session {
        let arg = try Self.arg(["cursor": ["session_id": id, "offset": offset], "close": false])
        try Self.require(try send(Self.content + "upload_session/append_v2", mutation: true,
          headers: headers.merging(["Dropbox-API-Arg": arg]) { $1 }, data: data))
      } else {
        let reply = try send(Self.content + "upload_session/start", mutation: true,
          headers: headers.merging(["Dropbox-API-Arg": try Self.arg(["close": false])]) { $1 }, data: data, collect: true)
        try Self.require(reply)
        guard let json = try? JSONSerialization.jsonObject(with: reply.body) as? [String: Any],
          let id = json["session_id"] as? String, !id.isEmpty, id.utf8.count <= 1024 else { throw IosWebDavFailure.code("webdav_response") }
        session = id
      }
      offset += Int64(data.count)
    }
    guard let id = session, try handle.read(upToCount: 1)?.isEmpty ?? true else { throw IosWebDavFailure.code("source_changed") }
    let arg = try Self.arg(["cursor": ["session_id": id, "offset": offset], "commit": commit])
    try Self.require(try send(Self.content + "upload_session/finish", mutation: true,
      headers: ["Dropbox-API-Arg": arg, "Content-Type": "application/octet-stream"], data: Data()))
  }
  func move(_ from: String, _ to: String) throws {
    let body = try JSONSerialization.data(withJSONObject: ["from_path": try full(from), "to_path": try full(to),
      "autorename": false, "allow_ownership_transfer": false], options: [.sortedKeys])
    try Self.require(try send(Self.api + "move_v2", mutation: true, headers: ["Content-Type": "application/json"], data: body))
  }
  func download(_ path: String, _ job: IosWebDavUpload, receive: @escaping (Data) throws -> Void) throws -> IosWebDavReply {
    let arg = try Self.arg(["path": try full(path)])
    let reply = try send(Self.content + "download", mutation: false, headers: ["Dropbox-API-Arg": arg], size: job.size, receive: receive)
    try Self.require(reply)
    return reply
  }

  // 29/3: `list_folder` pages of about 100 entries (one bounded 64 KiB reply each); deleted entries are skipped.
  func list(_ folder: String) throws -> [IosRemoteChild] {
    var result: [IosRemoteChild] = [], cursor: String?
    let path = try full(folder)
    repeat {
      let request: [String: Any] = cursor.map { ["cursor": $0] } ?? ["path": path, "recursive": false, "limit": 100]
      let reply = try send(Self.api + (cursor == nil ? "list_folder" : "list_folder/continue"), mutation: false,
        headers: ["Content-Type": "application/json"], data: try JSONSerialization.data(withJSONObject: request, options: [.sortedKeys]), collect: true)
      if cursor == nil, reply.status == 409, Self.summary(reply).hasPrefix("path/not_found") { return [] }
      try Self.require(reply)
      guard let json = try? JSONSerialization.jsonObject(with: reply.body) as? [String: Any], let entries = json["entries"] as? [[String: Any]],
        let more = json["has_more"] as? Bool else { throw IosWebDavFailure.code("webdav_response") }
      for entry in entries {
        guard let tag = entry[".tag"] as? String, let name = entry["name"] as? String else { throw IosWebDavFailure.code("webdav_response") }
        if tag != "deleted" { result.append(IosRemoteChild(name: name, folder: tag == "folder")) }
      }
      cursor = more ? json["cursor"] as? String : nil
      guard !more || cursor != nil, result.count <= 100_000 else { throw IosWebDavFailure.code("webdav_response") }
    } while cursor != nil
    return result
  }

  // ADR0028: a profile saved before the display label existed gets it once, after a successful run. Best effort.
  func fillLabel() {
    guard profile.accountLabel == nil, let slot = try? profile.targetId(),
      let reply = try? send("https://api.dropboxapi.com/2/users/get_current_account", mutation: false,
        headers: ["Content-Type": "application/json"], data: Data("null".utf8), collect: true),
      reply.status == 200, let label = IosOAuthProfile.label(reply.body) else { return }
    try? IosOAuthVault.fill(label: label, slot: slot)
  }

  // The app folder is Dropbox's root for this token; the destination root sits inside it.
  private func full(_ relative: String) throws -> String {
    let parts = profile.targetPath.split(separator: "/").map(String.init) + relative.split(separator: "/").map(String.init)
    guard !parts.isEmpty, !relative.contains("\\"), !parts.contains(where: { $0 == "." || $0 == ".." || $0.utf8.count > 255 ||
      $0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }) else {
      throw IosWebDavFailure.code("backup_path_rejected")
    }
    return "/" + parts.joined(separator: "/")
  }
  // A 401 on any call means the request was not applied, so one refresh and resend is safe for writes too. A non-200
  // reply never reaches `receive`, so a resent download starts from an empty sink.
  private func send(_ url: String, mutation: Bool, headers: [String: String], upload: URL? = nil, data: Data? = nil,
    size: Int64 = 65536, collect: Bool = false, receive: ((Data) throws -> Void)? = nil) throws -> IosWebDavReply {
    var fresh = false
    if access == nil { access = try token(); fresh = true }
    while true {
      var request = URLRequest(url: URL(string: url)!)
      request.httpMethod = "POST"
      request.setValue("Bearer " + access!, forHTTPHeaderField: "Authorization")
      for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
      let reply = try IosWebDavClient.exchange(request, mutation: mutation, upload: upload, data: data, size: size,
        collect: collect, receive: receive, check: check)
      guard reply.status == 401 else { return reply }
      if fresh { throw IosWebDavFailure.code("oauth_expired") }
      access = try token(); fresh = true
    }
  }
  // Access tokens stay in memory (ADR0028 §2). A refused refresh means the grant is gone: sign in again.
  private func token() throws -> String {
    try check()
    do { return try IosOAuthLogin(.dropbox).refresh(profile.refreshToken) }
    catch IosWebDavFailure.code("oauth_login") { throw IosWebDavFailure.code("oauth_expired") }
  }

  // Dropbox-API-Arg must be HTTP header safe: 0x7F and every non-ASCII character as a JSON \uXXXX escape.
  static func arg(_ value: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    guard let json = String(data: data, encoding: .utf8) else { throw IosWebDavFailure.code("invalid_request") }
    return json.utf16.map { $0 < 0x7F ? String(UnicodeScalar(UInt8($0))) : String(format: "\\u%04x", $0) }.joined()
  }
  static func summary(_ reply: IosWebDavReply) -> String {
    (try? JSONSerialization.jsonObject(with: reply.body) as? [String: Any])?["error_summary"] as? String ?? ""
  }
  static func require(_ reply: IosWebDavReply) throws {
    if reply.status == 200 { return }
    let summary = reply.status == 409 ? Self.summary(reply) : ""
    let code: String
    if reply.status == 409, summary.contains("insufficient_space") { code = "disk_full" }
    else if reply.status == 409, summary.contains("conflict") { code = "conflict" }
    else if reply.status == 409, ["malformed_path", "disallowed_name", "too_long"].contains(where: summary.contains) { code = "backup_path_rejected" }
    else if [403].contains(reply.status) { code = "webdav_auth" }
    else if [429, 500, 502, 503, 504].contains(reply.status) { code = "connection_unavailable" }
    else { code = "webdav_response" }
    throw IosWebDavFailure.code(code)
  }
}
