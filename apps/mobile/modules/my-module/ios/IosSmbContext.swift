#if KLODA_SMB_NATIVE
import Foundation
extension IosSmbJournal {
  static func open() throws -> IosSmbJournal { try IosSmbQueue.shared.journal() }
}
extension IosSmbProfile {
  func targetId() throws -> String { try target.archiveId() }
}
enum IosSmbContext {
  static func capture(_ profile: IosSmbProfile, journal: IosSmbJournal) throws -> String {
    try IosWebDavContext.synchronized {
      let sources = try IosSmbSources.capture(journal: journal)
      guard let current = try IosSmbProfiles(journal: journal).capture(), current.profile == profile,
        current.context == sources.context, try IosSmbQueue.shared.enabled(profile) else { throw IosSmbFailure(code: "context_changed") }
      return current.context
    }
  }
  static func check(_ profile: IosSmbProfile, binding: String, journal: IosSmbJournal) throws {
    guard try capture(profile, journal: journal) == binding else { throw IosSmbFailure(code: "context_changed") }
  }
}
#endif
