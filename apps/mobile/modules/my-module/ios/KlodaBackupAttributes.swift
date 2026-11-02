import Foundation

// Step19 Live Activity payload, compiled into the app module, the app target and the KlodaLiveActivity widget extension.
// Lock-screen privacy: only a phase, counts and destination kinds; never file, photo, device or server names.
struct KlodaBackupState: Codable, Hashable {
  // syncing | paused | waiting | safe | attention | error, the same states as the app's home status.
  var phase: String
  // Acknowledged progress, 0...100; nil when the native status gives no exact total.
  var percent: Int?
  // Completed and total operations; only from a run's native operation counts.
  var completed: Int64?
  var total: Int64?
  // Enabled destination kinds: "pc", "webdav".
  var targets: [String]
}

// Lock-screen buttons run LiveActivityIntents in the app process; the app module answers these notifications.
enum KlodaLiveActivityAction {
  static let pause = Notification.Name("com.kloda.live-activity.pause")
  static let resume = Notification.Name("com.kloda.live-activity.resume")
}

#if os(iOS) && canImport(ActivityKit)
import ActivityKit

struct KlodaBackupAttributes: ActivityAttributes {
  typealias ContentState = KlodaBackupState
}
#endif
