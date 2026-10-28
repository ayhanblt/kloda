import Foundation
import CryptoKit
import Darwin

// Uses only a newly created explicit temporary directory; no authority or user source bookmarks.
@main struct IosFilesSnapshotChecks {
  static func rejects(_ operation: () throws -> Void) {
    do { try operation(); fatalError("Unexpected snapshot acceptance") }
    catch is IosPairingFailure {}
    catch { fatalError("Unexpected fixture error") }
  }

  static func main() throws {
    let cocoaFull = NSError(domain: NSCocoaErrorDomain, code: NSFileWriteOutOfSpaceError)
    let posixFull = NSError(domain: NSPOSIXErrorDomain, code: Int(ENOSPC))
    precondition(IosFilesSource.isStorageFull(cocoaFull))
    precondition(IosFilesSource.isStorageFull(posixFull))
    precondition(IosFilesSource.isStorageFull(NSError(domain: NSPOSIXErrorDomain, code: Int(EDQUOT))))
    precondition(IosFilesSource.isStorageFull(NSError(domain: NSCocoaErrorDomain, code: NSFileWriteUnknownError,
      userInfo: [NSUnderlyingErrorKey: posixFull])))
    precondition(!IosFilesSource.isStorageFull(NSError(domain: NSCocoaErrorDomain, code: NSFileWriteNoPermissionError)))
    precondition(!IosFilesSource.isStorageFull(NSError(domain: NSPOSIXErrorDomain, code: Int(EIO))))
    print("PASS Cocoa/POSIX/quota/underlying storage-full classification preserves unrelated errors")
    let base = FileManager.default.temporaryDirectory.appendingPathComponent("kloda-snapshot-check-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: base, withIntermediateDirectories: false,
      attributes: [.posixPermissions: 0o700])
    let storage = try IosFilesSnapshot(directoryURL: base.appendingPathComponent("snapshots", isDirectory: true))
    let bytes = Data(repeating: 73, count: 131_073)
    let digest = IosFilesSource.encoded(Data(SHA256.hash(data: bytes)))
    let name = UUID().uuidString.lowercased() + ".snapshot"
    let path = base.appendingPathComponent("snapshots").appendingPathComponent(name)
    try bytes.write(to: path, options: .withoutOverwriting)
    precondition(chmod(path.path, 0o600) == 0)
    let opened = try storage.open(name, sha256: digest, size: Int64(bytes.count))
    let readback = try opened.read(upToCount: bytes.count)
    precondition(readback == bytes)
    try opened.close()
    print("PASS exact private snapshot hash/size and rewound descriptor")
    rejects { _ = try storage.open(name, sha256: digest, size: Int64(bytes.count - 1)) }
    rejects { _ = try storage.open(name, sha256: "wrong", size: Int64(bytes.count)) }
    rejects { _ = try storage.open(name, sha256: digest, size: Int64(bytes.count), cancelled: { true }) }
    rejects { _ = try storage.open("../" + name, sha256: digest, size: Int64(bytes.count)) }
    precondition(chmod(path.path, 0o644) == 0)
    rejects { _ = try storage.open(name, sha256: digest, size: Int64(bytes.count)) }
    precondition(chmod(path.path, 0o600) == 0)
    let linked = base.appendingPathComponent("linked")
    precondition(link(path.path, linked.path) == 0)
    rejects { _ = try storage.open(name, sha256: digest, size: Int64(bytes.count)) }
    precondition(unlink(linked.path) == 0)
    print("PASS stale/cancelled/overshared/hardlinked snapshots refuse")
    for bad in ["", "/absolute", "../outside", "dir/../file", "dir//file", "dir/\\file", "dir/\u{0}file"] {
      rejects { _ = try IosFilesSource.components(bad) }
    }
    let source = base.appendingPathComponent("source", isDirectory: true)
    try FileManager.default.createDirectory(at: source, withIntermediateDirectories: false)
    try bytes.write(to: source.appendingPathComponent("file.bin"))
    try FileManager.default.createSymbolicLink(at: source.appendingPathComponent("escape"),
      withDestinationURL: base)
    let root = Darwin.open(source.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW)
    precondition(root >= 0)
    defer { Darwin.close(root) }
    let file = try IosFilesSource.openRelative(rootFD: root, parts: ["file.bin"])
    defer { Darwin.close(file) }
    let (sourceHash, count) = try IosFilesSource.hash(file, maxBytes: Int64(bytes.count), cancelled: { false })
    precondition(sourceHash == digest && count == bytes.count)
    rejects { _ = try IosFilesSource.openRelative(rootFD: root, parts: ["escape", "outside"]) }
    rejects { _ = try IosFilesSource.hash(file, maxBytes: 1, cancelled: { false }) }
    print("PASS selected-root descriptor path rejects traversal/symlink and source overrun")
    try storage.discard(name)
    precondition(!FileManager.default.fileExists(atPath: path.path))
    try storage.discard(name)
    print("PASS exact owned snapshot discard is repeatable")
    let (staging, writer) = try storage.createStaging()
    try writer.write(contentsOf: bytes)
    try writer.synchronize()
    try writer.close()
    rejects { _ = try storage.openStaging(staging, offset: 0) }
    let resumed = try storage.openStaging(staging, offset: Int64(bytes.count))
    let position = try resumed.offset()
    precondition(position == UInt64(bytes.count))
    try resumed.close()
    try storage.discard(staging)
    rejects { _ = try storage.openStaging(staging, offset: 0) }
    let fifo = UUID().uuidString.lowercased() + ".snapshot"
    precondition(mkfifo(base.appendingPathComponent("snapshots").appendingPathComponent(fifo).path, 0o600) == 0)
    rejects { _ = try storage.openStaging(fifo, offset: 0) }
    print("PASS restore staging resumes exact size and refuses missing/FIFO/mismatched files")
    // Preserve this test-owned directory for evidence; never scan or clean unrelated paths.
    let (tailName, tail) = try storage.createStaging()
    try tail.write(contentsOf: Data(repeating: 1, count: 65_536)); try tail.synchronize(); try tail.close()
    rejects { _ = try storage.openStaging(tailName, offset: 0) }
    let recovered = try storage.openStaging(tailName, offset: 0, discardUnacknowledgedTail: true)
    let end = try recovered.seekToEnd()
    precondition(end == 0)
    try recovered.close()
    print("PASS lost-reply staging tail is not adopted and only owned unacknowledged bytes are replayed")
  }
}
