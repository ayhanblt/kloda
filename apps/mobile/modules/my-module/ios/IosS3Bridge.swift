#if KLODA_S3_NATIVE
import Foundation

@_silgen_name("kloda_s3_json_v1")
private func s3Json(_ kind: UInt32, _ input: UnsafePointer<UInt8>, _ count: Int,
  _ output: UnsafeMutablePointer<UInt8>?, _ capacity: Int, _ written: UnsafeMutablePointer<Int>) -> Int32

// Native-only: dictionaries contain short-lived bearer URLs; never return them to JS or logs.
enum IosS3Bridge {
  static func process(_ kind: UInt32, _ json: [String: Any]) throws -> [String: Any] {
    var input = try JSONSerialization.data(withJSONObject: json)
    defer { input.resetBytes(in: 0..<input.count) }
    guard !input.isEmpty, input.count <= 1024 * 1024 else { throw IosS3Failure(code: "invalid_request") }
    var size = 0
    let sizing = input.withUnsafeBytes { bytes in s3Json(kind, bytes.bindMemory(to: UInt8.self).baseAddress!, input.count, nil, 0, &size) }
    guard sizing == 2, size > 0, size <= 4 * 1024 * 1024 else { throw IosS3Failure(code: "invalid_request") }
    var output = Data(count: size)
    defer { output.resetBytes(in: 0..<output.count) }
    let capacity = size
    let result = input.withUnsafeBytes { bytes in output.withUnsafeMutableBytes { out in
      s3Json(kind, bytes.bindMemory(to: UInt8.self).baseAddress!, input.count, out.bindMemory(to: UInt8.self).baseAddress!, capacity, &size)
    } }
    guard result == 0, size == capacity, let value = try JSONSerialization.jsonObject(with: output) as? [String: Any]
      else { throw IosS3Failure(code: "invalid_request") }
    return value
  }
  static func prepare(_ profile: IosS3Profile, key: String, operation: [String: Any]) throws -> [String: Any] {
    let t = profile.target
    return try process(0, ["provider": t.provider, "endpoint": t.endpoint, "region": t.region, "bucket": t.bucket,
      "prefix": t.prefix, "path_style": t.pathStyle, "access_key": profile.accessKey, "secret": profile.secret,
      "token": profile.token as Any? ?? NSNull(), "key": key, "operation": operation])
  }
  static func reply(_ kind: UInt32, status: Int, body: String, target: IosS3Target, key: String) throws -> [String: Any] {
    try process(kind, ["status": status, "body": body, "bucket": target.bucket,
      "key": target.prefix.isEmpty ? key : target.prefix + "/" + key])
  }
}
#endif
