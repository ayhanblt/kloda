import Foundation
import CryptoKit
import Darwin

// Only coordinated, selected-bookmark reads; no provider descriptor crosses the native sender boundary.
enum IosFilesSource {
  static func directoryIdentity(bookmark: String) throws -> String {
    guard let data = Data(base64Encoded: bookmark) else { throw failure("source_unavailable") }
    var stale = false
    let root = try URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale)
    guard !stale, root.isFileURL, root.startAccessingSecurityScopedResource() else { throw failure("source_unavailable") }
    defer { root.stopAccessingSecurityScopedResource() }
    let fd = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard fd >= 0 else { throw ioFailure() }
    defer { Darwin.close(fd) }
    var info = stat()
    guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFDIR else { throw failure("local_path_rejected") }
    guard info.st_dev != 0, info.st_ino != 0, info.st_birthtimespec.tv_sec > 0 else { throw failure("source_identity_unknown") }
    return directoryIdentity(info)
  }
  private static func directoryIdentity(_ info: stat) -> String {
    "\(info.st_dev):\(info.st_ino):\(info.st_birthtimespec.tv_sec):\(info.st_birthtimespec.tv_nsec)"
  }
  static func wireSource(directory: String, reference: String) -> String {
    encoded(Data(SHA256.hash(data: Data((directory + "\u{0}" + reference).utf8)).prefix(16)))
  }

  static func read<T>(bookmark: String, file: IosQueuedSourceFile, cancelled: () -> Bool,
    body: (Int32, stat, String) throws -> T) throws -> T {
    guard file.reference == file.relativePath, file.size >= 0,
      let data = Data(base64Encoded: bookmark) else { throw failure("local_path_rejected") }
    let parts = try components(file.relativePath)
    var stale = false
    let root: URL
    do { root = try URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale) }
    catch { throw failure("source_unavailable") }
    guard !stale, root.isFileURL, root.startAccessingSecurityScopedResource() else {
      throw failure("source_unavailable")
    }
    defer { root.stopAccessingSecurityScopedResource() }
    if cancelled() { throw failure("cancelled") }
    let rootFD = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard rootFD >= 0 else { throw ioFailure() }
    defer { Darwin.close(rootFD) }
    var rootInfo = stat()
    guard fstat(rootFD, &rootInfo) == 0, rootInfo.st_mode & S_IFMT == S_IFDIR else {
      throw failure("local_path_rejected")
    }
    guard rootInfo.st_dev != 0, rootInfo.st_ino != 0, rootInfo.st_birthtimespec.tv_sec > 0 else {
      throw failure("source_identity_unknown")
    }
    let target = parts.reduce(root) { $0.appendingPathComponent($1, isDirectory: false) }
    var result: Result<T, Error>?
    var coordinationError: NSError?
    NSFileCoordinator().coordinate(readingItemAt: target, options: .withoutChanges, error: &coordinationError) { actual in
      result = Result {
        if cancelled() { throw failure("cancelled") }
        // A provider relocation must be selected again, never adopted outside the retained directory handle.
        guard actual.standardizedFileURL == target.standardizedFileURL else {
          throw failure("source_changed")
        }
        try checkRoot(root, expected: rootInfo)
        let availability = try actual.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey])
        if availability.isUbiquitousItem == true {
          guard availability.ubiquitousItemDownloadingStatus == .current || availability.ubiquitousItemDownloadingStatus == .downloaded else {
            throw failure("source_unavailable")
          }
        }
        let fd = try openRelative(rootFD: rootFD, parts: parts)
        defer { Darwin.close(fd) }
        let before = try metadata(fd)
        guard before.st_size == file.size,
          file.revision == "\(before.st_size):\(before.st_mtimespec.tv_sec)" else {
          throw failure("source_changed")
        }
        let wireSourceId = wireSource(directory: directoryIdentity(rootInfo), reference: file.relativePath)
        let value = try body(fd, before, wireSourceId)
        guard unchanged(before, try metadata(fd)) else { throw failure("source_changed") }
        try checkRoot(root, expected: rootInfo)
        if cancelled() { throw failure("cancelled") }
        return value
      }
    }
    guard coordinationError == nil, let result else { throw failure("source_unavailable") }
    return try result.get()
  }

  static func components(_ path: String) throws -> [String] {
    let parts = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
    guard !parts.isEmpty, path.utf8.count <= 4096,
      parts.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && !$0.contains("\\")
        && !$0.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) }) else {
      throw failure("local_path_rejected")
    }
    return parts
  }

  static func openRelative(rootFD: Int32, parts: [String]) throws -> Int32 {
    guard try components(parts.joined(separator: "/")) == parts else {
      throw failure("local_path_rejected")
    }
    var current = fcntl(rootFD, F_DUPFD_CLOEXEC, 0)
    guard current >= 0 else { throw ioFailure() }
    defer { Darwin.close(current) }
    for part in parts.dropLast() {
      let next = openat(current, part, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
      guard next >= 0 else { throw ioFailure() }
      Darwin.close(current)
      current = next
    }
    let file = openat(current, parts.last!, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK)
    guard file >= 0 else { throw ioFailure() }
    return file
  }

  private static func checkRoot(_ root: URL, expected: stat) throws {
    let fd = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard fd >= 0 else { throw failure("source_changed") }
    defer { Darwin.close(fd) }
    var current = stat()
    guard fstat(fd, &current) == 0, current.st_dev == expected.st_dev,
      current.st_ino == expected.st_ino else { throw failure("source_changed") }
  }

  static func metadata(_ fd: Int32) throws -> stat {
    var info = stat()
    guard fstat(fd, &info) == 0 else { throw ioFailure() }
    guard info.st_mode & S_IFMT == S_IFREG, info.st_size >= 0 else {
      throw failure("local_path_rejected")
    }
    return info
  }

  static func unchanged(_ a: stat, _ b: stat) -> Bool {
    a.st_dev == b.st_dev && a.st_ino == b.st_ino && a.st_size == b.st_size
      && a.st_mode == b.st_mode && a.st_nlink == b.st_nlink
      && a.st_mtimespec.tv_sec == b.st_mtimespec.tv_sec && a.st_mtimespec.tv_nsec == b.st_mtimespec.tv_nsec
      && a.st_ctimespec.tv_sec == b.st_ctimespec.tv_sec && a.st_ctimespec.tv_nsec == b.st_ctimespec.tv_nsec
  }

  static func hash(_ fd: Int32, maxBytes: Int64 = Int64.max, cancelled: () -> Bool,
    consume: (Data) throws -> Void = { _ in }) throws -> (String, Int64) {
    guard lseek(fd, 0, SEEK_SET) == 0 else { throw ioFailure() }
    var hash = SHA256(), total: Int64 = 0
    var buffer = [UInt8](repeating: 0, count: 65_536)
    while true {
      if cancelled() { throw failure("cancelled") }
      let count = Darwin.read(fd, &buffer, buffer.count)
      if count < 0 {
        if errno == EINTR { continue }
        throw ioFailure()
      }
      if count == 0 { break }
      let (next, overflow) = total.addingReportingOverflow(Int64(count))
      guard !overflow, next <= maxBytes else { throw failure("source_changed") }
      total = next
      let bytes = Data(buffer.prefix(count))
      hash.update(data: bytes)
      try consume(bytes)
    }
    return (encoded(Data(hash.finalize())), total)
  }

  static func encoded(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }

  static func failure(_ code: String) -> IosPairingFailure { .native(code) }
  static func isStorageFull(_ error: Error) -> Bool {
    var current = error as NSError
    for _ in 0..<16 {
      if current.domain == NSCocoaErrorDomain && current.code == NSFileWriteOutOfSpaceError { return true }
      if current.domain == NSPOSIXErrorDomain && [Int(ENOSPC), Int(EDQUOT)].contains(current.code) { return true }
      guard let underlying = current.userInfo[NSUnderlyingErrorKey] as? NSError else { return false }
      current = underlying
    }
    return false
  }

  static func ioFailure() -> IosPairingFailure {
    switch errno {
    case ENOSPC, EDQUOT: return failure("local_storage_full")
    case EACCES, EPERM: return failure("local_permission_lost")
    case ELOOP, ENOTDIR: return failure("local_path_rejected")
    default: return failure("source_unavailable")
    }
  }
}
