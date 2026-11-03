import Foundation

final class IosWebDavQueue {
  static let shared = IosWebDavQueue()
  private let worker = DispatchQueue(label: "com.kloda.webdav.sender", attributes: .concurrent)
  private var foreground = false
  private var uiOwner: UUID?
  private var protectedData = false
  private var active: Execution?
  private var retryWork: DispatchWorkItem?
  private var lastError: String?
  var onIdle: (() -> Void)?
  private final class Execution {
    let token = UUID()
    let journal: IosWebDavJournal
    let destination: IosCloudTarget
    let binding: String
    let lease: IosBackgroundLease?
    let onFinish: ((IosWebDavRun) -> Void)?
    var run: IosWebDavRun
    init(journal: IosWebDavJournal, destination: IosCloudTarget, binding: String, run: IosWebDavRun,
      lease: IosBackgroundLease?, onFinish: ((IosWebDavRun) -> Void)?) {
      self.journal = journal; self.destination = destination; self.binding = binding; self.run = run
      self.lease = lease; self.onFinish = onFinish
    }
  }
  private init() {}
  func attachUI(_ owner: UUID) { IosWebDavContext.synchronized { uiOwner = owner; foreground = false } }
  func ownsUI(_ owner: UUID) -> Bool { IosWebDavContext.synchronized { uiOwner == owner } }
  func interactive(_ owner: UUID) -> Bool { IosWebDavContext.synchronized { uiOwner == owner && foreground } }
  func uiActive(owner: UUID, protected: Bool) {
    IosWebDavContext.synchronized { if uiOwner == owner { foreground = true; protectedData = protected } }
  }
  func setProtected(_ value: Bool) { IosWebDavContext.synchronized { protectedData = value } }
  func uiInactive(owner: UUID) {
    let token = IosWebDavContext.synchronized { () -> UUID? in
      guard uiOwner == owner else { return nil }
      foreground = false; return active?.lease == nil ? active?.token : nil
    }
    if let token { try? pause(code: "os_interrupted", expected: token) }
  }
  private func stopLocked(code: String, expected: UUID?) throws -> Execution? {
    if let expected, active?.token != expected { return nil }
    let ended = active; active = nil; retryWork?.cancel(); retryWork = nil
    guard let ended else { return nil }
    ended.lease?.cancel()
    do {
      ended.run = try ended.run.failed(code, clock: IosAutomaticClock.read())
      try ended.journal.saveRun(ended.run)
    } catch {
      lastError = "storage_failure"
      ended.run.phase = "needs_attention"; ended.run.error = "storage_failure"
      ended.run.retryAt = nil; ended.run.retryUptime = nil; ended.run.boot = nil
    }
    return ended
  }
  func available(lease: IosBackgroundLease?) -> Bool {
    IosWebDavContext.synchronized { active == nil && (foreground || lease != nil) }
  }
  func pauseRun(_ id: String, code: String) throws {
    let token = IosWebDavContext.synchronized { active?.run.id == id ? active?.token : nil }
    if let token { try pause(code: code, expected: token) }
  }
  // A destination disabled or removed (ADR0027 §4) ends only its own run.
  func pauseTarget(_ target: String, code: String = "settings_changed") throws {
    let token = IosWebDavContext.synchronized { active?.run.target == target ? active?.token : nil }
    if let token { try pause(code: code, expected: token) }
  }
  func pause(code: String = "user_pause", expected: UUID? = nil) throws {
    var ended: Execution?
    do { ended = try IosWebDavContext.synchronized { try stopLocked(code: code, expected: expected) } }
    catch { IosWebDavContext.synchronized { lastError = "storage_failure" }; throw error }
    if let ended { ended.onFinish?(ended.run) }
    if ended?.run.error == "storage_failure" { throw IosWebDavFailure.code("storage_failure") }
  }
  func configure(_ requested: IosWebDavProfile) throws {
    try requested.validate()
    var ended: Execution?
    do {
      try IosWebDavContext.synchronized {
        let journal = try IosWebDavJournal.open()
        try journal.database.execute("UPDATE backup_destination SET enabled=0 WHERE kind='webdav'")
        try journal.database.execute("UPDATE backup_context SET revision=? WHERE id=1", values: [UUID().uuidString])
        ended = try stopLocked(code: "settings_changed", expected: nil)
        if ended?.run.error == "storage_failure" { throw IosWebDavFailure.code("storage_failure") }
        let old = try IosWebDavVault.read()
        let same = old?.endpoint == requested.endpoint && old?.targetPath == requested.targetPath && old?.username == requested.username && old?.password == requested.password
        let profile: IosWebDavProfile
        if let old, same { profile = old } else { profile = requested }
        try IosWebDavVault.write(profile)
        try journal.setEnabled(kind: "webdav", id: profile.targetId(), enabled: true, revision: profile.revision)
      }
    } catch { if let ended { ended.onFinish?(ended.run) }; throw error }
    if let ended { ended.onFinish?(ended.run) }
  }
  func disable() throws {
    var ended: Execution?
    do {
      try IosWebDavContext.synchronized {
        let journal = try IosWebDavJournal.open()
        try journal.database.execute("UPDATE backup_destination SET enabled=0 WHERE kind='webdav'")
        try journal.database.execute("UPDATE backup_context SET revision=? WHERE id=1", values: [UUID().uuidString])
        ended = try stopLocked(code: "settings_changed", expected: nil)
      }
    } catch { if let ended { ended.onFinish?(ended.run) }; throw error }
    if let ended { ended.onFinish?(ended.run) }
  }
  // target == nil (and no prior run) is the original WebDAV destination's manual start.
  @discardableResult func start(automatic: Bool = false, lease: IosBackgroundLease? = nil,
    prior: IosWebDavRun? = nil, target: String? = nil, onFinish: ((IosWebDavRun) -> Void)? = nil) throws -> [String: Any] {
    let execution: Execution = try IosWebDavContext.synchronized {
      guard active == nil else { throw IosWebDavFailure.code("backup_busy") }
      guard foreground || lease != nil else { throw IosWebDavFailure.code("candidate_stale") }
      guard protectedData else { throw IosWebDavFailure.code("credential_locked") }
      if automatic, try (IosAutomaticPause.requested || IosSyncJournal().automaticPaused()) { throw IosWebDavFailure.code("user_pause") }
      try lease?.check()
      let journal = try IosWebDavJournal.open()
      let profile: IosCloudTarget
      if let target = prior?.target ?? target {
        guard let header = try journal.destination(target: target) else { throw IosWebDavFailure.code("destination_disabled") }
        guard let stored = try IosWebDavContext.stored(kind: header.kind, target: target) else { throw IosWebDavFailure.code("webdav_missing") }
        profile = stored
      } else {
        guard let stored = try IosWebDavVault.read() else { throw IosWebDavFailure.code("webdav_missing") }
        profile = .dav(stored)
      }
      let binding = try IosWebDavContext.capture(profile, journal: journal)
      try IosWebDavContext.check(profile, binding: binding, journal: journal)
      guard try !IosFilesSelection.current().isEmpty || !IosPhotosSource.currentSelections().isEmpty else { throw IosWebDavFailure.code("source_unavailable") }
      let clock = try IosAutomaticClock.read()
      let run = try prior ?? IosWebDavRun(id: UUID().uuidString.lowercased(), target: profile.targetId(), binding: binding, automatic: automatic, occurrence: clock.now)
      guard try run.target == profile.targetId(), run.binding == binding, run.automatic == automatic, run.phase == "running" else { throw IosWebDavFailure.code("settings_changed") }
      try journal.saveRun(run)
      let value = Execution(journal: journal, destination: profile, binding: binding, run: run, lease: lease, onFinish: onFinish)
      active = value; lastError = nil; return value
    }
    worker.async { self.attempt(execution) }
    return try status()
  }
  private func check(_ execution: Execution) throws {
    try IosWebDavContext.synchronized {
      guard active?.token == execution.token, execution.run.phase == "running", foreground || execution.lease != nil else { throw IosWebDavFailure.code("cancelled") }
      guard protectedData else { throw IosWebDavFailure.code("credential_locked") }
      try execution.lease?.check()
      try IosWebDavContext.check(execution.destination, binding: execution.binding, journal: execution.journal)
    }
  }
  private func attempt(_ execution: Execution) {
    do {
      try check(execution)
      let snapshots = try IosFilesSnapshot.webdav()
      let check = { try self.check(execution) }
      let publisher = IosWebDavPublisher(target: try execution.destination.targetId(), binding: execution.binding, journal: execution.journal,
        snapshots: snapshots, transport: try execution.destination.transport(snapshots: snapshots, check: check),
        check: check, settle: { value in
          try IosWebDavContext.synchronized {
            try self.check(execution)
            try IosWebDavContext.complete(value, destination: execution.destination, journal: execution.journal)
          }
        }, track: { value in
          try IosWebDavContext.synchronized { try self.check(execution); try execution.journal.track(run: execution.run, job: value) }
        })
      let files = IosWebDavFilesRunner(publisher: publisher)
      try files.run()
      let photos = IosWebDavPhotosRunner(publisher: publisher)
      try photos.run()
      finish(execution, error: photos.errorCode ?? files.errorCode)
    } catch { finish(execution, error: IosWebDavFilesRunner.code(error)) }
  }
  private func finish(_ execution: Execution, error: String?) {
    var deliver = false
    do {
      try IosWebDavContext.synchronized {
        guard active?.token == execution.token else { return }
        let clock = try IosAutomaticClock.read()
        var code = error
        if execution.lease?.expired == true { code = "os_interrupted" }
        if code == nil {
          try check(execution)
          let counts = try execution.journal.runCounts(execution.run.id)
          if counts["operations"] != counts["completedOperations"] { code = "review_required" }
        }
        if let code { execution.run = try execution.run.failed(code, clock: clock) }
        else { execution.run.phase = "finished"; execution.run.error = nil }
        try execution.journal.saveRun(execution.run)
        lastError = execution.run.error
        if execution.run.phase == "waiting", !execution.run.automatic, foreground {
          arm(execution, delay: max(0, execution.run.retryUptime! - clock.uptime))
        } else { active = nil; execution.lease?.cancel(); deliver = true }
      }
    } catch {
      IosWebDavContext.synchronized { if active?.token == execution.token { active = nil; lastError = "storage_failure" } }
      execution.lease?.cancel()
      execution.run.phase = "needs_attention"; execution.run.error = "storage_failure"
      execution.run.retryAt = nil; execution.run.retryUptime = nil; execution.run.boot = nil
      deliver = true
    }
    if deliver { execution.onFinish?(execution.run); onIdle?() }
  }
  private func arm(_ execution: Execution, delay: Int64) {
    retryWork?.cancel()
    let work = DispatchWorkItem { [weak self, weak execution] in
      guard let self, let execution else { return }
      self.retry(execution)
    }
    retryWork = work
    worker.asyncAfter(deadline: .now() + Double(delay) / 1000, execute: work)
  }
  private func retry(_ execution: Execution) {
    var deliver = false
    do {
      let ready = try IosWebDavContext.synchronized { () -> Bool in
        guard active?.token == execution.token, foreground else { return false }
        try IosWebDavContext.check(execution.destination, binding: execution.binding, journal: execution.journal)
        let clock = try IosAutomaticClock.read()
        guard let next = try execution.run.retried(clock: clock) else {
          arm(execution, delay: max(0, execution.run.retryUptime! - clock.uptime)); return false
        }
        execution.run = next; try execution.journal.saveRun(next)
        if next.phase == "waiting" { arm(execution, delay: max(0, next.retryUptime! - clock.uptime)); return false }
        if next.phase != "running" { active = nil; deliver = true; return false }
        return true
      }
      if ready { attempt(execution) }
      if deliver { execution.onFinish?(execution.run); onIdle?() }
    } catch { try? pause(code: IosWebDavFilesRunner.code(error), expected: execution.token) }
  }
  func status() throws -> [String: Any] {
    try IosWebDavContext.synchronized {
      let journal = try IosWebDavJournal.open()
      let profile = try IosWebDavVault.read()
      var result: [String: Any] = ["running": active?.run.phase == "running", "configured": profile != nil, "enabled": false]
      if let profile {
        let target = try profile.targetId()
        result["targetId"] = target
        result["config"] = ["endpoint": profile.endpoint, "targetPath": profile.targetPath, "username": profile.username]
        result["enabled"] = try journal.enabled(kind: "webdav", id: target, revision: profile.revision)
        if let run = try journal.run(target: target) { result["run"] = try view(run, journal: journal) }
      }
      if let error = lastError { result["errorCode"] = error }
      return result
    }
  }
  // Step18A/4c: the latest run of one added DAV destination, for its connections card.
  func runView(target: String) throws -> [String: Any]? {
    try IosWebDavContext.synchronized {
      let journal = try IosWebDavJournal.open()
      return try journal.run(target: target).map { try view($0, journal: journal) }
    }
  }
  private func view(_ run: IosWebDavRun, journal: IosWebDavJournal) throws -> [String: Any] {
    var state = run.phase
    if state == "running", active?.run.id != run.id { state = "paused" }
    if state == "waiting", !run.automatic, active?.run.id != run.id { state = "paused" }
    var view: [String: Any] = ["id": run.id, "targetId": run.target, "automatic": run.automatic, "state": state,
      "attempts": run.attempts, "osAttempts": run.osAttempts, "counts": try journal.runCounts(run.id)]
    if let code = run.error { view["errorCode"] = code }
    if state == "waiting", let due = run.retryAt { view["retryAt"] = String(due) }
    return view
  }
}
