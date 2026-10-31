import Foundation
import Darwin

struct IosPreparedFile {
  let name: String
  let sha256: String
  let size: Int64
  let snapshot: String
  let revision: String
  let wireSourceId: String
}

final class IosFilesSnapshot {
  private let directory: Int32
  private let rootURL: URL

  init(directoryURL: URL? = nil) throws {
    let root: URL
    if let directoryURL { root = directoryURL }
    else {
      let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
        appropriateFor: nil, create: true)
      root = support.appendingPathComponent("kloda-files-snapshots", isDirectory: true)
    }
    if mkdir(root.path, 0o700) != 0 && errno != EEXIST { throw IosFilesSource.ioFailure() }
    let fd = Darwin.open(root.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    guard fd >= 0 else { throw IosFilesSource.ioFailure() }
    var info = stat()
    guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFDIR,
      info.st_uid == geteuid(), info.st_mode & 0o077 == 0 else {
      Darwin.close(fd)
      throw IosFilesSource.failure("local_path_rejected")
    }
    do {
      var url = root
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
      #if os(iOS)
      try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: root.path)
      #endif
    } catch {
      Darwin.close(fd)
      throw IosFilesSource.failure("source_unavailable")
    }
    directory = fd
    rootURL = root
  }

  var isWebDav: Bool { rootURL.lastPathComponent == "kloda-webdav-snapshots" }
  static func webdav() throws -> IosFilesSnapshot {
    let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    return try IosFilesSnapshot(directoryURL: support.appendingPathComponent("kloda-webdav-snapshots", isDirectory: true))
  }
  deinit { Darwin.close(directory) }

  func createStaging() throws -> (String, FileHandle) {
    let name = UUID().uuidString.lowercased() + ".snapshot"
    let fd = openat(directory, name, O_RDWR | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0o600)
    guard fd >= 0 else { throw IosFilesSource.ioFailure() }
    guard fsync(fd) == 0, fcntl(fd, F_FULLFSYNC) == 0, fsync(directory) == 0 else {
      let error = IosFilesSource.ioFailure()
      Darwin.close(fd)
      _ = unlinkat(directory, name, 0)
      throw error
    }
    return (name, FileHandle(fileDescriptor: fd, closeOnDealloc: true))
  }

  func openStaging(_ name: String, offset: Int64, discardUnacknowledgedTail: Bool = false) throws -> FileHandle {
    try validateName(name)
    guard offset >= 0 else { throw IosFilesSource.failure("invalid_request") }
    let fd = openat(directory, name, O_RDWR | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK)
    guard fd >= 0 else { throw IosFilesSource.ioFailure() }
    do {
      let info = try IosFilesSource.metadata(fd)
      guard info.st_uid == geteuid(), info.st_mode & 0o077 == 0, info.st_mode & 0o600 == 0o600,
        info.st_nlink == 1, info.st_size >= offset,
        info.st_size == offset || (discardUnacknowledgedTail && info.st_size - offset <= 65_536) else {
        throw IosFilesSource.failure("local_path_rejected")
      }
      if info.st_size > offset {
        guard ftruncate(fd, off_t(offset)) == 0, fsync(fd) == 0 else { throw IosFilesSource.ioFailure() }
      }
      guard lseek(fd, off_t(offset), SEEK_SET) == offset else { throw IosFilesSource.ioFailure() }
      return FileHandle(fileDescriptor: fd, closeOnDealloc: true)
    } catch {
      Darwin.close(fd)
      throw error
    }
  }

  func prepare(sourceId: String, bookmark: String, file: IosQueuedSourceFile,
    cancelled: () -> Bool) throws -> IosPreparedFile {
    guard !sourceId.isEmpty else { throw IosFilesSource.failure("invalid_request") }
    let name = try IosFilesSource.components(file.relativePath).last!
    guard name.utf8.count <= 255 else { throw IosFilesSource.failure("local_path_rejected") }
    let snapshot = UUID().uuidString.lowercased() + ".snapshot"
    let fd = openat(directory, snapshot, O_RDWR | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0o600)
    guard fd >= 0 else { throw IosFilesSource.ioFailure() }
    var retained = false
    defer {
      Darwin.close(fd)
      if !retained { _ = unlinkat(directory, snapshot, 0) }
    }
    let result = try IosFilesSource.read(bookmark: bookmark, file: file, cancelled: cancelled) { source, _, wireSourceId in
      let (hash, size) = try IosFilesSource.hash(source, maxBytes: file.size, cancelled: cancelled) { bytes in
        try bytes.withUnsafeBytes { raw in
          var offset = 0
          while offset < raw.count {
            if cancelled() { throw IosFilesSource.failure("cancelled") }
            let count = Darwin.write(fd, raw.baseAddress!.advanced(by: offset), raw.count - offset)
            if count < 0 && errno == EINTR { continue }
            guard count > 0 else { throw IosFilesSource.ioFailure() }
            offset += count
          }
        }
      }
      guard size == file.size else { throw IosFilesSource.failure("source_changed") }
      return IosPreparedFile(name: name, sha256: hash, size: size, snapshot: snapshot,
        revision: file.revision, wireSourceId: wireSourceId)
    }
    guard fsync(fd) == 0, fcntl(fd, F_FULLFSYNC) == 0, fsync(directory) == 0 else {
      throw IosFilesSource.ioFailure()
    }
    if cancelled() { throw IosFilesSource.failure("cancelled") }
    retained = true
    return result
  }

  func open(_ snapshot: String, sha256: String, size: Int64, cancelled: () -> Bool = { false }) throws -> FileHandle {
    try validateName(snapshot)
    let fd = openat(directory, snapshot, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK)
    guard fd >= 0 else { throw IosFilesSource.ioFailure() }
    do {
      let before = try IosFilesSource.metadata(fd)
      guard before.st_uid == geteuid(), before.st_mode & 0o077 == 0,
        before.st_mode & 0o400 != 0, before.st_nlink == 1, before.st_size == size else {
        throw IosFilesSource.failure("local_path_rejected")
      }
      let (actual, length) = try IosFilesSource.hash(fd, maxBytes: size, cancelled: cancelled)
      guard actual == sha256, length == size,
        IosFilesSource.unchanged(before, try IosFilesSource.metadata(fd)), lseek(fd, 0, SEEK_SET) == 0 else {
        throw IosFilesSource.failure("source_changed")
      }
      return FileHandle(fileDescriptor: fd, closeOnDealloc: true)
    } catch {
      Darwin.close(fd)
      throw error
    }
  }

  func validateSource(bookmark: String, file: IosQueuedSourceFile, sha256: String, size: Int64,
    wireSourceId: String? = nil, cancelled: () -> Bool) throws {
    try IosFilesSource.read(bookmark: bookmark, file: file, cancelled: cancelled) { fd, _, currentSource in
      let (actual, length) = try IosFilesSource.hash(fd, maxBytes: size, cancelled: cancelled)
      guard actual == sha256, length == size, wireSourceId == nil || wireSourceId == currentSource else {
        throw IosFilesSource.failure("source_changed")
      }
    }
  }

  func verifiedURL(_ name: String, sha256: String, size: Int64, check: () throws -> Void) throws -> URL {
    try check()
    let file = try open(name, sha256: sha256, size: size, cancelled: { (try? check()) == nil })
    try file.close()
    return rootURL.appendingPathComponent(name)
  }

  func discard(_ snapshot: String) throws {
    try validateName(snapshot)
    if unlinkat(directory, snapshot, 0) != 0 && errno != ENOENT { throw IosFilesSource.ioFailure() }
    guard fsync(directory) == 0 else { throw IosFilesSource.ioFailure() }
  }

  private func validateName(_ snapshot: String) throws {
    guard snapshot.hasSuffix(".snapshot"), snapshot.count == 45,
      UUID(uuidString: String(snapshot.dropLast(9)))?.uuidString.lowercased() == String(snapshot.dropLast(9)) else {
      throw IosFilesSource.failure("local_path_rejected")
    }
  }
}
