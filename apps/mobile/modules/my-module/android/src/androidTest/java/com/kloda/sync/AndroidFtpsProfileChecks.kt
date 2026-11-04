package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import android.database.sqlite.SQLiteDatabase
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.SecretKey

internal object AndroidFtpsProfileChecks {
  private fun rejects(work: () -> Unit) { check(runCatching(work).isFailure) }
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext
    val custody = object : ContextWrapper(base) {
      private val name = base.packageName + ".owned.ftps." + UUID.randomUUID().toString()
      override fun getPackageName() = name
      override fun getNoBackupFilesDir() = File(root, "ftps-profile-vault").apply { check(mkdirs() || isDirectory) }
    }
    val alias = custody.packageName + ".ftps.profile.v1"
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    check(!store.containsAlias(alias))
    fun open() = SQLiteDatabase.openOrCreateDatabase(File(root, "ftps-profile.sqlite"), null).also {
      check(it.enableWriteAheadLogging()); it.execSQL("PRAGMA synchronous=FULL")
    }
    var database = open()
    try {
      var journal = AndroidFtpsJournal(database)
      var owner = AndroidFtpsProfiles(custody, journal)
      check(owner.capture() == null)
      val input = FtpsTarget("192.168.1.10", 22, "nas.example.test", "/backup", "fixture", "ignored", "ignored")
      val first = owner.save(input, "fictional-profile-A")
      val captured = owner.capture()!!
      check(owner.current(captured) && first.target.profileGeneration != input.profileGeneration)
      val key = store.getKey(alias, null) as SecretKey
      check(key.algorithm == "AES" && key.encoded == null)
      val cipherFile = File(custody.noBackupFilesDir, "kloda-ftps-profile.v1")
      check(!String(cipherFile.readBytes(), Charsets.ISO_8859_1).contains(first.password))
      journal.invalidate()
      check(!owner.current(captured) && owner.capture()!!.profile == first)
      val beforeChange = owner.capture()!!
      val id = UUID.randomUUID().toString()
      val stale = FtpsUpload(id, "owned-installation", first.target, beforeChange.context, UUID.randomUUID().toString(),
        "owned.bin", "1", "owned.bin", "$id.snapshot", "A".repeat(43), 0, "file")
      journal.insert(stale)
      for (event in 1..3) journal.record(stale, event, 0)
      val changed = owner.save(input.copy(root = "/changed"), "fictional-profile-B")
      rejects { journal.complete(stale) { true } }
      check(journal.state(stale).step == 3 && !journal.state(stale).completed)
      val again = owner.save(input, "fictional-profile-A")
      check(again.target.profileGeneration != first.target.profileGeneration && again.target.credentialGeneration != first.target.credentialGeneration)
      check(again.target.profileGeneration != changed.target.profileGeneration && !owner.current(captured))
      val pending = AndroidFtpsProfile(input.copy(profileGeneration = UUID.randomUUID().toString(),
        credentialGeneration = UUID.randomUUID().toString()), "fictional-pending")
      journal.prepareProfile(pending.target)
      AndroidFtpsVault(custody).write(pending)
      rejects { owner.capture() } // Matching ciphertext is not a confirmed native profile save.
      database.close(); database = open(); journal = AndroidFtpsJournal(database); owner = AndroidFtpsProfiles(custody, journal)
      rejects { owner.capture() }
      rejects { journal.confirmProfile(first.target) }
      journal.confirmProfile(pending.target)
      check(owner.current(owner.capture()!!))
      val damaged = cipherFile.readBytes().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
      cipherFile.writeBytes(damaged)
      val before = journal.context()
      rejects { owner.capture() }
      rejects { owner.save(input, "fictional-replacement") }
      check(journal.context() == before && cipherFile.readBytes().contentEquals(damaged))
    } finally {
      database.close()
      if (store.containsAlias(alias)) store.deleteEntry(alias) // Only this test's newly allocated alias.
    }
  }
}
