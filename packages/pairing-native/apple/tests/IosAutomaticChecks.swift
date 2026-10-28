import Foundation

@main struct IosAutomaticChecks {
  static let record = String(repeating: "A", count: 22)
  static func reject(_ action: () throws -> Void) {
    do { try action(); fatalError("Invalid automatic transition accepted") } catch {}
  }
  static func checked(_ value: @autoclosure () throws -> Bool) throws {
    let result = try value(); precondition(result)
  }
  static func fresh(_ occurrence: Int64 = 1000) throws -> IosAutomaticRun {
    try IosAutomaticPolicy.start(prior: nil, binding: "binding", recordId: record, occurrence: occurrence,
      now: occurrence, uptime: 100, boot: "boot-one")!
  }

  static func policy() throws {
    let first = try fresh()
    precondition(first.osAttempts == 1 && first.accessAttempts == 0 && !first.updated)
    try checked(try IosAutomaticPolicy.start(prior: first, binding: first.binding, recordId: record,
      occurrence: first.occurrence, now: 1000, uptime: 100, boot: "boot-one") == nil)
    let earlyExpiry = try IosAutomaticPolicy.stoppedBeforeAdmission(first, priorAccess: 0, now: 1000, uptime: 100, boot: "boot-one")
    precondition(earlyExpiry.phase == "waiting" && earlyExpiry.osAttempts == 1 && earlyExpiry.accessAttempts == 0)
    precondition(earlyExpiry.errorCode == "os_interrupted" && earlyExpiry.retryAt == 301000)
    var lastOsSlot = first; lastOsSlot.osAttempts = 5
    let expiredLast = try IosAutomaticPolicy.stoppedBeforeAdmission(lastOsSlot, priorAccess: 0, now: 1000, uptime: 100, boot: "boot-one")
    precondition(expiredLast.phase == "exhausted" && expiredLast.osAttempts == 5 && expiredLast.accessAttempts == 0 && !expiredLast.updated)
    let access = try IosAutomaticPolicy.accessStarted(first)
    let denied = try IosAutomaticPolicy.accessFailed(access, code: "access_denied", now: 1000, uptime: 100, boot: "boot-one")
    precondition(denied.phase == "exhausted" && !denied.updated && denied.errorCode == "access_denied")
    let wait = try IosAutomaticPolicy.accessFailed(access, code: "connection_closed", now: 1000, uptime: 100, boot: "boot-one")
    precondition(wait.retryAt == 61000 && wait.retryUptime == 60100 && wait.accessAttempts == 1 && wait.osAttempts == 1)
    let early = try IosAutomaticPolicy.start(prior: wait, binding: wait.binding, recordId: record,
      occurrence: wait.occurrence, now: 9000000, uptime: 60099, boot: "boot-one")
    precondition(early == nil)
    let due = try IosAutomaticPolicy.start(prior: wait, binding: wait.binding, recordId: record,
      occurrence: wait.occurrence, now: 0, uptime: 60100, boot: "boot-one")!
    precondition(due.phase == "running" && due.osAttempts == 1 && due.accessAttempts == 2)
    let notAdmitted = try IosAutomaticPolicy.stoppedBeforeAdmission(due, priorAccess: wait.accessAttempts, now: 61000, uptime: 60100, boot: "boot-one")
    precondition(notAdmitted.accessAttempts == 1 && notAdmitted.osAttempts == 1 && notAdmitted.phase == "waiting")
    let admitted = try IosAutomaticPolicy.accessStarted(due)
    let admittedExpiry = try IosAutomaticPolicy.osStopped(admitted, now: 61000, uptime: 60100, boot: "boot-one")
    precondition(admittedExpiry.accessAttempts == 2 && admittedExpiry.osAttempts == 1 && admittedExpiry.phase == "waiting")
    reject { _ = try IosAutomaticPolicy.stoppedBeforeAdmission(first, priorAccess: 1, now: 1000, uptime: 100, boot: "boot-one") }
    let reboot = try IosAutomaticPolicy.start(prior: wait, binding: wait.binding, recordId: record,
      occurrence: wait.occurrence, now: 0, uptime: 5, boot: "boot-two")!
    precondition(reboot.phase == "waiting" && reboot.retryUptime == 60005 && reboot.accessAttempts == 1)
    let unknown = try IosAutomaticPolicy.start(prior: wait, binding: wait.binding, recordId: record,
      occurrence: wait.occurrence, now: 0, uptime: 5, boot: nil)!
    precondition(unknown.phase == "exhausted" && unknown.errorCode == "retry_clock_unavailable")

    let osWait = try IosAutomaticPolicy.osStopped(access, now: 1000, uptime: 100, boot: "boot-one")
    precondition(osWait.retryAt == 301000 && osWait.retryUptime == 300100 && osWait.accessAttempts == 1)
    let second = try IosAutomaticPolicy.start(prior: osWait, binding: osWait.binding, recordId: record,
      occurrence: osWait.occurrence, now: 0, uptime: 300100, boot: "boot-one")!
    precondition(second.osAttempts == 2 && second.accessAttempts == 1)
    let pause = try IosAutomaticPolicy.osStopped(second, now: 2000, uptime: 300100, boot: "boot-one", userPause: true)
    precondition(pause.phase == "paused" && pause.osAttempts == 2)
    let resume = try IosAutomaticPolicy.resumed(pause, now: 2000, uptime: 300100, boot: "boot-one")
    precondition(resume.osAttempts == 2 && resume.accessAttempts == 1 && resume.phase == "running")
    let changed = IosAutomaticPolicy.settingsChanged(resume)
    precondition(changed.phase == "paused" && changed.errorCode == "settings_changed")
    reject { _ = try IosAutomaticPolicy.resumed(changed, now: 2000, uptime: 300100, boot: "boot-one") }
    let replacement = try IosAutomaticPolicy.start(prior: changed, binding: "new-binding", recordId: record,
      occurrence: 2000, now: 2000, uptime: 300100, boot: "boot-one")!
    precondition(replacement.id != changed.id && replacement.osAttempts == 1 && replacement.accessAttempts == 0)

    var accessBudget = first
    var now: Int64 = 1000, uptime: Int64 = 100
    for attempt in 1...5 {
      accessBudget = try IosAutomaticPolicy.accessStarted(accessBudget)
      precondition(accessBudget.accessAttempts == attempt && accessBudget.osAttempts == 1)
      accessBudget = try IosAutomaticPolicy.accessFailed(accessBudget, code: "lan_unavailable", now: now, uptime: uptime, boot: "boot-one")
      if attempt < 5 {
        now = accessBudget.retryAt!; uptime = accessBudget.retryUptime!
        accessBudget = try IosAutomaticPolicy.start(prior: accessBudget, binding: first.binding, recordId: record,
          occurrence: first.occurrence, now: now, uptime: uptime, boot: "boot-one")!
      } else { precondition(accessBudget.phase == "exhausted" && accessBudget.accessAttempts == 5) }
    }
    var osBudget = first
    now = 1000; uptime = 100
    for attempt in 1...5 {
      precondition(osBudget.osAttempts == attempt && osBudget.accessAttempts == 0)
      osBudget = try IosAutomaticPolicy.osStopped(osBudget, now: now, uptime: uptime, boot: "boot-one")
      if attempt < 5 {
        now = osBudget.retryAt!; uptime = osBudget.retryUptime!
        osBudget = try IosAutomaticPolicy.start(prior: osBudget, binding: first.binding, recordId: record,
          occurrence: first.occurrence, now: now, uptime: uptime, boot: "boot-one")!
      } else { precondition(osBudget.phase == "exhausted" && osBudget.osAttempts == 5) }
    }
    for code in ["owner_deleted", "source_changed", "denied", "outcome_unknown"] {
      let failed = try IosAutomaticPolicy.accessFailed(access, code: code, now: 1000, uptime: 100, boot: "boot-one")
      precondition(failed.phase == "exhausted" && !failed.updated && failed.retryAt == nil)
    }
    let complete = try IosAutomaticPolicy.completed(first)
    precondition(complete.updated && complete.phase == "finished")
    let failed = try IosAutomaticPolicy.completed(first, errorCode: "outcome_unknown")
    precondition(failed.phase == "exhausted" && !failed.updated && failed.errorCode == "outcome_unknown")
    var fifthSlot = first
    var fifthNow: Int64 = 1000, fifthUptime: Int64 = 100
    for _ in 1...4 {
      fifthSlot = try IosAutomaticPolicy.accessStarted(fifthSlot)
      fifthSlot = try IosAutomaticPolicy.accessFailed(fifthSlot, code: "connection_closed", now: fifthNow, uptime: fifthUptime, boot: "boot-one")
      fifthNow = fifthSlot.retryAt!; fifthUptime = fifthSlot.retryUptime!
      fifthSlot = try IosAutomaticPolicy.start(prior: fifthSlot, binding: first.binding, recordId: record,
        occurrence: first.occurrence, now: fifthSlot.retryAt!, uptime: fifthSlot.retryUptime!, boot: "boot-one")!
    }
    fifthSlot = try IosAutomaticPolicy.accessStarted(fifthSlot)
    let interruptedFifth = try IosAutomaticPolicy.osStopped(fifthSlot, now: fifthNow, uptime: fifthUptime, boot: "boot-one")
    let resumedFifth = try IosAutomaticPolicy.start(prior: interruptedFifth, binding: first.binding, recordId: record,
      occurrence: first.occurrence, now: interruptedFifth.retryAt!, uptime: interruptedFifth.retryUptime!, boot: "boot-one")!
    let admittedFifth = try IosAutomaticPolicy.accessStarted(resumedFifth)
    precondition(admittedFifth.accessAttempts == 5 && admittedFifth.osAttempts == 2)
    try checked(try IosAutomaticPolicy.completed(admittedFifth).updated)
    reject { _ = try IosAutomaticPolicy.accessFailed(access, code: "connection_closed", now: Int64.max, uptime: 100, boot: "boot-one") }
    let encoded = try JSONEncoder().encode(wait)
    try checked(try JSONDecoder().decode(IosAutomaticRun.self, from: encoded) == wait)
  }

