import ActivityKit
import SwiftUI
import WidgetKit

// Step19: approved native SwiftUI exception for the Lovable lock-screen card (src/views/lock-screen.tsx reference).
@main
struct KlodaLiveActivityBundle: WidgetBundle {
  var body: some Widget { KlodaLiveActivityWidget() }
}

struct KlodaLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: KlodaBackupAttributes.self) { context in
      KlodaLockCard(state: context.state, stale: context.isStale)
        .activityBackgroundTint(KlodaTheme.lockCard)
        .activitySystemActionForegroundColor(KlodaTheme.lockText)
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { KlodaLogo(size: 32) }
        DynamicIslandExpandedRegion(.trailing) { KlodaPercent(state: state) }
        DynamicIslandExpandedRegion(.center) {
          Text(KlodaCopy.title(state, stale: context.isStale)).font(KlodaFont.semibold(15)).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            KlodaProgress(state: state)
            KlodaCountsRow(state: state)
          }
        }
      } compactLeading: {
        KlodaLogo(size: 24)
      } compactTrailing: {
        KlodaPercent(state: state)
      } minimal: {
        KlodaLogo(size: 22)
      }
      .keylineTint(KlodaTheme.lockAccent)
    }
  }
}
