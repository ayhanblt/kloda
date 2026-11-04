package com.kloda.sync

import android.app.KeyguardManager
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

// ADR0029 §1/§2 and user decisions 1–2: one 256-bit recovery secret per installation, shown as grouped Crockford
// Base32 with 4 check characters (tools/recovery-code-vectors.py is the reference). HKDF-SHA256 derives purpose keys.
internal object AndroidRecoveryCode {
  private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
  const val GROUPS = 14
  fun format(secret: ByteArray): String {
    require(secret.size == 32)
    val chars = StringBuilder()
    var buffer = 0; var bits = 0
    for (byte in secret) {
      buffer = (buffer shl 8) or (byte.toInt() and 0xff); bits += 8
      while (bits >= 5) { bits -= 5; chars.append(ALPHABET[(buffer shr bits) and 31]) }
      buffer = buffer and ((1 shl bits) - 1)
    }
    chars.append(ALPHABET[(buffer shl (5 - bits)) and 31])
    val check = MessageDigest.getInstance("SHA-256").digest("kloda-recovery-check-v1".toByteArray() + secret)
    val tail = ((check[0].toInt() and 0xff) shl 16) or ((check[1].toInt() and 0xff) shl 8) or (check[2].toInt() and 0xff)
    for (index in 0 until 4) chars.append(ALPHABET[(tail shr (19 - 5 * index)) and 31])
    return chars.chunked(4).joinToString("-")
  }
  // 29/3: a typed code back to its secret. Case, spaces and hyphens are free and Crockford's O/I/L aliases are
  // accepted; the 4 padding bits must be zero and the check characters must match, else `recovery_code_invalid`.
  fun parse(typed: String): ByteArray {
    val values = mutableListOf<Int>()
    for (char in typed.uppercase(java.util.Locale.ROOT)) {
      if (char == '-' || char.isWhitespace()) continue
      val normal = when (char) { 'O' -> '0'; 'I', 'L' -> '1'; else -> char }
      val index = ALPHABET.indexOf(normal)
      if (index < 0 || values.size >= 56) throw FilesFailure("recovery_code_invalid")
      values.add(index)
    }
    if (values.size != 56) throw FilesFailure("recovery_code_invalid")
    val secret = java.io.ByteArrayOutputStream()
    var buffer = 0; var bits = 0
    for (value in values.take(52)) {
      buffer = (buffer shl 5) or value; bits += 5
      if (bits >= 8) { bits -= 8; secret.write((buffer shr bits) and 0xff) }
      buffer = buffer and ((1 shl bits) - 1)
    }
    val bytes = secret.toByteArray()
    val normalized = values.map { ALPHABET[it] }.chunked(4).joinToString("-") { it.joinToString("") }
    if (buffer != 0 || bytes.size != 32 || format(bytes) != normalized) { bytes.fill(0); throw FilesFailure("recovery_code_invalid") }
    return bytes
  }
  fun hkdf(secret: ByteArray, label: String): ByteArray {
    val extract = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(ByteArray(32), "HmacSHA256")) }.doFinal(secret)
    try {
      return Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(extract, "HmacSHA256")) }
        .doFinal(label.toByteArray(Charsets.UTF_8) + byteArrayOf(1))
    } finally { extract.fill(0) }
  }
}

// Same Keystore AES-GCM file policy as AndroidOAuthVault. The secret is created once; only the confirmed flag changes, and
// regeneration (29/2, user decision 3) keeps the old secret until the new one is confirmed. Reading it never asks for
// the device lock: the reveal does.
internal class AndroidRecoveryVault(private val context: Context) {
  private val file = AtomicFile(File(context.noBackupFilesDir, "kloda-recovery.v1"))
  private val alias = context.packageName + ".recovery.v1"
  private val aad = alias.toByteArray(Charsets.UTF_8)
  private class Record(val secret: ByteArray, val confirmed: Boolean, val next: ByteArray? = null) {
    fun clear() { secret.fill(0); next?.fill(0) }
  }

