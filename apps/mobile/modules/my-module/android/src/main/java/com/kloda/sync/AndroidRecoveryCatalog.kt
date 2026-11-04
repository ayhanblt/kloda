package com.kloda.sync

import android.util.Base64
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Locale
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

// ADR0029 §3 and user decision 3: canonical catalog delta bytes (tools/recovery-catalog-vectors.py is the reference).
// The chain folder is derived from the secret, so a regenerated secret starts a new chain and never meets the
// create-only paths of the old one. The destination's targetId is part of the folder: two destinations of this phone
// may share one remote folder (the original WebDAV entry and an added Nextcloud entry for the same account).
internal object AndroidRecoveryCatalog {
  const val LIMIT = 65536
  class Keys(val mac: ByteArray, val chain: String)
  data class Entry(val job: String, val path: String, val sha256: String, val size: Long, val kind: String,
    val identity: String?, val completed: Long?)

  fun keys(secret: ByteArray): Keys {
    val id = AndroidRecoveryCode.hkdf(secret, "kloda-catalog-id-v1")
    try { return Keys(AndroidRecoveryCode.hkdf(secret, "kloda-catalog-mac-v1"), id.copyOf(16).joinToString("") { String.format(Locale.ROOT, "%02x", it) }) }
    finally { id.fill(0) }
  }
  fun folder(installation: String, chain: String, target: String) = ".kloda/catalog/$installation/$chain/$target"
  fun path(installation: String, chain: String, target: String, sequence: Long) = "${folder(installation, chain, target)}/$sequence.json"
  fun base64url(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  fun digest(bytes: ByteArray): String = base64url(MessageDigest.getInstance("SHA-256").digest(bytes))

  fun text(value: String): String = buildString {
    append('"')
    var index = 0
    while (index < value.length) {
      val point = value.codePointAt(index)
      when {
        point == '"'.code || point == '\\'.code -> append('\\').append(point.toChar())
        point < 0x20 -> append(String.format(Locale.ROOT, "\\u%04x", point))
        else -> appendCodePoint(point)
      }
      index += Character.charCount(point)
    }
    append('"')
  }
  private fun optional(value: String?) = value?.let(::text) ?: "null"
  private fun optional(value: Long?) = value?.toString() ?: "null"
  fun entry(value: Entry): String = "{\"path\":${text(value.path)},\"sha256\":${text(value.sha256)},\"size\":${value.size}" +
    ",\"kind\":${text(value.kind)},\"identity\":${optional(value.identity)},\"completed\":${optional(value.completed)}}"
  private fun body(installation: String, target: String, chain: String, sequence: Long, previous: String?, entries: List<String>) =
    "{\"format\":1,\"installation\":${text(installation)},\"target\":${text(target)},\"chain\":${text(chain)}" +
      ",\"sequence\":$sequence,\"previous\":${optional(previous)},\"entries\":[${entries.joinToString(",")}]}"
  // `,"mac":"` + 43 base64url characters + `"`.
  private const val MAC_BYTES = 52

  // How many of `entries` (in order) fit one delta; at least one, or a single oversized entry is refused.
  fun fitting(installation: String, target: String, chain: String, sequence: Long, previous: String?, entries: List<Entry>): Int {
    var total = body(installation, target, chain, sequence, previous, emptyList()).toByteArray().size + MAC_BYTES
    var count = 0
    for (value in entries) {
      val next = total + entry(value).toByteArray().size + if (count == 0) 0 else 1
      if (next > LIMIT) break
      total = next; count++
    }
    if (count == 0 && entries.isNotEmpty()) throw FilesFailure("invalid_request")
    return count
  }
  fun encode(keys: Keys, installation: String, target: String, sequence: Long, previous: String?, entries: List<Entry>): ByteArray {
    val unsigned = body(installation, target, keys.chain, sequence, previous, entries.map(::entry)).toByteArray(Charsets.UTF_8)
    val mac = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(keys.mac, "HmacSHA256")) }.doFinal(unsigned)
    val bytes = unsigned.copyOf(unsigned.size - 1) + ",\"mac\":${text(base64url(mac))}}".toByteArray(Charsets.UTF_8)
    if (bytes.size > LIMIT) throw FilesFailure("invalid_request")
    return bytes
  }

  class Delta(val installation: String, val target: String, val sequence: Long, val previous: String?, val entries: List<Entry>)
  // 29/3: a downloaded delta stands only if re-encoding its fields under these keys gives back exactly its bytes, which
  // checks canonical form, chain and MAC at once. A wrong type decodes as null/absent and therefore fails the comparison.
  fun decode(bytes: ByteArray, keys: Keys): Delta {
    val unverified = FilesFailure("catalog_unverified")
    if (bytes.size > LIMIT) throw unverified
    val delta = runCatching {
      val json = JSONObject(String(bytes, Charsets.UTF_8))
      val rows = json.getJSONArray("entries")
      val entries = (0 until rows.length()).map { index ->
        val row = rows.getJSONObject(index)
        Entry("", row.get("path") as String, row.get("sha256") as String, (row.get("size") as Number).toLong(), row.get("kind") as String,
          row.opt("identity") as? String, (row.opt("completed") as? Number)?.toLong())
      }
      Delta(json.get("installation") as String, json.get("target") as String, (json.get("sequence") as Number).toLong(),
        json.opt("previous") as? String, entries)
    }.getOrNull() ?: throw unverified
    if (delta.sequence <= 0) throw unverified
    val expected = runCatching { encode(keys, delta.installation, delta.target, delta.sequence, delta.previous, delta.entries) }.getOrNull()
    if (expected == null || !MessageDigest.isEqual(expected, bytes)) throw unverified
    return delta
  }
}
