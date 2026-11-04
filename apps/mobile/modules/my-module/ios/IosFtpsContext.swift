#if KLODA_FTPS_NATIVE
import Foundation
extension IosFtpsJournal {
  static func open() throws -> IosFtpsJournal { try IosFtpsQueue.shared.journal() }
}
extension IosFtpsProfile {
  func targetId() throws -> String { try target.archiveId() }
}
enum IosFtpsContext {
  static func capture(_ profile: IosFtpsProfile, journal: IosFtpsJournal) throws -> String {
    try IosWebDavContext.synchronized {
      let sources = try IosFtpsSources.capture(journal: journal)
      guard let current = try IosFtpsProfiles(journal: journal).capture(), current.profile == profile,
        current.context == sources.context, try IosFtpsQueue.shared.enabled(profile) else { throw IosFtpsFailure(code: "context_changed") }
      return current.context
    }
  }
  static func check(_ profile: IosFtpsProfile, binding: String, journal: IosFtpsJournal) throws {
    guard try capture(profile, journal: journal) == binding else { throw IosFtpsFailure(code: "context_changed") }
  }
}
#endif
