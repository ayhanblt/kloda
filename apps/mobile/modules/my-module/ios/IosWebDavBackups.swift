import Foundation

enum IosWebDavBackups {
  static func list(after: String) throws -> [String: Any] {
    guard after.isEmpty || UUID(uuidString: after) != nil else { throw IosWebDavFailure.code("invalid_request") }
    guard let profile = try IosWebDavVault.read() else { throw IosWebDavFailure.code("webdav_missing") }
    let target = try profile.targetId(), journal = try IosWebDavJournal.open()
    let rows = try journal.uploads(target: target, after: after)
    let items: [[String: Any]] = rows.filter {
      $0.phase == "completed" && !$0.skipped && $0.issue == nil && $0.sourceIdentity != nil && ["file", "photo_manifest"].contains($0.kind ?? "")
    }.map { value in
      ["id": value.id, "sourceId": value.source, "name": (value.relativePath as NSString).lastPathComponent,
        "kind": value.kind!, "sha256": value.sha256, "size": String(value.size)]
    }
    var result: [String: Any] = ["targetId": target, "items": items, "hasMore": rows.count == 100, "canRestoreFiles": true, "canRestorePhotos": true]
    if rows.count == 100 { result["nextCursor"] = rows.last!.id }
    return result
  }
}
