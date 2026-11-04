#if KLODA_S3_NATIVE
import Foundation

// Foreground manual Files work. No automatic replay of a partly acknowledged multipart job.
final class IosS3Queue {
  private static let registryLock = NSLock()
  private static let instances = NSHashTable<IosS3Queue>.weakObjects()
  private static func snapshot() -> [IosS3Queue] { registryLock.lock(); defer { registryLock.unlock() }; return instances.allObjects }
  static func cancelAllInMemory() { snapshot().forEach { $0.cancelInMemory() } }
  static func pauseAll(code: String = "user_pause") throws {
    let queues = snapshot(); queues.forEach { $0.cancelInMemory() }
    var failure: Error?
    for queue in queues { do { try queue.pause(code: code) } catch { failure = failure ?? error } }
    if let failure { throw failure }
  }
  let profiles: IosS3Profiles
  let runs: IosS3Runs
  private let mayRunAutomatic: () -> Bool
  private let mayRun: () -> Bool
  private let interruptLock = NSLock()
  private var interruptible: Execution?
  private var active: Execution?
  private var pauseFailed = false
  private final class Execution {
    let token = UUID()
    let capture: IosS3Capture
    let sources: IosS3Sources
    var run: IosS3Run
    let automatic: Bool
    let finished: ((IosS3Run) -> Void)?
    private let lock = NSLock()
    private var cancelled = false
    init(capture: IosS3Capture, sources: IosS3Sources, run: IosS3Run, finished: ((IosS3Run) -> Void)?, automatic: Bool) { self.capture = capture; self.sources = sources; self.run = run; self.finished = finished; self.automatic = automatic }
    func cancel() { lock.lock(); cancelled = true; lock.unlock() }
    func stopped() -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
  }
  init(profiles: IosS3Profiles, mayRunAutomatic: @escaping () -> Bool = { false }, mayRun: @escaping () -> Bool) throws {
    self.profiles = profiles; self.mayRun = mayRun; self.mayRunAutomatic = mayRunAutomatic; runs = try IosS3Runs(journal: profiles.journal)
    try profiles.journal.recoverInterrupted { try runs.recover() }
    Self.registryLock.lock(); Self.instances.add(self); Self.registryLock.unlock()
  }
  private func locked<T>(_ body: () throws -> T) rethrows -> T { IosS3Journal.lock.lock(); defer { IosS3Journal.lock.unlock() }; return try body() }
  private func setActive(_ value: Execution?) { active = value; interruptLock.lock(); interruptible = value; interruptLock.unlock() }
  func cancelInMemory() { interruptLock.lock(); let value = interruptible; interruptLock.unlock(); value?.cancel() }
  func available() -> Bool { locked { active == nil } }
  func enable() throws { try pause(code: "settings_changed"); try locked { try profiles.journal.setEnabled(true); pauseFailed = false } }
  func disable() throws { try pause(code: "settings_changed"); try locked { try profiles.journal.setAutomatic(false); try profiles.journal.setEnabled(false); pauseFailed = false } }
  func pause(code: String = "user_pause") throws {
    cancelInMemory()
    var failure: Error?
    let ended: Execution? = locked {
      guard let value = active else { return nil }
      setActive(nil)
      do {
        try profiles.journal.transaction {
          try profiles.journal.invalidate(); value.run.phase = "paused"; value.run.error = code; try runs.finish(value.run)
        }
      } catch { pauseFailed = true; failure = error; value.run.phase = "needs_attention"; value.run.error = "storage_failure" }
      return value
    }
    if let ended { ended.finished?(ended.run) }
    if failure != nil { throw IosS3Failure(code: "storage_failure") }
  }
  func pauseForeground() throws {
    interruptLock.lock(); let prior = interruptible; interruptLock.unlock()
    guard let prior, !prior.automatic else { return }; prior.cancel()
    try locked { if active?.token == prior.token { try pause(code: "os_interrupted") } }
  }
  func setAutomatic(_ value: Bool) throws { try pause(code: "settings_changed"); try locked { try profiles.journal.setAutomatic(value) } }
  private func allowed(_ automatic: Bool) throws -> Bool {
    if automatic { return try mayRunAutomatic() && profiles.journal.automatic() }; return mayRun()
  }
  func start(automatic: Bool = false, finished: ((IosS3Run) -> Void)? = nil) throws -> [String: Any] {
    let value: Execution = try locked {
      guard active == nil else { throw IosS3Failure(code: "backup_busy") }
      guard !pauseFailed else { throw IosS3Failure(code: "storage_failure") }
      guard try allowed(automatic) else { throw IosS3Failure(code: "candidate_stale") }
      let sources = try IosS3Sources.capture(journal: profiles.journal)
      guard try !sources.files.isEmpty || !IosPhotosSource.currentSelections().isEmpty else { throw IosS3Failure(code: "source_unavailable") }
      guard let capture = try profiles.capture(), try profiles.journal.enabled() else { throw IosS3Failure(code: "target_pause") }
      let run = IosS3Run(id: UUID().uuidString.lowercased(), target: try capture.profile.target.archiveId(), binding: capture.context)
      try profiles.journal.transaction { try runs.start(run) }
      let value = Execution(capture: capture, sources: sources, run: run, finished: finished, automatic: automatic); setActive(value); return value
    }
    DispatchQueue.global(qos: .userInitiated).async {
      var failure: String?
      do {
        try self.check(value)
        let snapshots = try IosFilesSnapshot.s3(self.profiles.journal.provider)
        try IosS3Files(profiles: self.profiles, snapshots: snapshots).run(cancelled: { (try? self.check(value)) == nil }) { job in
          try self.locked { try self.check(value); try self.runs.track(value.run, job: job) }
        }
        try IosS3Photos(profiles: self.profiles, snapshots: snapshots) { job in
          try self.locked { try self.check(value); try self.runs.track(value.run, job: job) }
        }.run(cancelled: { (try? self.check(value)) == nil })
        try self.check(value)
      } catch { failure = Self.code(error) }
      self.finish(value, error: failure)
    }
    return try status()
  }
  private func check(_ value: Execution) throws {
    try locked {
      guard !value.stopped(), active?.token == value.token else { throw IosS3Failure(code: "cancelled") }
      guard try allowed(value.automatic) else { throw IosS3Failure(code: "os_interrupted") }
      guard try profiles.journal.enabled(), try profiles.current(value.capture) else { throw IosS3Failure(code: "settings_changed") }
      try value.sources.check(journal: profiles.journal)
      guard !value.stopped(), active?.token == value.token else { throw IosS3Failure(code: "cancelled") }
    }
  }
  private func finish(_ value: Execution, error: String?) {
    let deliver = locked { () -> Bool in
      guard active?.token == value.token else { return false }
      var outcome = error
      if outcome == nil { do { try check(value) } catch { outcome = Self.code(error) } }
      let paused = value.stopped() || ["cancelled", "os_interrupted", "settings_changed", "context_changed", "user_pause", "target_pause"].contains(outcome ?? "")
      value.run.phase = paused ? "paused" : outcome == nil ? "finished" : "needs_attention"; value.run.error = outcome
      do {
        try runs.finish(value.run)
      } catch { pauseFailed = true; value.run.phase = "needs_attention"; value.run.error = "storage_failure" }
      setActive(nil); return true
    }
    if deliver { value.finished?(value.run) }
  }
  func status() throws -> [String: Any] {
    try locked {
      let capture = try profiles.capture(), enabled = try capture != nil && profiles.journal.enabled()
      var value: [String: Any] = ["automaticEnabled": try enabled && profiles.journal.automatic(), "enabled": enabled, "running": active != nil, "canRun": enabled && active == nil && !pauseFailed && mayRun()]
      if let capture, let run = try runs.read(capture.profile.target.archiveId()) {
        var summary: [String: Any] = ["id": run.id, "state": pauseFailed ? "needs_attention" : active?.run.id != run.id && run.phase == "running" ? "paused" : run.phase, "counts": try runs.counts(run.id)]
        if let error = pauseFailed ? "storage_failure" : run.error { summary["errorCode"] = error }
        value["run"] = summary
      }
      return value
    }
  }
  static func code(_ error: Error) -> String { (error as? IosS3Failure)?.code ?? (error as? IosPairingFailure)?.code ?? "storage_failure" }
}
#endif
