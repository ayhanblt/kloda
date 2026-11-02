import AppIntents
import SwiftUI
import WidgetKit

// Lock-screen card: header, state title, acknowledged progress, counts/destination kinds, buttons.
// Kept under the 160 pt Live Activity height; no file, photo, device or server names (privacy decision 2026-10-31).
struct KlodaLockCard: View {
  let state: KlodaBackupState
  let stale: Bool
  @Environment(\.dynamicTypeSize) private var typeSize

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        KlodaLogo(size: 26)
        VStack(alignment: .leading, spacing: 0) {
          Text(verbatim: "Kloda").font(KlodaFont.semibold(13))
          Text(KlodaCopy.key("ui.lockScreen.live")).font(KlodaFont.regular(10)).foregroundStyle(KlodaTheme.lockMuted)
        }
        Spacer(minLength: 4)
        KlodaPercent(state: state).padding(.horizontal, 8).padding(.vertical, 3)
          .background(Capsule().fill(KlodaTheme.lockTrack))
      }
      HStack(spacing: 8) {
        // Accessibility text sizes wrap the title instead of truncating it (user decision 2026-11-01).
        Text(KlodaCopy.title(state, stale: stale)).font(KlodaFont.semibold(16)).lineLimit(typeSize.isAccessibilitySize ? 2 : 1)
        Spacer(minLength: 4)
        KlodaStateIcon(state: state, stale: stale)
      }
      KlodaProgress(state: state)
      KlodaCountsRow(state: state)
      KlodaButtons(state: state, stale: stale)
    }
    .foregroundStyle(KlodaTheme.lockText)
    .padding(14)
  }
}

struct KlodaStateIcon: View {
  let state: KlodaBackupState
  let stale: Bool
  var body: some View {
    switch stale ? "waiting" : state.phase {
    case "safe": KlodaIcon(name: "check", size: 18).foregroundStyle(KlodaTheme.brand)
    case "syncing": KlodaLogo(size: 28)
    case "attention", "error": KlodaIcon(name: "circle-alert", size: 18)
    default: KlodaIcon(name: "pause", size: 18)
    }
  }
}

struct KlodaPercent: View {
  let state: KlodaBackupState
  var body: some View {
    let value = state.phase == "safe" ? 100 : state.percent
    Text(verbatim: value.map { "\($0)%" } ?? "–").font(KlodaFont.semibold(12)).monospacedDigit()
      .foregroundStyle(KlodaTheme.lockAccent)
  }
}

struct KlodaProgress: View {
  let state: KlodaBackupState
  var body: some View {
    let value = Double(state.phase == "safe" ? 100 : state.percent ?? 0) / 100
    GeometryReader { box in
      ZStack(alignment: .leading) {
        Capsule().fill(KlodaTheme.lockTrack)
        Capsule().fill(state.phase == "safe" ? KlodaTheme.brand : KlodaTheme.lockAccent).frame(width: box.size.width * value)
      }
    }
    .frame(height: 6)
    .accessibilityElement()
    .accessibilityLabel(Text(KlodaCopy.key("statusUi.progressLabel")))
    .accessibilityValue(Text(verbatim: "\(Int(value * 100))%"))
  }
}

struct KlodaCountsRow: View {
  let state: KlodaBackupState
  var body: some View {
    HStack(spacing: 6) {
      if let done = state.completed, let total = state.total {
        Text(KlodaCopy.operations(done, total)).lineLimit(1)
      }
      Spacer(minLength: 4)
      KlodaIcon(name: "monitor", size: 12)
      Text(KlodaCopy.targets(state.targets)).lineLimit(1)
    }
    .font(KlodaFont.regular(11)).monospacedDigit().foregroundStyle(KlodaTheme.lockMuted)
  }
}

// iOS 17+: buttons run LiveActivityIntents in the app. iOS 16 shows no buttons; tapping the card opens Kloda.
// Accessibility text sizes stack the buttons so their labels do not truncate (user decision 2026-11-01).
// A stale card reads "Waiting", so it offers no Pause: the app is not updating and the run state is unknown.
struct KlodaButtons: View {
  let state: KlodaBackupState
  let stale: Bool
  @Environment(\.dynamicTypeSize) private var typeSize
  var body: some View {
    if #available(iOS 17.0, *) {
      let stack = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
      stack {
        if state.phase == "syncing" && !stale {
          Button(intent: KlodaPauseBackupIntent()) { label("pause", KlodaCopy.key("statusUi.pause")) }
            .tint(KlodaTheme.lockTrack).foregroundStyle(KlodaTheme.lockText)
        } else if state.phase == "paused" {
          Button(intent: KlodaResumeBackupIntent()) { label("play", KlodaCopy.key("statusUi.resume")) }
            .tint(KlodaTheme.lockTrack).foregroundStyle(KlodaTheme.lockText)
        }
        Button(intent: KlodaOpenAppIntent()) { label("arrow-up-right", KlodaCopy.key("ui.lockScreen.open"), trailing: true) }
          .tint(KlodaTheme.buttonBrand).foregroundStyle(KlodaTheme.onBrand)
      }
      .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).font(KlodaFont.semibold(13))
    }
  }
  private func label(_ icon: String, _ text: LocalizedStringResource, trailing: Bool = false) -> some View {
    HStack(spacing: 6) {
      if !trailing { KlodaIcon(name: icon, size: 14) }
      Text(text).lineLimit(1)
      if trailing { KlodaIcon(name: icon, size: 14) }
    }
    .frame(maxWidth: .infinity, minHeight: 28)
  }
}

struct KlodaIcon: View {
  let name: String
  let size: CGFloat
  var body: some View { Image(name).renderingMode(.template).resizable().scaledToFit().frame(width: size, height: size).accessibilityHidden(true) }
}

// src/shared/ui/logo.tsx: tile square, 3/4 ring, brand dot.
struct KlodaLogo: View {
  let size: CGFloat
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: size * 0.3).fill(KlodaTheme.tile)
      Circle().trim(from: 0, to: 122.0 / 163.4).stroke(KlodaTheme.tileRing, style: StrokeStyle(lineWidth: size * 0.85 * 10 / 120, lineCap: .round))
        .rotationEffect(.degrees(-90)).frame(width: size * 0.85 * 52 / 120, height: size * 0.85 * 52 / 120)
      Circle().fill(KlodaTheme.brand).frame(width: size * 0.85 * 14 / 120, height: size * 0.85 * 14 / 120)
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}
