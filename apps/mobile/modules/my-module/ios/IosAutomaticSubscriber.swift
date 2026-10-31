import ExpoModulesCore
import UIKit

public final class IosAutomaticSubscriber: ExpoAppDelegateSubscriber {
  private var observers: [NSObjectProtocol] = []
  public func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    IosAutomaticCoordinator.shared.register()
    IosWebDavQueue.shared.setProtected(application.isProtectedDataAvailable)
    IosWebDavAutomaticCoordinator.shared.register()
    IosBackupNotifications.refresh()
    observers.append(NotificationCenter.default.addObserver(forName: NSNotification.Name.NSSystemTimeZoneDidChange,
      object: nil, queue: .main) { _ in IosAutomaticCoordinator.shared.clockChanged(); IosWebDavAutomaticCoordinator.shared.reconcile(clockChanged: true) })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
      object: nil, queue: .main) { _ in
        IosAutomaticCoordinator.shared.protectedDataUnavailable(); IosWebDavQueue.shared.setProtected(false)
        try? IosWebDavQueue.shared.pause(code: "credential_locked")
      })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.protectedDataDidBecomeAvailableNotification,
      object: nil, queue: .main) { _ in
        IosWebDavQueue.shared.setProtected(true); IosWebDavAutomaticCoordinator.shared.reconcile(allowForeground: false)
      })
    return true
  }
  public func applicationSignificantTimeChange(_ application: UIApplication) { IosAutomaticCoordinator.shared.clockChanged(); IosWebDavAutomaticCoordinator.shared.reconcile(clockChanged: true) }
  deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
}
