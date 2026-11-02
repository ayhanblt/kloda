import CoreText
import SwiftUI
import UIKit

// Step19/20 visual capture: renders the production lock-screen card (KlodaLockCard) for every phase into one
// contact sheet per appearance and text size. Language comes from -AppleLanguages, like the widget extension.
// The card background stands in for activityBackgroundTint; the system lock screen and Dynamic Island are not drawn.
@main struct IosLiveActivityCapture {
  static let states: [(KlodaBackupState, Bool)] = [
    (KlodaBackupState(phase: "syncing", percent: 75, completed: 3, total: 4, targets: ["webdav"]), false),
    (KlodaBackupState(phase: "syncing", percent: 40, targets: ["pc", "webdav"]), false),
    (KlodaBackupState(phase: "paused", percent: 40, completed: 2, total: 5, targets: ["webdav"]), false),
    (KlodaBackupState(phase: "syncing", percent: 60, completed: 3, total: 5, targets: ["webdav"]), true),
    (KlodaBackupState(phase: "waiting", targets: ["webdav"]), false),
    (KlodaBackupState(phase: "safe", targets: ["pc", "webdav"]), false),
    (KlodaBackupState(phase: "attention", targets: ["webdav"]), false),
    (KlodaBackupState(phase: "error", targets: ["webdav"]), false),
  ]
  static let variants: [(String, ColorScheme, DynamicTypeSize)] = [
    ("dark", .dark, .large), ("light", .light, .large), ("dark-xxxl", .dark, .xxxLarge), ("dark-ax2", .dark, .accessibility2),
  ]

  @MainActor static func main() {
    guard CommandLine.arguments.count > 2 else { fatalError("usage: capture <output-dir> <language>") }
    let output = URL(fileURLWithPath: CommandLine.arguments[1]), language = CommandLine.arguments[2]
    for font in ["Inter-Regular", "Inter-SemiBold"] {
      guard let url = Bundle.main.url(forResource: font, withExtension: "ttf") else { fatalError("missing \(font)") }
      CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }
    for (name, scheme, size) in variants {
      let sheet = VStack(spacing: 12) {
        ForEach(states.indices, id: \.self) { index in
          KlodaLockCard(state: states[index].0, stale: states[index].1)
            .frame(width: 370)
            .background(RoundedRectangle(cornerRadius: 24).fill(KlodaTheme.lockCard))
        }
      }
      .padding(16)
      .background(scheme == .dark ? Color.black : Color(white: 0.9))
      .environment(\.colorScheme, scheme)
      .environment(\.dynamicTypeSize, size)
      let renderer = ImageRenderer(content: sheet)
      renderer.scale = 2
      guard let data = renderer.uiImage?.pngData() else { fatalError("render failed: \(name)") }
      do { try data.write(to: output.appendingPathComponent("lock-card-\(language)-\(name).png")) }
      catch { fatalError("write failed: \(error)") }
    }
  }
}
