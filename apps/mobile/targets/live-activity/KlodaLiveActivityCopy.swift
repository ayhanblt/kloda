import Foundation
import SwiftUI

// Copy comes from the app's TR/EN/DE locale keys; the config plugin writes them to KlodaLiveActivity.strings.
// The extension follows the device language (it cannot read the in-app language choice).
enum KlodaCopy {
  static func text(_ key: String) -> String { NSLocalizedString(key, tableName: "KlodaLiveActivity", comment: "") }
  static func key(_ key: String) -> LocalizedStringResource { LocalizedStringResource(String.LocalizationValue(key), table: "KlodaLiveActivity") }

  static func title(_ state: KlodaBackupState, stale: Bool) -> String {
    if stale { return text("statusUi.states.waiting") }
    switch state.phase {
    case "syncing": return text("statusUi.states.syncing")
    case "paused": return text("ui.lockScreen.paused")
    case "safe": return text("statusUi.states.safe")
    case "attention": return text("statusUi.states.attention")
    case "error": return text("statusUi.states.error")
    default: return text("statusUi.states.waiting")
    }
  }
  static func operations(_ done: Int64, _ total: Int64) -> String {
    text("statusUi.progress.operations").replacingOccurrences(of: "{{completed}}", with: String(done))
      .replacingOccurrences(of: "{{total}}", with: String(total))
  }
  static func targets(_ kinds: [String]) -> String {
    kinds.map { $0 == "pc" ? text("ui.lockScreen.pc") : text("ui.providers.\($0)") }.joined(separator: " · ")
  }
}

// Inter is bundled into the extension by the config plugin (same files as App.tsx).
enum KlodaFont {
  static func regular(_ size: CGFloat) -> Font { .custom("Inter-Regular", size: size) }
  static func semibold(_ size: CGFloat) -> Font { .custom("Inter-SemiBold", size: size) }
}
