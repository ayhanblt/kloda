import Foundation

// V1-3 (ADR0028 §5): Yandex Disk AppFolder under the DAV publication contract.
// Uses `Authorization: OAuth <token>`, create-only `overwrite=false` on upload & move, async operation polling (202),
// safe unauthenticated CDN redirect following on downloads, and Kloda's own SHA-256 verification.
final class IosYandexTransport: IosBackupTransport {
  private static let api = "https://cloud-api.yandex.net/v1/disk"
  private static let redirects: Set<Int> = [301, 302, 303, 307, 308]

  let profile: IosOAuthProfile
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  private var ensuredFolders: Set<String> = []

  init(profile: IosOAuthProfile, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) {
    self.profile = profile; self.snapshots = snapshots; self.check = check
  }

  func inspect(_ path: String, _ job: IosWebDavUpload) throws -> String {
    let target = Self.appPath(try parts(path))
    let meta = try send(try Self.apiUrl("resources", ["path": target, "fields": "type,size"]), method: "GET", mutation: false)
    if meta.status == 404 { return "missing" }
    try Self.require(meta, [200])
    if (try Self.jsonObject(meta.body)["type"] as? String) != "file" { return "mismatch" }
    let link = try send(try Self.apiUrl("resources/download", ["path": target]), method: "GET", mutation: false)
    if link.status == 404 { return "missing" }
    try Self.require(link, [200])
    let href = try Self.requireHttpsUrl(try Self.jsonObject(link.body)["href"] as? String ?? "")
    let dl = try downloadUrl(href, maximum: job.size, receive: nil)
    try Self.require(dl, [200])
    return dl.sha256 == job.sha256 && dl.size == job.size ? "match" : "mismatch"
  }

  func upload(_ path: String, _ job: IosWebDavUpload) throws {
    guard snapshots.isWebDav else { throw IosWebDavFailure.code("snapshot_unavailable") }
    let segs = try parts(path)
    let file = try snapshots.verifiedURL(job.snapshot, sha256: job.sha256, size: job.size, check: check)
    try ensureFolder(Array(segs.dropLast()))
    let ticket = try send(try Self.apiUrl("resources/upload", ["path": Self.appPath(segs), "overwrite": "false"]), method: "GET", mutation: false)
    try Self.require(ticket, [200])
    let href = try Self.requireHttpsUrl(try Self.jsonObject(ticket.body)["href"] as? String ?? "")
    var request = URLRequest(url: URL(string: href)!)
    request.httpMethod = "PUT"
    request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
    let reply = try IosWebDavClient.exchange(request, mutation: true, upload: file, collect: true, check: check)
    try Self.require(reply, [200, 201, 202])
  }

  func move(_ from: String, _ to: String) throws {
    let fromSegs = try parts(from), toSegs = try parts(to)
    try ensureFolder(Array(toSegs.dropLast()))
    let reply = try send(try Self.apiUrl("resources/move", ["from": Self.appPath(fromSegs), "path": Self.appPath(toSegs), "overwrite": "false"]),
      method: "POST", mutation: true)
    if reply.status == 200 || reply.status == 201 { return }
    if reply.status == 202 {
      let href = try Self.requireOperationUrl(try Self.jsonObject(reply.body)["href"] as? String ?? "")
      for _ in 0..<30 {
        try check()
        Thread.sleep(forTimeInterval: 0.5)
        try check()
        let poll = try send(URL(string: href)!, method: "GET", mutation: false)
        try Self.require(poll, [200])
        let status = try Self.jsonObject(poll.body)["status"] as? String
        if status == "success" { return }
        if status == "in-progress" { continue }
        throw IosWebDavFailure.code("webdav_response")
      }
      throw IosWebDavFailure.code("connection_unavailable")
    }
    try Self.require(reply, [200, 201])
  }

  func download(_ path: String, _ job: IosWebDavUpload, receive: @escaping (Data) throws -> Void) throws -> IosWebDavReply {
    let target = Self.appPath(try parts(path))
    let link = try send(try Self.apiUrl("resources/download", ["path": target]), method: "GET", mutation: false)
    try Self.require(link, [200])
    let href = try Self.requireHttpsUrl(try Self.jsonObject(link.body)["href"] as? String ?? "")
    let dl = try downloadUrl(href, maximum: job.size, receive: receive)
    try Self.require(dl, [200])
    return dl
  }

  func list(_ folder: String) throws -> [IosRemoteChild] {
    let target = Self.appPath(try parts(folder))
    var result: [IosRemoteChild] = []
    var offset = 0
    while true {
      let url = try Self.apiUrl("resources", ["path": target,
        "fields": "_embedded.items.name,_embedded.items.type,_embedded.total,_embedded.limit,_embedded.offset",
        "limit": "100", "offset": String(offset)])
      let reply = try send(url, method: "GET", mutation: false)
      if offset == 0, reply.status == 404 { return [] }
      try Self.require(reply, [200])
      guard let embedded = try Self.jsonObject(reply.body)["_embedded"] as? [String: Any] else { return result }
      guard let items = embedded["items"] as? [[String: Any]] else { throw IosWebDavFailure.code("webdav_response") }
      for entry in items {
        guard let name = entry["name"] as? String, let type = entry["type"] as? String else {
          throw IosWebDavFailure.code("webdav_response")
        }
        result.append(IosRemoteChild(name: name, folder: type == "dir"))
      }
      guard result.count <= 100_000 else { throw IosWebDavFailure.code("webdav_response") }
      let total = (embedded["total"] as? NSNumber)?.intValue ?? (offset + items.count)
      if items.isEmpty { break }
      offset += items.count
      if offset >= total { break }
    }
    return result
  }

