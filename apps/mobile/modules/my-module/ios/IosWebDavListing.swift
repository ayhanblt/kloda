import Foundation

// ADR0029 29/3: the direct children named by a PROPFIND Depth 1 multistatus. Only `href` and the `collection` resource
// type are read; an href outside the listed folder or a name that is not one plain path segment is ignored.
final class IosWebDavListing: NSObject, XMLParserDelegate {
  static let request = "<?xml version=\"1.0\" encoding=\"utf-8\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:resourcetype/></d:prop></d:propfind>"
  private var responses: [(href: String, folder: Bool)] = []
  private var href: String?
  private var folder = false
  private var text = ""
  private var inResponse = false

  static func children(_ body: Data, of folder: URL) throws -> [IosRemoteChild] {
    let listing = IosWebDavListing()
    let parser = XMLParser(data: body)
    parser.shouldProcessNamespaces = true
    parser.shouldResolveExternalEntities = false
    parser.delegate = listing
    guard parser.parse() else { throw IosWebDavFailure.code("webdav_response") }
    let base = folder.path.hasSuffix("/") ? folder.path : folder.path + "/"
    var seen = Set<String>()
    return listing.responses.compactMap { response in
      guard let url = URL(string: response.href, relativeTo: folder)?.absoluteURL, url.scheme == folder.scheme, url.host == folder.host, url.port == folder.port else { return nil }
      var path = url.path
      if path.hasSuffix("/") { path.removeLast() }
      guard path.hasPrefix(base) else { return nil }
      let name = String(path.dropFirst(base.count))
      guard !name.isEmpty, !name.contains("/"), name != ".", name != "..", seen.insert(name).inserted else { return nil }
      return IosRemoteChild(name: name, folder: response.folder)
    }
  }

  func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?,
    attributes: [String: String] = [:]) {
    guard namespaceURI == "DAV:" else { return }
    switch name {
    case "response": inResponse = true; href = nil; folder = false
    case "collection" where inResponse: folder = true
    default: break
    }
    text = ""
  }
  func parser(_ parser: XMLParser, foundCharacters string: String) { text += string }
  func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
    guard namespaceURI == "DAV:", inResponse else { return }
    if name == "href", href == nil { href = text.trimmingCharacters(in: .whitespacesAndNewlines) }
    if name == "response" {
      if let href, !href.isEmpty { responses.append((href, folder)) }
      inResponse = false
    }
  }
}
