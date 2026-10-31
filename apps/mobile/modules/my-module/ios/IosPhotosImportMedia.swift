import Foundation
import Photos
import UniformTypeIdentifiers
import Darwin

// Shared SDK metadata/byte checks only. PC operation IDs and DAV receipt paths stay outside this helper.
enum IosPhotosImportMedia {
  static func resourceType(_ resource: IosPhotoMediaResource, single: Bool) throws -> PHAssetResourceType {
    let raw: Int
    if single && resource.role == "original" {
      if resource.mimeType.hasPrefix("image/") { raw = 1 }
      else if resource.mimeType.hasPrefix("video/") { raw = 2 }
      else { throw fail("review_required") }
    } else {
      guard resource.role.hasPrefix("resource-"), let value = Int(resource.role.dropFirst(9)),
        String(value) == resource.role.dropFirst(9), (1...12).contains(value) else { throw fail("review_required") }
      raw = value
    }
    guard let type = PHAssetResourceType(rawValue: raw), UTType(mimeType: resource.mimeType) != nil else {
      throw fail("review_required")
    }
    return type
  }
  static func verifyStage(_ url: URL, resource: IosPhotoMediaResource,
    check: () throws -> Void) throws {
    let fd = Darwin.open(url.path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK)
    guard fd >= 0 else { throw fail("review_required") }
    defer { Darwin.close(fd) }
    let before = try IosFilesSource.metadata(fd)
    guard before.st_uid == geteuid(), before.st_nlink == 1, before.st_mode & 0o077 == 0 else {
      throw fail("review_required")
    }
    var interruption: Error?
    let result: (String, Int64)
    do {
      result = try IosFilesSource.hash(fd, maxBytes: resource.size, cancelled: {
        do { try check(); return false } catch { interruption = error; return true }
      })
    } catch { throw interruption ?? error }
    guard result.0 == resource.sha256, result.1 == resource.size,
      IosFilesSource.unchanged(before, try IosFilesSource.metadata(fd)) else { throw fail("review_required") }
  }
  private static func fail(_ code: String) -> IosPairingFailure { .native(code) }
}