  func fillLabel() {
    guard profile.accountLabel == nil, let slot = try? profile.targetId(),
      let token = try? IosOAuthLogin(.yandex).refresh(profile.refreshToken, expiresAt: profile.expiresAt) else { return }
    var request = URLRequest(url: URL(string: "https://login.yandex.ru/info?format=json")!)
    request.httpMethod = "GET"
    request.setValue("OAuth " + token, forHTTPHeaderField: "Authorization")
    guard let reply = try? IosWebDavClient.exchange(request, mutation: false, collect: true, check: check),
      reply.status == 200, let label = IosOAuthProfile.label(reply.body, provider: "yandex") else { return }
    try? IosWebDavContext.synchronized { try IosOAuthVault.fill(label: label, slot: slot) }
  }

  private func ensureFolder(_ parentParts: [String]) throws {
    guard !parentParts.isEmpty else { throw IosWebDavFailure.code("backup_path_rejected") }
    var prefix: [String] = []
    for seg in parentParts {
      prefix.append(seg)
      let remote = Self.appPath(prefix)
      if ensuredFolders.contains(remote) { continue }
      let created = try send(try Self.apiUrl("resources", ["path": remote]), method: "PUT", mutation: true)
      if created.status == 201 || (created.status == 409 && Self.errorKey(created) == "DiskPathPointsToExistentDirectoryError") {
        ensuredFolders.insert(remote)
        continue
      }
      try Self.require(created, [201])
    }
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

  private func send(_ url: URL, method: String, mutation: Bool) throws -> IosWebDavReply {
    try check()
    let token = try IosOAuthLogin(.yandex).refresh(profile.refreshToken, expiresAt: profile.expiresAt)
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("OAuth " + token, forHTTPHeaderField: "Authorization")
    let reply = try IosWebDavClient.exchange(request, mutation: mutation, collect: true, check: check)
    if reply.status == 401 { throw IosWebDavFailure.code("oauth_expired") }
    return reply
  }

  private func parts(_ relative: String) throws -> [String] {
    let all = profile.targetPath.split(separator: "/").map(String.init) + relative.split(separator: "/").map(String.init)
    guard !all.isEmpty, !relative.contains("\\"), !all.contains(where: { $0 == "." || $0 == ".." || $0.utf8.count > 255 ||
      $0.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) }) else {
      throw IosWebDavFailure.code("backup_path_rejected")
    }
    return all
  }

  private static func appPath(_ segs: [String]) -> String { "app:/" + segs.joined(separator: "/") }

  private static func apiUrl(_ endpoint: String, _ params: [String: String]) throws -> URL {
    guard var url = URLComponents(string: "\(api)/\(endpoint)") else { throw IosWebDavFailure.code("invalid_request") }
    url.queryItems = params.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
    url.percentEncodedQuery = url.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
    guard let value = url.url else { throw IosWebDavFailure.code("invalid_request") }
    return value
  }

  private static func requireHttpsUrl(_ raw: String) throws -> String {
    guard let components = URLComponents(string: raw), components.scheme == "https",
      let host = components.host, !host.isEmpty, components.user == nil, components.password == nil,
      components.url != nil else {
      throw IosWebDavFailure.code("webdav_response")
    }
    return raw
  }

  private static func requireOperationUrl(_ raw: String) throws -> String {
    _ = try requireHttpsUrl(raw)
    guard raw.hasPrefix("\(api)/operations/") else { throw IosWebDavFailure.code("webdav_response") }
    return raw
  }

  private static func resolveRedirect(_ base: String, _ location: String) throws -> String {
    guard let baseUrl = URL(string: base), let resolved = URL(string: location, relativeTo: baseUrl)?.absoluteString else {
      throw IosWebDavFailure.code("webdav_response")
    }
    return resolved
  }

  private static func jsonObject(_ data: Data) throws -> [String: Any] {
    guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw IosWebDavFailure.code("webdav_response")
    }
    return obj
  }

  static func errorKey(_ reply: IosWebDavReply) -> String {
    (try? JSONSerialization.jsonObject(with: reply.body) as? [String: Any])?["error"] as? String ?? ""
  }

  static func require(_ reply: IosWebDavReply, _ allowed: Set<Int>) throws {
    if allowed.contains(reply.status) { return }
    let key = errorKey(reply)
    let code: String
    if reply.status == 401 { code = "oauth_expired" }
    else if [413, 507].contains(reply.status) || key == "DiskLimitExceededError" { code = "disk_full" }
    else if [409, 412].contains(reply.status) { code = key == "DiskPathDoesntExistsError" ? "webdav_response" : "conflict" }
    else if reply.status == 400 { code = "backup_path_rejected" }
    else if reply.status == 403 { code = "webdav_auth" }
    else if [429, 500, 502, 503, 504].contains(reply.status) { code = "connection_unavailable" }
    else { code = "webdav_response" }
    throw IosWebDavFailure.code(code)
  }
}
