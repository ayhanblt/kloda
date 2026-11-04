package com.kloda.sync

import android.util.Xml
import okhttp3.HttpUrl
import org.xmlpull.v1.XmlPullParser

// ADR0029 29/3: the direct children named by a PROPFIND Depth 1 multistatus. Only `href` and the `collection` resource
// type are read; an href outside the listed folder or a name that is not one plain path segment is ignored.
internal object AndroidWebDavListing {
  const val REQUEST = "<?xml version=\"1.0\" encoding=\"utf-8\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:resourcetype/></d:prop></d:propfind>"

  fun children(body: ByteArray, folder: HttpUrl): List<RemoteChild> {
    val responses = mutableListOf<Pair<String, Boolean>>()
    try {
      val parser = Xml.newPullParser()
      parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
      parser.setInput(body.inputStream(), null)
      var inResponse = false; var href: String? = null; var collection = false
      while (true) {
        when (parser.next()) {
          XmlPullParser.END_DOCUMENT -> break
          XmlPullParser.START_TAG -> if (parser.namespace == "DAV:") when (parser.name) {
            "response" -> { inResponse = true; href = null; collection = false }
            "collection" -> if (inResponse) collection = true
            "href" -> if (inResponse && href == null) href = parser.nextText().trim()
          }
          XmlPullParser.END_TAG -> if (parser.namespace == "DAV:" && parser.name == "response" && inResponse) {
            href?.takeIf { it.isNotEmpty() }?.let { responses.add(it to collection) }
            inResponse = false
          }
        }
      }
    } catch (_: Exception) { throw FilesFailure("webdav_response") }
    val base = folder.pathSegments.filter { it.isNotEmpty() }
    val seen = mutableSetOf<String>()
    return responses.mapNotNull { (href, collection) ->
      val url = folder.resolve(href)?.takeIf { it.scheme == folder.scheme && it.host == folder.host && it.port == folder.port } ?: return@mapNotNull null
      val segments = url.pathSegments.filter { it.isNotEmpty() }
      if (segments.size != base.size + 1 || segments.subList(0, base.size) != base) return@mapNotNull null
      val name = segments.last()
      if (name == "." || name == ".." || name.contains('/') || !seen.add(name)) null else RemoteChild(name, collection)
    }
  }
}
