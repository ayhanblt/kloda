import ExpoModulesCore
import UIKit

public final class IosAutomaticSubscriber: ExpoAppDelegateSubscriber {
  private var observers: [NSObjectProtocol] = []
  public func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    IosAutomaticCoordinator.shared.register()
    IosWebDavQueue.shared.setProtected(application.isProtectedDataAvailable)
    IosWebDavAutomaticCoordinator.shared.register()
#if KLODA_SMB_NATIVE
    IosSmbQueue.shared.setProtected(application.isProtectedDataAvailable)
    IosSmbAutomaticCoordinator.shared.register()
#endif
#if KLODA_SFTP_NATIVE
    IosSftpQueue.shared.setProtected(application.isProtectedDataAvailable)
    IosSftpAutomaticCoordinator.shared.register()
#endif
#if KLODA_FTPS_NATIVE
    IosFtpsQueue.shared.setProtected(application.isProtectedDataAvailable)
    IosFtpsAutomaticCoordinator.shared.register()
#endif
#if KLODA_S3_NATIVE
    IosS3Runtime.shared.setProtected(application.isProtectedDataAvailable); IosS3Automatic.shared.register()
#endif
    IosBackupNotifications.refresh()
    observers.append(NotificationCenter.default.addObserver(forName: NSNotification.Name.NSSystemTimeZoneDidChange,
      object: nil, queue: .main) { _ in IosAutomaticCoordinator.shared.clockChanged(); IosWebDavAutomaticCoordinator.shared.reconcile(clockChanged: true)
#if KLODA_SMB_NATIVE
        IosSmbAutomaticCoordinator.shared.reconcile(clockChanged: true)
#endif
#if KLODA_SFTP_NATIVE
        IosSftpAutomaticCoordinator.shared.reconcile(clockChanged: true)
#endif
#if KLODA_FTPS_NATIVE
        IosFtpsAutomaticCoordinator.shared.reconcile(clockChanged: true)
#endif
#if KLODA_S3_NATIVE
        IosS3Automatic.shared.reconcile(clockChanged: true)
#endif
    })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
      object: nil, queue: .main) { _ in
        IosAutomaticCoordinator.shared.protectedDataUnavailable(); IosWebDavQueue.shared.setProtected(false)
        try? IosWebDavQueue.shared.pause(code: "credential_locked")
#if KLODA_SMB_NATIVE
        IosSmbQueue.shared.setProtected(false); try? IosSmbQueue.shared.pause(code: "credential_locked")
#endif
#if KLODA_SFTP_NATIVE
        IosSftpQueue.shared.setProtected(false); try? IosSftpQueue.shared.pause(code: "credential_locked")
#endif
#if KLODA_FTPS_NATIVE
        IosFtpsQueue.shared.setProtected(false); try? IosFtpsQueue.shared.pause(code: "credential_locked")
#endif
#if KLODA_S3_NATIVE
        IosS3Runtime.shared.setProtected(false)
#endif
      })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.protectedDataDidBecomeAvailableNotification,
      object: nil, queue: .main) { _ in
        IosWebDavQueue.shared.setProtected(true); IosWebDavAutomaticCoordinator.shared.reconcile(allowForeground: false)
#if KLODA_SMB_NATIVE
        IosSmbQueue.shared.setProtected(true); IosSmbAutomaticCoordinator.shared.reconcile(allowForeground: false)
#endif
#if KLODA_SFTP_NATIVE
        IosSftpQueue.shared.setProtected(true); IosSftpAutomaticCoordinator.shared.reconcile(allowForeground: false)
#endif
#if KLODA_FTPS_NATIVE
        IosFtpsQueue.shared.setProtected(true); IosFtpsAutomaticCoordinator.shared.reconcile(allowForeground: false)
#endif
#if KLODA_S3_NATIVE
        IosS3Runtime.shared.setProtected(true); IosS3Automatic.shared.reconcile()
#endif
      })
    return true
  }
  public func applicationSignificantTimeChange(_ application: UIApplication) {
    IosAutomaticCoordinator.shared.clockChanged(); IosWebDavAutomaticCoordinator.shared.reconcile(clockChanged: true)
#if KLODA_SMB_NATIVE
    IosSmbAutomaticCoordinator.shared.reconcile(clockChanged: true)
#endif
#if KLODA_SFTP_NATIVE
    IosSftpAutomaticCoordinator.shared.reconcile(clockChanged: true)
#endif
#if KLODA_FTPS_NATIVE
    IosFtpsAutomaticCoordinator.shared.reconcile(clockChanged: true)
#endif
#if KLODA_S3_NATIVE
        IosS3Automatic.shared.reconcile(clockChanged: true)
#endif
  }
  deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
}
