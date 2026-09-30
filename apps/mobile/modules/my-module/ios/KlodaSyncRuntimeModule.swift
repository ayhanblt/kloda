import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

private final class DirectoryPickerDelegate: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  private var continuation: CheckedContinuation<String?, Never>?

  func pick(from viewController: UIViewController) async -> String? {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
      picker.delegate = self
      picker.presentationController?.delegate = self
      viewController.present(picker, animated: true)
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first, url.startAccessingSecurityScopedResource() else {
      finish(with: nil)
      return
    }
    defer { url.stopAccessingSecurityScopedResource() }
    let bookmark = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
    finish(with: bookmark?.base64EncodedString())
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(with: nil) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(with: nil) }

  private func finish(with value: String?) {
    continuation?.resume(returning: value)
    continuation = nil
  }
}

public class KlodaSyncRuntimeModule: Module {
  private let intervalKey = "kloda.sync.intervalHours"
  private let timeKey = "kloda.sync.localTime"
  private let directoryBookmarkKey = "kloda.sync.directoryBookmark"
  private let directoryPicker = DirectoryPickerDelegate()

  public func definition() -> ModuleDefinition {
    Name("KlodaSyncRuntime")

    AsyncFunction("pickDirectory") { (_: String) async -> String? in
      guard let viewController = self.appContext?.utilities?.currentViewController() else {
        throw NSError(domain: "KlodaSyncRuntime", code: 3, userInfo: [NSLocalizedDescriptionKey: "No active view controller."])
      }
      let bookmark = await self.directoryPicker.pick(from: viewController)
      if let bookmark { UserDefaults.standard.set(bookmark, forKey: self.directoryBookmarkKey) }
      return bookmark
    }

    AsyncFunction("loadSchedule") { () -> [String: Any] in
      let defaults = UserDefaults.standard
      return [
        "intervalHours": defaults.object(forKey: self.intervalKey) as? Int ?? 12,
        "localTime": defaults.string(forKey: self.timeKey) ?? "12:00"
      ]
    }

    AsyncFunction("saveSchedule") { (intervalHours: Int, localTime: String) in
      guard intervalHours == 12 || intervalHours == 24 else {
        throw NSError(domain: "KlodaSyncRuntime", code: 1, userInfo: [NSLocalizedDescriptionKey: "Interval must be 12 or 24 hours."])
      }
      guard localTime.range(of: "^([01]\\d|2[0-3]):[0-5]\\d$", options: .regularExpression) != nil else {
        throw NSError(domain: "KlodaSyncRuntime", code: 2, userInfo: [NSLocalizedDescriptionKey: "Time must use HH:mm."])
      }
      UserDefaults.standard.set(intervalHours, forKey: self.intervalKey)
      UserDefaults.standard.set(localTime, forKey: self.timeKey)
    }
  }
}
