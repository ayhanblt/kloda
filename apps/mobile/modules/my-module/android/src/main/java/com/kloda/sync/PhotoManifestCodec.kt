package com.kloda.sync

import android.util.Base64
import android.util.JsonReader
import android.util.JsonToken
import org.json.JSONArray
import org.json.JSONObject
import java.io.StringReader
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.Collections

internal data class PhotoResource(val operationId: String, val role: String, val name: String, val mimeType: String, val sha256: String, val size: Long)
internal data class PhotoAlbum(val id: String, val name: String)
internal data class PhotoManifest(val sourceDeviceId: String, val assetId: String, val revision: Long,
  val resources: List<PhotoResource>, val albums: List<PhotoAlbum>, val favorite: Boolean?)

internal object PhotoManifestCodec {
  const val prefix = "kloda-photo-v1-"
  const val maxBytes = 65536
  private val flags = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
  private val opaque = Regex("[A-Za-z0-9_-]{1,128}")
  private val role = Regex("[a-z][a-z0-9_-]{0,31}")
  private val mime = Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+")
  private val decimal = Regex("0|[1-9][0-9]{0,18}")

  private fun requireValue(valid: Boolean) { if (!valid) throw FilesFailure("invalid_request") }
  private fun fixed(value: String, size: Int) {
    requireValue(value.length == (size * 8 + 5) / 6 && opaque.matches(value))
    val decoded = Base64.decode(value, flags)
    requireValue(decoded.size == size && Base64.encodeToString(decoded, flags) == value)
  }
  fun validName(name: String): Boolean = name.isNotBlank() && name.length <= 255 && name != "." && name != ".." &&
    name.none { it == '/' || it == '\\' || it.isISOControl() } && validUnicode(name)
  private fun validUnicode(value: String): Boolean {
    var index = 0
    while (index < value.length) {
      val char = value[index++]
      if (char.isHighSurrogate()) {
        if (index == value.length || !value[index++].isLowSurrogate()) return false
      } else if (char.isLowSurrogate()) return false
    }
    return true
  }
  private fun validate(value: PhotoManifest) {
    requireValue(opaque.matches(value.sourceDeviceId) && opaque.matches(value.assetId) && value.revision > 0)
    requireValue(value.resources.size in 1..8 && value.albums.size <= 32)
    requireValue(value.resources.map { it.operationId }.toSet().size == value.resources.size &&
      value.resources.map { it.role }.toSet().size == value.resources.size && value.albums.map { it.id }.toSet().size == value.albums.size)
    value.resources.forEach {
      fixed(it.operationId, 16); fixed(it.sha256, 32)
      requireValue(role.matches(it.role) && validName(it.name) && it.mimeType.length <= 127 && mime.matches(it.mimeType) && it.size >= 0)
    }
    value.albums.forEach { requireValue(opaque.matches(it.id) && validName(it.name)) }
  }

  fun encode(value: PhotoManifest): ByteArray {
    validate(value)
    val resources = JSONArray().apply { value.resources.forEach { resource -> put(JSONObject()
      .put("operationId", resource.operationId).put("role", resource.role).put("name", resource.name)
      .put("mimeType", resource.mimeType).put("sha256", resource.sha256).put("size", resource.size.toString())) } }
    val albums = JSONArray().apply { value.albums.forEach { put(JSONObject().put("id", it.id).put("name", it.name)) } }
    return JSONObject().put("version", 1).put("sourceDeviceId", value.sourceDeviceId).put("assetId", value.assetId)
      .put("revision", value.revision.toString()).put("resources", resources).put("albums", albums)
      .put("favorite", value.favorite ?: JSONObject.NULL).toString().toByteArray(Charsets.UTF_8)
      .also { requireValue(it.size <= maxBytes) }
  }

