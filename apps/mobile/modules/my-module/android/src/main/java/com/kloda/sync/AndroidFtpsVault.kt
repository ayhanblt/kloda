package com.kloda.sync

import android.app.KeyguardManager
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.io.FileNotFoundException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Password encryption uses a separate device-native AES key, never the Kloda P-256 identity.
internal class AndroidFtpsVault(private val context: Context) {
  private val file = AtomicFile(File(context.noBackupFilesDir, "kloda-ftps-profile.v1"))
  private val alias = context.packageName + ".ftps.profile.v1"
  private val aad = alias.toByteArray(Charsets.UTF_8)
  private fun unlocked() {
    if (context.getSystemService(KeyguardManager::class.java).isDeviceLocked) throw FtpsFailure("credential_locked")
  }
  private fun key(create: Boolean): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    if (store.containsAlias(alias)) return store.getKey(alias, null) as? SecretKey ?: throw FtpsFailure("storage_failure")
    if (!create) throw FtpsFailure("storage_failure")
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
      generateKey()
    }
  }
  fun read(): AndroidFtpsProfile? = synchronized(AndroidSyncJournal.sourceLock) {
    unlocked()
    val bytes = try { file.openRead().use { it.readBytesBounded() } }
    catch (_: FileNotFoundException) { return@synchronized null }
    try {
      if (bytes.size !in 29..65536 || bytes[0] != 1.toByte()) throw FtpsFailure("storage_failure")
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
      cipher.updateAAD(aad)
      val plain = cipher.doFinal(bytes, 13, bytes.size - 13)
      try {
        AndroidFtpsProfile.decode(plain)
      } finally { plain.fill(0) }
    } catch (error: FtpsFailure) { throw error }
    catch (_: Exception) { throw FtpsFailure("storage_failure") }
  }
  fun write(profile: AndroidFtpsProfile) = synchronized(AndroidSyncJournal.sourceLock) {
    unlocked(); profile.validate()
    // Refuse to overwrite unreadable custody; no missing-key replacement or plaintext fallback.
    read()
    try {
      val plain = profile.encode()
      val bytes = try {
        if (plain.size > 65507) throw FtpsFailure("storage_failure")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(true)); cipher.updateAAD(aad)
        if (cipher.iv.size != 12) throw FtpsFailure("storage_failure")
        byteArrayOf(1) + cipher.iv + cipher.doFinal(plain)
      } finally { plain.fill(0) }
      val output = file.startWrite()
      try { output.write(bytes); output.fd.sync(); file.finishWrite(output) }
      catch (error: Exception) { file.failWrite(output); throw error }
      val directory = android.system.Os.open(context.noBackupFilesDir.path, android.system.OsConstants.O_RDONLY or android.system.OsConstants.O_NOFOLLOW, 0)
      try { android.system.Os.fsync(directory) } finally { android.system.Os.close(directory) }
      if (read() != profile) throw FtpsFailure("storage_failure")
    } catch (error: FtpsFailure) { throw error }
    catch (_: Exception) { throw FtpsFailure("storage_failure") }
  }
  private fun java.io.InputStream.readBytesBounded(): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    while (true) {
      val count = read(buffer)
      if (count < 0) return output.toByteArray()
      if (count > 65536 - output.size()) throw FtpsFailure("storage_failure")
      output.write(buffer, 0, count)
    }
  }
}
