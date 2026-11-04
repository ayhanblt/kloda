#if KLODA_FTPS_NATIVE
import Foundation
import SQLite3

final class IosFtpsQueue {
  static let shared = IosFtpsQueue()
  private let worker = DispatchQueue(label: "com.kloda.ftps.sender", attributes: .concurrent)
  private var database: IosFtpsJournal?
  private var foregroundWork: UUID?
  private let interruptLock = NSLock()
  private var interruptible: Execution?
  private var active: Execution? { didSet { interruptLock.lock(); interruptible = active; interruptLock.unlock() } }
  private var retryWork: DispatchWorkItem?
  private let ui = IosFtpsUi()
  private var foreground: Bool { ui.foreground }
  private var protectedData: Bool { ui.protectedData }
  var onIdle: (() -> Void)?
  private final class Execution {
    let token = UUID()
    private let cancelLock = NSLock()
    private var cancelled = false
    func cancel() { cancelLock.lock(); cancelled = true; cancelLock.unlock() }
    func checkCancellation() throws { cancelLock.lock(); defer { cancelLock.unlock() }; if cancelled { throw IosFtpsFailure(code: "cancelled") } }
    let captured: IosFtpsProfileCapture
    let sources: IosFtpsSources
    let lease: IosBackgroundLease?
    let finished: ((IosFtpsRun) -> Void)?
    var run: IosFtpsRun
    init(captured: IosFtpsProfileCapture, sources: IosFtpsSources, lease: IosBackgroundLease?, run: IosFtpsRun, finished: ((IosFtpsRun) -> Void)?) {
      self.captured = captured; self.sources = sources; self.lease = lease; self.run = run; self.finished = finished
    }
  }
  private init() {}
  func journal() throws -> IosFtpsJournal {
    try IosWebDavContext.synchronized {
      if let database { return database }
      let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      var directory = base.appendingPathComponent("kloda-ftps", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700, .protectionKey: FileProtectionType.complete])
      var options = URLResourceValues(); options.isExcludedFromBackup = true; try directory.setResourceValues(options)
      let value = try IosFtpsJournal(databaseURL: directory.appendingPathComponent("journal.sqlite"))
      try value.createRuns(); try value.createPlan(); _ = try IosFtpsCopyRequests(journal: value); try value.recoverInterrupted()
      // FTPS opt-in stays in its own pin/profile generation transaction; common destination schema is unchanged.
      try value.database.execute("CREATE TABLE IF NOT EXISTS ftps_enabled(id INTEGER PRIMARY KEY CHECK(id=1),profile TEXT NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)))")
      database = value; return value
    }
  }
  func attachUI(_ owner: UUID) {
    ui.attach(owner)
    interruptLock.lock(); let prior = interruptible; interruptLock.unlock()
    if let prior, prior.lease == nil { try? pause(code: "os_interrupted", expected: prior.token) }
  }
  func ownsUI(_ owner: UUID) -> Bool { ui.owns(owner) }
  func interactive(_ owner: UUID) -> Bool { ui.interactive(owner) }
  func uiActive(owner: UUID, protected: Bool) { ui.activate(owner, protected: protected) }
  func setProtected(_ value: Bool) { ui.setProtected(value) }
  func uiInactive(owner: UUID) {
    guard ui.deactivate(owner) else { return }
    interruptLock.lock(); let prior = interruptible; interruptLock.unlock()
    if let prior, prior.lease == nil { try? pause(code: "os_interrupted", expected: prior.token) }
  }
  func enabled(_ profile: IosFtpsProfile) throws -> Bool {
    let value = profile.target.profileGeneration
    return try journal().database.statement("SELECT 1 FROM ftps_enabled WHERE id=1 AND profile=? AND enabled=1", values: [value]) { sqlite3_step($0) == SQLITE_ROW }
  }
  func configure(target: IosFtpsTarget, password: String) throws {
    try pause(code: "settings_changed")
    try IosWebDavContext.synchronized {
      let journal = try journal()
      try journal.database.execute("UPDATE ftps_enabled SET enabled=0")
      let profile = try IosFtpsProfiles(journal: journal).save(target: target, password: password)
      try journal.database.execute("BEGIN IMMEDIATE")
      do {
        guard try journal.profileCurrent(profile.target) else { throw IosFtpsFailure(code: "context_changed") }
        try journal.database.execute("INSERT OR REPLACE INTO ftps_enabled VALUES(1,?,1)", values: [profile.target.profileGeneration])
        try journal.database.execute("COMMIT")
      } catch { try? journal.database.execute("ROLLBACK"); throw error }
    }
  }
  func enable() throws {
    try pause(code: "settings_changed")
    try IosWebDavContext.synchronized {
      let journal = try journal()
      guard let profile = try IosFtpsProfiles(journal: journal).capture()?.profile else { throw IosFtpsFailure(code: "profile_missing") }
      try journal.database.execute("BEGIN IMMEDIATE")
      do {
        try journal.invalidate()
        guard try journal.profileCurrent(profile.target) else { throw IosFtpsFailure(code: "context_changed") }
        try journal.database.execute("INSERT OR REPLACE INTO ftps_enabled VALUES(1,?,1)", values: [profile.target.profileGeneration])
        try journal.database.execute("COMMIT")
      } catch { try? journal.database.execute("ROLLBACK"); throw error }
    }
  }
  func disable() throws {
    try pause(code: "settings_changed")
    try IosWebDavContext.synchronized {
      let value = try journal(); try value.database.execute("BEGIN IMMEDIATE")
      do {
        try value.invalidate(); try value.database.execute("UPDATE ftps_enabled SET enabled=0")
        try value.database.execute("COMMIT")
      } catch { try? value.database.execute("ROLLBACK"); throw error }
    }
  }
  func available(lease: IosBackgroundLease?) -> Bool { IosWebDavContext.synchronized { active == nil && foregroundWork == nil && (foreground || lease != nil) } }
  func beginReview(_ ticket: UUID) throws {
    try IosWebDavContext.synchronized {
      guard active == nil, foregroundWork == nil else { throw IosFtpsFailure(code: "backup_busy") }; foregroundWork = ticket
    }
  }
  func endReview(_ ticket: UUID) { IosWebDavContext.synchronized { if foregroundWork == ticket { foregroundWork = nil } } }
  func pauseRun(_ id: String, code: String) throws { let token = IosWebDavContext.synchronized { active?.run.id == id ? active?.token : nil }; if let token { try pause(code: code, expected: token) } }
  func pause(code: String = "user_pause", expected: UUID? = nil) throws {
    interruptLock.lock(); let current = interruptible; interruptLock.unlock()
    if expected == nil || current?.token == expected { current?.cancel() }
    var failed = false
    let ended: Execution? = IosWebDavContext.synchronized {
      if let expected, active?.token != expected { return nil }
      let old = active; active = nil; retryWork?.cancel(); retryWork = nil
      if let old {
        old.lease?.cancel()
        do { old.run = try old.run.failed(code, clock: IosAutomaticClock.read()); try journal().saveRun(old.run) }
        catch { failed = true; old.run.phase = "needs_attention"; old.run.error = "storage_failure"; old.run.retryAt = nil; old.run.retryUptime = nil; old.run.boot = nil }
      }
      return old
    }
    if let ended { ended.finished?(ended.run) }
    if failed { throw IosFtpsFailure(code: "storage_failure") }
  }
  @discardableResult func start(automatic: Bool = false, lease: IosBackgroundLease? = nil, prior: IosFtpsRun? = nil,
    onFinish: ((IosFtpsRun) -> Void)? = nil) throws -> [String: Any] {
    let execution = try IosWebDavContext.synchronized { () -> Execution in
      guard active == nil, foregroundWork == nil else { throw IosFtpsFailure(code: "backup_busy") }
      guard foreground || lease != nil else { throw IosFtpsFailure(code: "candidate_stale") }
      guard protectedData else { throw IosFtpsFailure(code: "credential_locked") }
      if automatic, try (IosAutomaticPause.requested || IosSyncJournal().automaticPaused()) { throw IosFtpsFailure(code: "user_pause") }
      try lease?.check()
      let journal = try journal(), sources = try IosFtpsSources.capture(journal: journal)
      guard try !sources.files.isEmpty || !IosPhotosSource.currentSelections().isEmpty else { throw IosFtpsFailure(code: "source_unavailable") }
      guard let captured = try IosFtpsProfiles(journal: journal).capture(), try enabled(captured.profile) else { throw IosFtpsFailure(code: "profile_missing") }
      let clock = try IosAutomaticClock.read()
      let run = try prior ?? IosFtpsRun(id: UUID().uuidString.lowercased(), target: captured.profile.target.archiveId(), binding: captured.context, automatic: automatic, occurrence: clock.now)
      guard try run.target == captured.profile.target.archiveId(), run.binding == captured.context, run.automatic == automatic, run.phase == "running" else { throw IosFtpsFailure(code: "context_changed") }
      try journal.saveRun(run)
      let value = Execution(captured: captured, sources: sources, lease: lease, run: run, finished: onFinish); active = value; return value
    }
    worker.async { self.attempt(execution) }; return try status()
  }
  private func check(_ value: Execution) throws {
    try IosWebDavContext.synchronized {
      guard active?.token == value.token, value.run.phase == "running", foreground || value.lease != nil else { throw IosFtpsFailure(code: "cancelled") }
      guard protectedData else { throw IosFtpsFailure(code: "credential_locked") }
      try value.checkCancellation(); try value.lease?.check()
      if value.run.automatic, try (IosAutomaticPause.requested || IosSyncJournal().automaticPaused()) { throw IosFtpsFailure(code: "user_pause") }
      let journal = try journal()
      guard try enabled(value.captured.profile), try IosFtpsProfiles(journal: journal).current(value.captured) else { throw IosFtpsFailure(code: "context_changed") }
      try value.sources.check(journal: journal)
    }
  }
  private func attempt(_ value: Execution) {
    do {
      try check(value)
      let journal = try journal(), profiles = IosFtpsProfiles(journal: journal), snapshots = try IosFilesSnapshot.ftps()
      let track = { (job: IosFtpsUpload) in try IosWebDavContext.synchronized { try self.check(value); try journal.track(run: value.run, job: job) } }
      let cancelled = { (try? self.check(value)) == nil }
      try IosFtpsFiles(profiles: profiles, snapshots: snapshots, track: track).run(cancelled: cancelled)
      try check(value)
      try IosFtpsPhotos(profiles: profiles, snapshots: snapshots, track: track).run(cancelled: cancelled)
      finish(value, error: nil)
    } catch { finish(value, error: Self.code(error)) }
  }
  private func finish(_ value: Execution, error: String?) {
    var deliver = false
    do {
      try IosWebDavContext.synchronized {
        guard active?.token == value.token else { return }
        var outcome = error
        if outcome == nil {
          try check(value)
          let counts = try journal().runCounts(value.run.id)
          if counts["operations"] != counts["completedOperations"] { outcome = "review_required" }
        }
        if let outcome { value.run = try value.run.failed(outcome, clock: IosAutomaticClock.read()) }
        else { value.run.phase = "finished"; value.run.error = nil }
        try journal().saveRun(value.run)
        if value.run.phase == "waiting", !value.run.automatic, foreground { arm(value) }
        else { active = nil; value.lease?.cancel(); deliver = true }
      }
    } catch {
      IosWebDavContext.synchronized { if active?.token == value.token { active = nil } }
      value.lease?.cancel(); value.run.phase = "needs_attention"; value.run.error = "storage_failure"
      value.run.retryAt = nil; value.run.retryUptime = nil; value.run.boot = nil; deliver = true
    }
    if deliver { value.finished?(value.run); onIdle?() }
  }
  private func arm(_ value: Execution) {
    retryWork?.cancel()
    let work = DispatchWorkItem {
      var terminal = false
      do {
        let ready = try IosWebDavContext.synchronized { () -> Bool in
          guard self.active?.token == value.token, self.foreground else { return false }
          let journal = try self.journal()
          guard try IosFtpsProfiles(journal: journal).current(value.captured) else { throw IosFtpsFailure(code: "context_changed") }
          try value.sources.check(journal: journal)
          guard let next = try value.run.retried(clock: IosAutomaticClock.read()) else { self.arm(value); return false }
          value.run = next; try journal.saveRun(next)
          if next.phase == "waiting" { self.arm(value); return false }
          if next.phase != "running" { self.active = nil; value.lease?.cancel(); terminal = true }
          return next.phase == "running"
        }
        if ready { self.attempt(value) }
        if terminal { value.finished?(value.run); self.onIdle?() }
      } catch { try? self.pause(code: Self.code(error), expected: value.token) }
    }
    retryWork = work
    let delay = max(0, value.run.retryUptime! - ((try? IosAutomaticClock.read().uptime) ?? 0))
    worker.asyncAfter(deadline: .now() + Double(delay) / 1000, execute: work)
  }
  func status() throws -> [String: Any] {
    try IosWebDavContext.synchronized {
      let journal = try journal(), profile = try IosFtpsProfiles(journal: journal).capture()?.profile
      var result: [String: Any] = ["running": active?.run.phase == "running", "configured": profile != nil, "enabled": false]
      if let profile {
        let target = try profile.target.archiveId(); result["targetId"] = target; result["enabled"] = try enabled(profile)
        result["config"] = ["address": profile.target.address, "port": profile.target.port, "hostname": profile.target.hostname, "root": profile.target.root, "username": profile.target.username]
        if let run = try journal.run(target: target) {
          let state = active?.run.id != run.id && (run.phase == "running" || !run.automatic && run.phase == "waiting") ? "paused" : run.phase
          var view: [String: Any] = ["id": run.id, "targetId": target, "automatic": run.automatic, "state": state, "attempts": run.attempts, "osAttempts": run.osAttempts, "counts": try journal.runCounts(run.id)]
          if let error = run.error { view["errorCode"] = error }; if state == "waiting", let due = run.retryAt { view["retryAt"] = String(due) }; result["run"] = view
        }
      }
      return result
    }
  }
  static func code(_ error: Error) -> String { (error as? IosFtpsFailure)?.code ?? IosFilesQueue.failure(error).code }
}
#endif
