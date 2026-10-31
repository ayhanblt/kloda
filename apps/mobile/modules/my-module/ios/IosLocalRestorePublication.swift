import Foundation

protocol IosLocalRestorePublication {
  var name: String { get }
  var sha256: String { get }
  var size: Int64 { get }
  var staging: String { get }
  var destination: String? { get }
  var device: UInt64? { get set }
  var inode: UInt64? { get set }
  var state: String { get set }
  var errorCode: String? { get set }
}
extension IosRestoreIntent: IosLocalRestorePublication {}

