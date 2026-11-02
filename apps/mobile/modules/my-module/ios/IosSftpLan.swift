#if KLODA_SFTP_NATIVE
import Foundation
import Darwin

private typealias LanWorker = @convention(c) (UnsafeMutableRawPointer?, Int32, UnsafeRawPointer?) -> Int32
@_silgen_name("kloda_ios_lan_with_socket")
private func lanWithSocket(_ address: UnsafePointer<UInt8>, _ length: Int, _ port: UInt16,
  _ worker: LanWorker?, _ context: UnsafeMutableRawPointer?) -> Int32
@_silgen_name("kloda_ios_lan_current")
private func lanCurrent(_ lease: UnsafeRawPointer?) -> Int32

private final class SftpLanWorker {
  let profiles: IosSftpProfiles
  let job: IosSftpUpload
  let snapshot: Int32
  let currentSource: () throws -> Bool
  let completedSource: () throws -> Bool
  var error: Error?
  init(profiles: IosSftpProfiles, job: IosSftpUpload, snapshot: Int32, currentSource: @escaping () throws -> Bool, completedSource: @escaping () throws -> Bool) {
    self.profiles = profiles; self.job = job; self.snapshot = snapshot; self.currentSource = currentSource; self.completedSource = completedSource
  }
  func run(socket: Int32, lease: UnsafeRawPointer) -> Int32 {
    do {
      guard lanCurrent(lease) == 0, try currentSource() else { throw IosSftpFailure(code: "context_changed") }
      let owned = Darwin.dup(socket)
      guard owned >= 0 else { throw IosSftpFailure(code: "snapshot_io_failed") }
      // publishBound consumes the duplicate on every return; Rust retains the original.
      // The callback and its lease do not escape this synchronous publication.
      try profiles.publishBound(job: job, snapshot: snapshot, socket: owned, currentSourceAndRoute: {
        try lanCurrent(lease) == 0 && self.currentSource()
      }, completedSource: {
        try lanCurrent(lease) == 0 && self.completedSource()
      })
      return 0
    } catch { self.error = error; return 1 }
  }
}

extension IosSftpProfiles {
  // Native worker only; selected-source ownership is still mandatory, not a JS claim.
  func publishLan(job: IosSftpUpload, snapshot: Int32, currentSource: @escaping () throws -> Bool, completedSource: (() throws -> Bool)? = nil) throws {
    guard !Thread.isMainThread else { throw IosSftpFailure(code: "worker_required") }
    try job.validate()
    guard let captured = try capture(), captured.profile.target == job.target, captured.context == job.context,
      try currentSource() else { throw IosSftpFailure(code: "context_changed") }
    let owner = SftpLanWorker(profiles: self, job: job, snapshot: snapshot, currentSource: currentSource, completedSource: completedSource ?? currentSource)
    let bytes = Array(job.target.address.utf8)
    let result = withExtendedLifetime(owner) { bytes.withUnsafeBufferPointer { buffer in
      lanWithSocket(buffer.baseAddress!, bytes.count, UInt16(job.target.port), { context, socket, lease in
        guard let context, let lease else { return 1 }
        return Unmanaged<SftpLanWorker>.fromOpaque(context).takeUnretainedValue().run(socket: socket, lease: lease)
      }, Unmanaged.passUnretained(owner).toOpaque())
    } }
    if let error = owner.error { throw error }
    guard result == 0 else { throw IosSftpFailure(code: "lan_unavailable") }
  }
}
#endif
