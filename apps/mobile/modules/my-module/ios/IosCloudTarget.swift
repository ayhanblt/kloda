import Foundation

// Step18B/5 (ADR0028 §5): the publication state machine stays the DAV one; each destination kind supplies only
// its create-only transport. `inspect` answers "missing", "match" or "mismatch" from Kloda's own SHA-256.
// `download` (18B/5r) streams a published file into `receive`; the caller compares the reply's SHA-256/size.
protocol IosBackupTransport: AnyObject {
  func inspect(_ path: String, _ job: IosWebDavUpload) throws -> String
  func upload(_ path: String, _ job: IosWebDavUpload) throws
  func move(_ from: String, _ to: String) throws
  func download(_ path: String, _ job: IosWebDavUpload, receive: @escaping (Data) throws -> Void) throws -> IosWebDavReply
  // 29/3: direct children of a folder under the destination root; a missing folder has none.
  func list(_ folder: String) throws -> [IosRemoteChild]
}
struct IosRemoteChild: Equatable { let name: String; let folder: Bool }

// One queue destination: a DAV profile (original WebDAV entry or an added slot) or an OAuth profile whose
// provider has an upload adapter. Only Dropbox has one so far (user decision 2026-11-03).
enum IosCloudTarget: Equatable {
  case dav(IosWebDavProfile)
  case oauth(IosOAuthProfile)
  static let oauthKinds: Set<String> = ["dropbox", "onedrive", "yandex"]

  var kind: String {
    switch self {
    case .dav(let profile): return profile.provider ?? "webdav"
    case .oauth(let profile): return profile.provider
    }
  }
  var revision: String {
    switch self {
    case .dav(let profile): return profile.revision
    case .oauth(let profile): return profile.revision
    }
  }
  func targetId() throws -> String {
    switch self {
    case .dav(let profile): return try profile.targetId()
    case .oauth(let profile): return try profile.targetId()
    }
  }
  func sameBinding(_ other: IosCloudTarget?) -> Bool {
    switch (self, other) {
    case (.dav(let a), .dav(let b)): return a == b
    case (.oauth(let a), .oauth(let b)):
      return a.revision == b.revision && a.provider == b.provider && a.accountId == b.accountId &&
        a.targetPath == b.targetPath && a.expiresAt == b.expiresAt
    default: return false
    }
  }
  func transport(snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) throws -> IosBackupTransport {
    switch self {
    case .dav(let profile): return IosWebDavTransport(profile: profile, snapshots: snapshots, check: check)
    case .oauth(let profile):
      switch profile.provider {
      case "dropbox": return IosDropboxTransport(profile: profile, snapshots: snapshots, check: check)
      case "onedrive": return IosOneDriveTransport(profile: profile, snapshots: snapshots, check: check)
      case "yandex": return IosYandexTransport(profile: profile, snapshots: snapshots, check: check)
      default: throw IosWebDavFailure.code("destination_unsupported")
      }
    }
  }
}
