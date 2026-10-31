import Foundation

private func check(_ value: @autoclosure () throws -> Bool) throws {
  if try !value() { throw IosSmbFailure(code: "fixture_assertion") }
}
private func rejected(_ block: () throws -> Void) throws {
  do { try block() } catch { return }
  throw IosSmbFailure(code: "fixture_expected_rejection")
}
@main struct ProfileOwnerChecks {
  static func main() throws {
    guard CommandLine.arguments.count == 3 else { throw IosSmbFailure(code: "fixture_required") }
    let mode = CommandLine.arguments[1], root = URL(fileURLWithPath: CommandLine.arguments[2])
    let journal = try IosSmbJournal(databaseURL: root.appendingPathComponent("profile.sqlite"))
    func target(_ generation: String, root: String = "backup") -> IosSmbTarget {
      IosSmbTarget(address: "192.168.1.10", port: 445, share: "owned", root: root, username: "fixture", domain: "",
        profileGeneration: generation, credentialGeneration: generation)
    }
    let a = target("11111111-1111-4111-8111-111111111111")
    let b = target("22222222-2222-4222-8222-222222222222", root: "changed")
    let again = target("33333333-3333-4333-8333-333333333333")
    if mode == "prepare" {
      try check(!journal.hasProfile())
      let id = "44444444-4444-4444-8444-444444444444"
      let job = IosSmbUpload(id: id, installation: "fixture", target: a, context: try journal.context(),
        source: "55555555-5555-4555-8555-555555555555", reference: "owned.bin", revision: "1", relativePath: "owned.bin",
        snapshot: id + ".snapshot", sha256: String(repeating: "A", count: 43), size: 0, kind: "file", asset: nil)
      try journal.insert(job)
      for event in 1...5 { try journal.record(job, event: Int32(event), bytes: 0) }
      try JSONEncoder().encode(job).write(to: root.appendingPathComponent("old.json"))
      try journal.prepareProfile(a)
      try check(journal.context() != job.context && !journal.profileCurrent(a))
      try rejected { try journal.complete(job, current: { true }) }
    } else if mode == "confirm" {
      try check(journal.hasProfile() && !journal.profileCurrent(a))
      try rejected { try journal.confirmProfile(b) }
      try journal.confirmProfile(a)
      try check(journal.profileCurrent(a))
      try journal.invalidate()
      try check(journal.profileCurrent(a)) // A new work context does not replace credentials.
      try journal.prepareProfile(b)
      try check(!journal.profileCurrent(a) && !journal.profileCurrent(b))
      try rejected { try journal.confirmProfile(a) }
      try journal.confirmProfile(b)
      try journal.prepareProfile(again) // Same visible fields as A, different native generations.
      try check(!journal.profileCurrent(a) && !journal.profileCurrent(b) && !journal.profileCurrent(again))
    } else if mode == "reopen" {
      try check(journal.hasProfile() && !journal.profileCurrent(again))
      try journal.confirmProfile(again)
      try check(journal.profileCurrent(again) && !journal.profileCurrent(a))
      let old = try JSONDecoder().decode(IosSmbUpload.self, from: Data(contentsOf: root.appendingPathComponent("old.json")))
      try rejected { try journal.complete(old, current: { true }) }
      // This host executable has no app identity: actual vault failure must not mutate context.
      try check(Bundle.main.bundleIdentifier == nil)
      let before = try journal.context(), owner = IosSmbProfiles(journal: journal)
      try rejected { _ = try owner.capture() }
      try rejected { _ = try owner.save(target: a, password: "fictional-not-stored") }
      try check(journal.context() == before && journal.profileCurrent(again))
    } else { throw IosSmbFailure(code: "fixture_required") }
    print("PASS smb-profile-owner " + mode + "; no network/Keychain write; real positive Keychain runtime remains open")
  }
}
