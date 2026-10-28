import Foundation

@main struct DecoderChecks {
  static func main() throws {
    let accepted = try IosPairingReply.decode(Data(#"{"ok":true,"value":{"phase":"idle"}}"#.utf8)) as! [String:Any]
    assert(accepted["phase"] as? String == "idle")
    do { _ = try IosPairingReply.decode(Data(#"{"ok":false,"errorCode":"native_unsupported"}"#.utf8)); assertionFailure() }
    catch IosPairingFailure.native(let code) { assert(code == "native_unsupported") }
    for value in ["not json", "{", "{}", #"{"ok":1,"value":{}}"#, #"{"ok":true}"#,
      #"{"ok":true,"value":{},"trusted":true}"#, #"{"ok":false,"errorCode":"invented"}"#,
      #"{"ok":false,"value":{},"errorCode":"denied"}"#] {
      do { _ = try IosPairingReply.decode(Data(value.utf8)); assertionFailure(value) }
      catch IosPairingFailure.invalidReply {}
    }
    do { _ = try IosPairingReply.decode(Data(repeating: 65, count: 262_165)); assertionFailure() }
    catch IosPairingFailure.invalidReply {}
    let large = try JSONSerialization.data(withJSONObject: ["ok":true,"value":["items":Array(repeating:["sourceRevision":String(repeating:"\u{0001}",count:1024)],count:32)]])
    assert(large.count > 65_536 && large.count < 262_164)
    _ = try IosPairingReply.decode(large)
    print("PASS Swift native reply decoder: success, native error, strict envelope, bounds; no owner or network")
  }
}
