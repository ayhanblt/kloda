#if KLODA_FTPS_NATIVE
import Foundation
import Darwin

private typealias LanWorker = @convention(c) (UnsafeMutableRawPointer?, Int32, UnsafeRawPointer?) -> Int32
#if KLODA_FTPS_OWNED_FIXTURE
@_silgen_name("kloda_owned_ftps_lan_with_socket")
private func lanWithSocket(_ address: UnsafePointer<UInt8>, _ length: Int, _ port: UInt16,
  _ worker: LanWorker?, _ context: UnsafeMutableRawPointer?) -> Int32
#else
@_silgen_name("kloda_ios_lan_with_socket")
private func lanWithSocket(_ address: UnsafePointer<UInt8>, _ length: Int, _ port: UInt16,
  _ worker: LanWorker?, _ context: UnsafeMutableRawPointer?) -> Int32
#endif
#if KLODA_FTPS_OWNED_FIXTURE
@_silgen_name("kloda_owned_ftps_lan_current")
private func lanCurrent(_ lease: UnsafeRawPointer?) -> Int32
#else
@_silgen_name("kloda_ios_lan_current")
private func lanCurrent(_ lease: UnsafeRawPointer?) -> Int32
#endif
#if KLODA_FTPS_OWNED_FIXTURE
@_silgen_name("kloda_owned_ftps_lan_connect")
private func lanConnect(_ lease: UnsafeRawPointer?, _ port: UInt16) -> Int32
#else
@_silgen_name("kloda_ios_lan_connect")
private func lanConnect(_ lease: UnsafeRawPointer?, _ port: UInt16) -> Int32
#endif

private final class FtpsLanWorker {
  let profiles: IosFtpsProfiles
  let job: IosFtpsUpload
  let snapshot: Int32
  let currentSource: () throws -> Bool
  let completedSource: () throws -> Bool
  var error: Error?
  init(profiles: IosFtpsProfiles, job: IosFtpsUpload, snapshot: Int32, currentSource: @escaping () throws -> Bool, completedSource: @escaping () throws -> Bool) {
    self.profiles = profiles; self.job = job; self.snapshot = snapshot; self.currentSource = currentSource; self.completedSource = completedSource
  }
  func run(socket: Int32, lease: UnsafeRawPointer) -> Int32 {
    do {
      guard lanCurrent(lease) == 0, try currentSource() else { throw IosFtpsFailure(code: "context_changed") }
      let owned = Darwin.dup(socket)
      guard owned >= 0 else { throw IosFtpsFailure(code: "snapshot_io_failed") }
      // publishBound consumes the duplicate on every return; Rust retains the original.
      // The callback and its lease do not escape this synchronous publication.
      try profiles.publishBound(job: job, snapshot: snapshot, socket: owned, connect: { address, port in
        guard address == self.job.target.address, lanCurrent(lease) == 0, (try? self.currentSource()) == true else { return -1 }
        return lanConnect(lease, port)
      }, currentSourceAndRoute: {
        try lanCurrent(lease) == 0 && self.currentSource()
      }, completedSource: {
        try lanCurrent(lease) == 0 && self.completedSource()
      })
      return 0
    } catch { self.error = error; return 1 }
  }
}

extension IosFtpsProfiles {
  // Native worker only; selected-source ownership is still mandatory, not a JS claim.
  func publishLan(job: IosFtpsUpload, snapshot: Int32, currentSource: @escaping () throws -> Bool, completedSource: (() throws -> Bool)? = nil) throws {
    guard !Thread.isMainThread else { throw IosFtpsFailure(code: "worker_required") }
    try job.validate()
    guard let captured = try capture(), captured.profile.target == job.target, captured.context == job.context,
      try currentSource() else { throw IosFtpsFailure(code: "context_changed") }
    let owner = FtpsLanWorker(profiles: self, job: job, snapshot: snapshot, currentSource: currentSource, completedSource: completedSource ?? currentSource)
    let bytes = Array(job.target.address.utf8)
    let result = withExtendedLifetime(owner) { bytes.withUnsafeBufferPointer { buffer in
      lanWithSocket(buffer.baseAddress!, bytes.count, UInt16(job.target.port), { context, socket, lease in
        guard let context, let lease else { return 1 }
        return Unmanaged<FtpsLanWorker>.fromOpaque(context).takeUnretainedValue().run(socket: socket, lease: lease)
      }, Unmanaged.passUnretained(owner).toOpaque())
    } }
    if let error = owner.error { throw error }
    guard result == 0 else { throw IosFtpsFailure(code: "lan_unavailable") }
  }
}
#endif
