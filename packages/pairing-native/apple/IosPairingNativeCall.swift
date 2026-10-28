import Foundation
import Darwin

// Native-only ownership boundary; invoke on the future module's owned worker,
// not the main/UI thread. This does not establish foreground or route authority.
enum IosPairingNativeCall {
  static func consume(_ reply: UnsafeMutablePointer<CChar>?) throws -> Any {
    guard let reply else { throw IosPairingFailure.invalidReply }
    defer { kloda_ios_reply_free(reply) }
    let count = strnlen(reply, IosPairingReply.maximumBytes + 1)
    guard count > 0, count <= IosPairingReply.maximumBytes else { throw IosPairingFailure.invalidReply }
    var data = Data(bytes: reply, count: count)
    defer { data.resetBytes(in: 0..<data.count) }
    return try IosPairingReply.decode(data)
  }
}
