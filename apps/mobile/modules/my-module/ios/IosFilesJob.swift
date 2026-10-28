import Foundation

struct IosFilesJob: Codable, Equatable {
  var id: String
  var sourceId: String
  var reference: String
  var revision: String
  var recordId: String
  var wireSourceId: String
  var requestId: String
  var name: String
  var sha256: String
  var size: Int64
  var snapshot: String
  var operationId: String? = nil
  var acknowledged: Int64 = 0
  var state: String = "queued"
  var errorCode: String? = nil
  var rebackupOf: String? = nil
  var attempts: Int = 0
  var retryAt: Int64? = nil
  let identity: String

  static let photosReferencePrefix = "/photos:"
  var isPhotos: Bool { reference.hasPrefix(Self.photosReferencePrefix) }

  static let states: Set<String> = [
    "queued", "preparing", "uploading", "finalizing", "completed", "paused", "blocked", "owner_deleted"
  ]

  func validate() throws {
    guard !id.isEmpty, id.utf8.count <= 255, !sourceId.isEmpty, sourceId.utf8.count <= 1024,
      !reference.isEmpty, reference.utf8.count <= 4096, !revision.isEmpty, revision.utf8.count <= 1024,
      !identity.isEmpty, identity.utf8.count <= 4096,
      [id, sourceId, reference, revision, identity].allSatisfy({ !$0.utf8.contains(0) }),
      Self.canonical(recordId, bytes: 16), Self.canonical(wireSourceId, bytes: 16),
      Self.canonical(requestId, bytes: 16), Self.canonical(sha256, bytes: 32),
      Self.filename(name), Self.filename(snapshot), size >= 0, acknowledged >= 0, acknowledged <= size,
      Self.states.contains(state), attempts >= 0, attempts <= 5,
      retryAt == nil || (retryAt! >= 0 && attempts < 5),
      operationId == nil || Self.canonical(operationId!, bytes: 16),
      rebackupOf == nil || Self.canonical(rebackupOf!, bytes: 16),
      state != "completed" || (operationId != nil && acknowledged == size),
      errorCode == nil || (!errorCode!.isEmpty && errorCode!.utf8.count <= 128) else {
      throw NSError(domain: "KlodaSyncJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: "outcome_unknown"])
    }
  }

  private static func canonical(_ text: String, bytes: Int) -> Bool {
    let padded = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
      + String(repeating: "=", count: (4 - text.count % 4) % 4)
    guard let data = Data(base64Encoded: padded), data.count == bytes else { return false }
    return data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") == text
  }

  private static func filename(_ text: String) -> Bool {
    !text.isEmpty && text.utf8.count <= 255 && text != "." && text != ".."
      && !text.contains("/") && !text.contains("\\")
      && text.unicodeScalars.allSatisfy { $0.value >= 32 && $0.value != 127 }
  }
}
