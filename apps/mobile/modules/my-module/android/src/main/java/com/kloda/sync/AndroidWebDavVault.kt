package com.kloda.sync

import android.app.KeyguardManager
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Password encryption uses a separate device-native AES key, never the Kloda P-256 identity.
// slot == null is the original WebDAV entry, read in place; other DAV destinations use one entry and key per targetId (ADR0027).
internal class AndroidWebDavVault(private val context: Context, private val slot: String? = null) {
  init { if (slot != null && !SLOT.matches(slot)) throw FilesFailure("invalid_request") }
  private val file = AtomicFile(File(context.noBackupFilesDir, if (slot == null) LEGACY else "kloda-dav-$slot.v1"))
  private val alias = context.packageName + if (slot == null) ".webdav.profile.v1" else ".dav.$slot.v1"
  private val fields = if (slot == null) setOf("revision", "endpoint", "targetPath", "username", "password")
    else setOf("revision", "endpoint", "targetPath", "username", "password", "provider")
  private fun owned(profile: AndroidWebDavProfile) =
    if (slot == null) profile.provider == null else profile.provider != null && profile.targetId() == slot
  private val aad = alias.toByteArray(Charsets.UTF_8)
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
  fun read(): AndroidWebDavProfile? = synchronized(AndroidSyncJournal.sourceLock) {
    unlocked()
    val bytes = try { file.openRead().use { it.readBytesBounded() } }
    catch (_: FileNotFoundException) { return@synchronized null }
    try {
      if (bytes.size !in 29..65536 || bytes[0] != 1.toByte()) throw FilesFailure("webdav_storage")
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
      cipher.updateAAD(aad)
      val plain = cipher.doFinal(bytes, 13, bytes.size - 13)
      try {
        val json = JSONObject(String(plain, Charsets.UTF_8))
        if (json.keys().asSequence().toSet() != fields) throw FilesFailure("webdav_storage")
        AndroidWebDavProfile(json.getString("revision"), json.getString("endpoint"), json.getString("targetPath"),
          json.getString("username"), json.getString("password"), if (slot == null) null else json.getString("provider"))
          .also { it.validate(); if (!owned(it)) throw FilesFailure("webdav_storage") }
      } finally { plain.fill(0) }
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  fun write(profile: AndroidWebDavProfile) = synchronized(AndroidSyncJournal.sourceLock) {
    unlocked(); profile.validate()
    if (!owned(profile)) throw FilesFailure("invalid_request")
    // Refuse to overwrite unreadable custody; no missing-key replacement or plaintext fallback.
    if (read() == null && count(context) >= LIMIT) throw FilesFailure("destination_limit")
    try {
      val json = JSONObject().put("revision", profile.revision).put("endpoint", profile.endpoint).put("targetPath", profile.targetPath)
        .put("username", profile.username).put("password", profile.password)
      if (slot != null) json.put("provider", profile.provider)
      val plain = json.toString().toByteArray(Charsets.UTF_8)
      val bytes = try {
        if (plain.size > 65507) throw FilesFailure("webdav_storage")
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
      if (read() != profile) throw FilesFailure("webdav_storage")
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  // Removes one added DAV destination's custody; the original WebDAV entry is never deleted here.
  fun delete() = synchronized(AndroidSyncJournal.sourceLock) {
    if (slot == null) throw FilesFailure("invalid_request")
    try {
      file.delete()
      val directory = android.system.Os.open(context.noBackupFilesDir.path, android.system.OsConstants.O_RDONLY or android.system.OsConstants.O_NOFOLLOW, 0)
      try { android.system.Os.fsync(directory) } finally { android.system.Os.close(directory) }
      KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
    } catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  companion object {
    private const val LEGACY = "kloda-webdav-profile.v1"
    const val LIMIT = 8
    private val SLOT = Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]")
    private val ENTRY = Regex("kloda-dav-([A-Za-z0-9_-]{42}[AEIMQUYcgkosw048])\\.v1")
    fun slots(context: Context): List<String> = context.noBackupFilesDir.list().orEmpty()
      .mapNotNull { ENTRY.matchEntire(it)?.groupValues?.get(1) }.sorted()
    // Every configured DAV destination counts, including the original WebDAV entry.
    fun count(context: Context): Int = slots(context).size + if (File(context.noBackupFilesDir, LEGACY).exists()) 1 else 0
  }
  private fun java.io.InputStream.readBytesBounded(): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    while (true) {
      val count = read(buffer)
      if (count < 0) return output.toByteArray()
      if (count > 65536 - output.size()) throw FilesFailure("webdav_storage")
      output.write(buffer, 0, count)
    }
  }
}
