import Foundation

// Same advanced-WebDAV contract as Desktop: intent/equality alone never proves ownership.
final class IosWebDavPublication {
  private static let lock = NSLock()
  private static var active = Set<String>()
  let journal: IosWebDavJournal
  let inspect: (String, IosWebDavUpload) throws -> String
  let upload: (String, IosWebDavUpload) throws -> Void
  let move: (String, String) throws -> Void
  let check: () throws -> Void
  let complete: (IosWebDavUpload) throws -> Void

  init(journal: IosWebDavJournal, inspect: @escaping (String, IosWebDavUpload) throws -> String,
    upload: @escaping (String, IosWebDavUpload) throws -> Void,
    move: @escaping (String, String) throws -> Void, check: @escaping () throws -> Void, complete: @escaping (IosWebDavUpload) throws -> Void) {
    self.journal = journal; self.inspect = inspect; self.upload = upload; self.move = move; self.check = check; self.complete = complete
  }
  static func temporary(_ value: IosWebDavUpload) -> String {
    value.relativePath.split(separator: "/").dropLast().joined(separator: "/") + "/.kloda-upload-" + value.id
  }

  static func withJob<T>(_ id: String, _ action: () throws -> T) throws -> T {
    lock.lock(); let admitted = active.insert(id).inserted; lock.unlock()
    guard admitted else { throw IosWebDavFailure.code("backup_busy") }
    defer { lock.lock(); active.remove(id); lock.unlock() }
    return try action()
  }
  @discardableResult func execute(_ id: String) throws -> Bool { try Self.withJob(id) { try executeHeld(id) } }
  private func executeHeld(_ id: String) throws -> Bool {
    guard var value = try journal.find(id) else { throw IosWebDavFailure.code("outcome_unknown") }
    try check()
    if value.skipped || value.issue != nil { return false }
    let temporary = Self.temporary(value), destination = try journal.publication(value)
    if value.phase == "completed" {
      guard try inspect(destination, value) == "match" else { throw IosWebDavFailure.code("review_required") }
      try check(); return true
    }
    if value.phase == "prepared" {
      let state = try inspect(temporary, value)
      try check()
      guard state == "missing" else { throw IosWebDavFailure.code("review_required") }
      // A prior prepared job with a definitely missing temp can start its create-only PUT safely.
      try upload(temporary, value)
      try journal.advance(value, phase: "uploaded"); value.phase = "uploaded"
      try check()
    }
    if value.phase == "uploaded" || value.phase == "moving" {
      guard try inspect(temporary, value) == "match" else { throw IosWebDavFailure.code("review_required") }
      try check()
      guard try inspect(destination, value) == "missing" else { throw IosWebDavFailure.code("conflict") }
      try check()
      if value.phase == "uploaded" { try journal.advance(value, phase: "moving"); value.phase = "moving" }
      try move(temporary, destination)
      try journal.advance(value, phase: "moved"); value.phase = "moved"
      try check()
    }
    guard value.phase == "moved", try inspect(destination, value) == "match" else {
      throw IosWebDavFailure.code("review_required")
    }
    try check()
    try complete(value)
    return true
  }
  func review(_ id: String, action: String, validate: (IosWebDavUpload) throws -> Void) throws -> Bool {
    try Self.withJob(id) {
      try check()
      guard let value = try journal.find(id), value.phase != "completed", !value.skipped,
        ["recheck", "keep_both", "skip"].contains(action) else { throw IosWebDavFailure.code("review_required") }
      if action == "skip" { try journal.issue(value, code: value.issue ?? "review_required", skipped: true); return false }
      do {
        try validate(value); try check()
        if action == "keep_both" {
          guard ["uploaded", "moving"].contains(value.phase), value.issue == "conflict",
            try inspect(Self.temporary(value), value) == "match" else { throw IosWebDavFailure.code("review_required") }
          let selected = try journal.publication(value)
          let path: String
          if selected != value.relativePath, try inspect(selected, value) == "missing" { path = selected }
          else {
            guard try inspect(selected, value) != "missing" else { throw IosWebDavFailure.code("review_required") }
            path = try Self.copyPath(value)
            guard try inspect(path, value) == "missing" else { throw IosWebDavFailure.code("conflict") }
          }
          try check(); try journal.choosePublication(value, path: path)
        }
        try check(); try journal.clearIssue(value)
        return try executeHeld(id)
      } catch {
        if let current = try journal.find(id), current.phase != "completed", !current.skipped {
          try journal.issue(current, code: Self.failureCode(error))
        }
        throw error
      }
    }
  }
  private static func failureCode(_ error: Error) -> String {
    if case IosWebDavFailure.code(let code) = error { return code }
    if case IosPairingFailure.native(let code) = error { return code }
    let native = error as NSError
    if native.domain == "KlodaSyncJournal" { return native.localizedDescription == "outcome_unknown" ? "outcome_unknown" : "storage_failure" }
    return "outcome_unknown"
  }
  private static func copyPath(_ value: IosWebDavUpload) throws -> String {
    let name = (value.relativePath as NSString).lastPathComponent
    let ext = (name as NSString).pathExtension
    let clock = DateFormatter(); clock.locale = Locale(identifier: "en_US_POSIX")
    clock.calendar = Calendar(identifier: .gregorian); clock.timeZone = TimeZone(secondsFromGMT: 0); clock.dateFormat = "yyyyMMdd-HHmmss"
    let suffix = " (Kloda " + clock.string(from: Date()) + " " + value.sha256.prefix(8) + " " + UUID().uuidString.lowercased().prefix(8) + ")" + (ext.isEmpty ? "" : "." + ext)
    let stem = ext.isEmpty ? name : String(name.dropLast(ext.count + 1))
    var short = ""
    for char in stem {
      if short.utf8.count + String(char).utf8.count > 255 - suffix.utf8.count { break }
      short.append(char)
    }
    guard !short.isEmpty else { throw IosWebDavFailure.code("review_required") }
    return (value.relativePath as NSString).deletingLastPathComponent + "/" + short + suffix
  }

}
