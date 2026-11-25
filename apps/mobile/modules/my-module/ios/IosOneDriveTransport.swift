import Foundation
import CryptoKit

// V1-3 (ADR0028 §5): Microsoft OneDrive AppFolder under the DAV publication contract.
// All writes use `@microsoft.graph.conflictBehavior=fail`; `inspect` downloads via `@microsoft.graph.downloadUrl`
// and verifies Kloda's own SHA-256. Rotated Microsoft refresh tokens are persisted atomically via IosOAuthVault.
final class IosOneDriveTransport: IosBackupTransport {
  static let chunk = 25 * 320 * 1024 // 8,192,000 bytes: exact multiple of Graph 320 KiB, < 60 MiB.
  private static let graph = "https://graph.microsoft.com"
  private static let redirects: Set<Int> = [301, 302, 303, 307, 308]
  private static let emptySha256 = IosWebDavClient.encode(Data(SHA256.hash(data: Data())))
  private static let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

  let profile: IosOAuthProfile
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  private var access: String?
  private var currentRefresh: String
  private var folderIds: [String: String] = [:]

  init(profile: IosOAuthProfile, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) {
    self.profile = profile; self.snapshots = snapshots; self.check = check
    self.currentRefresh = profile.refreshToken
  }

  func inspect(_ path: String, _ job: IosWebDavUpload) throws -> String {
    let segs = try parts(path)
    let reply = try send(itemUrl(segs, "?$select=id,name,size,folder,@microsoft.graph.downloadUrl"), method: "GET", mutation: false, collect: true)
    if reply.status == 404 { return "missing" }
    try Self.require(reply, [200])
    let json = try Self.jsonObject(reply.body)
    if let folder = json["folder"], !(folder is NSNull) { return "mismatch" }
    if let href = json["@microsoft.graph.downloadUrl"] as? String, !href.isEmpty {
      let dl = try downloadUrl(href, maximum: job.size, receive: nil)
      try Self.require(dl, [200])
      return dl.sha256 == job.sha256 && dl.size == job.size ? "match" : "mismatch"
    }
    if (json["size"] as? NSNumber)?.int64Value == 0 {
      return job.size == 0 && job.sha256 == Self.emptySha256 ? "match" : "mismatch"
    }
    let contentReply = try send(itemActionUrl(segs, "/content"), method: "GET", mutation: false, size: job.size)
    if contentReply.status == 404 { return "missing" }
    let finalReply: IosWebDavReply
    if Self.redirects.contains(contentReply.status), let loc = contentReply.location {
      finalReply = try downloadUrl(loc, maximum: job.size, receive: nil)
      try Self.require(finalReply, [200])
    } else {
      try Self.require(contentReply, [200])
      finalReply = contentReply
    }
    return finalReply.sha256 == job.sha256 && finalReply.size == job.size ? "match" : "mismatch"
  }

  func upload(_ path: String, _ job: IosWebDavUpload) throws {
    guard snapshots.isWebDav else { throw IosWebDavFailure.code("snapshot_unavailable") }
    let segs = try parts(path)
    let file = try snapshots.verifiedURL(job.snapshot, sha256: job.sha256, size: job.size, check: check)
    if job.size == 0 {
      let parentId = try ensureFolder(Array(segs.dropLast()))
      let body = try JSONSerialization.data(withJSONObject: ["name": segs.last!, "file": [String: Any](),
        "@microsoft.graph.conflictBehavior": "fail"], options: [.sortedKeys])
      let reply = try send("\(Self.graph)/v1.0/me/drive/items/\(parentId)/children", method: "POST", mutation: true,
        headers: ["Content-Type": "application/json"], data: body, collect: true)
      try Self.require(reply, [200, 201])
      return
    }
    let sessionBody = try JSONSerialization.data(withJSONObject: ["item": ["@microsoft.graph.conflictBehavior": "fail"]], options: [.sortedKeys])
    let created = try send(itemActionUrl(segs, "/createUploadSession"), method: "POST", mutation: true,
      headers: ["Content-Type": "application/json"], data: sessionBody, collect: true)
    try Self.require(created, [200])
    let createdJson = try Self.jsonObject(created.body)
    let uploadUrl = try Self.requireHttpsUrl(createdJson["uploadUrl"] as? String ?? "")
    let handle = try FileHandle(forReadingFrom: file)
    defer { try? handle.close() }
    var offset: Int64 = 0
    while offset < job.size {
      try check()
      let data = try handle.read(upToCount: Int(min(Int64(Self.chunk), job.size - offset))) ?? Data()
      guard !data.isEmpty else { throw IosWebDavFailure.code("source_changed") }
      var request = URLRequest(url: URL(string: uploadUrl)!)
      request.httpMethod = "PUT"
      request.setValue("bytes \(offset)-\(offset + Int64(data.count) - 1)/\(job.size)", forHTTPHeaderField: "Content-Range")
      request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
      let reply = try IosWebDavClient.exchange(request, mutation: true, data: data, collect: true, check: check)
      let isLast = offset + Int64(data.count) == job.size
      try Self.require(reply, isLast ? [200, 201] : [202, 200, 201])
      offset += Int64(data.count)
    }
    guard offset == job.size, try handle.read(upToCount: 1)?.isEmpty ?? true else { throw IosWebDavFailure.code("source_changed") }
  }

