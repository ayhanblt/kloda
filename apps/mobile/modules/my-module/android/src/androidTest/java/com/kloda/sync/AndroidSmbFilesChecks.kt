package com.kloda.sync

import android.app.Instrumentation
import android.database.sqlite.SQLiteDatabase
import android.os.ParcelFileDescriptor
import android.util.Base64
import java.io.File
import java.security.MessageDigest
import java.util.UUID

internal object AndroidSmbFilesChecks {
  private fun refuses(work: () -> Unit) { check(runCatching(work).isFailure) }
  fun run(instrumentation: Instrumentation, root: File) {
    val library = File(root, "libkloda_storage_native.so")
    check(library.createNewFile())
    instrumentation.context.assets.open("kloda-smb16/libkloda_storage_native.so").use { input -> library.outputStream().use { input.copyTo(it) } }
    val expected = instrumentation.context.assets.open("kloda-smb16/sha256.txt").bufferedReader().use { it.readText().trim() }
    check(MessageDigest.getInstance("SHA-256").digest(library.readBytes()).joinToString("") { "%02x".format(it) } == expected)
    System.load(library.absolutePath)
    val file = File(root, "snapshot"); check(file.createNewFile())
    val bytes = ByteArray(1048576) { (it % 251).toByte() }; file.writeBytes(bytes)
    val hash = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(bytes), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    val databaseFile = File(root, "smb.sqlite")
    fun open(): SQLiteDatabase = SQLiteDatabase.openOrCreateDatabase(databaseFile, null).also {
      check(it.enableWriteAheadLogging()); it.execSQL("PRAGMA synchronous=FULL")
    }
    var db = open()
    try {
      var journal = AndroidSmbJournal(db)
      val target = SmbTarget("127.0.0.1", 27445, "owned", "", "owned", "", "owned-profile", "owned-credential")
      val unique = UUID.randomUUID().toString(); val source = UUID.randomUUID().toString()
      fun job(name: String, path: String? = null): SmbUpload {
        val id = UUID.randomUUID().toString()
        return SmbUpload(id, "owned-installation", target, journal.context(), source, "$name.bin", "1",
          path ?: "android-owned-$unique-$name.bin", "$id.snapshot", hash, bytes.size.toLong(), "file")
      }
      ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { snapshot ->
        // Raw owned loopback FD proves JNI handoff only, not production LAN admission.
        fun publish(value: SmbUpload, current: () -> Boolean) {
          val raw = android.system.Os.socket(android.system.OsConstants.AF_INET, android.system.OsConstants.SOCK_STREAM, 0)
          val socket = try {
            android.system.Os.connect(raw, java.net.InetAddress.getByAddress(byteArrayOf(127, 0, 0, 1)), 27445)
            ParcelFileDescriptor.dup(raw)
          } finally { android.system.Os.close(raw) }
          AndroidSmbPublication.runBound(journal, value, snapshot, "owned-disposable-fixture", socket, current)
        }
        val complete = job("complete")
        publish(complete) { true }
        check(journal.state(complete).completed)
        db.close(); db = open(); journal = AndroidSmbJournal(db)
        check(journal.state(complete).completed && journal.state(complete).step == 5)
        refuses { db.execSQL("UPDATE smb_upload SET header='forged' WHERE id=?", arrayOf(complete.id)) }
        refuses { db.execSQL("DELETE FROM smb_upload WHERE id=?", arrayOf(complete.id)) }
        refuses { publish(complete) { true } }
        val fenced = job("fenced")
        refuses { publish(fenced) {
          if (journal.state(fenced).step == 4) { journal.invalidate(); false } else true
        } }
        check(journal.state(fenced).step == 4 && !journal.state(fenced).completed)
        val unknown = job("unknown")
        db.execSQL("CREATE TRIGGER owned_fail_rename_receipt BEFORE UPDATE ON smb_upload WHEN NEW.id='${unknown.id}' AND NEW.step=4 BEGIN SELECT RAISE(ABORT,'owned_receipt_failure'); END")
        refuses { publish(unknown) { true } }
        check(journal.state(unknown).step == 3 && !journal.state(unknown).completed)
        db.execSQL("DROP TRIGGER owned_fail_rename_receipt")
        val collision = job("collision", unknown.relativePath)
        refuses { publish(collision) { true } }
        check(journal.state(collision).step == 3 && !journal.state(collision).completed)
        val cancelled = job("cancelled")
        refuses { publish(cancelled) { false } }
        check(journal.state(cancelled).step == 0 && !journal.state(cancelled).completed)
        val changed = job("changed")
        journal.insert(changed); journal.record(changed, 1, 0); journal.invalidate()
        journal.record(changed, 2, changed.size)
        for (event in 3..5) journal.record(changed, event, 0)
        refuses { journal.complete(changed) { true } }
        check(journal.state(changed).step == 5 && !journal.state(changed).completed)
      }
    } finally { db.close() }
  }
}
