#if KLODA_S3_NATIVE
import Foundation
import Darwin
import CryptoKit

// Native-only descriptor input. The caller retains selected-source/foreground authority.
final class IosS3Publisher {
  let profiles: IosS3Profiles
  init(profiles: IosS3Profiles) { self.profiles = profiles }
  private func statFile(_ fd: Int32) throws -> stat {
    var value = stat()
    guard fstat(fd, &value) == 0, value.st_mode & S_IFMT == S_IFREG else { throw IosS3Failure(code: "source_changed") }
    return value
  }
  private func same(_ a: stat, _ b: stat) -> Bool {
    a.st_dev == b.st_dev && a.st_ino == b.st_ino && a.st_size == b.st_size && a.st_mtimespec.tv_sec == b.st_mtimespec.tv_sec &&
      a.st_mtimespec.tv_nsec == b.st_mtimespec.tv_nsec && a.st_ctimespec.tv_sec == b.st_ctimespec.tv_sec && a.st_ctimespec.tv_nsec == b.st_ctimespec.tv_nsec
  }
  private func read(_ fd: Int32, offset: Int64, count: Int) throws -> Data {
    var bytes = [UInt8](repeating: 0, count: count)
    let size = bytes.withUnsafeMutableBytes { pread(fd, $0.baseAddress, count, off_t(offset)) }
    guard size > 0 else { throw IosS3Failure(code: "source_changed") }
    return Data(bytes.prefix(size))
  }
  private func json(_ reply: IosS3Reply) throws -> String {
    guard let value = String(data: reply.body, encoding: .utf8) else { throw IosS3Failure(code: "review_required") }; return value
  }
  private func failure(_ status: Int) -> IosS3Failure {
    let code = [401,403].contains(status) ? "s3_auth" : status == 404 ? "target_missing" : status == 412 ? "conflict"
      : status == 409 ? "multipart_restart_required" : "review_required"
    return IosS3Failure(code: code)
  }
  func publish(_ job: IosS3Job, snapshot: Int32, currentSource: @escaping () throws -> Bool, completedSource: (() throws -> Void)? = nil) throws {
    let journal = profiles.journal
    guard try journal.state(job) == "prepared", let captured = try profiles.capture(), captured.context == job.context,
      captured.profile.target == job.target, job.size <= 5 * 1024 * 1024 * 1024 * 10000 else { throw IosS3Failure(code: "context_changed") }
    let witness = try statFile(snapshot)
    guard witness.st_size == job.size else { throw IosS3Failure(code: "source_changed") }
    func current() throws -> Bool { try profiles.current(captured) && currentSource() && same(witness, statFile(snapshot)) }
    func check() throws { guard try current() else { throw IosS3Failure(code: "context_changed") } }
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("kloda-s3-part-" + UUID().uuidString.lowercased(), isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
    defer { _ = directory.path.withCString { Darwin.rmdir($0) } }
    var stage = "source", lastStatus = 0
    do {
      try check()
      var hash = SHA256(), offset: Int64 = 0
      while offset < job.size {
        try check(); let data = try read(snapshot, offset: offset, count: Int(min(65536, job.size - offset)))
        hash.update(data: data); offset += Int64(data.count)
      }
      guard IosS3Target.hashDigest(Data(hash.finalize())) == job.sha256 else { throw IosS3Failure(code: "source_changed") }
      try journal.record(job, from: "prepared", to: "creating", current: current)
      stage = "create"; lastStatus = 0
      let created = try IosS3Client.send(profile: captured.profile, key: job.key, operation: ["kind": "create", "job": job.id.replacingOccurrences(of: "-", with: "")], check: check)
      lastStatus = created.status
      let reply = try IosS3Bridge.reply(1, status: created.status, body: json(created), target: job.target, key: job.key)
      guard reply["kind"] as? String == "created", let upload = reply["upload"] as? String else { throw failure(created.status) }
      try journal.record(job, from: "creating", to: "created", payload: ["upload": upload], current: current)
      let unit: Int64 = 1024 * 1024
      let partSize = max(5 * unit, ((job.size + 9999) / 10000 + unit - 1) / unit * unit)
      let count = max(1, (job.size + partSize - 1) / partSize)
      var etags: [String] = []
      offset = 0
      for number in 1...Int(count) {
        let length = min(partSize, job.size - offset), part = directory.appendingPathComponent("part-\(number)")
        let fd = part.path.withCString { Darwin.open($0, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600) }
        guard fd >= 0 else { throw IosS3Failure(code: "local_storage_full") }
        defer { Darwin.close(fd) }
        let owned = try statFile(fd)
        defer {
          var final = stat()
          if part.path.withCString({ lstat($0, &final) }) == 0 && final.st_dev == owned.st_dev && final.st_ino == owned.st_ino {
            _ = part.path.withCString { Darwin.unlink($0) }
          }
        }
        var copied: Int64 = 0, partHash = SHA256()
        while copied < length {
          try check(); let data = try read(snapshot, offset: offset + copied, count: Int(min(65536, length - copied)))
          try data.withUnsafeBytes { buffer in
            var written = 0
            while written < data.count {
              let size = Darwin.write(fd, buffer.baseAddress!.advanced(by: written), data.count - written)
              guard size > 0 else { throw IosS3Failure(code: "local_storage_full") }; written += size
            }
          }
          partHash.update(data: data); copied += Int64(data.count)
        }
        guard fsync(fd) == 0 else { throw IosS3Failure(code: "local_storage_full") }
        let previous = number == 1 ? "created" : "part-ack"
        try journal.record(job, from: previous, to: "part-intent", payload: ["number": number, "size": String(length), "sha256": IosS3Target.hashDigest(Data(partHash.finalize()))], current: current)
        stage = "part"; lastStatus = 0
        let uploaded = try IosS3Client.send(profile: captured.profile, key: job.key, operation: ["kind": "part", "upload": upload, "number": number], upload: part, check: check)
        lastStatus = uploaded.status
        guard uploaded.status == 200, uploaded.body.isEmpty, let etag = uploaded.headers["etag"], !etag.isEmpty, etag.utf8.count <= 1024,
          !etag.unicodeScalars.contains(where: { $0.value < 32 || (127...159).contains($0.value) }) else { throw failure(uploaded.status) }
        try journal.record(job, from: "part-intent", to: "part-ack", payload: ["number": number, "etag": etag], current: current)
        etags.append(etag); offset += length
      }
      let manifest = try JSONSerialization.data(withJSONObject: etags)
      try journal.record(job, from: "part-ack", to: "completing", payload: ["count": etags.count, "partsDigest": IosS3Target.hash(manifest)], current: current)
      stage = "complete"; lastStatus = 0
      let completed = try IosS3Client.send(profile: captured.profile, key: job.key, operation: ["kind": "complete", "upload": upload, "etags": etags], check: check)
      lastStatus = completed.status
      let ack = try IosS3Bridge.reply(2, status: completed.status, body: json(completed), target: job.target, key: job.key)
      guard ack["kind"] as? String == "completion_ack", let etag = ack["etag"] as? String else { throw failure(completed.status) }
      var proof = ["etag": etag]; if let version = completed.headers["x-amz-version-id"] { proof["version"] = version }
      try journal.record(job, from: "completing", to: "complete-ack", payload: proof, current: current)
      try check()
      var operation: [String: Any] = ["kind": "get", "version": NSNull()]
      if let version = proof["version"] { operation["version"] = version }
      stage = "verify"; lastStatus = 0
      let verification = try IosS3Client.send(profile: captured.profile, key: job.key, operation: operation, maximum: job.size, receive: { _ in try check() }, check: check)
      lastStatus = verification.status
      guard verification.status == 200, verification.size == job.size, verification.sha256 == job.sha256 else { throw IosS3Failure(code: "verification_failed") }
      try completedSource?()
      try journal.record(job, from: "complete-ack", to: "completed", payload: ["size": String(job.size), "sha256": job.sha256], current: current)
    } catch {
      if let phase = try? journal.state(job), !["completed", "aborted", "review"].contains(phase) {
        try journal.record(job, from: phase, to: "review", payload: ["code": (error as? IosS3Failure)?.code ?? "outcome_unknown", "stage": stage, "status": lastStatus], current: { false })
      }
      throw error
    }
  }
}
#endif