  fun state(): String = synchronized(AndroidSyncJournal.sourceLock) {
    val record = read() ?: return@synchronized "none"
    try { if (record.confirmed) "confirmed" else "pending" } finally { record.clear() }
  }
  fun requireConfirmed() { if (state() != "confirmed") throw FilesFailure("recovery_required") }
  // Called only after a successful device-lock check (AndroidDeviceCheck).
  fun reveal(): String = synchronized(AndroidSyncJournal.sourceLock) {
    val record = read() ?: ByteArray(32).also { SecureRandom().nextBytes(it) }.let { secret ->
      try { write(Record(secret, false)) } finally { secret.fill(0) }
      read() ?: throw FilesFailure("webdav_storage")
    }
    try { AndroidRecoveryCode.format(record.secret) } finally { record.clear() }
  }
  // Called only after a successful device-lock check. A new secret waits beside the confirmed one and replaces it
  // only when confirmed; until then the old code and catalog chain stay in force. Asking again shows the same new code.
  fun renew(): String = synchronized(AndroidSyncJournal.sourceLock) {
    val record = read() ?: throw FilesFailure("recovery_required")
    try {
      if (!record.confirmed) throw FilesFailure("recovery_required")
      record.next?.let { return@synchronized AndroidRecoveryCode.format(it) }
      val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
      try {
        write(Record(record.secret, true, secret))
        val stored = read() ?: throw FilesFailure("webdav_storage")
        try { if (stored.next?.contentEquals(secret) != true) throw FilesFailure("webdav_storage") } finally { stored.clear() }
        AndroidRecoveryCode.format(secret)
      } finally { secret.fill(0) }
    } finally { record.clear() }
  }
  // A code `reveal`/`renew` can show after the lock check: the current one (still in force while a renewal is
  // pending, shown in Settings) or the pending new one. The caller must already hold the exact code.
  fun shown(code: String): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    val record = read() ?: return@synchronized false
    try { listOfNotNull(record.secret, record.next).any { AndroidRecoveryCode.format(it) == code } } finally { record.clear() }
  }
  // Background catalog writes (29/2): keys of the confirmed secret only; null before confirmation or while the
  // device is locked, so the run continues and the next run catches up.
  fun catalogKeys(): AndroidRecoveryCatalog.Keys? = synchronized(AndroidSyncJournal.sourceLock) {
    val record = try { read() } catch (error: FilesFailure) { if (error.code == "credential_locked") null else throw error }
      ?: return@synchronized null
    try { if (record.confirmed) AndroidRecoveryCatalog.keys(record.secret) else null } finally { record.clear() }
  }
  // Two distinct groups of the shown code, compared after upper-casing; a wrong answer changes nothing.
  fun confirm(answers: Map<Int, String>): String = synchronized(AndroidSyncJournal.sourceLock) {
    val record = read() ?: throw FilesFailure("recovery_required")
    try {
      if (answers.size < 2 || answers.keys.any { it !in 0 until AndroidRecoveryCode.GROUPS }) throw FilesFailure("invalid_request")
      val groups = AndroidRecoveryCode.format(record.next ?: record.secret).split('-')
      if (answers.any { (index, value) -> value.trim().uppercase() != groups[index] }) throw FilesFailure("recovery_mismatch")
      if (record.next != null) write(Record(record.next, true))
      else if (!record.confirmed) write(Record(record.secret, true))
      "confirmed"
    } finally { record.clear() }
  }

  private fun unlocked() {
    if (context.getSystemService(KeyguardManager::class.java).isDeviceLocked) throw FilesFailure("credential_locked")
  }
  private fun key(create: Boolean): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    if (store.containsAlias(alias)) return store.getKey(alias, null) as? SecretKey ?: throw FilesFailure("webdav_storage")
    if (!create) throw FilesFailure("webdav_storage")
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
      generateKey()
    }
  }
  private fun read(): Record? {
    unlocked()
    if (file.baseFile.length() > 4096) throw FilesFailure("webdav_storage")
    val bytes = try { file.openRead().use { it.readBytes() } } catch (_: FileNotFoundException) { return null }
    try {
      if (bytes.size !in 29..4096 || bytes[0] != 1.toByte()) throw FilesFailure("webdav_storage")
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
      cipher.updateAAD(aad)
      val plain = cipher.doFinal(bytes, 13, bytes.size - 13)
      try {
        val json = JSONObject(String(plain, Charsets.UTF_8))
        val keys = json.keys().asSequence().toSet()
        if (keys != setOf("secret", "confirmed") && keys != setOf("secret", "confirmed", "next")) throw FilesFailure("webdav_storage")
        val secret = Base64.decode(json.getString("secret"), Base64.NO_WRAP)
        val next = if (json.has("next")) Base64.decode(json.getString("next"), Base64.NO_WRAP) else null
        if (secret.size != 32 || (next != null && next.size != 32)) throw FilesFailure("webdav_storage")
        return Record(secret, json.getBoolean("confirmed"), next)
      } finally { plain.fill(0) }
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  private fun write(record: Record) {
    unlocked()
    try {
      val json = JSONObject().put("secret", Base64.encodeToString(record.secret, Base64.NO_WRAP)).put("confirmed", record.confirmed)
      record.next?.let { json.put("next", Base64.encodeToString(it, Base64.NO_WRAP)) }
      val plain = json.toString().toByteArray(Charsets.UTF_8)
      val bytes = try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(true)); cipher.updateAAD(aad)
        if (cipher.iv.size != 12) throw FilesFailure("webdav_storage")
        byteArrayOf(1) + cipher.iv + cipher.doFinal(plain)
      } finally { plain.fill(0) }
      val output = file.startWrite()
      try { output.write(bytes); output.fd.sync(); file.finishWrite(output) }
      catch (error: Exception) { file.failWrite(output); throw error }
      val directory = android.system.Os.open(context.noBackupFilesDir.path, android.system.OsConstants.O_RDONLY or android.system.OsConstants.O_NOFOLLOW, 0)
      try { android.system.Os.fsync(directory) } finally { android.system.Os.close(directory) }
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
}
