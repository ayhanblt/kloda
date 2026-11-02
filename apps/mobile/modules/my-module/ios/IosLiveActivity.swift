#if os(iOS) && canImport(ActivityKit)
import ActivityKit
import Foundation
import UIKit

// Step19: one Live Activity mirrors the home status rules (src/pages/home/model/home-status.ts) from native status.
// It is display only: no upload authority, no background time, no push; updates happen while this process runs.
final class IosLiveActivity: @unchecked Sendable {
  static let shared = IosLiveActivity()
  typealias State = KlodaBackupState
  private let queue = DispatchQueue(label: "com.kloda.live-activity")
  private var timer: DispatchSourceTimer?
  private var foreground = false
  private var shown: State?
  private var refreshed = Date.distantPast
  // Own lock: uiActive runs on the main thread and must not wait behind a status read on the queue.
  private let resumeLock = NSLock()
  private var resumeRequested: Date?

  func register() {
    queue.async {
      guard self.timer == nil else { return }
      let timer = DispatchSource.makeTimerSource(queue: self.queue)
      timer.schedule(deadline: .now() + 1, repeating: 2, leeway: .milliseconds(500))
      timer.setEventHandler { self.tick() }
      timer.resume()
      self.timer = timer
    }
  }
  func setForeground(_ value: Bool) { queue.async { self.foreground = value; self.tick() } }

  // Pause keeps the existing pause path (same as the app's Pause); the intent requires a device unlock first.
  func pause() -> String? {
    do { try IosAutomaticCoordinator.shared.pause() } catch { return (error as? IosPairingFailure)?.code ?? "automatic_pause_not_saved" }
    queue.async { self.tick() }
    return nil
  }
  // Resume never runs here: the intent opens Kloda and the foreground UI performs it (uiActive).
  func requestResume() { resumeLock.lock(); resumeRequested = Date(); resumeLock.unlock() }
  // Called by the pairing module only when its session became foreground-active, the existing resume fence.
  func uiActive() {
    resumeLock.lock()
    let requested = resumeRequested.map { Date().timeIntervalSince($0) < 60 } ?? false
    resumeRequested = nil
    resumeLock.unlock()
    guard requested else { return }
    try? IosAutomaticCoordinator.shared.resume()
    queue.async { self.tick() }
  }

  private func tick() {
    // An ended card stays listed until it is dismissed; it can no longer be updated, so only live ones count.
    let all = Activity<KlodaBackupAttributes>.activities
    let activities = all.filter { [.active, .stale].contains($0.activityState) }
    guard foreground || !activities.isEmpty else { return }
    // Unreadable status (for example protected data while locked) leaves the last content; staleDate marks it.
    let next: State?
    do { next = try Self.observe() } catch { return }
    if activities.isEmpty {
      guard foreground, next?.phase == "syncing", ActivityAuthorizationInfo().areActivitiesEnabled, let next else { return }
      for ended in all { Task { await ended.end(nil, dismissalPolicy: .immediate) } }
      do {
        _ = try Activity.request(attributes: KlodaBackupAttributes(), content: Self.content(next), pushType: nil)
        shown = next; refreshed = Date()
      } catch { return }
      return
    }
    for extra in activities.dropFirst() { Task { await extra.end(nil, dismissalPolicy: .immediate) } }
    let activity = activities[0]
    guard let next else {
      shown = nil
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
      return
    }
    let final = ["safe", "attention", "error"].contains(next.phase)
    guard next != shown || (next.phase == "syncing" && Date().timeIntervalSince(refreshed) > 60) else { return }
    shown = final ? nil : next; refreshed = Date()
    let content = Self.content(next)
    Task { if final { await activity.end(content, dismissalPolicy: .default) } else { await activity.update(content) } }
  }

  private static func content(_ state: State) -> ActivityContent<State> {
    ActivityContent(state: state, staleDate: state.phase == "syncing" ? Date().addingTimeInterval(120) : nil)
  }

  // nil: nothing to show (no destination enabled).
  static func observe() throws -> State? {
    let pc = try IosWebDavJournal.open().hasEnabledPc()
    // Same WebDAV status the home screen reads (KlodaBackupModule.webDavStatus), including the automatic error.
    var webdav = try IosWebDavQueue.shared.status()
    if let code = IosWebDavAutomaticCoordinator.shared.error() { webdav["automaticError"] = code }
    var queue = try IosAutomaticCoordinator.shared.files.status()
    for (key, value) in try IosAutomaticCoordinator.shared.status() { queue[key] = value }
    return IosLiveActivityStatus.state(pc: pc, queue: queue, webdav: webdav)
  }
}
#endif
