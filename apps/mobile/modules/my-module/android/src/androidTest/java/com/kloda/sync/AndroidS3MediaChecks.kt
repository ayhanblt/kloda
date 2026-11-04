package com.kloda.sync

import android.content.ContextWrapper
import android.app.Instrumentation
import java.io.File
import java.util.UUID
import org.json.JSONObject

// Component receipts only; this fixture never opens Photos, vaults, sources or network.
internal object AndroidS3MediaChecks {
  fun run(instrumentation: Instrumentation, root: File) {
    val app = object : ContextWrapper(instrumentation.targetContext) { override fun getNoBackupFilesDir(): File = File(root, "s3-media").apply { mkdirs() } }
    val journal = AndroidS3Journal(app, "s3-compatible")
    fun reject(block: () -> Unit) { var denied = false; try { block() } catch (_: Exception) { denied = true }; check(denied) }
    try {
      val generation = UUID.randomUUID().toString()
      val target = S3Target("s3-compatible", "https://owned.example.test", "us-east-1", "owned-bucket", "owned", true, S3Target.hash("synthetic"), generation, generation)
      journal.prepareProfile(target); journal.confirmProfile(target); journal.setEnabled(true)
      val id = UUID.randomUUID().toString(); val install = journal.installation()
      val job = AndroidS3Job(id, install, journal.context(), target, UUID.randomUUID().toString(), "ownedasset:original", "revision", "generation", "$id.snapshot", "objects/$install/$id", S3Target.hash("owned"), 5, "owned.jpg", "ownedasset/original", "photo_resource", "ownedasset", "image/jpeg")
      check(AndroidS3Job.decode(job.payload()) == job); journal.insert(job)
      val resource = S3PhotoResource(job.key, "original", "owned.jpg", "image/jpeg", job.sha256, 5)
      val manifest = S3PhotoManifest(install, "ownedasset", 1, listOf(resource), emptyList(), false)
      check(S3PhotoManifestCodec.decode(S3PhotoManifestCodec.encode(manifest)) == manifest)
      reject { S3PhotoManifestCodec.requireReceipts(manifest, target, journal) }
      val phases = listOf("prepared", "creating", "created", "part-intent", "part-ack", "completing", "complete-ack")
      for ((from, to) in phases.zipWithNext()) journal.record(job, from, to) { true }
      journal.record(job, "complete-ack", "completed", JSONObject().put("sha256", job.sha256).put("size", "5")) { true }
      S3PhotoManifestCodec.requireReceipts(manifest, target, journal)
      reject { S3PhotoManifestCodec.requireReceipts(manifest, target.copy(prefix = "another"), journal) }
      reject { S3PhotoManifestCodec.requireReceipts(manifest.copy(resources = listOf(resource.copy(size = 6))), target, journal) }
      reject { S3PhotoManifestCodec.decode(S3PhotoManifestCodec.encode(manifest).toString(Charsets.UTF_8).replace("kloda-s3-photo", "kloda-ftps-photo").toByteArray()) }
      reject { S3PhotoManifestCodec.encode(manifest.copy(resources = listOf(resource.copy(relativePath = "../escape")))) }
      val legacy = job.copy(kind = null, asset = null, mimeType = null); check(!legacy.payload().contains("\"kind\"")); check(AndroidS3Job.decode(legacy.payload()) == legacy)
      check(!journal.automatic()); journal.setAutomatic(true); check(journal.automatic())
      journal.prepareProfile(target.copy(profileGeneration = UUID.randomUUID().toString())); check(!journal.automatic())
    } finally { journal.database.close() }
  }
}