  static func scheduling() throws {
    func millis(_ value: String) -> Int64 { Int64(ISO8601DateFormatter().date(from: value)!.timeIntervalSince1970 * 1000) }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
    let gap = try IosAutomaticPlan.nextOccurrence(now: millis("2026-03-29T00:50:00Z"), intervalHours: 24, localTime: "02:30", calendar: calendar)
    precondition(gap == millis("2026-03-29T01:00:00Z"))
    let fold = try IosAutomaticPlan.nextOccurrence(now: millis("2026-10-25T00:10:00Z"), intervalHours: 24, localTime: "02:30", calendar: calendar)
    precondition(fold == millis("2026-10-25T00:30:00Z"))
    let afterFold = try IosAutomaticPlan.nextOccurrence(now: millis("2026-10-25T00:45:00Z"), intervalHours: 12, localTime: "02:30", calendar: calendar)
    precondition(afterFold == millis("2026-10-25T13:30:00Z"))
    reject { _ = try IosAutomaticPlan.nextOccurrence(now: 0, intervalHours: 1, localTime: "02:30", calendar: calendar) }
    reject { _ = try IosAutomaticPlan.nextOccurrence(now: 0, intervalHours: 12, localTime: "25:00", calendar: calendar) }
  }

  static func main() throws {
    guard CommandLine.arguments.count == 3, ["seed", "reopen"].contains(CommandLine.arguments[1]) else { fatalError("Expected phase and disposable SQLite URL") }
    let url = URL(fileURLWithPath: CommandLine.arguments[2])
    guard url.deletingLastPathComponent().lastPathComponent.hasPrefix("kloda-ios-automatic-"), url.lastPathComponent == "fixture.sqlite" else { fatalError("Unexpected fixture URL") }
    try policy()
    try scheduling()
    if CommandLine.arguments[1] == "reopen" {
      guard FileManager.default.fileExists(atPath: url.path) else { fatalError("Missing seed fixture") }
      let journal = try IosSyncJournal(databaseURL: url)
      try journal.createAutomatic()
      let originalBinding = try journal.automaticBinding(Data("same-settings".utf8), record: record)
      let seededBinding = try String(contentsOf: url.deletingLastPathComponent().appendingPathComponent("context.txt"), encoding: .utf8)
      precondition(originalBinding == seededBinding)
      try checked(try IosSyncJournal(databaseURL: url).automaticBinding(Data("same-settings".utf8), record: record) == originalBinding)
      try journal.advanceAutomaticContext()
      let changedBinding = try journal.automaticBinding(Data("same-settings".utf8), record: record)
      precondition(changedBinding != originalBinding)
      try journal.advanceAutomaticContext()
      try checked(try journal.automaticBinding(Data("same-settings".utf8), record: record) != changedBinding)
      try checked(try journal.automaticPaused())
      let retained = try journal.automaticRun(id: "fixture-automatic")!
      precondition(retained.phase == "waiting" && retained.accessAttempts == 1 && retained.osAttempts == 1)
      precondition(retained.retryAt == 61000 && retained.retryUptime == 60100 && retained.retryBoot == "boot-one")
      let receipt = try journal.fileJob(id: "retained-file")!
      precondition(receipt.state == "uploading" && receipt.acknowledged == 2 && receipt.operationId != nil)
      let old = try journal.automaticRun(id: "settings-run")!
      precondition(old.phase == "paused" && old.errorCode == "settings_changed")
      try checked(try journal.automaticRun()!.binding == "new-binding")
      try checked(try journal.automaticPlan() == IosAutomaticPlan(binding: "new-binding", recordId: record, occurrence: 2000, due: 4000))
      try checked(try journal.automaticRecord() == record && journal.automaticError() == "automatic_unavailable")
      print("IOS_AUTOMATIC_CHECKS_PASS phase=reopen pause=true clocks=retained counters=retained receipts=untouched")
      return
    }
    guard !FileManager.default.fileExists(atPath: url.path) else { fatalError("Seed requires a fresh database") }
    let journal = try IosSyncJournal(databaseURL: url)
    try journal.createAutomatic()
    try checked(try !journal.automaticPaused())
    let seededBinding = try journal.automaticBinding(Data("same-settings".utf8), record: record)
    try seededBinding.write(to: url.deletingLastPathComponent().appendingPathComponent("context.txt"), atomically: true, encoding: .utf8)
    var receipt = IosFilesJob(id: "retained-file", sourceId: "source", reference: "test.bin", revision: "v1",
      recordId: record, wireSourceId: record, requestId: record, name: "test.bin", sha256: String(repeating: "A", count: 43),
      size: 4, snapshot: "fixture.snapshot", identity: "retained-identity")
    try journal.saveFileJob(receipt)
    receipt.operationId = record; receipt.acknowledged = 2; receipt.state = "uploading"; receipt.attempts = 1
    try journal.saveFileJob(receipt)
    var run = try fresh(); run.id = "fixture-automatic"
    try journal.saveAutomaticRun(run)
    run = try IosAutomaticPolicy.accessStarted(run); try journal.saveAutomaticRun(run)
    run = try IosAutomaticPolicy.accessFailed(run, code: "connection_closed", now: 1000, uptime: 100, boot: "boot-one")
    try journal.saveAutomaticRun(run)
    try checked(try journal.automaticRun() == run)
    var wrong = run; wrong.accessAttempts = 0
    reject { try journal.saveAutomaticRun(wrong) }
    wrong = run; wrong.osAttempts = 3
    reject { try journal.saveAutomaticRun(wrong) }
    wrong = run; wrong.binding = "another-binding"
    reject { try journal.saveAutomaticRun(wrong) }
    wrong = run; wrong.id = "duplicate"
    reject { try journal.saveAutomaticRun(wrong) }
    var finished = try fresh(500); finished.id = "terminal"
    try journal.saveAutomaticRun(finished)
    finished = try IosAutomaticPolicy.completed(finished); try journal.saveAutomaticRun(finished)
    wrong = finished; wrong.phase = "running"; wrong.updated = false
    reject { try journal.saveAutomaticRun(wrong) }
    reject { try journal.execute("DELETE FROM automatic_run") }
    var old = try fresh(2000); old.id = "settings-run"
    try journal.saveAutomaticRun(old)
    old = IosAutomaticPolicy.settingsChanged(old); try journal.saveAutomaticRun(old)
    wrong = old; wrong.phase = "running"; wrong.errorCode = nil
    reject { try journal.saveAutomaticRun(wrong) }
    let replacement = try IosAutomaticPolicy.start(prior: old, binding: "new-binding", recordId: record,
      occurrence: 2000, now: 2000, uptime: 500, boot: "boot-one")!
    try journal.saveAutomaticRun(replacement)
    try checked(try journal.automaticRun(id: old.id) == old)
    try journal.setAutomaticPaused(true)
    try journal.setAutomaticRecord(record)
    try journal.setAutomaticError("automatic_unavailable")
    let plan = IosAutomaticPlan(binding: "new-binding", recordId: record, occurrence: 2000, due: 4000)
    try journal.saveAutomaticPlan(plan)
    try checked(try journal.automaticPlan() == plan)
    try journal.saveAutomaticPlan(nil)
    try checked(try journal.automaticRun(id: run.id) == run)
    try journal.saveAutomaticPlan(plan)
    reject { try journal.setAutomaticRecord("invalid") }
    print("IOS_AUTOMATIC_CHECKS_PASS phase=seed policy=PASS context=immutable terminal=retained budgets=separate")
  }
}
