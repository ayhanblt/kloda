import Foundation

struct IosAutomaticRun: Codable, Equatable {
  var id: String
  var binding: String
  var recordId: String
  var occurrence: Int64
  var phase = "running"
  var osAttempts = 1
  var accessAttempts = 0
  var updated = false
  var retryAt: Int64?
  var errorCode: String?
  var retryUptime: Int64?
  var retryBoot: String?

  func validate() throws {
    let decoded = Data(base64Encoded: recordId.replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/") + "==")
    let canonical = decoded?.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    guard !id.isEmpty, id.utf8.count <= 255, !id.utf8.contains(0),
      !binding.isEmpty, binding.utf8.count <= 4096, !binding.utf8.contains(0),
      decoded?.count == 16, canonical == recordId, occurrence >= 0,
      ["running", "waiting", "finished", "exhausted", "paused"].contains(phase),
      (1...5).contains(osAttempts), (0...5).contains(accessAttempts),
      !updated || phase == "finished" && errorCode == nil,
      errorCode == nil || (!errorCode!.isEmpty && errorCode!.utf8.count <= 128 && !errorCode!.utf8.contains(0)) else {
      throw IosAutomaticPolicy.error("outcome_unknown")
    }
    if phase == "waiting" {
      guard let retryAt, let retryUptime, let retryBoot, retryAt >= 0, retryUptime >= 0,
        !retryBoot.isEmpty, retryBoot.utf8.count <= 255, !retryBoot.utf8.contains(0),
        IosAutomaticPolicy.retryDelay(errorCode) != nil else {
        throw IosAutomaticPolicy.error("outcome_unknown")
      }
    } else if retryAt != nil || retryUptime != nil || retryBoot != nil {
      throw IosAutomaticPolicy.error("outcome_unknown")
    }
  }
}

enum IosAutomaticPolicy {
  static let accessDelay: Int64 = 60_000
  static let osDelay: Int64 = 300_000
  private static let transient = Set(["connection_closed", "lan_unavailable"])

  static func retryDelay(_ code: String?) -> Int64? {
    if code == "os_interrupted" { return osDelay }
    return transient.contains(code ?? "") ? accessDelay : nil
  }

