import Foundation

// Schema-bounded token parsing preserves duplicate keys before Foundation can collapse them.
indirect enum IosPhotoJson {
  case object([String: IosPhotoJson]), array([IosPhotoJson]), string(String), version, bool(Bool), null

  struct Reader {
    let bytes: [UInt8]
    var index = 0
    let invalid = IosPairingFailure.native("manifest_invalid")

    init(_ data: Data) throws {
      guard !data.isEmpty, data.count <= 65_536, String(data: data, encoding: .utf8) != nil else {
        throw IosPairingFailure.native("manifest_invalid")
      }
      bytes = Array(data)
    }
    mutating func read() throws -> IosPhotoJson {
      let result = try object(depth: 0)
      whitespace()
      guard index == bytes.count else { throw invalid }
      return result
    }
    mutating func whitespace() {
      while index < bytes.count && [9, 10, 13, 32].contains(bytes[index]) { index += 1 }
    }
    mutating func take(_ byte: UInt8) -> Bool {
      whitespace()
      guard index < bytes.count, bytes[index] == byte else { return false }
      index += 1
      return true
    }
    mutating func object(depth: Int) throws -> IosPhotoJson {
      guard depth <= 1, take(123) else { throw invalid }
      var values: [String: IosPhotoJson] = [:]
      if take(125) { return .object(values) }
      repeat {
        let key = try string()
        guard key.utf16.count <= 32, values[key] == nil, values.count < 8, take(58) else { throw invalid }
        whitespace()
        guard index < bytes.count else { throw invalid }
        switch bytes[index] {
        case 34: values[key] = .string(try string())
        case 116: try literal("true"); values[key] = .bool(true)
        case 102: try literal("false"); values[key] = .bool(false)
        case 110: try literal("null"); values[key] = .null
        case 49:
          guard depth == 0, key == "version" else { throw invalid }
          index += 1; values[key] = .version
        case 91:
          guard depth == 0, key == "resources" || key == "albums" else { throw invalid }
          index += 1
          var array: [IosPhotoJson] = []
          if !take(93) {
            repeat {
              guard array.count < (key == "resources" ? 8 : 32) else { throw invalid }
              array.append(try object(depth: depth + 1))
            } while take(44)
            guard take(93) else { throw invalid }
          }
          values[key] = .array(array)
        default: throw invalid
        }
        if take(125) { return .object(values) }
        guard take(44) else { throw invalid }
      } while true
    }
    mutating func literal(_ text: String) throws {
      let token = Array(text.utf8)
      guard bytes.count - index >= token.count,
        Array(bytes[index..<(index + token.count)]) == token else { throw invalid }
      index += token.count
    }
    mutating func hex() throws -> UInt16 {
      guard bytes.count - index >= 4 else { throw invalid }
      var result: UInt16 = 0
      for _ in 0..<4 {
        let byte = bytes[index]; index += 1
        let digit: UInt8
        switch byte {
        case 48...57: digit = byte - 48
        case 65...70: digit = byte - 55
        case 97...102: digit = byte - 87
        default: throw invalid
        }
        result = result * 16 + UInt16(digit)
      }
      return result
    }
    mutating func string() throws -> String {
      whitespace()
      let start = index
      guard take(34) else { throw invalid }
      while index < bytes.count {
        let byte = bytes[index]; index += 1
        if byte == 34 {
          let data = Data(bytes[start..<index])
          guard let text = try JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed) as? String,
            text.utf16.count <= 1024 else { throw invalid }
          return text
        }
        guard byte >= 32 else { throw invalid }
        if byte == 92 {
          guard index < bytes.count else { throw invalid }
          let escaped = bytes[index]; index += 1
          if escaped == 117 {
            let scalar = try hex()
            if (0xD800...0xDBFF).contains(scalar) {
              guard bytes.count - index >= 6, bytes[index] == 92, bytes[index + 1] == 117 else { throw invalid }
              index += 2
              guard (0xDC00...0xDFFF).contains(try hex()) else { throw invalid }
            } else if (0xDC00...0xDFFF).contains(scalar) { throw invalid }
          } else if ![34, 92, 47, 98, 102, 110, 114, 116].contains(escaped) { throw invalid }
        }
      }
      throw invalid
    }
  }
}
