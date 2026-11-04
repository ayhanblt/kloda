import Foundation

@main struct Checks {
  static func main() throws {
    let root = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
    let journal = try IosS3Journal(url: root.appendingPathComponent("amazon.sqlite"), provider: "amazon-s3")
    if CommandLine.arguments[1] == "reopen" {
      let job = try JSONDecoder().decode(IosS3Job.self, from: Data(contentsOf: root.appendingPathComponent("job.json")))
      let before = try journal.state(job); precondition(before == "part-intent")
      try journal.recoverInterrupted(); let after = try journal.state(job); precondition(after == "review")
      do { try journal.record(job, from: "review", to: "completing", current: { true }); fatalError("review resumed") } catch {}
      print("PASS separate-process journal reopen and restart Review; no automatic completion/retry")
      return
    }
    let target = IosS3Target(provider: "amazon-s3", endpoint: "https://s3.us-east-1.amazonaws.com", region: "us-east-1",
      bucket: "owned-bucket", prefix: "owned", pathStyle: false, accountBinding: IosS3Target.hash(Data("synthetic".utf8)),
      profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    do { try journal.setEnabled(true); fatalError("no profile enabled") } catch {}
    try journal.prepareProfile(target)
    let pending = try journal.profileCurrent(target); precondition(!pending)
    try journal.confirmProfile(target); try journal.setEnabled(true)
    let id = UUID().uuidString.lowercased(), installation = try journal.installation()
    let job = IosS3Job(id: id, installation: installation, context: try journal.context(), target: target,
      source: UUID().uuidString.lowercased(), reference: "owned-source", revision: "revision1", sourceGeneration: "native-generation1",
      snapshot: id + ".snapshot", key: "objects/" + installation + "/" + id, sha256: IosS3Target.hash(Data("owned".utf8)), size: 5)
    try journal.insert(job)
    do { try journal.record(job, from: "prepared", to: "completed", payload: ["sha256": job.sha256, "size": "5"], current: { true }); fatalError("missing ACK completed") } catch {}
    do { try journal.record(job, from: "prepared", to: "creating", current: { false }); fatalError("source revoked") } catch {}
    try journal.record(job, from: "prepared", to: "creating", current: { true })
    try journal.invalidate()
    // A received ACK is retained even when permission changes during the request.
    try journal.record(job, from: "creating", to: "created", payload: ["upload": "own-id"], current: { false })
    do { try journal.record(job, from: "created", to: "part-intent", current: { true }); fatalError("old context used") } catch {}
    try journal.record(job, from: "created", to: "review", current: { false })
    do { try journal.database.execute("UPDATE s3_job SET header='tampered' WHERE id=?", values: [job.id]); fatalError("header mutated") } catch {}
    // A second, independent owned job provides the separate-process restart case.
    let nextId = UUID().uuidString.lowercased()
    let next = IosS3Job(id: nextId, installation: installation, context: try journal.context(), target: target,
      source: job.source, reference: "different-owned-source", revision: job.revision, sourceGeneration: job.sourceGeneration,
      snapshot: nextId + ".snapshot", key: "objects/" + installation + "/" + nextId, sha256: job.sha256, size: 5)
    try journal.insert(next); try journal.record(next, from: "prepared", to: "creating", current: { true })
    try journal.record(next, from: "creating", to: "created", payload: ["upload": "own-next-id"], current: { true })
    try journal.record(next, from: "created", to: "part-intent", payload: ["number": 1], current: { true })
    try JSONEncoder().encode(next).write(to: root.appendingPathComponent("job.json"), options: .atomic)
    let separate = try IosS3Journal(url: root.appendingPathComponent("compatible.sqlite"), provider: "s3-compatible")
    let separateProfile = try separate.hasProfile(); precondition(!separateProfile)
    do { _ = try IosS3Journal(url: root.appendingPathComponent("amazon.sqlite"), provider: "s3-compatible"); fatalError("provider database rebound") } catch {}
    print("PASS pending/ready, no-profile enable, mandatory admission, ACK retention, stale context, immutable header and P5/C1 isolation")
  }
}
