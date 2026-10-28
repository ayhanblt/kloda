import Foundation
import UserNotifications

enum IosBackupNotifications {
  private static let lock = NSLock()
  private static var allowed = false
  static var enabled: Bool { lock.lock(); defer { lock.unlock() }; return allowed }
  static func refresh() {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      lock.lock(); allowed = [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus); lock.unlock()
    }
  }
  static func request(_ completion: @escaping (Bool) -> Void) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
      lock.lock(); allowed = granted; lock.unlock(); completion(granted)
    }
  }
  static func began() { post(kind: "progress") }
  static func clearProgress() {
    UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["kloda-backup-progress"])
    UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["kloda-backup-progress"])
  }
  static func ended(run: IosAutomaticRun) {
    clearProgress()
    if run.phase == "exhausted" && !run.updated { post(kind: run.errorCode == "os_interrupted" ? "deferred" : "error") }
  }
  private static func post(kind: String) {
    guard enabled else { return }
    let language = Locale.preferredLanguages.first?.prefix(2) ?? "en"
    let messages: [String: [String: String]] = [
      "tr": ["progress": "Yedekleme sürüyor. İlerlemeyi Kloda’da görebilirsiniz.", "deferred": "iOS yedeklemeyi tamamlayamadı. Kalan işler korundu; Kloda’yı açıp durumu kontrol edin.", "error": "Yedekleme tamamlanamadı. Kloda’yı açıp hatayı kontrol edin."],
      "de": ["progress": "Die Sicherung läuft. Den Fortschritt sehen Sie in Kloda.", "deferred": "iOS konnte die Sicherung nicht abschließen. Offene Aufgaben bleiben erhalten; prüfen Sie Kloda.", "error": "Die Sicherung wurde nicht abgeschlossen. Prüfen Sie den Fehler in Kloda."],
      "en": ["progress": "Backup is running. Check progress in Kloda.", "deferred": "iOS could not complete backup. Pending work is retained; open Kloda to check its status.", "error": "Backup could not complete. Open Kloda to check the error."]]
    let content = UNMutableNotificationContent()
    content.title = "Kloda"; content.body = (messages[String(language)] ?? messages["en"]!)[kind]!
    content.sound = kind == "progress" ? nil : .default
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "kloda-backup-" + kind, content: content, trigger: nil))
  }
}
