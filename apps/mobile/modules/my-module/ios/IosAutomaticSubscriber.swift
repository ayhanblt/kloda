import ExpoModulesCore
import UIKit

public final class IosAutomaticSubscriber: ExpoAppDelegateSubscriber {
  private var observers: [NSObjectProtocol] = []
  public func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    IosAutomaticCoordinator.shared.register()
    IosBackupNotifications.refresh()
    observers.append(NotificationCenter.default.addObserver(forName: NSNotification.Name.NSSystemTimeZoneDidChange,
      object: nil, queue: .main) { _ in IosAutomaticCoordinator.shared.clockChanged() })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
      object: nil, queue: .main) { _ in IosAutomaticCoordinator.shared.protectedDataUnavailable() })
    return true
  }
  public func applicationSignificantTimeChange(_ application: UIApplication) { IosAutomaticCoordinator.shared.clockChanged() }
  deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
}
