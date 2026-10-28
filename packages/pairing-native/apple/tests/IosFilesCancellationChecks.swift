import Foundation

@main struct IosFilesCancellationChecks {
  static func main() {
    let restore = IosOwnRestore()
    let pendingPicker = restore.ticket()
    restore.cancel()
    var replied = false
    let connection = IosFilesConnection(check: { fatalError("Cancelled picker reached native access") },
      send: { _, _ in fatalError("Cancelled picker sent bytes") })
    restore.restore(record: String(repeating: "A", count: 22),
      backup: IosOwnBackup(id: String(repeating: "A", count: 22), name: "test.bin", sha256: String(repeating: "A", count: 43), size: 4),
      destination: "never-opened", connection: connection, ticket: pendingPicker) { result in
      guard case .failure(.native("cancelled")) = result else { fatalError("Stale picker adopted fresh cancellation epoch") }
      replied = true
    }
    precondition(replied)
    print("PASS cancelled pending picker cannot acquire a new ticket or access native/filesystem work")
  }
}
