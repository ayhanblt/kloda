package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import java.io.File
import java.util.UUID

internal object AndroidS3CopyChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val base = instrumentation.targetContext; val namespace = UUID.randomUUID().toString()
    val app = object : ContextWrapper(base) {
      override fun getPackageName() = base.packageName + ".owned.s3.copy." + namespace
      override fun getNoBackupFilesDir() = File(root, "copy").apply { mkdirs() }
    }
    val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = app.packageName + ".s3.s3-compatible.profile.v1"; check(!store.containsAlias(alias))
    val journal = AndroidS3Journal(app, "s3-compatible")
    fun reject(action: () -> Unit) { check(runCatching(action).isFailure) }
    try {
      val profiles = AndroidS3Profiles(app, journal)
      profiles.save(S3Target("s3-compatible", "https://owned.example.test", "us-east-1", "owned-bucket", "owned", true, S3Target.hash("synthetic"), namespace, namespace), "synthetic", "synthetic-only", null) {}
      journal.setEnabled(true); val target = profiles.capture()!!.profile.target
      val id = UUID.randomUUID().toString(); val device = journal.installation()
      val old = AndroidS3Job(id, device, journal.context(), target, UUID.randomUUID().toString(), "owned", "revision", "generation", "$id.snapshot", "objects/$device/$id", S3Target.hash("owned"), 5, "owned.bin", "owned.bin")
      journal.insert(old); journal.record(old, "prepared", "creating") { true }; journal.record(old, "creating", "review") { true }
      val original = old.payload(); val request = UUID.randomUUID().toString()
      reject { AndroidS3Copy(profiles, old.id, request) { false } }
      val copy = AndroidS3Copy(profiles, old.id, request) { true }
      val next = UUID.randomUUID().toString(); val replacement = old.copy(id = next, snapshot = "$next.snapshot", key = "objects/$device/$next")
      reject { copy.record(replacement.copy(sha256 = S3Target.hash("different"))) }
      journal.insert(replacement); copy.record(replacement)
      reject { copy.record(replacement) }
      check(journal.state(old) == "review" && old.payload() == original && journal.state(replacement) == "prepared")
      check(journal.text("SELECT COUNT(*) FROM s3_copy_request WHERE request=? AND original=? AND replacement=?", arrayOf(request, id, next)) == "1")
      reject { journal.database.execSQL("UPDATE s3_copy_request SET context=? WHERE request=?", arrayOf(UUID.randomUUID().toString(), request)) }
      reject { journal.database.execSQL("DELETE FROM s3_copy_request WHERE request=?", arrayOf(request)) }
      var visible = true; val revoked = AndroidS3Copy(profiles, id, UUID.randomUUID().toString()) { visible }; visible = false
      reject { revoked.record(replacement) }
    } finally {
      journal.database.close(); if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias))
    }
  }
}
