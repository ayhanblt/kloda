package com.kloda.sync

import android.content.Context
import java.util.UUID

// Private synthetic bytes only: no SAF picker/provider, Photos writes, PC identity or physical device.
internal object AndroidWebDavFilesChecks {
  fun run(base: Context) {
    val namespace = UUID.randomUUID().toString().replace("-", "")
    val context = object : android.content.ContextWrapper(base) { override fun getPackageName() = base.packageName + ".owned.files." + namespace }
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = context.packageName + ".webdav.profile.v1"
    check(!keys.containsAlias(alias))
    try {
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://10.0.2.2:26443/dav", "owned-files-" + UUID.randomUUID(), "owned", "disposable-https-fixture")
      val snapshots = AndroidFilesSnapshots(context, true) {}
      val bytes = ByteArray(1048576) { (it % 251).toByte() }
      val digest = AndroidFilesSnapshots.digest(java.io.ByteArrayInputStream(bytes))
      val source = UUID.randomUUID().toString()
      AndroidSyncJournal.webdav(context).use { database ->
        val journal = AndroidWebDavJournal(database.writableDatabase)
        fun row(mode: String): WebDavUpload {
          val staged = snapshots.stageDownload(digest) { it.write(bytes) }
          return WebDavUpload(UUID.randomUUID().toString(), profile.targetId(), "owned-files-component", source, "$source/$mode/payload.bin", "$source/$mode/payload.bin", "1", staged.id, digest.sha256, digest.size,
            kind = "file", sourceIdentity = "owned-private-byte-fixture").also(journal::insert)
        }
        val transport = AndroidWebDavTransport(context, profile, snapshots) {}
        val publication = AndroidWebDavPublication(journal, transport::inspect, transport::upload, transport::move, {}, { journal.advance(it, "completed") })
        val normal = row("normal"); check(publication.execute(normal.id))
        val download = AndroidWebDavDownload(context, profile, journal, snapshots) {}
        val restored = download.stage(normal.id)
        snapshots.open(restored.id, digest.size).use { snapshots.validate(digest, it) }
        snapshots.discard(restored)
        val unknown = row("lost-move")
        var lost: String? = null
        try { publication.execute(unknown.id) } catch (error: FilesFailure) { lost = error.code }
        check(lost == "connection_unavailable" && journal.find(unknown.id)?.phase == "moving")
        var rejected: String? = null
        try { download.stage(unknown.id) } catch (error: FilesFailure) { rejected = error.code }
        check(rejected == "review_required")
        AndroidWebDavVault(context).write(profile)
        val catalog = AndroidWebDavBackups.list(context, "")
        @Suppress("UNCHECKED_CAST") val items = catalog["items"] as List<Map<String, String>>
        check(items.size == 1 && items[0]["id"] == normal.id && catalog["targetId"] == profile.targetId())
        check(!journal.enabled("webdav", profile.targetId())) // Explicit own restore/catalog is separate from automatic backup opt-in.
        download.cancel(); transport.cancel()
      }
    } finally { if (keys.containsAlias(alias)) keys.deleteEntry(alias) }
  }
}
