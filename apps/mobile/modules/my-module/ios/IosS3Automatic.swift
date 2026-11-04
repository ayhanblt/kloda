#if KLODA_S3_NATIVE
import Foundation
import BackgroundTasks
import SQLite3

// Persist the next occurrence before starting. A process restart never replays a partial S3 job.
final class IosS3Automatic {
  static let shared = IosS3Automatic()
  static let identifier = "com.kloda.app.s3.processing"
  private let worker = DispatchQueue(label: "com.kloda.s3.automatic")
  private var timer: DispatchSourceTimer?
  private var foreground = false
  private var active = false
  private let store = UserDefaults.standard
  func register() {
    _ = BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.identifier, using: .main) { task in
      guard let task = task as? BGProcessingTask else { task.setTaskCompleted(success: false); return }
      self.receive(task)
    }
    reconcile()
  }
  func uiActive(_ value: Bool) { worker.async { self.foreground = value; self.reconcileOnWorker() } }
  func reconcile(clockChanged: Bool = false) { worker.async { self.reconcileOnWorker(clockChanged: clockChanged) } }
  func cancel() { BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier) }
  private func next(_ now: Int64) throws -> Int64 {
    if store.string(forKey: "kloda.sync.backupMode") == "live" || (store.string(forKey: "kloda.sync.backupMode") == nil && store.object(forKey: "kloda.sync.intervalHours") == nil) {
      let value = now.addingReportingOverflow(15 * 60 * 1000)
      guard !value.overflow else { throw IosS3Failure(code: "retry_clock_unavailable") }; return value.partialValue
    }
    return try IosAutomaticPlan.nextOccurrence(now: now, intervalHours: store.object(forKey: "kloda.sync.intervalHours") as? Int ?? 12, localTime: store.string(forKey: "kloda.sync.localTime") ?? "12:00")
  }
  private func context() throws -> (IosS3Queue, String) {
    guard !IosAutomaticPause.requested, try !IosSyncJournal().automaticPaused() else { throw IosS3Failure(code: "user_pause") }
    let queue = try IosS3Runtime.shared.queue()
    return try IosWebDavContext.synchronized {
      guard try queue.profiles.journal.enabled(), try queue.profiles.journal.automatic(),
        let captured = try queue.profiles.capture(), try !IosFilesSelection.current().isEmpty || !IosPhotosSource.currentSelections().isEmpty else { throw IosS3Failure(code: "target_pause") }
      return (queue, IosS3Target.hash(Data((captured.profile.target.profileGeneration + (try IosS3Sources.binding())).utf8)))
    }
  }
  private func plan(_ queue: IosS3Queue) throws -> (String, Int64)? {
    try IosWebDavContext.synchronized {
      let db = queue.profiles.journal.database
      try db.execute("CREATE TABLE IF NOT EXISTS s3_auto_plan(id INTEGER PRIMARY KEY CHECK(id=1),binding TEXT NOT NULL,due INTEGER NOT NULL CHECK(due>=0))")
      return try db.statement("SELECT binding,due FROM s3_auto_plan WHERE id=1") { row in
        let step = sqlite3_step(row); if step == SQLITE_DONE { return nil }
        guard step == SQLITE_ROW, let raw = sqlite3_column_text(row, 0), sqlite3_column_int64(row, 1) >= 0 else { throw IosS3Failure(code: "storage_failure") }
        return (String(cString: raw), sqlite3_column_int64(row, 1))
      }
    }
  }
  private func save(_ queue: IosS3Queue, binding: String, due: Int64) throws {
    try queue.profiles.journal.transaction {
      try queue.profiles.journal.database.execute("INSERT INTO s3_auto_plan VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET binding=excluded.binding,due=excluded.due", values: [binding, due])
    }
  }
  private func reconcileOnWorker(clockChanged: Bool = false) {
    timer?.cancel(); timer = nil
    do {
      let (queue, binding) = try context(), now = Int64(Date().timeIntervalSince1970 * 1000)
      let old = try plan(queue)
      let due = try clockChanged || old == nil || old?.0 != binding ? next(now) : old!.1
      try save(queue, binding: binding, due: due)
      let request = BGProcessingTaskRequest(identifier: Self.identifier)
      request.requiresNetworkConnectivity = true; request.requiresExternalPower = false
      request.earliestBeginDate = Date(timeIntervalSince1970: Double(due) / 1000)
      cancel(); try BGTaskScheduler.shared.submit(request)
      if foreground && !active {
        let timer = DispatchSource.makeTimerSource(queue: worker)
        timer.schedule(deadline: .now() + Double(max(0, due - now)) / 1000)
        timer.setEventHandler { self.start(nil) }; self.timer = timer; timer.resume()
      }
    } catch { cancel() }
  }
  private func receive(_ task: BGProcessingTask) {
    let lease = IosBackgroundLease(task: task)
    guard IosS3Runtime.shared.begin(lease) else { task.setTaskCompleted(success: false); return }
    task.expirationHandler = {
      lease.expire(); IosS3Queue.cancelAllInMemory()
      self.worker.async { try? IosS3Runtime.shared.queue().pause(code: "os_interrupted") }
    }
    worker.async { self.start((task, lease)) }
  }
  private func start(_ background: (BGProcessingTask, IosBackgroundLease)?) {
    guard !active else {
      if let (task, lease) = background { IosS3Runtime.shared.end(lease); task.setTaskCompleted(success: false) }; return
    }
    do {
      let (queue, binding) = try context(), now = Int64(Date().timeIntervalSince1970 * 1000)
      guard let scheduled = try plan(queue), scheduled.0 == binding, now >= scheduled.1 else { throw IosS3Failure(code: "candidate_stale") }
      if let (_, lease) = background { try lease.check() }
      try save(queue, binding: binding, due: next(now)); active = true
      _ = try queue.start(automatic: true) { run in
        self.worker.async {
          self.active = false
          if let (task, lease) = background { IosS3Runtime.shared.end(lease); task.setTaskCompleted(success: run.phase == "finished" && !lease.expired) }
          self.reconcileOnWorker()
        }
      }
    } catch {
      active = false
      if let (task, lease) = background { IosS3Runtime.shared.end(lease); task.setTaskCompleted(success: false) }
      reconcileOnWorker()
    }
  }
}
#endif
