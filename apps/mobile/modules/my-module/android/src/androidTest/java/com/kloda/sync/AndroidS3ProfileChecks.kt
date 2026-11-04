package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.SecretKey

internal object AndroidS3ProfileChecks {
  private fun rejected(block: () -> Unit) { check(runCatching(block).isFailure) }
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext
    val custody = object : ContextWrapper(base) {
      private val name = base.packageName + ".owned.s3." + UUID.randomUUID().toString()
      override fun getPackageName() = name
      override fun getNoBackupFilesDir() = File(root, "s3-custody").apply { check(mkdirs() || isDirectory) }
    }
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val aliases = listOf("amazon-s3", "s3-compatible").map { custody.packageName + ".s3.$it.profile.v1" }
    check(aliases.none(store::containsAlias))
    var journal = AndroidS3Journal(custody, "amazon-s3")
    val p5 = AndroidS3Journal(custody, "s3-compatible")
    try {
      var owner = AndroidS3Profiles(custody, journal)
      check(owner.capture() == null)
      val generation = UUID.randomUUID().toString()
      val input = S3Target("amazon-s3", "https://s3.us-east-1.amazonaws.com", "us-east-1", "owned-bucket", "owned", false,
        S3Target.hash("fixture-key"), generation, generation)
      owner.save(input, "fixture-key", "fixture-secret-A", null) {}
      val first = owner.capture()!!
      check(owner.current(first) && first.profile.target.profileGeneration != generation)
      check(S3NativeEngine.prepare(first.profile, "validation", JSONObject().put("kind", "head")).getString("method") == "HEAD")
      check(S3NativeEngine.reply(2, 0, "", first.profile.target, "validation").getString("kind") == "review")
      val key = store.getKey(aliases[0], null) as SecretKey
      check(key.algorithm == "AES" && key.encoded == null)
      val cipher = File(custody.noBackupFilesDir, "kloda-amazon-s3-profile.v1")
      check(!String(cipher.readBytes(), Charsets.ISO_8859_1).contains("fixture-secret-A"))
      check(!first.profile.toString().contains("fixture-secret-A"))
      val other = AndroidS3Profiles(custody, p5)
      other.save(input.copy(provider = "s3-compatible", endpoint = "https://s3.example.test", pathStyle = true), "fixture-key", "fixture-p5", null) {}
      owner.save(input, "fixture-key", "fixture-secret-B", "fixture-session") {}
      check(!owner.current(first) && other.capture()!!.profile.secret == "fixture-p5")
      val expected = owner.capture()!!
      journal.database.close(); journal = AndroidS3Journal(custody, "amazon-s3"); owner = AndroidS3Profiles(custody, journal)
      check(owner.capture() == expected)
      val pending = expected.profile.copy(target = expected.profile.target.copy(profileGeneration = UUID.randomUUID().toString(), credentialGeneration = UUID.randomUUID().toString()))
      journal.prepareProfile(pending.target); AndroidS3Vault(custody, "amazon-s3").write(pending)
      rejected { owner.capture() }; rejected { journal.confirmProfile(first.profile.target) }
      journal.confirmProfile(pending.target); check(owner.capture()!!.profile == pending)
      val original = cipher.readBytes()
      val context = journal.context()
      val damaged = original.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }; cipher.writeBytes(damaged)
      rejected { owner.capture() }; rejected { owner.save(input, "fixture-key", "replacement", null) {} }
      check(journal.context() == context && cipher.readBytes().contentEquals(damaged))
      cipher.writeBytes(original); check(owner.capture()!!.profile == pending)
      store.deleteEntry(aliases[0]); rejected { owner.capture() }; rejected { owner.save(input, "fixture-key", "replacement", null) {} }
      check(!store.containsAlias(aliases[0]) && cipher.readBytes().contentEquals(original))
      check(other.capture()!!.profile.secret == "fixture-p5")
    } finally {
      journal.database.close(); p5.database.close()
      for (alias in aliases) { if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias)) }
    }
  }
}
