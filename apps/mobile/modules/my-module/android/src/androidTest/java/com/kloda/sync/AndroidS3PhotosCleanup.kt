package com.kloda.sync

import android.app.Instrumentation
import android.content.ContextWrapper
import android.net.Uri
import android.provider.MediaStore
import java.io.File
import org.json.JSONObject

// Recovery of the single identity-mismatched approved fixture; never enumerate/delete the library.
internal object AndroidS3PhotosCleanup {
  fun run(instrumentation: Instrumentation) {
    val base = instrumentation.targetContext; check(base.packageName == "com.kloda.sync.test")
    val root = File(base.cacheDir, "kloda-files-check-mZ_3k1uWsC4c_IDXGSyNew/s3-photos")
    check(root.canonicalPath.startsWith(base.cacheDir.canonicalPath + "/"))
    val ledgerFile = File(root, "media-ledger.json"); val ledger = JSONObject(ledgerFile.readText())
    val nonce = ledger.getString("nonce"); check(nonce == "3e4d6cde-9aab-458a-9bbd-9cc917a51dce")
    if (ledger.optBoolean("cleaned")) return
    val app = object : ContextWrapper(base) { override fun getNoBackupFilesDir() = root }
    val journal = AndroidS3Journal(app, "s3-compatible")
    try {
      val header = AndroidS3Job.decode(journal.text("SELECT header FROM s3_job WHERE state='completed' LIMIT 1"))
      check(header.target.prefix == "android-photos-$nonce")
      val target = header.target.archiveId(); val state = AndroidS3PhotosJournal(journal.database, target) { it() }
      val reader = journal.database.rawQuery("SELECT key FROM s3_photo_import WHERE target=?", arrayOf(target))
      val intents = reader.use { rows -> buildList { while (rows.moveToNext()) add(state.get(rows.getString(0))!!) } }
      val media = AndroidPhotosMedia(base) {}; val targets = ledger.getJSONArray("targets"); check(targets.length() == 1 && intents.size == 1)
      val expected = targets.getString(0)
      for (intent in intents) {
        check(intent.uri == expected && intent.owned)
        val receipt = media.receipt(intent); check(receipt != null && media.owned(intent, receipt))
        check(base.contentResolver.delete(Uri.parse(expected), null, null) == 1)
      }
      val source = Uri.parse(ledger.getString("source")); val resolver = base.contentResolver
      resolver.query(source, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.OWNER_PACKAGE_NAME), null, null, null)!!.use {
        check(it.moveToFirst() && it.getString(0) == "owned-source.png" && it.getString(1) == "Pictures/KlodaOwnedS3Photos17-$nonce/" && it.getString(2) == base.packageName && !it.moveToNext())
      }
      val expectedBytes = instrumentation.context.assets.open("kloda-ftps16/owned-photo.png").use { it.readBytes() }
      check(resolver.openInputStream(source)!!.use { it.readBytes() }.contentEquals(expectedBytes))
      check(resolver.delete(source, null, null) == 1)
      val store = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      val alias = base.packageName + ".owned.s3.photos." + nonce + ".s3.s3-compatible.profile.v1"
      if (store.containsAlias(alias)) store.deleteEntry(alias); check(!store.containsAlias(alias))
      check(!store.containsAlias(base.packageName + ".s3.s3-compatible.profile.v1"))
      ledger.put("cleaned", true); ledgerFile.writeText(ledger.toString())
    } finally { journal.database.close() }
  }
}
