// Unrelated PC/DAV target operations are inert. Shared context generation and selected Files are real production code.
import Foundation
import CryptoKit
import SQLite3

enum IosPairingFailure: Error { case native(String); var code: String { switch self { case .native(let value): return value } } }
enum IosFilesQueue { static func failure(_ error: Error) -> IosPairingFailure { (error as? IosPairingFailure) ?? .native("outcome_unknown") } }
enum IosSmbJournal { static let ownerLock = NSRecursiveLock() }
enum IosWebDavFailure: Error { case code(String) }
struct IosWebDavProfile: Equatable { let revision: String; let provider: String?; func targetId() throws -> String { "unused-dav-target" } }
struct IosWebDavUpload { let binding: String; let target: String }
enum IosWebDavVault { static func read() throws -> IosWebDavProfile? { nil }; static func read(slot: String) throws -> IosWebDavProfile? { nil } }
enum IosWebDavClient { static func encode(_ data: Data) -> String { IosS3Target.hashDigest(data) } }
final class IosWebDavQueue { static let shared = IosWebDavQueue(); func pause(code: String) throws {} }
final class IosWebDavAutomaticCoordinator { static let shared = IosWebDavAutomaticCoordinator(); func reconcile() {} }
final class IosWebDavJournal {
  let database: IosSyncJournal
  init() throws {
    database = try IosSyncJournal(databaseURL: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("source-context.sqlite"))
  }
  static func open() throws -> IosWebDavJournal { try IosWebDavJournal() }
  func enabled(kind: String, id: String, revision: String) throws -> Bool { false }
  func advance(_ value: IosWebDavUpload, phase: String) throws { throw IosWebDavFailure.code("unused_dav") }
}
extension IosSyncJournal {
  func createFilesJobs() throws {}
  func createFilesRuns() throws {}
  func createPhotos() throws {}
  func createAutomatic() throws {}
  func createAutomaticPlan() throws {}
}

// Automatic OS dispatch is outside this selected-Files component fixture.
final class IosS3Automatic { static let shared = IosS3Automatic(); func reconcile() {} }
