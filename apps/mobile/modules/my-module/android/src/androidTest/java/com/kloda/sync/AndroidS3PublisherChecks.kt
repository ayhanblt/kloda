package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream
import java.security.KeyStore
import java.util.UUID

internal object AndroidS3PublisherChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext
    val custody = object : ContextWrapper(base) {
      private val name = base.packageName + ".owned.s3.publisher." + UUID.randomUUID().toString()
      override fun getPackageName() = name
      override fun getNoBackupFilesDir() = File(root, "s3-publisher").apply { check(mkdirs() || isDirectory) }
    }
    val alias = custody.packageName + ".s3.s3-compatible.profile.v1"
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(custody, "s3-compatible")
    try {
      val owner = AndroidS3Profiles(custody, journal)
      val generation = UUID.randomUUID().toString()
      val target = S3Target("s3-compatible", "https://localhost:52408", "us-east-1", "kloda17-native", "android-publisher-$generation", true,
        S3Target.hash("kloda17fixture"), generation, generation)
      owner.save(target, "kloda17fixture", "synthetic-only-kloda17-fixture", null) {}
      journal.setEnabled(true)
      val captured = owner.capture()!!
      val source = File(custody.noBackupFilesDir, "owned.snapshot")
      FileOutputStream(source).use { output ->
        val block = ByteArray(65536) { (it % 251).toByte() }
        repeat(80) { output.write(block) }; output.write(block, 0, 4097); output.fd.sync()
      }
      check(source.setReadOnly())
      val digest = source.inputStream().use { AndroidFilesSnapshots.digest(it) }
      check(digest.size == 5246977L)
      fun job(hash: String = digest.sha256): AndroidS3Job {
        val id = UUID.randomUUID().toString()
        return AndroidS3Job(id, journal.installation(), captured.context, captured.profile.target, UUID.randomUUID().toString(),
          "owned-synthetic", "revision", "generation", "$id.snapshot", "objects/${journal.installation()}/$id", hash, digest.size)
      }
      val publisher = AndroidS3Publisher(custody, owner) {}
      val good = job(); journal.insert(good)
      var finalChecks = 0
      ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { publisher.publish(good, it, { true }) { finalChecks++ } }
      check(journal.state(good) == "completed" && finalChecks == 1)
      check(journal.events(good, "part-ack").size == 2 && journal.events(good, "complete-ack").size == 1)
      val bad = job(S3Target.hash("wrong bytes")); journal.insert(bad)
      val mismatch = ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use {
        runCatching { publisher.publish(bad, it, { true }) { error("must not complete") } }.exceptionOrNull()
      }
      check(mismatch is S3Failure && mismatch.code == "source_changed" && journal.state(bad) == "review" && journal.events(bad, "creating").isEmpty())
      val stale = job(); journal.insert(stale)
      val revoked = ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use {
        runCatching { publisher.publish(stale, it, { false }) { error("must not complete") } }.exceptionOrNull()
      }
      check(revoked is S3Failure && journal.state(stale) == "review" && journal.events(stale, "creating").isEmpty())
      check(source.inputStream().use { AndroidFilesSnapshots.digest(it) } == digest)
      println("Owned S3 publisher job=${good.id}; 2 parts/5246977 bytes; rejected source jobs sent no create")
    } finally {
      journal.database.close()
      if (store.containsAlias(alias)) store.deleteEntry(alias)
      check(!store.containsAlias(alias))
    }
  }
}