  func move(_ from: String, _ to: String) throws {
    let fromSegs = try parts(from), toSegs = try parts(to)
    let meta = try send(itemUrl(fromSegs, "?$select=id,parentReference"), method: "GET", mutation: false, collect: true)
    try Self.require(meta, [200])
    let json = try Self.jsonObject(meta.body)
    guard let itemId = json["id"] as? String, Self.validId(itemId) else { throw IosWebDavFailure.code("webdav_response") }
    let fromParentId = (json["parentReference"] as? [String: Any])?["id"] as? String
    let fromParents = Array(fromSegs.dropLast()), toParents = Array(toSegs.dropLast())
    var patch: [String: Any] = ["name": toSegs.last!, "@microsoft.graph.conflictBehavior": "fail"]
    if fromParents != toParents || !(fromParentId.map(Self.validId) ?? false) {
      patch["parentReference"] = ["id": try ensureFolder(toParents)]
    }
    let body = try JSONSerialization.data(withJSONObject: patch, options: [.sortedKeys])
    let reply = try send("\(Self.graph)/v1.0/me/drive/items/\(itemId)", method: "PATCH", mutation: true,
      headers: ["Content-Type": "application/json"], data: body, collect: true)
    try Self.require(reply, [200])
  }

  func download(_ path: String, _ job: IosWebDavUpload, receive: @escaping (Data) throws -> Void) throws -> IosWebDavReply {
    let segs = try parts(path)
    let reply = try send(itemUrl(segs, "?$select=id,size,folder,@microsoft.graph.downloadUrl"), method: "GET", mutation: false, collect: true)
    try Self.require(reply, [200])
    let json = try Self.jsonObject(reply.body)
    if let folder = json["folder"], !(folder is NSNull) { throw IosWebDavFailure.code("review_required") }
    if let href = json["@microsoft.graph.downloadUrl"] as? String, !href.isEmpty {
      let dl = try downloadUrl(href, maximum: job.size, receive: receive)
      try Self.require(dl, [200])
      return dl
    }
    if (json["size"] as? NSNumber)?.int64Value == 0 {
      return IosWebDavReply(status: 200, size: 0, sha256: Self.emptySha256)
    }
    let contentReply = try send(itemActionUrl(segs, "/content"), method: "GET", mutation: false, size: job.size, receive: receive)
    if Self.redirects.contains(contentReply.status), let loc = contentReply.location {
      let dl = try downloadUrl(loc, maximum: job.size, receive: receive)
      try Self.require(dl, [200])
      return dl
    }
    try Self.require(contentReply, [200])
    return contentReply
  }

