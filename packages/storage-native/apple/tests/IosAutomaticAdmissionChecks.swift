import Foundation

// Source-derived coordinator begin() is injected below; no network, Photos, vault or real OS lease.
enum FixtureFailure: Error { case code(String) }
struct FixtureProfile { func targetId() throws -> String { "target" } }
struct FixturePlan: Equatable {
  var target = "target", binding = "binding"
  var occurrence: Int64 = 1000, due: Int64 = 1000
  var run: String?
}
enum IosAutomaticPause { static var requested = false }
final class IosSyncJournal { func automaticPaused() throws -> Bool { false } }
enum IosAutomaticClock {
  static func read() throws -> (now: Int64, uptime: Int64, boot: String?) { (1000, 1000, "boot") }
}
final class IosBackgroundLease { var expired = false; var cancelled = 0; func cancel() { cancelled += 1 } }
final class BGProcessingTask { var results: [Bool] = []; func setTaskCompleted(success: Bool) { results.append(success) } }
struct FixtureRun: Equatable {
  let id: String, target: String, binding: String
  let automatic: Bool
  let occurrence: Int64
  var phase = "running", error: String?
  var attempts = 1, osAttempts = 1
  func failed(_ code: String, clock: (now: Int64, uptime: Int64, boot: String?)) throws -> Self {
    FixtureJournal.shared.failureCodes.append(code)
    var next = self; next.phase = "needs_attention"; next.error = code; return next
  }
  func retried(clock: (now: Int64, uptime: Int64, boot: String?)) throws -> Self? {
    var next = self; next.phase = "running"; next.error = nil; next.attempts += 1; return next
  }
}
final class FixtureJournal {
  static var shared = FixtureJournal()
  var stored = FixturePlan(), runs: [String: FixtureRun] = [:], failureCodes: [String] = []
  var runWrites = 0
  static func open() throws -> FixtureJournal { shared }
  func plan() throws -> FixturePlan? { stored }
  func savePlan(_ next: FixturePlan, expected: FixturePlan) throws {
    guard stored == expected else { throw FixtureFailure.code("settings_changed") }; stored = next
  }
  func run(id: String) throws -> FixtureRun? { runs[id] }
  func saveRun(_ run: FixtureRun) throws { runs[run.id] = run; runWrites += 1 }
}
enum FixtureContext {
  private static let lock = NSRecursiveLock()
  static func synchronized<T>(_ action: () throws -> T) rethrows -> T { lock.lock(); defer { lock.unlock() }; return try action() }
  static func capture(_ profile: FixtureProfile, journal: FixtureJournal) throws -> String { "binding" }
  static func check(_ profile: FixtureProfile, binding: String, journal: FixtureJournal) throws {}
}
final class Outcome { var error: String? }
final class Signals {
  let checked = DispatchSemaphore(value: 0), attempting = DispatchSemaphore(value: 0)
  let inGap = DispatchSemaphore(value: 0), done = DispatchSemaphore(value: 0)
}
final class FixtureQueue {
  static var shared = FixtureQueue()
  var busy = false, automaticStarts = 0, manualStarts = 0
  var signals: Signals?
  static func code(_ error: Error) -> String { if case FixtureFailure.code(let code) = error { return code }; return "other_error" }
  func available(lease: IosBackgroundLease?) -> Bool {
    let free = FixtureContext.synchronized { !busy }
    if free, let signals {
      signals.checked.signal()
      precondition(signals.attempting.wait(timeout: .now() + 5) == .success)
      // Fixed begin retains the outer fence; the manual start cannot finish inside this gap.
      _ = signals.inGap.wait(timeout: .now() + 1)
    }
    return free
  }
  @discardableResult func start(automatic: Bool = false, lease: IosBackgroundLease? = nil,
    prior: FixtureRun? = nil, onFinish: ((FixtureRun) -> Void)? = nil) throws -> [String: Any] {
    try FixtureContext.synchronized {
      guard !busy else { throw FixtureFailure.code("backup_busy") }
      busy = true
      if automatic { automaticStarts += 1 } else { manualStarts += 1 }
      return [:]
    }
  }
}
enum FixtureFilesRunner { static func code(_ error: Error) -> String { FixtureQueue.code(error) } }
typealias FixtureFailureAlias = FixtureFailure
final class Coordinator {
  let worker = DispatchQueue(label: "owned-admission-check")
  struct Execution {
    let token: UUID, plan: FixturePlan, profile: FixtureProfile
    let task: BGProcessingTask?, lease: IosBackgroundLease?
  }
  var active: Execution?, submitted: [FixturePlan] = [], errors: [String] = []
  func future(_ now: Int64, _ delay: Int64) throws -> Int64 { now + delay }
  func submit(_ plan: FixturePlan) throws { submitted.append(plan) }
  func reconcile(allowForeground: Bool) {}
  func report(_ code: String) { errors.append(code) }
  func finish(_ execution: Execution, result: FixtureRun) { active = nil }
  // ACTUAL_BEGIN
  func start(_ plan: FixturePlan, task: BGProcessingTask, lease: IosBackgroundLease) {
    begin(plan, profile: FixtureProfile(), task: task, lease: lease)
  }
}
@main struct Checks {
  static func reset() { FixtureQueue.shared = FixtureQueue(); FixtureJournal.shared = FixtureJournal() }
  static func race(expectProtected: Bool) throws {
    reset()
    let signals = Signals(), outcome = Outcome(), queue = FixtureQueue.shared
    queue.signals = signals
    DispatchQueue.global().async {
      precondition(signals.checked.wait(timeout: .now() + 5) == .success)
      signals.attempting.signal()
      do { try queue.start() } catch { outcome.error = FixtureQueue.code(error) }
      signals.inGap.signal(); signals.done.signal()
    }
    let coordinator = Coordinator(), task = BGProcessingTask(), lease = IosBackgroundLease()
    coordinator.start(FixturePlan(), task: task, lease: lease)
    precondition(signals.done.wait(timeout: .now() + 5) == .success)
    let journal = FixtureJournal.shared
    if expectProtected {
      precondition(queue.automaticStarts == 1 && queue.manualStarts == 0 && outcome.error == "backup_busy")
      precondition(journal.failureCodes.isEmpty && journal.runs.count == 1 && journal.runs.values.first?.phase == "running")
      precondition(journal.runs.values.first?.attempts == 1 && journal.runs.values.first?.osAttempts == 1)
      precondition(task.results.isEmpty && lease.cancelled == 0)
    } else {
      precondition(queue.automaticStarts == 0 && queue.manualStarts == 1 && outcome.error == nil)
      precondition(journal.failureCodes == ["backup_busy"] && journal.runs.values.first?.phase == "needs_attention")
    }
  }
  static func occupied(prior: Bool) throws {
    reset(); FixtureQueue.shared.busy = true
    let journal = FixtureJournal.shared
    var plan = FixturePlan()
    let run = FixtureRun(id: "old", target: "target", binding: "binding", automatic: true, occurrence: 1000,
      phase: "waiting", error: "connection_unavailable", attempts: 3, osAttempts: 2)
    if prior { plan.run = run.id; journal.runs[run.id] = run }
    journal.stored = plan
    let coordinator = Coordinator(), task = BGProcessingTask(), lease = IosBackgroundLease()
    coordinator.start(plan, task: task, lease: lease)
    precondition(journal.runWrites == 0 && journal.failureCodes.isEmpty && FixtureQueue.shared.automaticStarts == 0)
    precondition(journal.runs.count == (prior ? 1 : 0))
    if prior { precondition(journal.runs[run.id] == run) }
    precondition(journal.stored.due == 301000 && journal.stored.occurrence == plan.occurrence && journal.stored.run == plan.run)
    precondition(coordinator.submitted == [journal.stored] && task.results == [false] && lease.cancelled == 1)
  }
  static func main() throws {
    let control = CommandLine.arguments.contains("unprotected-control")
    try race(expectProtected: !control)
    if !control { try occupied(prior: false); try occupied(prior: true) }
    print(control ? "PASS negative control reproduces manual-wins backup_busy -> needs_attention" : "PASS atomic automatic admission, manual loser busy, occupied deferral and prior retry budget retained")
  }
}
