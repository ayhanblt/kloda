import Foundation

@main struct Checks {
  static func main() throws {
    let target = IosS3Target(provider: "amazon-s3", endpoint: "https://s3.us-east-1.amazonaws.com", region: "us-east-1",
      bucket: "owned-bucket", prefix: "owned", pathStyle: false, accountBinding: IosS3Target.hash(Data("synthetic".utf8)),
      profileGeneration: UUID().uuidString.lowercased(), credentialGeneration: UUID().uuidString.lowercased())
    let profile = IosS3Profile(target: target, accessKey: "synthetic", secret: "synthetic-secret", token: nil)
    try profile.validate()
    let encoded = try JSONEncoder().encode(profile)
    let decoded = try IosS3Profile.decode(encoded); precondition(decoded == profile)
    precondition(!String(describing: profile).contains("synthetic-secret"))
    let signed = try IosS3Bridge.prepare(profile, key: "x", operation: ["kind": "head"])
    precondition(signed["method"] as? String == "HEAD")
    let url = URL(string: signed["url"] as! String)!
    precondition(url.host == "owned-bucket.s3.us-east-1.amazonaws.com")
    let reply = try IosS3Bridge.reply(2, status: 0, body: "", target: target, key: "x"); precondition(reply["kind"] as? String == "review")
    var tampered = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
    tampered["accessKey"] = "other-account"
    do { _ = try IosS3Profile.decode(JSONSerialization.data(withJSONObject: tampered)); fatalError("changed account accepted") } catch {}
    tampered = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
    tampered["extra"] = "unexpected"
    do { _ = try IosS3Profile.decode(JSONSerialization.data(withJSONObject: tampered)); fatalError("unknown field accepted") } catch {}
    print("PASS native Swift/C signer, nil-token roundtrip, redaction, target binding, strict decoding and lost-ACK Review; no vault/network mutation")
  }
}
