package com.kloda.sync

import android.app.KeyguardManager
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException
import java.security.KeyStore
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// One OAuth destination (ADR0028): the refresh token and the account it was issued for. Access tokens are never stored,
// except Yandex's long-lived one with its expiry (ADR0028 §2 exception). Google Drive keeps no token at all: Play services
// holds the grant, and `accountName` names the device account to ask it for (AndroidGoogleDrive).
internal data class AndroidOAuthProfile(val revision: String, val provider: String, val accountId: String,
  val targetPath: String, val refreshToken: String, val expiresAt: Long? = null, val accountName: String? = null,
  val accountLabel: String? = null) {
  // `accountLabel` is display-only (ADR0028 account display label): never identity, so equality and `targetId` ignore it.
  override fun equals(other: Any?) = other is AndroidOAuthProfile && revision == other.revision && provider == other.provider &&
    accountId == other.accountId && targetPath == other.targetPath && refreshToken == other.refreshToken &&
    expiresAt == other.expiresAt && accountName == other.accountName
  override fun hashCode() = listOf(revision, provider, accountId, targetPath, refreshToken, expiresAt, accountName).hashCode()
  fun validate() {
    val parts = targetPath.split('/').filter { it.isNotEmpty() }
    val drive = provider == "google-drive"
    if (provider !in PROVIDERS || (provider == "yandex") != ((expiresAt ?: 0) > 0) || drive != (accountName != null) ||
      drive != refreshToken.isEmpty() || runCatching { UUID.fromString(revision) }.isFailure || parts.isEmpty() || targetPath.contains('\\') ||
      parts.any { it == "." || it == ".." || it.toByteArray().size > 255 } ||
      listOfNotNull(accountId, targetPath, refreshToken.takeIf { !drive }, accountName)
        .any { it.isEmpty() || it.toByteArray().size > 8192 || it.any(Char::isISOControl) })
      throw FilesFailure("webdav_fields")
    if (accountLabel != null && !validLabel(accountLabel)) throw FilesFailure("webdav_fields")
  }
  // Provider, stable account ID and normalized root; another account or root is another destination.
  fun targetId(): String {
    validate()
    val root = targetPath.split('/').filter { it.isNotEmpty() }.joinToString("/")
    val identity = JSONArray().put(provider).put(accountId).put(root)
    return AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256").digest(identity.toString().toByteArray()))
  }
  companion object {
    val PROVIDERS = setOf("dropbox", "onedrive", "yandex", "google-drive")
    fun validLabel(value: String) = value.isNotEmpty() && value.toByteArray().size <= 512 && value.none(Char::isISOControl)
    // Email, else display name, from the provider's own account reply; anything unusable leaves the label empty.
    fun label(body: String?): String? {
      val json = body?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
      val value = json.optString("email").takeIf { it.contains('@') }
        ?: json.optJSONObject("name")?.optString("display_name")
      return value?.takeIf(::validLabel)
    }
  }
}

// Same Keystore AES-GCM file policy as AndroidWebDavVault, with its own file and key per destination.
internal class AndroidOAuthVault(private val context: Context, private val slot: String) {
  init { if (!SLOT.matches(slot)) throw FilesFailure("invalid_request") }
  private val file = AtomicFile(File(context.noBackupFilesDir, "kloda-oauth-$slot.v1"))
  private val alias = context.packageName + ".oauth.$slot.v1"
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
  fun read(): AndroidOAuthProfile? = synchronized(AndroidSyncJournal.sourceLock) {
    unlocked()
    if (file.baseFile.length() > 65536) throw FilesFailure("webdav_storage")
    val bytes = try { file.openRead().use { it.readBytes() } } catch (_: FileNotFoundException) { return@synchronized null }
    try {
      if (bytes.size !in 29..65536 || bytes[0] != 1.toByte()) throw FilesFailure("webdav_storage")
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
      cipher.updateAAD(aad)
      val plain = cipher.doFinal(bytes, 13, bytes.size - 13)
      try {
        val json = JSONObject(String(plain, Charsets.UTF_8))
        val keys = json.keys().asSequence().toSet()
        if (keys - setOf("expiresAt", "accountName", "accountLabel") != FIELDS || !keys.containsAll(FIELDS)) throw FilesFailure("webdav_storage")
        AndroidOAuthProfile(json.getString("revision"), json.getString("provider"), json.getString("accountId"),
          json.getString("targetPath"), json.getString("refreshToken"), if (json.has("expiresAt")) json.getLong("expiresAt") else null,
          if (json.has("accountName")) json.getString("accountName") else null,
          if (json.has("accountLabel")) json.getString("accountLabel") else null).also { if (it.targetId() != slot) throw FilesFailure("webdav_storage") }
      } finally { plain.fill(0) }
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  // Add only: an existing entry, readable or not, is never replaced.
  fun add(profile: AndroidOAuthProfile) = synchronized(AndroidSyncJournal.sourceLock) {
    unlocked()
    if (profile.targetId() != slot) throw FilesFailure("invalid_request")
    if (file.baseFile.exists()) throw FilesFailure("destination_exists")
    write(profile)
  }
  // Fills a missing display label once; the credential fields are rewritten unchanged under the same key.
  fun fill(label: String) = synchronized(AndroidSyncJournal.sourceLock) {
    if (!AndroidOAuthProfile.validLabel(label)) return@synchronized
    val profile = read() ?: return@synchronized
    if (profile.accountLabel != null) return@synchronized
    write(profile.copy(accountLabel = label))
    if (read()?.accountLabel != label) throw FilesFailure("webdav_storage")
  }
  private fun write(profile: AndroidOAuthProfile) {
    try {
      val plain = JSONObject().put("revision", profile.revision).put("provider", profile.provider).put("accountId", profile.accountId)
        .put("targetPath", profile.targetPath).put("refreshToken", profile.refreshToken)
        .apply { profile.expiresAt?.let { put("expiresAt", it) }; profile.accountName?.let { put("accountName", it) }
          profile.accountLabel?.let { put("accountLabel", it) } }.toString().toByteArray(Charsets.UTF_8)
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
      syncDirectory()
      if (read() != profile) throw FilesFailure("webdav_storage")
    } catch (error: FilesFailure) { throw error }
    catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  fun delete() = synchronized(AndroidSyncJournal.sourceLock) {
    try {
      file.delete(); syncDirectory()
      KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
    } catch (_: Exception) { throw FilesFailure("webdav_storage") }
  }
  private fun syncDirectory() {
    val directory = android.system.Os.open(context.noBackupFilesDir.path, android.system.OsConstants.O_RDONLY or android.system.OsConstants.O_NOFOLLOW, 0)
    try { android.system.Os.fsync(directory) } finally { android.system.Os.close(directory) }
  }
  companion object {
    private val FIELDS = setOf("revision", "provider", "accountId", "targetPath", "refreshToken")
    private val SLOT = Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]")
    private val ENTRY = Regex("kloda-oauth-([A-Za-z0-9_-]{42}[AEIMQUYcgkosw048])\\.v1")
    fun slots(context: Context): List<String> = context.noBackupFilesDir.list().orEmpty()
      .mapNotNull { ENTRY.matchEntire(it)?.groupValues?.get(1) }.sorted()
  }
}