  func list(_ folder: String) throws -> [IosRemoteChild] {
    let segs = try parts(folder)
    var result: [IosRemoteChild] = []
    var nextUrl: String? = try itemActionUrl(segs, "/children?$select=name,folder&$top=100")
    var first = true
    while let url = nextUrl {
      let reply = try send(url, method: "GET", mutation: false, collect: true)
      if first, reply.status == 404 { return [] }
      first = false
      try Self.require(reply, [200])
      let json = try Self.jsonObject(reply.body)
      guard let entries = json["value"] as? [[String: Any]] else { throw IosWebDavFailure.code("webdav_response") }
      for entry in entries {
        guard let name = entry["name"] as? String else { throw IosWebDavFailure.code("webdav_response") }
        let hasFolder = entry["folder"].map { !($0 is NSNull) } ?? false
        result.append(IosRemoteChild(name: name, folder: hasFolder))
      }
      guard result.count <= 100_000 else { throw IosWebDavFailure.code("webdav_response") }
      if let candidate = json["@odata.nextLink"] as? String {
        guard candidate.hasPrefix(Self.graph + "/") else { throw IosWebDavFailure.code("webdav_response") }
        nextUrl = candidate
      } else { nextUrl = nil }
    }
    return result
  }

  func fillLabel() {
    guard profile.accountLabel == nil, let slot = try? profile.targetId(),
      let reply = try? send("\(Self.graph)/v1.0/me?$select=mail,userPrincipalName,displayName", method: "GET", mutation: false, collect: true),
      reply.status == 200, let label = IosOAuthProfile.label(reply.body, provider: "onedrive") else { return }
    try? IosWebDavContext.synchronized { try IosOAuthVault.fill(label: label, slot: slot) }
  }

  private func ensureFolder(_ parentParts: [String]) throws -> String {
    guard !parentParts.isEmpty else { throw IosWebDavFailure.code("backup_path_rejected") }
    var parentId: String?
    var prefix: [String] = []
    for seg in parentParts {
      prefix.append(seg)
      let key = prefix.joined(separator: "/")
      if let cached = folderIds[key] { parentId = cached; continue }
      let createUrl = parentId == nil ? "\(Self.graph)/v1.0/me/drive/special/approot/children"
        : "\(Self.graph)/v1.0/me/drive/items/\(parentId!)/children"
      let body = try JSONSerialization.data(withJSONObject: ["name": seg, "folder": [String: Any](),
        "@microsoft.graph.conflictBehavior": "fail"], options: [.sortedKeys])
      let created = try send(createUrl, method: "POST", mutation: true, headers: ["Content-Type": "application/json"], data: body, collect: true)
      let id: String
      if created.status == 200 || created.status == 201 {
        let json = try Self.jsonObject(created.body)
        guard let parsed = json["id"] as? String, Self.validId(parsed) else { throw IosWebDavFailure.code("webdav_response") }
        id = parsed
      } else if created.status == 409 {
        let fetched = try send(itemUrl(prefix, "?$select=id,folder"), method: "GET", mutation: false, collect: true)
        try Self.require(fetched, [200])
        let json = try Self.jsonObject(fetched.body)
        guard let folder = json["folder"], !(folder is NSNull) else { throw IosWebDavFailure.code("conflict") }
        guard let parsed = json["id"] as? String, Self.validId(parsed) else { throw IosWebDavFailure.code("webdav_response") }
        id = parsed
      } else {
        try Self.require(created, [200, 201])
        throw IosWebDavFailure.code("webdav_response")
      }
      folderIds[key] = id
      parentId = id
    }
    guard let result = parentId else { throw IosWebDavFailure.code("backup_path_rejected") }
    return result
  }

  private func downloadUrl(_ initialUrl: String, maximum: Int64, receive: ((Data) throws -> Void)?) throws -> IosWebDavReply {
    var current = try Self.requireHttpsUrl(initialUrl)
    for hop in 0...3 {
      try check()
      var request = URLRequest(url: URL(string: current)!)
      request.httpMethod = "GET"
      let reply = try IosWebDavClient.exchange(request, mutation: false, size: maximum, collect: false, receive: receive, check: check)
      if Self.redirects.contains(reply.status), let location = reply.location {
        if hop == 3 { throw IosWebDavFailure.code("connection_unavailable") }
        current = try Self.requireHttpsUrl(Self.resolveRedirect(current, location))
        continue
      }
      return reply
    }
    throw IosWebDavFailure.code("connection_unavailable")
  }

