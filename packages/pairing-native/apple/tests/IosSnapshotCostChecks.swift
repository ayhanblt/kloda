import Foundation
import CryptoKit
import Darwin

// One disposable staging/hash sample, not provider/PhotoKit/network or physical performance acceptance.
@main struct IosSnapshotCostChecks {
  static func main() throws {
    let size = 256 * 1024 * 1024
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("kloda-cost-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
    let free = try FileManager.default.attributesOfFileSystem(forPath: directory.path)[.systemFreeSize] as? NSNumber
    guard let free, free.int64Value > Int64(size) * 2 else { print("NOT_RUN insufficient disposable test space"); return }
    let snapshots = try IosFilesSnapshot(directoryURL: directory.appendingPathComponent("snapshots"))
    let (name, handle) = try snapshots.createStaging()
    let chunk = Data(repeating: 73, count: 64 * 1024)
    var digest = SHA256()
    let begin = DispatchTime.now().uptimeNanoseconds
    for _ in 0..<(size / chunk.count) { try handle.write(contentsOf: chunk); digest.update(data: chunk) }
    try handle.synchronize(); try handle.close()
    let written = DispatchTime.now().uptimeNanoseconds
    let hash = IosFilesSource.encoded(Data(digest.finalize()))
    let verified = try snapshots.open(name, sha256: hash, size: Int64(size))
    let offset = try verified.offset(); precondition(offset == 0)
    var info = stat(); precondition(fstat(verified.fileDescriptor, &info) == 0 && info.st_size == size)
    try verified.close()
    let end = DispatchTime.now().uptimeNanoseconds
    let cancelled = DispatchTime.now().uptimeNanoseconds
    do { _ = try snapshots.open(name, sha256: hash, size: Int64(size), cancelled: { true }); fatalError("Cancelled hash accepted") }
    catch is IosPairingFailure {}
    let object: [String: Any] = ["result": "PASS", "logicalBytes": size, "chunkBytes": chunk.count,
      "fileBlocks512": info.st_blocks, "writeAndHashMs": Double(written - begin) / 1_000_000,
      "verifyHashMs": Double(end - written) / 1_000_000,
      "cancelBeforeReadMs": Double(DispatchTime.now().uptimeNanoseconds - cancelled) / 1_000_000,
      "scope": "single production staging/open path; source-copy, PhotoKit and LAN not measured"]
    print(String(data: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), encoding: .utf8)!)
  }
}
