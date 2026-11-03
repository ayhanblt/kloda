import Foundation
import UIKit
import BackgroundTasks

final class IosWebDavAutomaticCoordinator {
  static let shared = IosWebDavAutomaticCoordinator()
  static let identifier = "com.kloda.app.webdav.processing"
  private let worker = DispatchQueue(label: "com.kloda.webdav.automatic")
  private let errorLock = NSLock()
  private var lastError: String?
  private var foreground = false
  private var timer: DispatchSourceTimer?
  private var active: Execution?
  private struct Execution {
    let token: UUID
    let plan: IosWebDavPlan
    let profile: IosCloudTarget
    let task: BGProcessingTask?
    let lease: IosBackgroundLease?
  }
  private init() {
    IosWebDavQueue.shared.onIdle = { [weak self] in self?.reconcile(allowForeground: false) }
  }
  func error() -> String? { errorLock.lock(); defer { errorLock.unlock() }; return lastError }
  private func report(_ code: String?) { errorLock.lock(); lastError = code; errorLock.unlock() }
  func register() {
    if !BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.identifier, using: .main, launchHandler: { task in
      guard let task = task as? BGProcessingTask else { task.setTaskCompleted(success: false); return }
      self.receive(task)
    }) { report("automatic_unavailable") }
    reconcile(allowForeground: false)
  }
  func uiActive() { worker.async { self.foreground = true; self.reconcileOnWorker(allowForeground: true) } }
  func uiInactive() { worker.async { self.foreground = false; self.timer?.cancel(); self.timer = nil } }
  func reconcile(allowForeground: Bool = true, clockChanged: Bool = false) {
    worker.async { self.reconcileOnWorker(allowForeground: allowForeground, clockChanged: clockChanged) }
  }
  private func live() -> Bool {
    let value = UserDefaults.standard
    return value.string(forKey: "kloda.sync.backupMode") == "live" ||
      (value.string(forKey: "kloda.sync.backupMode") == nil && value.object(forKey: "kloda.sync.intervalHours") == nil)
  }
  private func next(_ now: Int64, after occurrence: Int64? = nil) throws -> Int64 {
    if live() {
      guard let occurrence else { return now }
      let increment = occurrence.addingReportingOverflow(1)
      guard !increment.overflow else { throw IosWebDavFailure.code("retry_clock_unavailable") }
      return max(now, increment.partialValue)
    }
    return try IosAutomaticPlan.nextOccurrence(now: max(now, occurrence ?? now), intervalHours: UserDefaults.standard.object(forKey: "kloda.sync.intervalHours") as? Int ?? 12,
      localTime: UserDefaults.standard.string(forKey: "kloda.sync.localTime") ?? "12:00")
  }
  @discardableResult
  private func reconcileOnWorker(allowForeground: Bool, clockChanged: Bool = false) -> (IosWebDavPlan, IosCloudTarget)? {
    guard active == nil else { return nil }
    timer?.cancel(); timer = nil
    do {
      guard !IosAutomaticPause.requested, try !IosSyncJournal().automaticPaused() else { cancelRequest(); return nil }
      let journal = try IosWebDavJournal.open()
      guard try !IosFilesSelection.current().isEmpty || !IosPhotosSource.currentSelections().isEmpty else { cancelRequest(); return nil }
      // ADR0027 §4, sequential (user decision 2026-11-02): each enabled DAV destination keeps its own plan and the earliest
      // due one is dispatched; the others wait for the next opportunity without spending theirs.
      var candidates: [(IosWebDavPlan, IosCloudTarget)] = []
      for header in try journal.destinations() {
        guard let profile = try IosWebDavContext.stored(kind: header.kind, target: header.target), profile.revision == header.revision else { continue }
        candidates.append((try settle(profile, journal: journal, clockChanged: clockChanged), profile))
      }
      guard let (plan, profile) = candidates.min(by: { ($0.0.due, $0.0.target) < ($1.0.due, $1.0.target) }) else { cancelRequest(); return nil }
      let clock = try IosAutomaticClock.read()
      do { try submit(plan); report(nil) } catch { report(IosWebDavFilesRunner.code(error)) }
      if allowForeground && foreground && plan.due <= clock.now { begin(plan, profile: profile, task: nil, lease: nil) }
      else if foreground && plan.due > clock.now && (!live() || plan.run != nil) { arm(plan) }
      return (plan, profile)
    } catch { cancelRequest(); report(IosWebDavFilesRunner.code(error)); return nil }
  }
  // One destination's plan, settled exactly as the former single plan was.
  private func settle(_ profile: IosCloudTarget, journal: IosWebDavJournal, clockChanged: Bool) throws -> IosWebDavPlan {
    let target = try profile.targetId()
    let binding = try IosWebDavContext.capture(profile, journal: journal), clock = try IosAutomaticClock.read()
    var plan: IosWebDavPlan
    if let old = try journal.plan(target: target), old.binding == binding { plan = old }
    else {
      let due = try next(clock.now); plan = IosWebDavPlan(target: target, binding: binding, occurrence: due, due: due)
      try journal.savePlan(plan)
    }
    if let id = plan.run, var run = try journal.run(id: id) {
      guard run.target == plan.target, run.binding == plan.binding, run.automatic, run.occurrence == plan.occurrence else { throw IosWebDavFailure.code("outcome_unknown") }
      if run.phase == "running" { run = try run.failed("os_interrupted", clock: clock); try journal.saveRun(run) }
      if run.phase == "waiting" {
        let transition = try run.retried(clock: clock)
        if let transition, transition.phase != "running" { run = transition; try journal.saveRun(run) }
        if run.phase == "waiting" {
          let due = clock.now.addingReportingOverflow(max(0, run.retryUptime! - clock.uptime))
          guard !due.overflow else { throw IosWebDavFailure.code("retry_clock_unavailable") }
          let old = plan; plan.due = due.partialValue; try journal.savePlan(plan, expected: old)
        }
      }
      if ["finished", "needs_attention", "exhausted"].contains(run.phase) || (run.phase == "paused" && run.error != "user_pause") {
        let old = plan, due = try next(clock.now, after: plan.occurrence)
        plan = IosWebDavPlan(target: target, binding: binding, occurrence: due, due: due)
        try journal.savePlan(plan, expected: old)
      }
    } else if clockChanged, plan.due > clock.now {
      let old = plan, due = try next(clock.now); plan.occurrence = due; plan.due = due
      try journal.savePlan(plan, expected: old)
    }
    return plan
  }
  private func cancelRequest() { BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier) }
  private func submit(_ plan: IosWebDavPlan) throws {
    let request = BGProcessingTaskRequest(identifier: Self.identifier)
    request.earliestBeginDate = Date(timeIntervalSince1970: Double(plan.due) / 1000)
    request.requiresNetworkConnectivity = false; request.requiresExternalPower = false
    do { try BGTaskScheduler.shared.submit(request) }
    catch { throw IosWebDavFailure.code("automatic_unavailable") }
  }
  private func arm(_ plan: IosWebDavPlan) {
    let value = DispatchSource.makeTimerSource(queue: worker)
    value.schedule(wallDeadline: DispatchWallTime(timespec: timespec(tv_sec: Int(plan.due / 1000), tv_nsec: Int(plan.due % 1000) * 1_000_000)))
    value.setEventHandler { [weak self] in self?.reconcileOnWorker(allowForeground: true) }
    timer = value; value.resume()
  }
  private func receive(_ task: BGProcessingTask) {
    let lease = IosBackgroundLease(task: task)
    IosWebDavQueue.shared.setProtected(UIApplication.shared.isProtectedDataAvailable)
    let token = UUID()
    task.expirationHandler = { [weak self, weak lease] in
      lease?.expire()
      self?.worker.async {
        guard let self, let execution = self.active, execution.token == token, let run = execution.plan.run else { return }
        try? IosWebDavQueue.shared.pauseRun(run, code: "os_interrupted")
      }
    }
    worker.async {
      guard let (plan, profile) = self.reconcileOnWorker(allowForeground: false), self.active == nil else {
        lease.cancel(); task.setTaskCompleted(success: false); return
      }
      self.begin(plan, profile: profile, task: task, lease: lease, token: token)
    }
  }
  private func begin(_ expected: IosWebDavPlan, profile: IosCloudTarget, task: BGProcessingTask?, lease: IosBackgroundLease?, token: UUID = UUID()) {
    var execution: Execution?
    // Retain the manual-start fence from availability through journal setup and queue admission.
    do { try IosWebDavContext.synchronized {
      let journal = try IosWebDavJournal.open(), clock = try IosAutomaticClock.read()
      guard active == nil, try !(IosAutomaticPause.requested || IosSyncJournal().automaticPaused()), try journal.plan(target: expected.target) == expected,
        try IosWebDavContext.capture(profile, journal: journal) == expected.binding, try profile.targetId() == expected.target,
        clock.now >= expected.due else { lease?.cancel(); task?.setTaskCompleted(success: false); return }
      try IosWebDavContext.check(profile, binding: expected.binding, journal: journal)
      guard IosWebDavQueue.shared.available(lease: lease) else {
        var later = expected; later.due = try future(clock.now, 300000)
        try journal.savePlan(later, expected: expected); try submit(later)
        lease?.cancel(); task?.setTaskCompleted(success: false); return
      }
      var run: IosWebDavRun
      if let id = expected.run, let old = try journal.run(id: id) {
        guard old.target == expected.target, old.binding == expected.binding, old.automatic, old.occurrence == expected.occurrence else { throw IosWebDavFailure.code("outcome_unknown") }
        if old.phase == "waiting" {
          guard let ready = try old.retried(clock: clock), ready.phase == "running" else {
            lease?.cancel(); task?.setTaskCompleted(success: false); reconcile(allowForeground: false); return
          }
          run = ready
        } else if old.phase == "paused", old.error == "user_pause" { run = old; run.phase = "running"; run.error = nil }
        else { throw IosWebDavFailure.code("settings_changed") }
      } else { run = IosWebDavRun(id: expected.run ?? UUID().uuidString.lowercased(), target: expected.target, binding: expected.binding, automatic: true, occurrence: expected.occurrence) }
      var plan = expected; plan.run = run.id; try journal.savePlan(plan, expected: expected)
      try journal.saveRun(run)
      let value = Execution(token: token, plan: plan, profile: profile, task: task, lease: lease)
      execution = value; active = value
      try IosWebDavQueue.shared.start(automatic: true, lease: lease, prior: run) { result in self.worker.async { self.finish(value, result: result) } }
    } } catch {
      if let execution, let id = execution.plan.run {
        do {
          let journal = try IosWebDavJournal.open()
          if let run = try journal.run(id: id) {
            let result = try run.failed(lease?.expired == true ? "os_interrupted" : IosWebDavFilesRunner.code(error), clock: IosAutomaticClock.read())
            try journal.saveRun(result); finish(execution, result: result); return
          }
        } catch { report("storage_failure") }
      }
      if active?.token == token { active = nil }
      lease?.cancel(); task?.setTaskCompleted(success: false); report(IosWebDavFilesRunner.code(error))
    }
  }
  private func future(_ now: Int64, _ delay: Int64) throws -> Int64 {
    let value = now.addingReportingOverflow(delay)
    guard !value.overflow else { throw IosWebDavFailure.code("retry_clock_unavailable") }; return value.partialValue
  }
  private func finish(_ execution: Execution, result: IosWebDavRun) {
    guard active?.token == execution.token else { return }
    active = nil; execution.lease?.cancel()
    var success = false
    do {
      let journal = try IosWebDavJournal.open()
      guard try journal.run(id: result.id) == result else { throw IosWebDavFailure.code("storage_failure") }
      if try journal.plan(target: execution.plan.target) == execution.plan,
        try IosWebDavContext.capture(execution.profile, journal: journal) == execution.plan.binding {
        try IosWebDavContext.check(execution.profile, binding: execution.plan.binding, journal: journal)
        let clock = try IosAutomaticClock.read()
        var plan = execution.plan
        if result.phase == "waiting" { plan.due = try future(clock.now, max(0, result.retryUptime! - clock.uptime)) }
        else if result.phase != "paused" {
          let due = try next(clock.now, after: plan.occurrence)
          plan = IosWebDavPlan(target: plan.target, binding: plan.binding, occurrence: due, due: due)
        }
        try journal.savePlan(plan, expected: execution.plan)
        success = result.phase == "finished" && execution.lease?.expired != true
      }
    } catch { report(IosWebDavFilesRunner.code(error)) }
    execution.task?.setTaskCompleted(success: success)
    reconcile(allowForeground: false)
  }
}
