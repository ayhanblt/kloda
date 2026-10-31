package com.kloda.sync

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal data class WebDavPhotoResource(val relativePath: String, override val role: String, override val name: String,
  override val mimeType: String, override val sha256: String, override val size: Long) : PhotoMediaResource
internal data class WebDavPhotoManifest(override val sourceDeviceId: String, val assetId: String, val revision: Long,
  val resources: List<WebDavPhotoResource>, override val albums: List<PhotoAlbum>, override val favorite: Boolean?) : PhotoMediaManifest {
  val filename get() = "kloda-webdav-photo-v1-$sourceDeviceId-$assetId-$revision.json"
}

// ADR0024: no PC-issued operation ID or cross-device adoption inferred from content equality.
internal object WebDavPhotoManifestCodec {
  private fun requireValue(valid: Boolean) { if (!valid) throw FilesFailure("manifest_invalid") }
  fun encode(value: WebDavPhotoManifest): ByteArray {
    validate(value)
    val resources = JSONArray().apply { value.resources.forEach { resource -> put(JSONObject()
      .put("relativePath", resource.relativePath).put("role", resource.role).put("name", resource.name)
      .put("mimeType", resource.mimeType).put("sha256", resource.sha256).put("size", resource.size.toString())) } }
    val albums = JSONArray().apply { value.albums.forEach { put(JSONObject().put("id", it.id).put("name", it.name)) } }
    return JSONObject().put("format", "kloda-webdav-photo").put("version", 1).put("sourceDeviceId", value.sourceDeviceId)
      .put("assetId", value.assetId).put("revision", value.revision.toString()).put("resources", resources).put("albums", albums)
      .put("favorite", value.favorite ?: JSONObject.NULL).toString().toByteArray(Charsets.UTF_8).also { requireValue(it.size <= 65536) }
  }
  fun decode(bytes: ByteArray): WebDavPhotoManifest {
    try {
      val root = PhotoManifestCodec.parseObject(bytes)
      PhotoManifestCodec.keys(root, setOf("format", "version", "sourceDeviceId", "assetId", "revision", "resources", "albums", "favorite"))
      requireValue(root["format"] == "kloda-webdav-photo" && root["version"] == 1L)
      val resources = PhotoManifestCodec.list(root, "resources", 8).map { raw ->
        val row = raw as? Map<*, *> ?: throw FilesFailure("manifest_invalid")
        PhotoManifestCodec.keys(row, setOf("relativePath", "role", "name", "mimeType", "sha256", "size"))
        WebDavPhotoResource(PhotoManifestCodec.string(row, "relativePath"), PhotoManifestCodec.string(row, "role"),
          PhotoManifestCodec.string(row, "name"), PhotoManifestCodec.string(row, "mimeType"), PhotoManifestCodec.string(row, "sha256"), PhotoManifestCodec.number(row, "size"))
      }
      val albums = PhotoManifestCodec.list(root, "albums", 32).map { raw ->
        val row = raw as? Map<*, *> ?: throw FilesFailure("manifest_invalid")
        PhotoManifestCodec.keys(row, setOf("id", "name")); PhotoAlbum(PhotoManifestCodec.string(row, "id"), PhotoManifestCodec.string(row, "name"))
      }
      val favorite = root["favorite"]
      requireValue(favorite == null || favorite is Boolean)
      return WebDavPhotoManifest(PhotoManifestCodec.string(root, "sourceDeviceId"), PhotoManifestCodec.string(root, "assetId"),
        PhotoManifestCodec.number(root, "revision"), resources.toList(), albums.toList(), favorite as Boolean?).also { validate(it) }
    } catch (_: Exception) { throw FilesFailure("manifest_invalid") }
  }
  fun validate(value: WebDavPhotoManifest) {
    val opaque = Regex("[A-Za-z0-9_-]{1,128}")
    requireValue(opaque.matches(value.sourceDeviceId) && opaque.matches(value.assetId) && value.revision > 0)
    requireValue(value.resources.size in 1..8 && value.albums.size <= 32 &&
      value.resources.map { it.relativePath }.toSet().size == value.resources.size &&
      value.resources.map { it.role }.toSet().size == value.resources.size && value.albums.map { it.id }.toSet().size == value.albums.size)
    value.resources.forEach { row ->
      val parts = row.relativePath.split('/')
      requireValue(row.relativePath.length <= 1024 && parts.size >= 2 &&
        runCatching { UUID.fromString(parts[0]).toString().equals(parts[0], ignoreCase = true) }.getOrDefault(false) &&
        row.relativePath.none { it == '\\' || it.isISOControl() } &&
        parts.all { it.isNotEmpty() && it != "." && it != ".." && it.toByteArray().size <= 255 } &&
        Regex("[a-z][a-z0-9_-]{0,31}").matches(row.role) && PhotoManifestCodec.validName(row.name) &&
        Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(row.sha256) && row.size >= 0 && row.mimeType.length <= 127 &&
        Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+").matches(row.mimeType))
    }
    value.albums.forEach { requireValue(opaque.matches(it.id) && PhotoManifestCodec.validName(it.name)) }
  }
  fun requireReceipts(value: WebDavPhotoManifest, target: String, journal: AndroidWebDavJournal) {
    validate(value)
    value.resources.forEach { resource ->
      val source = resource.relativePath.substringBefore('/')
      requireValue(journal.photoReceipt(target, source, resource.relativePath,
        "photos:${value.sourceDeviceId}:${value.assetId}:${resource.role}", resource.sha256, resource.size) != null)
    }
  }
}
