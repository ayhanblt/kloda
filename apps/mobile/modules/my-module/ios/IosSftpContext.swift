#if KLODA_SFTP_NATIVE
import Foundation
extension IosSftpJournal {
  static func open() throws -> IosSftpJournal { try IosSftpQueue.shared.journal() }
}
extension IosSftpProfile {
  func targetId() throws -> String { try target.archiveId() }
}
enum IosSftpContext {
  static func capture(_ profile: IosSftpProfile, journal: IosSftpJournal) throws -> String {
    try IosWebDavContext.synchronized {
      let sources = try IosSftpSources.capture(journal: journal)
      guard let current = try IosSftpProfiles(journal: journal).capture(), current.profile == profile,
        current.context == sources.context, try IosSftpQueue.shared.enabled(profile) else { throw IosSftpFailure(code: "context_changed") }
      return current.context
    }
  }
  static func check(_ profile: IosSftpProfile, binding: String, journal: IosSftpJournal) throws {
    guard try capture(profile, journal: journal) == binding else { throw IosSftpFailure(code: "context_changed") }
  }
}
#endif
