import Foundation
@main struct OwnershipChecks {
  static func main() throws {
    do { _ = try IosPairingNativeCall.consume(nil); assertionFailure() }
    catch IosPairingFailure.invalidReply {}
    assert(kloda_test_free_count() == 0)
    _ = try IosPairingNativeCall.consume(kloda_test_reply(0))
    assert(kloda_test_free_count() == 1)
    for mode: Int32 in [1, 2, 3] {
      do { _ = try IosPairingNativeCall.consume(kloda_test_reply(mode)); assertionFailure() }
      catch IosPairingFailure.invalidReply {}
      assert(kloda_test_free_count() == mode+1)
    }
    print("PASS Swift C-reply ownership: exact-once free for valid, malformed, oversize and invalid UTF8; null safe. C stub, not owner runtime.")
  }
}
