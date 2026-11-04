import UIKit
import Security
import SQLite3

// Component fake ACKs only. No NSURLSession or selected-source data is read in this fixture.
@main final class S3RunApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var root: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  var automaticStage = "setup"
  var automaticOnly: Bool { Bundle.main.object(forInfoDictionaryKey: "RunsAutomaticOnly") as? Bool == true }
  var globalPause: Bool { Bundle.main.object(forInfoDictionaryKey: "RunsGlobalPause") as? Bool == true }
  var pauseOnly: Bool { Bundle.main.object(forInfoDictionaryKey: "RunsPauseOnly") as? Bool == true }
  var mode: String { CommandLine.arguments.last ?? "invalid" }
  func require(_ value: @autoclosure () throws -> Bool, line: UInt = #line) throws { if try !value() { throw IosS3Failure(code: "fixture_assertion_\(line)") } }
  func reject(_ body: () throws -> Void) throws { do { try body() } catch { return }; throw IosS3Failure(code: "fixture_missing_rejection") }
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = UIViewController(); window.makeKeyAndVisible(); self.window = window
    DispatchQueue.global().async { self.execute() }; return true
  }
  func execute() {
    do {
      try require(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "61A45399-D0F9-43C0-B356-E1EF6712E960")
      try require(Bundle.main.bundleIdentifier!.hasPrefix("com.kloda.fixture.s3files17."))
      if mode == "cleanup" {
        let service = Bundle.main.bundleIdentifier! + ".s3.s3-compatible.native.v1"
        let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
        try require(status == errSecSuccess || status == errSecItemNotFound); try require(IosS3Vault.read("s3-compatible") == nil)
      } else {
        let journal = try IosS3Journal(url: root.appendingPathComponent("runs.sqlite"), provider: "s3-compatible")
        let profiles = IosS3Profiles(journal: journal), runs = try IosS3Runs(journal: journal)
        if mode == "seed" {
          let generation = UUID().uuidString.lowercased()
          let target = IosS3Target(provider: "s3-compatible", endpoint: "https://owned.example.test", region: "us-east-1", bucket: "owned-bucket", prefix: "owned", pathStyle: true,
            accountBinding: IosS3Target.hash(Data("synthetic".utf8)), profileGeneration: generation, credentialGeneration: generation)
          try profiles.save(target, accessKey: "synthetic", secret: "synthetic-only", token: nil, check: {})
          try journal.setEnabled(true); let capture = try profiles.capture()!
          if !pauseOnly {
          let run = IosS3Run(id: UUID().uuidString.lowercased(), target: try capture.profile.target.archiveId(), binding: capture.context)
          try runs.start(run)
          let id = UUID().uuidString.lowercased(), installation = try journal.installation()
          let job = IosS3Job(id: id, installation: installation, context: capture.context, target: capture.profile.target, source: UUID().uuidString.lowercased(), reference: "owned", revision: "revision", sourceGeneration: "generation", snapshot: id + ".snapshot", key: "objects/" + installation + "/" + id, sha256: IosS3Target.hash(Data("owned".utf8)), size: 5)
          try journal.insert(job); try reject { try runs.track(run, job: job) }
          let phases = ["prepared", "creating", "created", "part-intent", "part-ack", "completing", "complete-ack"]
          for (from, to) in zip(phases, phases.dropFirst()) { try journal.record(job, from: from, to: to, current: { true }) }
          try journal.record(job, from: "complete-ack", to: "completed", payload: ["sha256": job.sha256, "size": "5"], current: { true })
          try runs.track(run, job: job); try runs.track(run, job: job)
          try require(runs.counts(run.id) == ["verifiedFiles": "1", "verifiedBytes": "5"])
          var finished = run; finished.phase = "finished"; try runs.finish(finished)
          try reject { try journal.database.execute("UPDATE s3_run SET phase='running' WHERE id=?", values: [run.id]) }
          try reject { try journal.database.execute("DELETE FROM s3_run_job WHERE run=?", values: [run.id]) }
          try IosWebDavContext.mutate { UserDefaults.standard.removeObject(forKey: "kloda.sync.directorySources") }
          let empty = try IosS3Queue(profiles: profiles, mayRun: { true }); try reject { _ = try empty.start() }; try require(empty.available())
          try run.id.write(to: root.appendingPathComponent("run-id.txt"), atomically: true, encoding: .utf8)
          }
          let folder = root.appendingPathComponent("EmptyOwnedSource"); try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
          let bookmark = try folder.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil).base64EncodedString()
          try IosWebDavContext.mutate { UserDefaults.standard.set([["id": generation, "kind": "directory", "displayName": "Owned", "reference": bookmark]], forKey: "kloda.sync.directorySources") }
          func exercise(failStore: Bool) throws {
            try journal.setEnabled(true)
            let entered = DispatchSemaphore(value: 0), release = DispatchSemaphore(value: 0), done = DispatchSemaphore(value: 0), pauseDone = DispatchSemaphore(value: 0), startDone = DispatchSemaphore(value: 0)
            let gateLock = NSLock(); var gated = false, callbacks = 0; var outcome: IosS3Run?
            let queue = try IosS3Queue(profiles: profiles) {
              gateLock.lock(); let shouldGate = Thread.current.threadDictionary["s3Starter"] == nil && !gated
              if shouldGate { gated = true }; gateLock.unlock()
              if shouldGate { entered.signal(); return release.wait(timeout: .now() + 15) == .success }; return true
            }
            if failStore { try journal.database.execute("CREATE TRIGGER owned_fail_s3_finish BEFORE UPDATE ON s3_run WHEN NEW.phase!='running' BEGIN SELECT RAISE(ABORT,'owned-failure'); END") }
            let starter = Thread {
              Thread.current.threadDictionary["s3Starter"] = true
              defer { startDone.signal() }
              do { _ = try queue.start { result in gateLock.lock(); callbacks += 1; outcome = result; gateLock.unlock(); done.signal() } } catch { done.signal() }
            }
      starter.start(); try require(entered.wait(timeout: .now() + 10) == .success)
            let before = ProcessInfo.processInfo.systemUptime; if self.globalPause { IosS3Queue.cancelAllInMemory() } else { queue.cancelInMemory() }
            try require(ProcessInfo.processInfo.systemUptime - before < 1)
            DispatchQueue.global().async { if self.globalPause { try? IosS3Queue.pauseAll() } else { try? queue.pause() }; pauseDone.signal() }
      release.signal(); try require(done.wait(timeout: .now() + 10) == .success)
            try require(startDone.wait(timeout: .now() + 5) == .success && pauseDone.wait(timeout: .now() + 5) == .success)
            gateLock.lock(); let count = callbacks, error = outcome?.error, phase = outcome?.phase; gateLock.unlock()
            try require(count == 1 && queue.available())
            if failStore {
              try require(error == "storage_failure" && queue.status()["canRun"] as? Bool == false); try reject { _ = try queue.start() }
              try journal.database.execute("DROP TRIGGER owned_fail_s3_finish")
            } else {
              try require(phase == "paused" && error != "storage_failure")
              try require(runs.read(capture.profile.target.archiveId())?.phase == "paused")
            }
            try queue.disable(); try require(!journal.enabled())
          }
          if automaticOnly { try automaticChecks(profiles, journal) }
          else { if pauseOnly { try exercise(failStore: false) }; try exercise(failStore: true) }
        } else {
          try require(mode == "reopen")
          let capture = try profiles.capture()!
          try require(!journal.enabled())
          try journal.recoverInterrupted { try runs.recover() }
          let target = try capture.profile.target.archiveId()
          try require(runs.read(target)?.phase == "paused")
          if !pauseOnly { let id = try String(contentsOf: root.appendingPathComponent("run-id.txt"), encoding: .utf8); try require(runs.counts(id)["verifiedFiles"] == "1") }
        }
      }
      try report(["status": "PASS", "phase": "finished", "mode": mode])
    } catch { try? report(["status": "FAIL", "phase": "finished", "mode": mode, "code": IosS3Queue.code(error), "automaticStage": automaticStage]) }
  }
  func automaticChecks(_ profiles: IosS3Profiles, _ journal: IosS3Journal) throws {
    for automatic in [true, false] {
      automaticStage = automatic ? "automatic-setup" : "manual-setup"
      try journal.setEnabled(true)
      let entered = DispatchSemaphore(value: 0), release = DispatchSemaphore(value: 0), done = DispatchSemaphore(value: 0), returned = DispatchSemaphore(value: 0), paused = DispatchSemaphore(value: 0)
      let state = NSLock(); var foreground = !automatic, lease = true, gated = false, armed = false, callbacks = 0; var outcome: IosS3Run?
      func allowed(_ mode: Bool) -> Bool {
        state.lock()
        let gate = armed && mode == automatic && Thread.current.threadDictionary["s3Starter"] == nil && !gated
        if gate { gated = true }; state.unlock()
        if gate { entered.signal(); _ = release.wait(timeout: .now() + 15) }
        state.lock(); defer { state.unlock() }; return mode ? lease : foreground
      }
      let queue = try IosS3Queue(profiles: profiles, mayRunAutomatic: { allowed(true) }, mayRun: { allowed(false) })
      if automatic { try require(!journal.automatic()); try reject { _ = try queue.start(automatic: true) }; try queue.setAutomatic(true) }
      state.lock(); armed = true; state.unlock()
      let starter = Thread {
        Thread.current.threadDictionary["s3Starter"] = true; defer { returned.signal() }
        do { _ = try queue.start(automatic: automatic) { value in state.lock(); callbacks += 1; outcome = value; state.unlock(); done.signal() } }
        catch { done.signal() }
      }
      automaticStage = automatic ? "automatic-enter" : "manual-enter"
      starter.start(); try require(entered.wait(timeout: .now() + 10) == .success)
      if automatic {
        let before = ProcessInfo.processInfo.systemUptime; try queue.pauseForeground()
        try require(ProcessInfo.processInfo.systemUptime - before < 1)
        state.lock(); try require(callbacks == 0); lease = false; state.unlock(); paused.signal()
      } else {
        state.lock(); foreground = false; state.unlock()
        DispatchQueue.global().async { try? queue.pauseForeground(); paused.signal() }
      }
      automaticStage = automatic ? "automatic-revoke" : "manual-revoke"
      release.signal(); try require(done.wait(timeout: .now() + 10) == .success)
      try require(returned.wait(timeout: .now() + 5) == .success && paused.wait(timeout: .now() + 5) == .success)
      state.lock(); let count = callbacks, result = outcome; state.unlock()
      try require(count == 1 && result?.phase == "paused" && queue.available())
      if automatic { try require(result?.error == "os_interrupted") }
      try require(journal.database.statement("SELECT COUNT(*) FROM s3_job") { row in sqlite3_step(row) == SQLITE_ROW && sqlite3_column_int64(row, 0) == 0 })
      automaticStage = automatic ? "automatic-disable" : "manual-disable"
      try queue.disable(); try require(!journal.automatic())
    }
  }
  func report(_ value: [String: Any]) throws { try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: root.appendingPathComponent(mode + "-result.json"), options: .atomic) }
}
