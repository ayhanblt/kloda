#if KLODA_S3_NATIVE
import Foundation

// Independent of the journal lock so UI/lock loss can revoke an in-flight exchange.
final class IosS3TestGrant {
  private let lock = NSLock()
  private var active = false
  private var protected = false
  private var ticket: UUID?
  private var running = false
  private var cancelled = Set<UUID>()
  private func read<T>(_ body: () throws -> T) rethrows -> T { lock.lock(); defer { lock.unlock() }; return try body() }
  func available() -> Bool { read { active && protected } }
  func activate(protected value: Bool) { read { active = true; protected = value } }
  func deactivate() { read { active = false; protected = false; if let ticket { cancelled.insert(ticket) }; ticket = nil } }
  func start(_ request: UUID) throws {
    try read {
      guard active, protected, !running, !cancelled.contains(request) else { throw IosS3Failure(code: "candidate_stale") }
      ticket = request; running = true
    }
  }
  func current(_ request: UUID) -> Bool { read { active && protected && ticket == request && !cancelled.contains(request) } }
  func cancel(_ request: UUID) { read { cancelled.insert(request); if ticket == request { ticket = nil } } }
  func finish(_ request: UUID) { read { cancelled.insert(request); if ticket == request { ticket = nil }; running = false } }
}
#endif
