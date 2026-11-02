import ExpoModulesCore
import UIKit

// Step19: starts the Live Activity observer at launch, also when iOS launches the app only to perform a lock-screen intent.
public final class IosLiveActivitySubscriber: ExpoAppDelegateSubscriber {
  private var observers: [NSObjectProtocol] = []
  public func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    #if canImport(ActivityKit)
    let center = NotificationCenter.default
    // The intent passes an NSMutableDictionary and reads "code" back synchronously.
    observers.append(center.addObserver(forName: KlodaLiveActivityAction.pause, object: nil, queue: nil) { note in
      if let code = IosLiveActivity.shared.pause() { (note.object as? NSMutableDictionary)?["code"] = code }
    })
    observers.append(center.addObserver(forName: KlodaLiveActivityAction.resume, object: nil, queue: nil) { _ in
      IosLiveActivity.shared.requestResume()
    })
    observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
      IosLiveActivity.shared.setForeground(true)
    })
    observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { _ in
      IosLiveActivity.shared.setForeground(false)
    })
    IosLiveActivity.shared.setForeground(application.applicationState == .active)
    IosLiveActivity.shared.register()
    #endif
    return true
  }
  deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
}
