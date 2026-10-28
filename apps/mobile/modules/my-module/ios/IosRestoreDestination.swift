import Foundation
import Darwin

// User-selected folder only. O_EXCL and the durable inode receipt prevent overwrite/adoption.
enum IosRestoreDestination {
  static func sameLocation(_ previous: String?, _ current: String) -> Bool {
    guard let previous, let a = Data(base64Encoded: previous), let b = Data(base64Encoded: current) else { return false }
    var staleA = false, staleB = false
    guard let left = try? URL(resolvingBookmarkData: a, bookmarkDataIsStale: &staleA),
      let right = try? URL(resolvingBookmarkData: b, bookmarkDataIsStale: &staleB), !staleA, !staleB,
      left.startAccessingSecurityScopedResource() else { return false }
    defer { left.stopAccessingSecurityScopedResource() }
    guard right.startAccessingSecurityScopedResource() else { return false }
    defer { right.stopAccessingSecurityScopedResource() }
    let x = Darwin.open(left.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
    let y = Darwin.open(right.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
    defer { if x >= 0 { Darwin.close(x) }; if y >= 0 { Darwin.close(y) } }
    var l = stat(), r = stat()
    return x >= 0 && y >= 0 && fstat(x, &l) == 0 && fstat(y, &r) == 0 && l.st_dev == r.st_dev && l.st_ino == r.st_ino
  }
  static func publish(_ intent: inout IosRestoreIntent, journal: IosSyncJournal,
    snapshots: IosFilesSnapshot, check: () throws -> Void) throws {
    guard let bookmark = intent.destination, let data = Data(base64Encoded: bookmark) else {
      throw IosPairingFailure.native("invalid_request")
    }
    var stale = false
    let root = try URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale)
    guard !stale, root.isFileURL, root.startAccessingSecurityScopedResource() else { throw IosPairingFailure.native("destination_unavailable") }
    defer { root.stopAccessingSecurityScopedResource() }
    let directory = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
    guard directory >= 0 else { throw IosFilesSource.ioFailure() }
    defer { Darwin.close(directory) }
    if intent.state == "completed" {
      try verifyCompleted(intent, directory: directory, check: check)
      return
    }
    let source = try snapshots.open(intent.staging, sha256: intent.sha256, size: intent.size, cancelled: { (try? check()) == nil })
    defer { try? source.close() }
    let target = root.appendingPathComponent(intent.name)
    var result: Result<Void, Error>?
    var coordinatorError: NSError?
    var updated = intent
    NSFileCoordinator().coordinate(writingItemAt: target, options: .forMerging, error: &coordinatorError) { actual in
      result = Result {
        guard actual.standardizedFileURL == target.standardizedFileURL else { throw IosPairingFailure.native("destination_permission_lost") }
        try publishVerified(&updated, journal: journal, source: source, directory: directory, check: check)

      }
    }
    intent = updated
    guard coordinatorError == nil, let result else { throw IosPairingFailure.native("destination_unavailable") }
    try result.get()
  }
  static func verifyCompleted(_ intent: IosRestoreIntent, directory: Int32, check: () throws -> Void) throws {
    try check()
    let fd = openat(directory, intent.name, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
    guard fd >= 0 else { throw IosPairingFailure.native(errno == ENOENT ? "not_found" : "destination_unavailable") }
    defer { Darwin.close(fd) }
    let info = try IosFilesSource.metadata(fd)
    guard intent.device == UInt64(truncatingIfNeeded: info.st_dev), intent.inode == info.st_ino,
      info.st_uid == geteuid(), info.st_nlink == 1, info.st_size == intent.size else { throw IosPairingFailure.native("destination_not_empty") }
    let (hash, size) = try IosFilesSource.hash(fd, maxBytes: intent.size, cancelled: { (try? check()) == nil })
    guard hash == intent.sha256, size == intent.size else { throw IosPairingFailure.native("hash_mismatch") }
    try check()
  }

  static func publishVerified(_ intent: inout IosRestoreIntent, journal: IosSyncJournal,
    source: FileHandle, directory: Int32, check: () throws -> Void) throws {
    var updated = intent
    defer { intent = updated }
        try check()
        let fd: Int32
        if let device = updated.device, let inode = updated.inode {
          fd = openat(directory, updated.name, O_RDWR | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
          guard fd >= 0 else { throw IosPairingFailure.native("destination_unavailable") }
          let info = try IosFilesSource.metadata(fd)
          guard UInt64(truncatingIfNeeded: info.st_dev) == device, info.st_ino == inode, info.st_nlink == 1,
            info.st_uid == geteuid(), info.st_size <= updated.size else {
            Darwin.close(fd); throw IosPairingFailure.native("destination_not_empty")
          }
        } else {
          updated.state = "publishing"; try journal.saveRestoreIntent(updated)
          fd = openat(directory, updated.name, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
          guard fd >= 0 else { throw IosPairingFailure.native(errno == EEXIST ? "destination_not_empty" : IosFilesSource.ioFailure().code) }
          let info = try IosFilesSource.metadata(fd)
          guard info.st_nlink == 1, info.st_uid == geteuid() else {
            Darwin.close(fd); throw IosPairingFailure.native("local_path_rejected")
          }
          updated.device = UInt64(truncatingIfNeeded: info.st_dev); updated.inode = info.st_ino
          do { try journal.saveRestoreIntent(updated) } catch { Darwin.close(fd); throw error }
        }
        defer { Darwin.close(fd) }
        // Resume only our recorded inode after proving every existing byte is the expected prefix.
        let existing = try IosFilesSource.metadata(fd).st_size
        var buffer = [UInt8](repeating: 0, count: 65_536)
        var position: Int64 = 0
        while position < updated.size {
          try check()
          let amount = Int(min(65536, updated.size - position))
          let count = Darwin.read(source.fileDescriptor, &buffer, amount)
          if count < 0 && errno == EINTR { continue }
          guard count == amount else { throw IosPairingFailure.native("hash_mismatch") }
          if position < existing {
            let overlap = Int(min(Int64(count), existing - position))
            var old = [UInt8](repeating: 0, count: overlap)
            guard pread(fd, &old, overlap, off_t(position)) == overlap,
              old == Array(buffer.prefix(overlap)) else { throw IosPairingFailure.native("destination_not_empty") }
          }
          let start = Int(max(0, existing - position))
          if start < count {
            try buffer.withUnsafeBytes { raw in
              var written = start
              while written < count {
                try check()
                let n = pwrite(fd, raw.baseAddress!.advanced(by: written), count - written, off_t(position + Int64(written)))
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { throw IosFilesSource.ioFailure() }
                written += n
              }
            }
          }
          position += Int64(count)
        }
        guard fsync(fd) == 0, fcntl(fd, F_FULLFSYNC) == 0, fsync(directory) == 0 else { throw IosFilesSource.ioFailure() }
        let (hash, length) = try IosFilesSource.hash(fd, maxBytes: updated.size, cancelled: { (try? check()) == nil })
        guard hash == updated.sha256, length == updated.size else { throw IosPairingFailure.native("hash_mismatch") }
        try check()
        updated.state = "completed"; updated.errorCode = nil
        try journal.saveRestoreIntent(updated)
  }

}
