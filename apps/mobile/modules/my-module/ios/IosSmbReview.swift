#if KLODA_SMB_NATIVE
import Foundation
final class IosSmbReview {
  private let lock = NSRecursiveLock()
  private let worker = DispatchQueue(label: "com.kloda.smb.review")
  private var active: UUID?
  private var cancelled = Set<UUID>()
  func cancel(_ ticket: UUID? = nil) {
    lock.lock(); defer { lock.unlock() }
    if let ticket { cancelled.insert(ticket) }
    if ticket == nil || active == ticket { if let active { cancelled.insert(active) }; active = nil }
  }
  func perform(id: String, request: UUID, visible: @escaping () -> Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    lock.lock()
    guard visible(), active == nil, !cancelled.contains(request) else { lock.unlock(); completion(.failure(IosSmbFailure(code: "cancelled"))); return }
    active = request; lock.unlock()
    worker.async {
      let queue = IosSmbQueue.shared
      let result = Result<[String: Any], Error> {
        try queue.beginReview(request); defer { queue.endReview(request) }
        let files = try IosSmbFiles(profiles: IosSmbProfiles(journal: queue.journal()), snapshots: IosFilesSnapshot.smb())
        let copy = try files.keepBoth(id, request: request, cancelled: {
          self.lock.lock(); defer { self.lock.unlock() }
          return self.active != request || self.cancelled.contains(request) || !visible()
        })
        return ["id": copy.id, "state": "completed", "path": copy.relativePath]
      }
      self.lock.lock(); if self.active == request { self.active = nil }; self.lock.unlock(); completion(result)
    }
  }
}
#endif
