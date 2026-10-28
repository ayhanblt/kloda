import Foundation

// Disposable Photos test app only; never include this fake session in the production pod.
final class IosBackgroundLease {}

final class KlodaPairingSession {
  let fixture: IosFilesConnection?
  init(fixture: IosFilesConnection? = nil) { self.fixture = fixture }
  func backgroundFileConnection(record: String, lease: IosBackgroundLease,
    completion: @escaping (Result<IosFilesConnection, IosPairingFailure>) -> Void) {
    completion(.failure(.native("native_unsupported")))
  }
  func fileConnection(record: String, automatic: Bool = false, completion: @escaping (Result<IosFilesConnection, IosPairingFailure>) -> Void) {
    if let fixture { completion(.success(fixture)) } else { completion(.failure(.native("native_unsupported"))) }
  }
}
