import Foundation
import UIKit
import BackgroundTasks
final class IosAutomaticCoordinator {
  static let shared = IosAutomaticCoordinator()
  static let identifier = "com.kloda.app.backup.processing"
  let session = KlodaPairingSession(), files = IosFilesQueue()
  private let worker = DispatchQueue(label: "com.kloda.automatic.ios")
  private var timer: DispatchSourceTimer?
  private var foreground = false
  private var pauseBarrier = false
  private var lastError: String?
  private var active: Execution?
  private struct Execution {
    let token: UUID; let plan: IosAutomaticPlan
    var run: IosAutomaticRun
    let task: BGProcessingTask?; let lease: IosBackgroundLease?
    var admitted = false; var priorAccess = 0
  }
  private init() {
    files.onIdle = { [weak self] in DispatchQueue.main.async { self?.uiActive() } }
  }
  func register() {
    let registered = BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.identifier, using: .main) { task in
      guard let processing = task as? BGProcessingTask else { task.setTaskCompleted(success: false); return }
      self.receive(processing)
    }
    if !registered { worker.async { self.report("automatic_unavailable") } }
    reconcile()
  }
  func observed(status: [String: Any]) {
    guard status["phase"] as? String == "complete", status["repairRequired"] as? Bool == false,
      let record = status["recordId"] as? String else { return }
    worker.async {
      do {
        let journal = try IosSyncJournal()
        if try journal.automaticRecord() != record {
          try self.invalidate(journal, clearRecord: false)
          try journal.setAutomaticRecord(record)
          try self.plan(journal, allowForeground: self.foreground)
        }
      } catch { self.report(Self.code(error)) }
    }
  }
  func reconcile() { worker.async { self.reconcileOnWorker() } }
  func pause() throws {
    try worker.sync {
      pauseBarrier = true
      active?.lease?.cancel(); files.pause()
      timer?.cancel(); timer = nil
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier)
      do {
        let journal = try IosSyncJournal(); try journal.setAutomaticPaused(true)
        cancelActive(journal, userPause: true)
      } catch { end(false); lastError = "automatic_pause_not_saved"; throw IosAutomaticPolicy.error("automatic_pause_not_saved") }
    }
  }
  func resume() throws {
    try worker.sync {
      pauseBarrier = true
      let journal = try IosSyncJournal()
      try journal.setAutomaticPaused(false); pauseBarrier = false
      try plan(journal, allowForeground: foreground)
    }
  }
  func status() throws -> [String: Any] {
    try worker.sync {
      let journal = try IosSyncJournal()
      let paused = try pauseBarrier || journal.automaticPaused()
      var value: [String: Any] = ["automaticPaused": paused, "notificationsEnabled": IosBackupNotifications.enabled]
      if let run = try journal.automaticRun() {
        var row: [String: Any] = ["attempts": run.osAttempts, "accessAttempts": run.accessAttempts,
          "updated": run.updated ? 1 : 0, "state": (paused && ["running", "waiting"].contains(run.phase)) || (run.phase == "running" && active?.run.id != run.id) ? "paused" : run.phase]
        if let error = run.errorCode { row["errorCode"] = error }
        if !paused, let retry = run.retryAt { row["retryAt"] = String(retry) }
        value["automaticRun"] = row
      }
      if let error = try lastError ?? journal.automaticError() { value["automaticError"] = error }
      return value
    }
  }
  func settingsChanged() {
    worker.sync {
      active?.lease?.cancel(); files.pause()
      do { let journal = try IosSyncJournal(); try invalidate(journal, clearRecord: false); try plan(journal, allowForeground: foreground) }
      catch { end(false); report(Self.code(error)) }
    }
  }
  func invalidateForTrustChange(clearRecord: Bool = true) {
    worker.sync {
      active?.lease?.cancel(); files.pause()
      do { try invalidate(IosSyncJournal(), clearRecord: clearRecord) } catch { end(false); report(Self.code(error)) }
    }
  }
  func uiActive() {
    guard Thread.isMainThread else { DispatchQueue.main.async { self.uiActive() }; return }
    guard session.isForegroundActive else { return }
    let protected = UIApplication.shared.isProtectedDataAvailable
    worker.async { self.foreground = true; self.reconcileOnWorker(allowForeground: protected) }
  }
  func uiInactive() {
    worker.async {
      self.foreground = false; self.timer?.cancel(); self.timer = nil
      if self.active?.task == nil { self.files.pause() }
    }
  }
  func protectedDataUnavailable() {
    worker.sync {
      guard let execution = active else { return }
      execution.lease?.expire(); files.pause()
      do { let journal = try IosSyncJournal(); cancelActive(journal, userPause: false); try plan(journal, allowForeground: false) }
      catch { end(false); report(Self.code(error)) }
    }
  }
  func clockChanged() { worker.async { self.reconcileOnWorker(allowForeground: self.foreground, clockChanged: true) } }
  private func reconcileOnWorker(allowForeground: Bool = false, clockChanged: Bool = false) { do { try plan(IosSyncJournal(), allowForeground: allowForeground, clockChanged: clockChanged) }
    catch { report(Self.code(error)) }
  }
  private func live() -> Bool { UserDefaults.standard.string(forKey: "kloda.sync.backupMode") == "live" ||
    (UserDefaults.standard.object(forKey: "kloda.sync.backupMode") == nil && UserDefaults.standard.object(forKey: "kloda.sync.intervalHours") == nil) }
  private func next(_ now: Int64) throws -> Int64 {
    if live() { return now }; return try IosAutomaticPlan.nextOccurrence(now: now, intervalHours: UserDefaults.standard.object(forKey: "kloda.sync.intervalHours") as? Int ?? 12,
      localTime: UserDefaults.standard.string(forKey: "kloda.sync.localTime") ?? "12:00")
  }
  private func plan(_ journal: IosSyncJournal, allowForeground: Bool, clockChanged: Bool = false) throws {
    guard active == nil else { return }
    timer?.cancel(); timer = nil
    guard try !pauseBarrier && !journal.automaticPaused(), let record = try journal.automaticRecord(),
      try !IosFilesSelection.current().isEmpty || !IosPhotosSource.currentSelections().isEmpty else {
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier); return
    }
    let clock = try IosAutomaticClock.read(), current = try journal.automaticBinding(IosFilesSelection.binding(), record: record)
    var saved = try journal.automaticPlan()
    if saved?.binding != current || saved?.recordId != record {
      if let old = try journal.automaticRun() { try journal.saveAutomaticRun(IosAutomaticPolicy.settingsChanged(old)) }
      let due = try next(clock.now); saved = IosAutomaticPlan(binding: current, recordId: record, occurrence: due, due: due)
    }
    guard var saved else { throw IosAutomaticPolicy.error("storage_failure") }
    if let old = try journal.automaticRun(), old.binding == saved.binding, old.occurrence == saved.occurrence, old.phase == "running" {
      let stopped = try IosAutomaticPolicy.osStopped(old, now: clock.now, uptime: clock.uptime, boot: clock.boot)
      try journal.saveAutomaticRun(stopped); saved.due = stopped.retryAt ?? clock.now
    }
    if let old = try journal.automaticRun(), old.binding == saved.binding, old.occurrence == saved.occurrence {
      if old.phase == "waiting" {
        let transition = try IosAutomaticPolicy.start(prior: old, binding: old.binding, recordId: old.recordId,
          occurrence: old.occurrence, now: clock.now, uptime: clock.uptime, boot: clock.boot)
        if let transition, transition.phase != "running" { try journal.saveAutomaticRun(transition) }
        if transition?.phase == "waiting" { saved.due = transition!.retryAt! }
        else if transition?.phase == "running" { saved.due = clock.now }
        else if transition == nil {
          let projection = clock.now.addingReportingOverflow(max(0, old.retryUptime! - clock.uptime))
          guard !projection.overflow else { throw IosAutomaticPolicy.error("retry_clock_unavailable") }
          saved.due = projection.partialValue
        }
      }
      if let current = try journal.automaticRun(), ["finished", "exhausted"].contains(current.phase) { saved = try saved.advanced(now: clock.now, live: live(), next: next) }
    }
    if clockChanged, saved.due > clock.now, let old = try journal.automaticRun(), old.phase != "waiting" {
      let due = try next(clock.now); saved.occurrence = due; saved.due = due
    }
    try journal.saveAutomaticPlan(saved)
    do { try submit(saved) } catch { report(Self.code(error)) }
    if allowForeground && foreground && saved.due <= clock.now { begin(saved, task: nil, lease: nil, protected: true) }
    else if foreground && saved.due > clock.now { if try mayArm(journal) { arm(saved) } }
  }
  private func submit(_ plan: IosAutomaticPlan) throws {
    let request = BGProcessingTaskRequest(identifier: Self.identifier)
    request.earliestBeginDate = Date(timeIntervalSince1970: Double(plan.due) / 1000)
    // Internet/power constraints would silently narrow the approved offline LAN opportunity.
    request.requiresNetworkConnectivity = false; request.requiresExternalPower = false
    do { try BGTaskScheduler.shared.submit(request); lastError = nil; try IosSyncJournal().setAutomaticError(nil) }
    catch { throw IosAutomaticPolicy.error("automatic_unavailable") }
  }
  private func mayArm(_ journal: IosSyncJournal) throws -> Bool { if !live() { return true }; return try journal.automaticRun()?.phase == "waiting" }
  private func arm(_ plan: IosAutomaticPlan) {
    let source = DispatchSource.makeTimerSource(queue: worker)
    source.schedule(wallDeadline: DispatchWallTime(timespec: timespec(tv_sec: Int(plan.due / 1000), tv_nsec: Int(plan.due % 1000) * 1_000_000)))
    source.setEventHandler { [weak self] in DispatchQueue.main.async { self?.uiActive() } }
    timer = source; source.resume()
  }
  private func receive(_ task: BGProcessingTask) {
    let lease = IosBackgroundLease(task: task), protected = UIApplication.shared.isProtectedDataAvailable
    let token = UUID()
    task.expirationHandler = { [weak self] in
      lease.expire()
      self?.worker.async { self?.expire(token) }
    }
    worker.async {
      do {
        guard let plan = try IosSyncJournal().automaticPlan() else { task.setTaskCompleted(success: false); return }
        self.begin(plan, task: task, lease: lease, protected: protected, token: token)
      } catch { lease.cancel(); task.setTaskCompleted(success: false); self.report(Self.code(error)) }
    }
  }
  private func begin(_ plan: IosAutomaticPlan, task: BGProcessingTask?, lease: IosBackgroundLease?, protected: Bool, token: UUID = UUID()) {
    do {
      let journal = try IosSyncJournal(), clock = try IosAutomaticClock.read()
      guard active == nil, !pauseBarrier, try !journal.automaticPaused(),
        try journal.automaticPlan() == plan, try journal.automaticBinding(IosFilesSelection.binding(), record: plan.recordId) == plan.binding, clock.now >= plan.due else {
        lease?.cancel(); task?.setTaskCompleted(success: false); return
      }
      if try files.status()["running"] as? Bool ?? true {
        lease?.cancel(); task?.setTaskCompleted(success: false); try submit(plan); return
      }
      let old = try journal.automaticRun()
      var candidate: IosAutomaticRun?
      if let old, old.binding == plan.binding, old.recordId == plan.recordId, old.occurrence == plan.occurrence,
        old.phase == "paused", old.errorCode != "settings_changed" {
        candidate = try IosAutomaticPolicy.resumed(old, now: clock.now, uptime: clock.uptime, boot: clock.boot)
      } else { candidate = try IosAutomaticPolicy.start(prior: old, binding: plan.binding, recordId: plan.recordId, occurrence: plan.occurrence,
        now: clock.now, uptime: clock.uptime, boot: clock.boot) }
      guard var run = candidate else { task?.setTaskCompleted(success: false); return }
      guard run.phase == "running", protected, lease?.expired != true else {
        if run.phase == "running" { run.accessAttempts = old?.id == run.id ? old!.accessAttempts : 0 }
        let stopped = run.phase == "running" ? try IosAutomaticPolicy.osStopped(run, now: clock.now, uptime: clock.uptime, boot: clock.boot) : run
        try journal.saveAutomaticRun(stopped)
        var retry = plan; retry.due = stopped.retryAt ?? clock.now; try journal.saveAutomaticPlan(retry)
        lease?.cancel(); task?.setTaskCompleted(success: false); if stopped.phase == "waiting" { try submit(retry) }; return
      }
      active = Execution(token: token, plan: plan, run: run, task: task, lease: lease, priorAccess: old?.id == run.id ? old!.accessAttempts : 0)
      files.start(record: plan.recordId, rebackup: nil, session: session, background: lease, attempt: max(1, run.accessAttempts),
        onFinish: { [weak self] code in self?.worker.async { self?.finished(token, error: code) } }, onAdmitted: {
          try lease?.check()
          let counted = try IosAutomaticPolicy.accessStarted(run); try journal.saveAutomaticRun(counted)
          self.active?.run = counted; self.active?.admitted = true; IosBackupNotifications.began()
        }) { [weak self] result in
          if case .failure(let failure) = result { self?.worker.async { self?.finished(token, error: failure.code) } }
        }
    } catch { lease?.cancel(); task?.setTaskCompleted(success: false); active = nil; report(Self.code(error)) }
  }
  private func finished(_ token: UUID, error: String?) {
    DispatchQueue.main.async {
      let protected = UIApplication.shared.isProtectedDataAvailable
      self.worker.async { self.finishOnWorker(token, error: error, protected: protected) }
    }
  }
  private func finishOnWorker(_ token: UUID, error: String?, protected: Bool) {
    guard let execution = active, execution.token == token else { return }
    do {
      let journal = try IosSyncJournal(), clock = try IosAutomaticClock.read()
      guard try journal.automaticPlan() == execution.plan, try journal.automaticBinding(IosFilesSelection.binding(), record: execution.plan.recordId) == execution.plan.binding else {
        try journal.saveAutomaticRun(IosAutomaticPolicy.settingsChanged(execution.run)); end(false); return
      }
      if !execution.admitted {
        if execution.lease?.expired == true { cancelActive(journal, userPause: false); try plan(journal, allowForeground: false) }
        else { end(false); try submit(execution.plan) }; return
      }
      let result: IosAutomaticRun
      if execution.lease?.expired == true || error == "cancelled" || execution.task == nil && !foreground || error == "identity_unavailable" && !protected {
        result = try IosAutomaticPolicy.osStopped(execution.run, now: clock.now, uptime: clock.uptime, boot: clock.boot,
          userPause: pauseBarrier || journal.automaticPaused())
      } else if let error {
        result = try IosAutomaticPolicy.accessFailed(execution.run, code: error, now: clock.now, uptime: clock.uptime, boot: clock.boot)
      } else { result = try IosAutomaticPolicy.completed(execution.run) }
      try journal.saveAutomaticRun(result); IosBackupNotifications.ended(run: result); end(result.updated)
      var nextPlan = execution.plan
      if result.phase == "waiting" { nextPlan.due = result.retryAt! }
      else if result.phase != "paused" { nextPlan = try execution.plan.advanced(now: clock.now, live: live(), next: next) }
      try journal.saveAutomaticPlan(nextPlan)
      if try !pauseBarrier && !journal.automaticPaused() {
        try submit(nextPlan); if foreground && nextPlan.due > clock.now { if try mayArm(journal) { arm(nextPlan) } }
      }
    } catch { end(false); report(Self.code(error)) }
  }
  private func expire(_ token: UUID) {
    guard active?.token == token else { return }
    do { let journal = try IosSyncJournal(); cancelActive(journal, userPause: false); try plan(journal, allowForeground: false) }
    catch { report(Self.code(error)) }
  }
  private func cancelActive(_ journal: IosSyncJournal, userPause: Bool) {
    guard let execution = active else { files.pause(); return }
    execution.lease?.cancel()
    if execution.admitted || userPause { files.pause() }
    guard execution.admitted || execution.lease?.expired == true else { end(false); return }
    do {
      let clock = try IosAutomaticClock.read()
      let result = try execution.admitted
        ? IosAutomaticPolicy.osStopped(execution.run, now: clock.now, uptime: clock.uptime, boot: clock.boot, userPause: userPause)
        : IosAutomaticPolicy.stoppedBeforeAdmission(execution.run, priorAccess: execution.priorAccess, now: clock.now, uptime: clock.uptime, boot: clock.boot)
      try journal.saveAutomaticRun(result)
      var plan = execution.plan; plan.due = result.retryAt ?? clock.now; try journal.saveAutomaticPlan(plan)
    } catch { report(Self.code(error)) }
    end(false)
  }
  private func end(_ success: Bool) { IosBackupNotifications.clearProgress(); active?.lease?.cancel(); active?.task?.setTaskCompleted(success: success); active = nil }
  private func invalidate(_ journal: IosSyncJournal, clearRecord: Bool) throws {
    active?.lease?.cancel(); files.pause()
    if let old = try journal.automaticRun() { try journal.saveAutomaticRun(IosAutomaticPolicy.settingsChanged(old)) }
    end(false); timer?.cancel(); timer = nil
    try journal.advanceAutomaticContext()
    try journal.saveAutomaticPlan(nil); if clearRecord { try journal.setAutomaticRecord(nil) }
    BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier)
  }
  private func report(_ code: String) { lastError = code; try? IosSyncJournal().setAutomaticError(code) }
  private static func code(_ error: Error) -> String {
    if let value = error as? IosPairingFailure { return value.code }
    let value = (error as NSError).localizedDescription
    return ["outcome_unknown", "storage_failure", "retry_clock_unavailable", "automatic_unavailable", "paused", "settings_changed", "retry_exhausted"].contains(value) ? value : "storage_failure"
  }
}
