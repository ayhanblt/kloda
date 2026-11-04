package com.kloda.sync

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal data class S3PhotoResource(val relativePath: String, override val role: String, override val name: String,
  override val mimeType: String, override val sha256: String, override val size: Long) : PhotoMediaResource
internal data class S3PhotoManifest(override val sourceDeviceId: String, val assetId: String, val revision: Long,
  val resources: List<S3PhotoResource>, override val albums: List<PhotoAlbum>, override val favorite: Boolean?) : PhotoMediaManifest {
  val filename get() = "kloda-s3-photo-v1-$sourceDeviceId-$assetId-$revision.json"
}

// ADR0022/D2; separate S3 resource/manifest receipt contract: same-installation Completed S3 resources only.
internal object S3PhotoManifestCodec {
  private fun requireValue(valid: Boolean) { if (!valid) throw FilesFailure("manifest_invalid") }
  fun encode(value: S3PhotoManifest): ByteArray {
    validate(value)
    val resources = JSONArray().apply { value.resources.forEach { resource -> put(JSONObject()
      .put("relativePath", resource.relativePath).put("role", resource.role).put("name", resource.name)
      .put("mimeType", resource.mimeType).put("sha256", resource.sha256).put("size", resource.size.toString())) } }
    val albums = JSONArray().apply { value.albums.forEach { put(JSONObject().put("id", it.id).put("name", it.name)) } }
    return JSONObject().put("format", "kloda-s3-photo").put("version", 1).put("sourceDeviceId", value.sourceDeviceId)
      .put("assetId", value.assetId).put("revision", value.revision.toString()).put("resources", resources).put("albums", albums)
      .put("favorite", value.favorite ?: JSONObject.NULL).toString().toByteArray(Charsets.UTF_8).also { requireValue(it.size <= 65536) }
  }
  fun decode(bytes: ByteArray): S3PhotoManifest {
    try {
      val root = PhotoManifestCodec.parseObject(bytes)
      PhotoManifestCodec.keys(root, setOf("format", "version", "sourceDeviceId", "assetId", "revision", "resources", "albums", "favorite"))
      requireValue(root["format"] == "kloda-s3-photo" && root["version"] == 1L)
      val resources = PhotoManifestCodec.list(root, "resources", 8).map { raw ->
        val row = raw as? Map<*, *> ?: throw FilesFailure("manifest_invalid")
        PhotoManifestCodec.keys(row, setOf("relativePath", "role", "name", "mimeType", "sha256", "size"))
        S3PhotoResource(PhotoManifestCodec.string(row, "relativePath"), PhotoManifestCodec.string(row, "role"),
          PhotoManifestCodec.string(row, "name"), PhotoManifestCodec.string(row, "mimeType"), PhotoManifestCodec.string(row, "sha256"), PhotoManifestCodec.number(row, "size"))
      }
      val albums = PhotoManifestCodec.list(root, "albums", 32).map { raw ->
        val row = raw as? Map<*, *> ?: throw FilesFailure("manifest_invalid")
        PhotoManifestCodec.keys(row, setOf("id", "name")); PhotoAlbum(PhotoManifestCodec.string(row, "id"), PhotoManifestCodec.string(row, "name"))
      }
      val favorite = root["favorite"]
      requireValue(favorite == null || favorite is Boolean)
      return S3PhotoManifest(PhotoManifestCodec.string(root, "sourceDeviceId"), PhotoManifestCodec.string(root, "assetId"),
        PhotoManifestCodec.number(root, "revision"), resources.toList(), albums.toList(), favorite as Boolean?).also { validate(it) }
    } catch (_: Exception) { throw FilesFailure("manifest_invalid") }
  }
  fun validate(value: S3PhotoManifest) {
    val opaque = Regex("[A-Za-z0-9_-]{1,128}")
    requireValue(opaque.matches(value.sourceDeviceId) && opaque.matches(value.assetId) && value.revision > 0)
    requireValue(value.resources.size in 1..8 && value.albums.size <= 32 &&
      value.resources.map { it.relativePath.lowercase(java.util.Locale.ROOT) }.toSet().size == value.resources.size &&
      value.resources.map { it.role }.toSet().size == value.resources.size && value.albums.map { it.id }.toSet().size == value.albums.size)
    value.resources.forEach { row ->
      val parts = row.relativePath.split('/')
      requireValue(row.relativePath.all { it.code < 128 } && row.relativePath.length <= 1024 && parts.size == 3 && parts[0] == "objects" &&
        parts.drop(1).all { runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false) } &&
        row.relativePath.none { it == '\\' || it.isISOControl() } &&
        parts.all(::validPart) &&
        Regex("[a-z][a-z0-9_-]{0,31}").matches(row.role) && PhotoManifestCodec.validName(row.name) &&
        Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(row.sha256) && row.size >= 0 && row.mimeType.length <= 127 &&
        Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+").matches(row.mimeType))
    }
    value.albums.forEach { requireValue(opaque.matches(it.id) && PhotoManifestCodec.validName(it.name)) }
  }
  private fun validPart(part: String): Boolean {
    val reserved = setOf("CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$") +
      (1..9).flatMap { listOf("COM$it", "LPT$it") }
    val base = part.substringBefore('.').trimEnd(' ').uppercase(java.util.Locale.ROOT)
    return part.isNotEmpty() && part != "." && part != ".." && part.length <= 255 &&
      !part.endsWith('.') && !part.endsWith(' ') && base !in reserved && part.none { it in "<>:\"|?*" }
  }
  fun requireReceipts(value: S3PhotoManifest, target: S3Target, journal: AndroidS3Journal) {
    validate(value)
    requireValue(value.sourceDeviceId == journal.installation())
    value.resources.forEach { requireValue(resourceReceipt(it, value, target, journal) != null) }
  }
  fun resourceReceipt(resource: S3PhotoResource, manifest: S3PhotoManifest, target: S3Target, journal: AndroidS3Journal): AndroidS3Job? {
    validate(manifest)
    requireValue(manifest.sourceDeviceId == journal.installation() && resource in manifest.resources)
    val values = journal.database.rawQuery("SELECT j.header FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.archive=? AND l.installation=? AND l.reference=? AND l.sha256=? AND j.state='completed' ORDER BY l.rowid DESC LIMIT 100", arrayOf(target.archiveId(), manifest.sourceDeviceId, "${manifest.assetId}:${resource.role}", resource.sha256)).use { row ->
      buildList { while (row.moveToNext()) add(AndroidS3Job.decode(row.getString(0))) }
    }
    val job = values.firstOrNull { it.key == resource.relativePath && it.kind == "photo_resource" && it.asset == manifest.assetId && it.name == resource.name && it.mimeType == resource.mimeType && it.size == resource.size } ?: return null
    return journal.receipt(job.id, target)
  }
}
