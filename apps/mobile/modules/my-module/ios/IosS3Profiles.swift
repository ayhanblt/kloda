#if KLODA_S3_NATIVE
import Foundation

struct IosS3Capture { let profile: IosS3Profile; let context: String }
final class IosS3Profiles {
  let journal: IosS3Journal
  init(journal: IosS3Journal) { self.journal = journal }
  func save(_ target: IosS3Target, accessKey: String, secret: String, token: String?, check: () throws -> Void) throws {
    IosS3Journal.lock.lock(); defer { IosS3Journal.lock.unlock() }
    let target = IosS3Target(provider: target.provider, endpoint: target.endpoint, region: target.region, bucket: target.bucket,
      prefix: target.prefix, pathStyle: target.pathStyle, accountBinding: IosS3Target.hash(Data(accessKey.utf8)),
      profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    let profile = IosS3Profile(target: target, accessKey: accessKey, secret: secret, token: token)
    try check(); try profile.validate(); _ = try IosS3Vault.read(journal.provider)
    try journal.prepareProfile(target); try check(); try IosS3Vault.write(profile); try check(); try journal.confirmProfile(target)
  }
  func capture() throws -> IosS3Capture? {
    IosS3Journal.lock.lock(); defer { IosS3Journal.lock.unlock() }
    guard let profile = try IosS3Vault.read(journal.provider) else {
      guard try !journal.hasProfile() else { throw IosS3Failure(code: "storage_failure") }; return nil
    }
    guard try journal.profileCurrent(profile.target) else { throw IosS3Failure(code: "context_changed") }
    return IosS3Capture(profile: profile, context: try journal.context())
  }
  func current(_ capture: IosS3Capture) throws -> Bool {
    IosS3Journal.lock.lock(); defer { IosS3Journal.lock.unlock() }
    return try journal.context() == capture.context && journal.profileCurrent(capture.profile.target) && IosS3Vault.read(journal.provider) == capture.profile
  }
}
#endif
