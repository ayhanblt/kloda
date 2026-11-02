import AppIntents
import Foundation

// Step19 lock-screen buttons, compiled into the app target and the widget extension. LiveActivityIntent runs
// perform() in the app process, where the app module answers KlodaLiveActivityAction notifications.
struct KlodaLiveActivityFailure: Error, CustomLocalizedStringResourceConvertible {
  let code: String
  var localizedStringResource: LocalizedStringResource { LocalizedStringResource("statusUi.lines.error", table: "KlodaLiveActivity") }
}

@available(iOS 17.0, *)
struct KlodaPauseBackupIntent: LiveActivityIntent {
  static let title = LocalizedStringResource("statusUi.pause", table: "KlodaLiveActivity")
  static let isDiscoverable = false
  // Unlock first: the journals are protected while the device is locked.
  static let authenticationPolicy = IntentAuthenticationPolicy.requiresLocalDeviceAuthentication
  init() {}
  func perform() async throws -> some IntentResult {
    let reply = NSMutableDictionary()
    NotificationCenter.default.post(name: KlodaLiveActivityAction.pause, object: reply)
    if let code = reply["code"] as? String { throw KlodaLiveActivityFailure(code: code) }
    return .result()
  }
}

// Resume needs Kloda in the foreground (existing fence): this only records the request and opens the app.
@available(iOS 17.0, *)
struct KlodaResumeBackupIntent: LiveActivityIntent {
  static let title = LocalizedStringResource("statusUi.resume", table: "KlodaLiveActivity")
  static let isDiscoverable = false
  static let authenticationPolicy = IntentAuthenticationPolicy.requiresLocalDeviceAuthentication
  static let openAppWhenRun = true
  init() {}
  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(name: KlodaLiveActivityAction.resume, object: nil)
    return .result()
  }
}

@available(iOS 17.0, *)
struct KlodaOpenAppIntent: LiveActivityIntent {
  static let title = LocalizedStringResource("ui.lockScreen.open", table: "KlodaLiveActivity")
  static let isDiscoverable = false
  static let authenticationPolicy = IntentAuthenticationPolicy.requiresLocalDeviceAuthentication
  static let openAppWhenRun = true
  init() {}
  func perform() async throws -> some IntentResult { .result() }
}
