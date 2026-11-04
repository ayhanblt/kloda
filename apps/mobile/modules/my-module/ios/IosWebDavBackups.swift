import Foundation

enum IosWebDavBackups {
  static func list(after: String, target requested: String) throws -> [String: Any] {
    guard after.isEmpty || UUID(uuidString: after) != nil else { throw IosWebDavFailure.code("invalid_request") }
    let target = try IosWebDavContext.restoreTarget(requested).targetId(), journal = try IosWebDavJournal.open()
    let local = try journal.uploads(target: target, after: after), imported = try journal.importedReceipts(target: target, after: after)
    let page = merged(local, imported)
    let items: [[String: Any]] = page.rows.filter {
      $0.phase == "completed" && !$0.skipped && $0.issue == nil && $0.sourceIdentity != nil && ["file", "photo_manifest"].contains($0.kind ?? "")
    }.map { value in
      ["id": value.id, "sourceId": value.source, "name": (value.relativePath as NSString).lastPathComponent,
        "kind": value.kind!, "sha256": value.sha256, "size": String(value.size)]
    }
    var result: [String: Any] = ["targetId": target, "items": items, "hasMore": page.cursor != nil, "canRestoreFiles": true, "canRestorePhotos": true]
    if let cursor = page.cursor { result["nextCursor"] = cursor }
    return result
  }
  // 29/4: this device's receipts and imported receipts in one id-ordered page of at most 100. Below the smaller last id
  // of a full page both lists are complete, so the cursor never skips a row of either.
  static func merged(_ local: [IosWebDavUpload], _ imported: [IosWebDavUpload]) -> (rows: [IosWebDavUpload], cursor: String?) {
    let bound = [local, imported].compactMap { $0.count == 100 ? $0.last?.id : nil }.min()
    let known = (local + imported).filter { bound == nil || $0.id <= bound! }.sorted { $0.id < $1.id }
    let rows = Array(known.prefix(100))
    return (rows, bound != nil || known.count > rows.count ? rows.last?.id : nil)
  }
}
