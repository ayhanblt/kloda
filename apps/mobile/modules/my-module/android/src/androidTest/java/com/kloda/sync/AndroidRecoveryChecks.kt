package com.kloda.sync

import android.content.Context
import java.io.File
import java.security.KeyStore

// ADR0029 29/1 without UI: the shared vectors from tools/recovery-code-vectors.py, and the vault life cycle
// (create once on reveal, same code after reopen, wrong groups refused, confirm). The device-lock prompt is a runtime check.
internal object AndroidRecoveryChecks {
  private fun rejects(code: String, action: () -> Unit) {
    var observed: String? = null
    try { action() } catch (error: FilesFailure) { observed = error.code }
    check(observed == code) { "Expected $code; observed $observed" }
  }
  private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }

  fun run(context: Context) {
    val sequence = ByteArray(32) { it.toByte() }
    check(AndroidRecoveryCode.format(sequence) == "000G-40R4-0M30-E209-185G-R38E-1W81-24GK-2GAH-C5RR-34D1-P70X-3RFG-F3V8") { "sequence code" }
    check(hex(AndroidRecoveryCode.hkdf(sequence, "kloda-catalog-mac-v1")) == "0e9740aa9b8e0ac30b45a75a892ea24174a29d41bd545a2441dda63de62e306a") { "sequence hkdf" }
    val ones = ByteArray(32) { 0xff.toByte() }
    check(AndroidRecoveryCode.format(ones) == "ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZG-SCBA") { "ones code" }
    check(hex(AndroidRecoveryCode.hkdf(ones, "kloda-catalog-mac-v1")) == "c76950639e311eb81b58b56055515881476713b6f7310f5f1e3d395b18a6b12b") { "ones hkdf" }

    val vault = AndroidRecoveryVault(context)
    try {
      check(vault.state() == "none")
      rejects("recovery_required") { vault.requireConfirmed() }
      rejects("recovery_required") { vault.confirm(mapOf(0 to "0000", 1 to "0000")) }
      val code = vault.reveal()
      check(Regex("^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){13}$").matches(code)) { "code shape" }
      check(vault.state() == "pending" && AndroidRecoveryVault(context).reveal() == code) { "created once" }
      rejects("recovery_required") { vault.renew() }
      check(vault.catalogKeys() == null) { "no catalog before confirmation" }
      val groups = code.split('-')
      rejects("invalid_request") { vault.confirm(mapOf(3 to groups[3])) }
      rejects("invalid_request") { vault.confirm(mapOf(3 to groups[3], 14 to "0000")) }
      rejects("recovery_mismatch") { vault.confirm(mapOf(3 to groups[3], 9 to (if (groups[9] == "0000") "1111" else "0000"))) }
      check(vault.state() == "pending") { "mismatch keeps pending" }
      check(vault.confirm(mapOf(3 to " " + groups[3].lowercase(), 9 to groups[9])) == "confirmed")
      vault.requireConfirmed()
      check(AndroidRecoveryVault(context).state() == "confirmed" && vault.reveal() == code) { "confirmed persists, secret unchanged" }
      // 29/2 regeneration: the new secret waits beside the old one and replaces it only when confirmed.
      val oldChain = vault.catalogKeys()!!.chain
      val renewed = vault.renew()
      check(renewed != code && AndroidRecoveryVault(context).renew() == renewed && vault.reveal() == code && vault.state() == "confirmed") { "renewal pending" }
      check(vault.catalogKeys()!!.chain == oldChain && vault.shown(renewed) && vault.shown(code)) { "old chain in force until confirmed" }
      val next = renewed.split('-')
      val stale = (0 until AndroidRecoveryCode.GROUPS).filter { groups[it] != next[it] }.take(2)
      rejects("recovery_mismatch") { vault.confirm(mapOf(stale[0] to groups[stale[0]], stale[1] to groups[stale[1]])) }
      check(vault.confirm(mapOf(1 to next[1], 12 to next[12])) == "confirmed")
      check(vault.reveal() == renewed && vault.catalogKeys()!!.chain != oldChain && vault.shown(renewed) && !vault.shown(code)) { "new secret replaces the old one" }
      val file = File(context.noBackupFilesDir, "kloda-recovery.v1")
      file.writeBytes(file.readBytes().also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() })
      rejects("webdav_storage") { vault.state() }
    } finally {
      File(context.noBackupFilesDir, "kloda-recovery.v1").delete()
      KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(context.packageName + ".recovery.v1")
    }
  }
}
