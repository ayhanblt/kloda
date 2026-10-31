import Foundation

final class IosWebDavReview {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.webdav.review", attributes: .concurrent)
  private var active: UUID?
  private var cancelled = Set<UUID>()
  func cancel(request: UUID? = nil) {
    lock.lock(); if let request { cancelled.insert(request) }; if request == nil || active == request { if let active { cancelled.insert(active) }; active = nil }; lock.unlock()
  }
  private func current(_ token: UUID, visible: () -> Bool) throws {
    lock.lock(); let matches = active == token; lock.unlock()
    guard matches && visible() else { throw IosWebDavFailure.code("cancelled") }
  }
  func items(after: String) throws -> [String: Any] {
    let journal = try IosWebDavJournal.open()
    var binding: String?, target: String?, contextError: String?
    var selected = Set<String>()
    do {
      if let profile = try IosWebDavVault.read(), try journal.enabled(kind: "webdav", id: profile.targetId(), revision: profile.revision) {
        target = try profile.targetId(); binding = try IosWebDavContext.capture(profile, journal: journal)
        selected = Set(try IosFilesSelection.current().map { $0.id } + IosPhotosSource.currentSelections().map { $0.id })
      }
    } catch { contextError = IosWebDavFilesRunner.code(error) }
    let rows = try journal.unfinished(after: after), page = Array(rows.prefix(100))
    let items: [[String: Any]] = try page.map { value in
      let current = value.target == target && selected.contains(value.source) && value.sourceIdentity != nil && value.kind != nil && !value.skipped && (value.binding == binding || ["uploaded", "moving", "moved"].contains(value.phase))
      let path = try journal.publication(value)
      var item: [String: Any] = ["id": value.id, "targetId": value.target, "sourceId": value.source, "name": (value.relativePath as NSString).lastPathComponent,
        "relativePath": value.relativePath, "kind": value.kind ?? "unknown", "phase": value.phase, "skipped": value.skipped,
        "errorCode": value.issue ?? (current ? "review_required" : "settings_changed"), "canRecheck": current, "requiresAuthorization": current && value.binding != binding,
        "canKeepBoth": current && value.issue == "conflict" && ["uploaded", "moving"].contains(value.phase)]
      if path != value.relativePath { item["publishedPath"] = path }
      return item
    }
    var result: [String: Any] = ["items": items, "hasMore": rows.count > 100]
    if rows.count > 100 { result["nextCursor"] = page.last!.id }
    if let contextError { result["errorCode"] = contextError }
    return result
  }
  func perform(id: String, action requested: String, request: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    let explicit = ["authorize_recheck", "authorize_keep_both"].contains(requested)
    let action = explicit ? String(requested.dropFirst(10)) : requested
    lock.lock()
    guard !cancelled.contains(request) else { lock.unlock(); completion(.failure(IosWebDavFailure.code("cancelled"))); return }
    guard active == nil else { lock.unlock(); completion(.failure(IosWebDavFailure.code("backup_busy"))); return }
    let token = request; active = token; lock.unlock()
    worker.async {
      let result = Result<[String: Any], Error> {
        guard UUID(uuidString: id) != nil, ["skip", "recheck", "keep_both"].contains(action) else { throw IosWebDavFailure.code("invalid_request") }
        try self.current(token, visible: visible)
        let journal = try IosWebDavJournal.open()
        guard let value = try journal.find(id), value.phase != "completed", !value.skipped else { throw IosWebDavFailure.code("review_required") }
        if action == "skip" {
          return try IosWebDavPublication.withJob(id) {
            try self.current(token, visible: visible)
            try journal.issue(value, code: value.issue ?? "review_required", skipped: true)
            return ["state": "skipped"]
          }
        }
        guard let profile = try IosWebDavVault.read(), try profile.targetId() == value.target else { throw IosWebDavFailure.code("settings_changed") }
        let binding = try IosWebDavContext.capture(profile, journal: journal)
        guard explicit || binding == value.binding else { throw IosWebDavFailure.code("settings_changed") }
        let check = {
          try self.current(token, visible: visible)
          try IosWebDavContext.check(profile, binding: binding, journal: journal)
        }
        try check()
        let snapshots = try IosFilesSnapshot.webdav(), transport = IosWebDavTransport(profile: profile, snapshots: snapshots, check: check)
        let validation = IosWebDavSourceValidation(journal: journal, snapshots: snapshots, transport: transport, check: check)
        if explicit {
          try check(); try validation.validate(value); try check()
          try journal.authorizeReview(value, request: request, binding: binding)
        }
        let sender = IosWebDavPublication(journal: journal, inspect: transport.inspect, upload: transport.upload, move: transport.move, check: check,
          complete: { upload in
            try validation.validate(upload)
            try IosWebDavContext.synchronized {
              self.lock.lock(); defer { self.lock.unlock() }
              try check()
              if explicit {
                try journal.requireReviewAuthority(upload, request: request, binding: binding)
                guard try upload.target == profile.targetId() else { throw IosWebDavFailure.code("settings_changed") }
                try journal.advance(upload, phase: "completed")
              } else { try IosWebDavContext.complete(upload, profile: profile, journal: journal) }
            }
          })
        guard try sender.review(id, action: action, validate: validation.validate), try journal.find(id)?.phase == "completed" else { throw IosWebDavFailure.code("review_required") }
        return ["state": "completed"]
      }
      self.lock.lock(); if self.active == token { self.active = nil }; self.lock.unlock()
      completion(result)
    }
  }
}