  private func send(_ url: String, method: String, mutation: Bool, headers: [String: String] = [:],
    upload: URL? = nil, data: Data? = nil, size: Int64 = 65536, collect: Bool = false,
    receive: ((Data) throws -> Void)? = nil) throws -> IosWebDavReply {
    var fresh = false
    if access == nil { access = try token(); fresh = true }
    while true {
      var request = URLRequest(url: URL(string: url)!)
      request.httpMethod = method
      request.setValue("Bearer " + access!, forHTTPHeaderField: "Authorization")
      for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
      let reply = try IosWebDavClient.exchange(request, mutation: mutation, upload: upload, data: data, size: size,
        collect: collect, receive: receive, check: check)
      guard reply.status == 401 else { return reply }
      if fresh { throw IosWebDavFailure.code("oauth_expired") }
      access = try token(); fresh = true
    }
  }

  private func token() throws -> String {
    try check()
    do {
      let refreshed = try IosOAuthLogin(.onedrive).refreshFull(currentRefresh)
      if let rotated = refreshed.refreshToken, rotated != currentRefresh {
        try IosWebDavContext.synchronized {
          try IosOAuthVault.rotate(expectedRevision: profile.revision, refreshToken: rotated, slot: try profile.targetId())
        }
        currentRefresh = rotated
      }
      return refreshed.accessToken
    } catch IosWebDavFailure.code("oauth_login") {
      throw IosWebDavFailure.code("oauth_expired")
    }
  }

  private func parts(_ relative: String) throws -> [String] {
    let all = profile.targetPath.split(separator: "/").map(String.init) + relative.split(separator: "/").map(String.init)
    guard !all.isEmpty, !relative.contains("\\"), !all.contains(where: { $0 == "." || $0 == ".." || $0.utf8.count > 255 ||
      $0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }) else {
      throw IosWebDavFailure.code("backup_path_rejected")
    }
    return all
  }

  private func itemUrl(_ segs: [String], _ suffix: String) throws -> String {
    "\(Self.graph)/v1.0/me/drive/special/approot:/\(try Self.encodePath(segs))\(suffix)"
  }

  private func itemActionUrl(_ segs: [String], _ action: String) throws -> String {
    "\(Self.graph)/v1.0/me/drive/special/approot:/\(try Self.encodePath(segs)):\(action)"
  }

  private static func encodePath(_ segs: [String]) throws -> String {
    try segs.map { seg in
      guard let encoded = seg.addingPercentEncoding(withAllowedCharacters: unreserved) else {
        throw IosWebDavFailure.code("backup_path_rejected")
      }
      return encoded
    }.joined(separator: "/")
  }

  private static func requireHttpsUrl(_ raw: String) throws -> String {
    guard let components = URLComponents(string: raw), components.scheme == "https",
      let host = components.host, !host.isEmpty, components.user == nil, components.password == nil,
      components.url != nil else {
      throw IosWebDavFailure.code("webdav_response")
    }
    return raw
  }

  private static func resolveRedirect(_ base: String, _ location: String) throws -> String {
    guard let baseUrl = URL(string: base), let resolved = URL(string: location, relativeTo: baseUrl)?.absoluteString else {
      throw IosWebDavFailure.code("webdav_response")
    }
    return resolved
  }

  private static func validId(_ value: String) -> Bool {
    !value.isEmpty && value.utf8.count <= 512 && !value.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) || $0 == "/" || $0 == "\\" })
  }

  private static func jsonObject(_ data: Data) throws -> [String: Any] {
    guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw IosWebDavFailure.code("webdav_response")
    }
    return obj
  }

  static func require(_ reply: IosWebDavReply, _ allowed: Set<Int>) throws {
    if allowed.contains(reply.status) { return }
    let errCode = ((try? JSONSerialization.jsonObject(with: reply.body) as? [String: Any])?["error"] as? [String: Any])?["code"] as? String ?? ""
    let code: String
    if reply.status == 401 { code = "oauth_expired" }
    else if reply.status == 507 || ["quotaLimitReached", "insufficientSpace"].contains(errCode) { code = "disk_full" }
    else if [409, 412].contains(reply.status) || errCode == "nameAlreadyExists" { code = "conflict" }
    else if reply.status == 400 && ["invalidRequest", "notAllowed"].contains(errCode) { code = "backup_path_rejected" }
    else if reply.status == 403 { code = "webdav_auth" }
    else if [429, 500, 502, 503, 504].contains(reply.status) { code = "connection_unavailable" }
    else { code = "webdav_response" }
    throw IosWebDavFailure.code(code)
  }
}
