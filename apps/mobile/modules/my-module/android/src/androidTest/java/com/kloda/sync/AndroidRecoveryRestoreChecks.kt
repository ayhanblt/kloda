package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.os.ParcelFileDescriptor
import java.io.File
import java.util.UUID

// ADR0029 29/4: imported receipts through the production download (restore authority, staging, Kloda's SHA-256)
// against the old device's catalog and files in the in-memory destination (same cases as IosRecoveryRestoreChecks).
// The 29/3 delta cases are not repeated; these are their restore consequences plus altered/injected remote files,
// wrong code and interruption.
internal object AndroidRecoveryRestoreChecks {
  private class Cancelled : RuntimeException()

  fun run(context: Context, origin: AndroidWebDavJournal, remote: AndroidRecoveryCatalogChecks.MemoryDestination,
    old: AndroidRecoveryCatalog.Keys, target: String, source: String, announce: (String) -> Unit) {
    val sha = AndroidRecoveryCatalogChecks::sha
    val fresh = sha("restore-device-target"); val installation = origin.catalog.installation()
    val folder = AndroidRecoveryCatalog.folder(installation, old.chain, target)
    val twinFolder = AndroidRecoveryCatalog.folder(installation, old.chain, sha("twin-target"))
    val snapshots = AndroidFilesSnapshots(context, webdav = true) {}
    val directory = File(context.noBackupFilesDir, "kloda-webdav-snapshots")
    val baseline = directory.listFiles()?.size ?: 0
    fun staged() = (directory.listFiles()?.size ?: 0) - baseline
    val opened = mutableListOf<SQLiteDatabase>()
    fun journal() = AndroidWebDavJournal(SQLiteDatabase.openOrCreateDatabase(
      context.getDatabasePath("restore-${UUID.randomUUID()}.db").apply { parentFile?.mkdirs() }, null).also { opened.add(it) })

    // The old device's files beside its chain (a.txt, b.txt; c.txt), plus an authentic photo delta 3.
    val files = AndroidRecoveryCatalogChecks.MemoryDestination()
    remote.files.filterKeys { it.startsWith("$folder/") }.forEach { (key, value) -> files.files[key] = value }
    for (name in listOf("a.txt", "b.txt", "c.txt")) files.files["$source/$name"] = name.toByteArray()
    val photo = "photo-bytes".toByteArray(); val photoPath = "$source/photos/p.jpg"
    val resource = WebDavPhotoResource(photoPath, "original", "p.jpg", "image/jpeg", AndroidRecoveryCatalog.digest(photo), photo.size.toLong())
    val manifest = WebDavPhotoManifest("old-device", "asset1", 1, listOf(resource), emptyList(), null)
    val manifestBytes = WebDavPhotoManifestCodec.encode(manifest); val manifestPath = "$source/photos/${manifest.filename}"
    files.files[photoPath] = photo; files.files[manifestPath] = manifestBytes
    val resourceEntry = AndroidRecoveryCatalog.Entry("", photoPath, resource.sha256, resource.size, "photo_resource", "photos:old-device:asset1:original", null)
    val manifestEntry = AndroidRecoveryCatalog.Entry("", manifestPath, AndroidRecoveryCatalog.digest(manifestBytes), manifestBytes.size.toLong(),
      "photo_manifest", "photos:old-device:asset1:manifest", null)
    fun delta3(entries: List<AndroidRecoveryCatalog.Entry>, copy: AndroidRecoveryCatalogChecks.MemoryDestination) {
      copy.files["$folder/3.json"] = AndroidRecoveryCatalog.encode(old, installation, target, 3,
        AndroidRecoveryCatalog.digest(copy.files.getValue("$folder/2.json")), entries)
    }
    delta3(listOf(resourceEntry, manifestEntry), files)
    fun copy(change: (AndroidRecoveryCatalogChecks.MemoryDestination) -> Unit = {}) =
      AndroidRecoveryCatalogChecks.MemoryDestination().also { value -> files.files.forEach { (k, v) -> value.files[k] = v }; change(value) }
    fun imported(destination: AndroidBackupTransport, keys: AndroidRecoveryCatalog.Keys = old, device: AndroidWebDavJournal = journal(),
      check: () -> Unit = {}) = device to AndroidRecoveryImport(device.catalog, device.imports, fresh, keys, destination, check).run()
    fun listed(device: AndroidWebDavJournal) = AndroidWebDavBackups.merged(device.uploads(fresh), device.imports.receipts(fresh, "")).first
      .filter { it.kind in setOf("file", "photo_manifest") }.map { it.relativePath.substringAfterLast('/') }.sorted()
    fun id(device: AndroidWebDavJournal, name: String) = device.imports.receipts(fresh, "").first { it.relativePath.endsWith("/$name") }.id
    fun download(device: AndroidWebDavJournal, destination: AndroidBackupTransport, bound: String = fresh, check: () -> Unit = {}) =
      AndroidWebDavDownload(bound, destination, device, snapshots, check)
    fun bytes(snapshot: FilesSnapshot) = snapshots.open(snapshot.id, snapshot.digest.size).use { ParcelFileDescriptor.AutoCloseInputStream(it).use { s -> s.readBytes() } }

    try {
      val (device, summary) = imported(files)
      check(summary == AndroidRecoveryImport.Summary(1, 3, 5, 0)) { "$summary" }
      val names = listed(device)
      check(names == listOf("a.txt", "b.txt", "c.txt", manifest.filename).sorted()) { "restore list: $names" }
      for (name in listOf("a.txt", "b.txt", "c.txt")) {
        val stage = download(device, files).stage(id(device, name))
        check(bytes(stage).contentEquals(name.toByteArray())) { name }
        snapshots.discard(stage)
      }
      val photos = download(device, files); val manifestId = id(device, manifest.filename)
      val decoded = photos.manifest(manifestId)
      check(decoded == manifest && photos.resource(decoded, decoded.resources[0], photos.receipt(manifestId))?.relativePath == photoPath && staged() == 0) {
        "manifest and its resource of the same origin"
      }
      announce("PASS restore: imported files and photo manifest download, verify by SHA-256 and stage; nothing retained")

      val a = id(device, "a.txt")
      AndroidRecoveryCatalogChecks.fails("review_required") { download(device, files, target).receipt(a) }
      val projection = download(device, files).receipt(a)
      check(device.find(a) == null && projection.binding == AndroidRecoveryImportJournal.BINDING) { "not an upload row" }
      AndroidRecoveryCatalogChecks.fails("outcome_unknown") { device.insert(projection) }
      val row = WebDavFileRestore(UUID.randomUUID().toString(), fresh, a, "a.txt", projection.sha256, projection.size,
        AndroidFilesSnapshots.randomId(), "content://example.documents/tree/x")
      AndroidWebDavRestoreJournal(opened.first(), "imported_file_restore", "imported_receipt").save(row)
      check(AndroidWebDavRestoreJournal(opened.first(), "imported_file_restore", "imported_receipt").latest(fresh, a) == row &&
        AndroidWebDavRestoreJournal(opened.first()).latest(fresh, a) == null) { "imported restore row only in imported_file_restore" }
      announce("PASS bound: other destination refused; never an upload row; restore rows only in imported_file_restore")

      AndroidRecoveryCatalogChecks.fails("hash_mismatch") { download(device, copy { it.files["$source/a.txt"] = "A.txt".toByteArray() }).stage(a) }
      AndroidRecoveryCatalogChecks.fails("review_required") { download(device, copy { it.files["$source/a.txt"] = "a.txt+".toByteArray() }).stage(a) }
      val swapped = copy { it.files[manifestPath] = WebDavPhotoManifestCodec.encode(manifest.copy(resources = listOf(resource.copy(relativePath = "$source/photos/x.jpg", name = "x.jpg")))) }
      AndroidRecoveryCatalogChecks.fails("hash_mismatch") { download(device, swapped).manifest(manifestId) }
      check(staged() == 0) { "rejected downloads leave no staging" }
      announce("PASS altered file: changed bytes hash_mismatch, longer body refused, swapped manifest hash_mismatch; no staging kept")

      val (injectedDevice, _) = imported(copy { it.files["$source/injected.txt"] = "injected".toByteArray() })
      check(listed(injectedDevice) == names) { "a remote file without an authentic entry is never listed" }
      val split = copy { value ->
        delta3(listOf(manifestEntry), value)
        value.files["$twinFolder/1.json"] = AndroidRecoveryCatalog.encode(old, installation, sha("twin-target"), 1, null, listOf(resourceEntry))
      }
      val (splitDevice, splitSummary) = imported(split)
      check(splitSummary.chains == 2 && splitSummary.entries == 5) { "$splitSummary" }
      AndroidRecoveryCatalogChecks.fails("manifest_invalid") { download(splitDevice, split).manifest(id(splitDevice, manifest.filename)) }
      announce("PASS injected: unlisted remote file never offered; a resource from another catalog origin never completes a manifest")

      val (gapDevice, gap) = imported(copy { it.files.remove("$folder/2.json") })
      check(gap.deltas == 1 && gap.unverified == 1 && listed(gapDevice) == listOf("a.txt", "b.txt")) { "$gap" }
      val (replayDevice, replay) = imported(copy { it.files["$folder/3.json"] = it.files.getValue("$folder/1.json") })
      check(replay.deltas == 2 && replay.unverified == 1 && listed(replayDevice) == listOf("a.txt", "b.txt", "c.txt")) { "$replay" }
      val (stranger, wrong) = imported(files, AndroidRecoveryCatalog.keys(ByteArray(32) { 9 }))
      check(wrong.chains == 0 && listed(stranger).isEmpty()) { "wrong code" }
      AndroidRecoveryCatalogChecks.fails("review_required") { download(stranger, files).receipt(a) }
      announce("PASS deleted/replayed delta: later entries never restorable, no duplicates; wrong code leaves nothing to restore")

      val resumed = journal()
      var limit = 1; var attempts = 0; var before = 0L
      while (true) {
        var calls = 0
        try { imported(files, device = resumed) { if (++calls == limit) throw Cancelled() }; break }
        catch (_: Cancelled) {
          val now = resumed.imports.count(fresh)
          check(now in before..5L) { "interrupted import keeps a verified prefix" }; before = now
        }
        limit++; attempts++
      }
      check(attempts > 3 && resumed.imports.count(fresh) == 5L && imported(files, device = resumed).second.deltas == 3) { "resumed import" }
      var reads = 0
      try { download(device, files) { if (++reads == 3) throw Cancelled() }.stage(a); error("interrupted download completed") } catch (_: Cancelled) {}
      check(staged() == 0) { "interrupted download leaves no staging" }
      snapshots.discard(download(device, files).stage(a))
      announce("PASS interruption: import resumes to the same 5 receipts after $attempts cuts; interrupted download retried cleanly")

      fun upload(id: String, binding: String) = WebDavUpload(id, fresh, binding, source, "r", "$source/r", "1", "", projection.sha256, 1)
      val all = List(450) { upload(UUID.randomUUID().toString(), if (it % 3 == 0) "b" else AndroidRecoveryImportJournal.BINDING) }
      fun page(rows: List<WebDavUpload>, after: String) = rows.filter { it.id > after }.sortedBy { it.id }.take(100)
      val seen = mutableListOf<String>(); var cursor: String? = ""
      while (cursor != null) {
        val after: String = cursor
        val (rows, next) = AndroidWebDavBackups.merged(page(all.filter { it.binding == "b" }, after), page(all.filter { it.binding != "b" }, after))
        check(rows.size <= 100); seen += rows.map { it.id }; cursor = next
      }
      check(seen == all.map { it.id }.sorted()) { "merged pages cover both lists once, in order" }
      announce("PASS restore list: local and imported receipts merged into pages of at most 100 without gaps or repeats")
    } finally { opened.forEach { it.close() } }
  }
}
