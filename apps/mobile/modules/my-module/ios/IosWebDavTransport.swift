import Foundation

final class IosWebDavTransport: IosBackupTransport {
  let profile: IosWebDavProfile
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  private var directories = Set<String>()
  init(profile: IosWebDavProfile, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) {
    self.profile = profile; self.snapshots = snapshots; self.check = check
  }
  func inspect(_ path: String, _ job: IosWebDavUpload) throws -> String {
    let reply = try IosWebDavClient.send(profile: profile, path: path, method: "GET", size: job.size, check: check)
    if reply.status == 404 { return "missing" }
    try IosWebDavClient.require(reply, [200])
    return reply.sha256 == job.sha256 && reply.size == job.size ? "match" : "mismatch"
  }
  func upload(_ path: String, _ job: IosWebDavUpload) throws {
    guard snapshots.isWebDav else { throw IosWebDavFailure.code("snapshot_unavailable") }
    let file = try snapshots.verifiedURL(job.snapshot, sha256: job.sha256, size: job.size, check: check)
    try prepareParents(path)
    let reply = try IosWebDavClient.send(profile: profile, path: path, method: "PUT",
      headers: ["If-None-Match": "*", "Content-Type": "application/octet-stream"], upload: file, check: check)
    try IosWebDavClient.require(reply, [201])
  }
  func move(_ from: String, _ to: String) throws {
    let destination = try profile.url(to).absoluteString
    let reply = try IosWebDavClient.send(profile: profile, path: from, method: "MOVE",
      headers: ["Destination": destination, "Overwrite": "F"], check: check)
    try IosWebDavClient.require(reply, [201])
  }
  func download(_ path: String, _ job: IosWebDavUpload, receive: @escaping (Data) throws -> Void) throws -> IosWebDavReply {
    let reply = try IosWebDavClient.send(profile: profile, path: path, method: "GET", size: job.size, receive: receive, check: check)
    try IosWebDavClient.require(reply, [200])
    return reply
  }
  private func prepareParents(_ path: String) throws {
    // MKCOL is create-only. A 405 never authorizes replacing an existing resource.
    let parts = profile.targetPath.split(separator: "/").map(String.init) + path.split(separator: "/").dropLast().map(String.init)
    for index in 1...parts.count {
      try check()
      let prefix = parts.prefix(index).joined(separator: "/")
      if directories.contains(prefix) { continue }
      let collection = IosWebDavProfile(revision: profile.revision, endpoint: profile.endpoint,
        targetPath: prefix, username: profile.username, password: profile.password)
      let reply = try IosWebDavClient.send(profile: collection, path: "", method: "MKCOL", check: check)
      try IosWebDavClient.require(reply, [201, 405]); directories.insert(prefix)
    }
  }
}
