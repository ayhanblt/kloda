// Host harness: actual Swift owner/publication/journal; vault/route/SMB are doubles.
import Foundation
import Darwin
@_silgen_name("fixture_reset") private func fixtureReset(_ mode: Int32)
@_silgen_name("fixture_auth") private func fixtureAuth() -> Int32
@_silgen_name("fixture_closed") private func fixtureClosed() -> Int32

enum IosSmbVault {
  static var value: IosSmbProfile?
  static func read() throws -> IosSmbProfile? { value }
  static func write(_ profile: IosSmbProfile) throws { try profile.validate(); value = profile }
}
private func check(_ value: @autoclosure () throws -> Bool) throws {
  guard try value() else { throw IosSmbFailure(code: "fixture_assertion") }
}
@main struct LanChecks {
  static func main() throws {
    let done = DispatchSemaphore(value: 0)
    let result = ResultBox()
    DispatchQueue.global().async {
      do { try run() } catch { result.error = error }
      done.signal()
    }
    done.wait()
    if let error = result.error { throw error }
    print("PASS Swift LAN/profile/source fences and socket ownership; doubles, not OS/SMB acceptance")
  }
  private final class ResultBox { var error: Error? }
  static func run() throws {
    for scenario in ["success", "open-refused", "source-before-connect", "route-before-auth", "route-at-complete", "source-at-complete", "source-throws", "final-validation"] {
      fixtureReset(scenario == "open-refused" ? 1 : scenario == "route-before-auth" ? 2 : scenario == "route-at-complete" ? 3 : 0)
      IosSmbVault.value = nil
      let root = FileManager.default.temporaryDirectory.appendingPathComponent("smb-lan-" + UUID().uuidString)
      try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
      defer { try? FileManager.default.removeItem(at: root) }
      let journal = try IosSmbJournal(databaseURL: root.appendingPathComponent("journal.sqlite"))
      let profiles = IosSmbProfiles(journal: journal)
      let target = IosSmbTarget(address: "192.168.1.10", port: 445, share: "owned", root: "backup",
        username: "fixture", domain: "", profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
      let profile = try profiles.save(target: target, password: "fictional-double-only")
      let id = UUID().uuidString.lowercased()
      let job = IosSmbUpload(id: id, installation: "fixture", target: profile.target, context: try journal.context(),
        source: UUID().uuidString.lowercased(), reference: "owned.bin", revision: "1", relativePath: "owned.bin",
        snapshot: id + ".snapshot", sha256: String(repeating: "A", count: 43), size: 0, kind: "file", asset: nil)
      let snapshot = Darwin.open("/dev/null", O_RDONLY)
      guard snapshot >= 0 else { throw IosSmbFailure(code: "fixture_open") }
      defer { Darwin.close(snapshot) }
      var calls = 0, failure: String?
      do {
        try profiles.publishLan(job: job, snapshot: snapshot, currentSource: {
          calls += 1
          if scenario == "source-throws", calls == 3 { throw IosSmbFailure(code: "source_unavailable") }
          return scenario != "source-before-connect" && !(scenario == "source-at-complete" && calls == 4)
        }, completedSource: scenario == "final-validation" ? { false } : nil)
      } catch let error as IosSmbFailure { failure = error.code }
      try check((scenario == "success") == (failure == nil))
      try check(fixtureClosed() == 1 && fcntl(snapshot, F_GETFD) >= 0)
      let authenticated = ["success", "route-at-complete", "source-at-complete", "final-validation"].contains(scenario)
      try check(fixtureAuth() == (authenticated ? 1 : 0))
      if !["open-refused", "source-before-connect"].contains(scenario) {
        let row = try journal.state(job)
        try check(row.completed == (scenario == "success"))
        if authenticated { try check(row.step == 5) }
      }
      print("PASS " + scenario)
    }
  }
}
