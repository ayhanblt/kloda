#if KLODA_FTPS_NATIVE
import Foundation
import Darwin

private typealias ReadConnect = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<UInt8>?, Int, UInt16) -> Int32
private typealias ReadCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UInt64) -> Int32
private typealias ReadLanWorker = @convention(c) (UnsafeMutableRawPointer?, Int32, UnsafeRawPointer?) -> Int32
@_silgen_name("kloda_ftps_read_bound")
private func ftpsRead(_ json: UnsafePointer<UInt8>, _ length: Int, _ output: Int32, _ socket: Int32,
  _ callback: ReadCallback?, _ connect: ReadConnect?, _ context: UnsafeMutableRawPointer?) -> Int32
#if KLODA_FTPS_OWNED_FIXTURE
@_silgen_name("kloda_owned_ftps_lan_with_socket")
private func readLan(_ address: UnsafePointer<UInt8>, _ length: Int, _ port: UInt16,
  _ worker: ReadLanWorker?, _ context: UnsafeMutableRawPointer?) -> Int32
#else
@_silgen_name("kloda_ios_lan_with_socket")
private func readLan(_ address: UnsafePointer<UInt8>, _ length: Int, _ port: UInt16,
  _ worker: ReadLanWorker?, _ context: UnsafeMutableRawPointer?) -> Int32
#endif
#if KLODA_FTPS_OWNED_FIXTURE
@_silgen_name("kloda_owned_ftps_lan_current")
private func readRouteCurrent(_ lease: UnsafeRawPointer?) -> Int32
#else
@_silgen_name("kloda_ios_lan_current")
private func readRouteCurrent(_ lease: UnsafeRawPointer?) -> Int32
#endif
#if KLODA_FTPS_OWNED_FIXTURE
@_silgen_name("kloda_owned_ftps_lan_connect")
private func readRouteConnect(_ lease: UnsafeRawPointer?, _ port: UInt16) -> Int32
#else
@_silgen_name("kloda_ios_lan_connect")
private func readRouteConnect(_ lease: UnsafeRawPointer?, _ port: UInt16) -> Int32
#endif

private final class ReadOwner {
  let request: Data
  let output: Int32
  let check: () throws -> Void
  let address: String
  var lease: UnsafeRawPointer?
  var error: Error?
  init(request: Data, output: Int32, address: String, check: @escaping () throws -> Void) {
    self.request = request; self.output = output; self.address = address; self.check = check
  }
  func current() throws {
    try check()
    guard let lease, readRouteCurrent(lease) == 0 else { throw IosFtpsFailure(code: "context_changed") }
  }
  func run(socket: Int32, lease: UnsafeRawPointer) -> Int32 {
    self.lease = lease; defer { self.lease = nil }
    do {
      try current()
      let source = Darwin.dup(output)
      guard source >= 0 else { throw IosFtpsFailure(code: "snapshot_io_failed") }
      let wire = Darwin.dup(socket)
      guard wire >= 0 else { Darwin.close(source); throw IosFtpsFailure(code: "snapshot_io_failed") }
      let result = request.withUnsafeBytes { data in
        ftpsRead(data.bindMemory(to: UInt8.self).baseAddress!, request.count, source, wire, { raw, event, bytes in
          guard let raw, event == 0, bytes == 0 else { return 1 }
          do { try Unmanaged<ReadOwner>.fromOpaque(raw).takeUnretainedValue().current(); return 0 } catch { return 1 }
        }, { raw, address, length, port in
          guard let raw, let address, (1...39).contains(length), port > 0 else { return -1 }
          let owner = Unmanaged<ReadOwner>.fromOpaque(raw).takeUnretainedValue()
          do {
            try owner.current()
            guard String(bytes: UnsafeBufferPointer(start: address, count: length), encoding: .utf8) == owner.address else { return -1 }
            return readRouteConnect(owner.lease, port)
          } catch { return -1 }
        }, Unmanaged.passUnretained(self).toOpaque())
      }
      guard result == 0 else { throw IosFtpsFailure(code: "native_" + String(result)) }
      try current(); return 0
    } catch { self.error = error; return 1 }
  }
}

final class IosFtpsDownload {
  let profiles: IosFtpsProfiles
  let snapshots: IosFilesSnapshot
  let check: () throws -> Void
  init(profiles: IosFtpsProfiles, snapshots: IosFilesSnapshot, check: @escaping () throws -> Void) throws {
    guard snapshots.isFtps else { throw IosFtpsFailure(code: "invalid_request") }
    self.profiles = profiles; self.snapshots = snapshots; self.check = check
  }
  func receipt(_ id: String) throws -> IosFtpsUpload {
    try check()
    guard let captured = try profiles.capture() else { throw IosFtpsFailure(code: "profile_missing") }
    return try profiles.journal.ownReceipt(id: id, target: captured.profile.target)
  }
  func stage(_ id: String) throws -> String {
    guard !Thread.isMainThread else { throw IosFtpsFailure(code: "worker_required") }
    try check()
    guard let captured = try profiles.capture() else { throw IosFtpsFailure(code: "profile_missing") }
    let settings = try IosFtpsSources.binding()
    let job = try profiles.journal.ownReceipt(id: id, target: captured.profile.target)
    let current = {
      try self.check()
      guard try self.profiles.current(captured), try IosFtpsSources.binding() == settings else { throw IosFtpsFailure(code: "context_changed") }
    }
    let (name, file) = try snapshots.createStaging()
    var retained = false
    defer { try? file.close(); if !retained { try? snapshots.discard(name) } }
    let owner = try ReadOwner(request: IosFtpsPublication.request(job: job, password: captured.profile.password), output: file.fileDescriptor, address: captured.profile.target.address, check: current)
    let bytes = Array(captured.profile.target.address.utf8)
    let result = withExtendedLifetime(owner) { bytes.withUnsafeBufferPointer { address in
      readLan(address.baseAddress!, bytes.count, UInt16(captured.profile.target.port), { raw, socket, lease in
        guard let raw, let lease else { return 1 }
        return Unmanaged<ReadOwner>.fromOpaque(raw).takeUnretainedValue().run(socket: socket, lease: lease)
      }, Unmanaged.passUnretained(owner).toOpaque())
    } }
    if let error = owner.error { throw error }
    guard result == 0 else { throw IosFtpsFailure(code: "lan_unavailable") }
    try current()
    try snapshots.sealStaging(name, sha256: job.sha256, size: job.size, cancelled: { (try? current()) == nil })
    try current(); retained = true; return name
  }
  func manifest(_ id: String) throws -> IosFtpsPhotoManifest {
    let value = try receipt(id)
    guard value.kind == "photo_manifest", value.size <= 65536 else { throw IosFtpsFailure(code: "manifest_invalid") }
    let name = try stage(id); defer { try? snapshots.discard(name) }
    let file = try snapshots.open(name, sha256: value.sha256, size: value.size, cancelled: { (try? self.check()) == nil })
    defer { try? file.close() }; try file.seek(toOffset: 0)
    let result = try IosFtpsPhotoManifestCodec.decode(file.readToEnd() ?? Data())
    try IosFtpsPhotoManifestCodec.requireReceipts(result, target: value.target, journal: profiles.journal)
    guard result.filename == (value.relativePath as NSString).lastPathComponent, value.asset == result.assetId,
      value.reference == result.assetId + ":manifest", value.revision == String(result.revision),
      result.resources.allSatisfy({ $0.relativePath.hasPrefix(value.source + "/") }) else { throw IosFtpsFailure(code: "manifest_invalid") }
    try check(); return result
  }

}
#endif