  static func error(_ code: String) -> NSError {
    NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: code])
  }

  /// A returned waiting/exhausted value is a durable clock transition, never an execution lease.
  static func start(prior: IosAutomaticRun?, binding: String, recordId: String, occurrence: Int64,
    now: Int64, uptime: Int64, boot: String?) throws -> IosAutomaticRun? {
    try clock(now, uptime)
    if let prior { try prior.validate() }
    guard var prior, prior.binding == binding, prior.recordId == recordId, prior.occurrence == occurrence else {
      guard now >= occurrence else { return nil }
      let value = IosAutomaticRun(id: UUID().uuidString, binding: binding, recordId: recordId, occurrence: occurrence)
      try value.validate()
      return value
    }
    guard prior.phase == "waiting" else { return nil }
    let delay = retryDelay(prior.errorCode)!
    guard let boot, !boot.isEmpty else { return ended(prior, phase: "exhausted", code: "retry_clock_unavailable") }
    if prior.retryBoot != boot || uptime < prior.retryUptime! - delay {
      return try waiting(prior, now: now, uptime: uptime, boot: boot, delay: delay, code: prior.errorCode)
    }
    guard uptime >= prior.retryUptime! else { return nil }
    if transient.contains(prior.errorCode ?? "") {
      guard prior.accessAttempts < 5 else { return ended(prior, phase: "exhausted", code: prior.errorCode) }
      prior.accessAttempts += 1
    } else {
      guard prior.osAttempts < 5 else { return ended(prior, phase: "exhausted", code: prior.errorCode) }
      prior.osAttempts += 1
    }
    return ended(prior, phase: "running", code: nil)
  }

  static func accessStarted(_ run: IosAutomaticRun) throws -> IosAutomaticRun {
    try run.validate()
    guard run.phase == "running" else { throw error("retry_exhausted") }
    var value = run
    if value.accessAttempts == 0 { value.accessAttempts = 1 }
    return value
  }

  static func accessFailed(_ run: IosAutomaticRun, code: String, now: Int64, uptime: Int64, boot: String?) throws -> IosAutomaticRun {
    try run.validate(); try clock(now, uptime)
    guard run.phase == "running", run.accessAttempts > 0 else { throw error("outcome_unknown") }
    if code == "settings_changed" { return settingsChanged(run) }
    guard transient.contains(code) else { return ended(run, phase: "exhausted", code: code) }
    guard run.accessAttempts < 5 else { return ended(run, phase: "exhausted", code: code) }
    guard let boot, !boot.isEmpty else { return ended(run, phase: "exhausted", code: "retry_clock_unavailable") }
    return try waiting(run, now: now, uptime: uptime, boot: boot, delay: accessDelay, code: code)
  }

  static func stoppedBeforeAdmission(_ candidate: IosAutomaticRun, priorAccess: Int, now: Int64, uptime: Int64, boot: String?) throws -> IosAutomaticRun {
    var value = candidate
    guard (0...candidate.accessAttempts).contains(priorAccess) else { throw error("outcome_unknown") }
    value.accessAttempts = priorAccess
    return try osStopped(value, now: now, uptime: uptime, boot: boot)
  }

  static func osStopped(_ run: IosAutomaticRun, now: Int64, uptime: Int64, boot: String?, userPause: Bool = false) throws -> IosAutomaticRun {
    try run.validate(); try clock(now, uptime)
    guard run.phase == "running" else { return run }
    if userPause { return ended(run, phase: "paused", code: "paused") }
    guard run.osAttempts < 5 else { return ended(run, phase: "exhausted", code: "os_interrupted") }
    guard let boot, !boot.isEmpty else { return ended(run, phase: "exhausted", code: "retry_clock_unavailable") }
    return try waiting(run, now: now, uptime: uptime, boot: boot, delay: osDelay, code: "os_interrupted")
  }

  static func completed(_ run: IosAutomaticRun, errorCode: String? = nil) throws -> IosAutomaticRun {
    try run.validate()
    guard run.phase == "running" else { throw error("paused") }
    var value = ended(run, phase: errorCode == nil ? "finished" : "exhausted", code: errorCode)
    value.updated = errorCode == nil
    try value.validate()
    return value
  }

  static func resumed(_ run: IosAutomaticRun, now: Int64, uptime: Int64, boot: String?) throws -> IosAutomaticRun {
    try run.validate(); try clock(now, uptime)
    guard run.phase == "paused", run.errorCode != "settings_changed" else { throw error("paused") }
    return ended(run, phase: "running", code: nil)
  }

  static func settingsChanged(_ run: IosAutomaticRun) -> IosAutomaticRun {
    guard !["finished", "exhausted"].contains(run.phase) else { return run }
    return ended(run, phase: "paused", code: "settings_changed")
  }

  private static func ended(_ run: IosAutomaticRun, phase: String, code: String?) -> IosAutomaticRun {
    var value = run
    value.phase = phase; value.errorCode = code; value.updated = false
    value.retryAt = nil; value.retryUptime = nil; value.retryBoot = nil
    return value
  }

  private static func clock(_ now: Int64, _ uptime: Int64) throws {
    guard now >= 0, uptime >= 0 else { throw error("retry_clock_unavailable") }
  }

  private static func waiting(_ run: IosAutomaticRun, now: Int64, uptime: Int64, boot: String, delay: Int64, code: String?) throws -> IosAutomaticRun {
    let wall = now.addingReportingOverflow(delay), elapsed = uptime.addingReportingOverflow(delay)
    guard !wall.overflow, !elapsed.overflow else { throw error("retry_clock_unavailable") }
    var value = run
    value.phase = "waiting"; value.updated = false; value.errorCode = code
    value.retryAt = wall.partialValue; value.retryUptime = elapsed.partialValue; value.retryBoot = boot
    try value.validate()
    return value
  }
}