  fun decode(bytes: ByteArray): PhotoManifest {
    try {
      requireValue(bytes.isNotEmpty() && bytes.size <= maxBytes)
      val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
      strictStrings(text)
      return JsonReader(StringReader(text)).use { reader ->
        reader.isLenient = false
        val root = objectValue(reader, 0)
        requireValue(reader.peek() == JsonToken.END_DOCUMENT)
        keys(root, setOf("version", "sourceDeviceId", "assetId", "revision", "resources", "albums", "favorite"))
        requireValue(root["version"] == 1L)
        val resources = list(root, "resources", 8).map { entry ->
          val resource = entry as? Map<*, *> ?: throw FilesFailure("invalid_request")
          keys(resource, setOf("operationId", "role", "name", "mimeType", "sha256", "size"))
          PhotoResource(string(resource, "operationId"), string(resource, "role"), string(resource, "name"),
            string(resource, "mimeType"), string(resource, "sha256"), number(resource, "size"))
        }
        val albums = list(root, "albums", 32).map { entry ->
          val album = entry as? Map<*, *> ?: throw FilesFailure("invalid_request")
          keys(album, setOf("id", "name")); PhotoAlbum(string(album, "id"), string(album, "name"))
        }
        val favorite = root["favorite"]
        requireValue(favorite == null || favorite is Boolean)
        PhotoManifest(string(root, "sourceDeviceId"), string(root, "assetId"), number(root, "revision"),
          Collections.unmodifiableList(resources), Collections.unmodifiableList(albums), favorite as Boolean?).also { validate(it) }
      }
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("invalid_request") }
  }

  private fun keys(value: Map<*, *>, expected: Set<String>) { requireValue(value.keys == expected) }
  private fun string(value: Map<*, *>, key: String): String = value[key] as? String ?: throw FilesFailure("invalid_request")
  private fun number(value: Map<*, *>, key: String): Long {
    val text = string(value, key)
    requireValue(decimal.matches(text))
    return text.toLongOrNull() ?: throw FilesFailure("invalid_request")
  }
  private fun list(value: Map<*, *>, key: String, limit: Int): List<*> =
    (value[key] as? List<*> ?: throw FilesFailure("invalid_request")).also { requireValue(it.size <= limit) }

  private fun strictStrings(text: String) {
    var quoted = false
    var index = 0
    while (index < text.length) {
      val char = text[index++]
      if (char == '"') quoted = !quoted
      else if (quoted) {
        requireValue(char.code >= 32)
        if (char == '\\') {
          requireValue(index < text.length)
          when (text[index++]) {
            '"', '\\', '/', 'b', 'f', 'n', 'r', 't' -> Unit
            'u' -> {
              requireValue(index + 4 <= text.length && text.substring(index, index + 4).all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' })
              index += 4
            }
            else -> throw FilesFailure("invalid_request")
          }
        }
      }
    }
    requireValue(!quoted)
  }

  // JSONObject silently replaces duplicate keys; token parsing retains that trust-boundary check.
  private fun objectValue(reader: JsonReader, depth: Int): Map<String, Any?> {
    requireValue(depth <= 2)
    val values = linkedMapOf<String, Any?>()
    reader.beginObject()
    while (reader.hasNext()) {
      requireValue(values.size < 8)
      val key = reader.nextName()
      requireValue(key.length <= 32 && !values.containsKey(key))
      values[key] = when (reader.peek()) {
        JsonToken.STRING -> reader.nextString().also { requireValue(it.length <= 1024 && validUnicode(it)) }
        JsonToken.NUMBER -> { requireValue(depth == 0 && key == "version"); requireValue(reader.nextString() == "1"); 1L }
        JsonToken.BOOLEAN -> reader.nextBoolean()
        JsonToken.NULL -> { reader.nextNull(); null }
        JsonToken.BEGIN_ARRAY -> {
          requireValue(depth == 0 && key in setOf("resources", "albums"))
          val array = arrayListOf<Map<String, Any?>>()
          val limit = if (key == "resources") 8 else 32
          reader.beginArray()
          while (reader.hasNext()) { requireValue(array.size < limit); array.add(objectValue(reader, depth + 1)) }
          reader.endArray(); array
        }
        else -> throw FilesFailure("invalid_request")
      }
    }
    reader.endObject()
    return values
  }
}
