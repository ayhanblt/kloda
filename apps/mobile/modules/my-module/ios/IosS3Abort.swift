#if KLODA_S3_NATIVE
import Foundation

// Never use this path for a Review/unknown completion or another profile generation.
enum IosS3Abort {
  static func run(profiles: IosS3Profiles, job: IosS3Job, current: () throws -> Bool) throws {
    let journal = profiles.journal, phase = try journal.state(job)
    guard ["created", "part-ack"].contains(phase), let capture = try profiles.capture(), capture.context == job.context,
      capture.profile.target == job.target else { throw IosS3Failure(code: "binding_changed") }
    let events = try journal.events(job, kind: "created")
    guard events.count == 1, let upload = events[0]["upload"] as? String else { throw IosS3Failure(code: "outcome_unknown") }
    func authorized() throws -> Bool { try profiles.current(capture) && journal.enabled() && current() }
    func check() throws { guard try authorized() else { throw IosS3Failure(code: "context_changed") } }
    try check(); try journal.record(job, from: phase, to: "aborting", payload: ["upload": upload], current: authorized)
    var status = 0
    do {
      let reply = try IosS3Client.send(profile: capture.profile, key: job.key, operation: ["kind": "abort", "upload": upload], check: check)
      status = reply.status
      guard status == 204, reply.body.isEmpty else { throw IosS3Failure(code: "review_required") }
      try journal.record(job, from: "aborting", to: "aborted", payload: ["status": status], current: { false })
    } catch {
      if try journal.state(job) == "aborting" {
        try journal.record(job, from: "aborting", to: "review", payload: ["code": (error as? IosS3Failure)?.code ?? "outcome_unknown", "stage": "abort", "status": status], current: { false })
      }
      throw error
    }
  }
}
#endif
