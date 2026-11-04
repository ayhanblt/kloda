package com.kloda.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.util.UUID

// ADR0029 29/3: the typed code, the PROPFIND listing parser and the importer against the deltas the 29/2 writer left in
// the in-memory destination, then tampered copies (same cases as IosRecoveryImportChecks).
internal object AndroidRecoveryImportChecks {
  private fun code(announce: (String) -> Unit) {
    val secret = ByteArray(32) { it.toByte() }
    val shown = AndroidRecoveryCode.format(secret)
    check(AndroidRecoveryCode.parse(shown).contentEquals(secret)) { "round trip" }
    val loose = " " + shown.lowercase().replace('-', ' ').replace('0', 'o').replace('1', 'l') + " "
    check(AndroidRecoveryCode.parse(loose).contentEquals(secret)) { "case, spaces and Crockford aliases" }
    val wrong = shown.dropLast(1) + if (shown.last() == '0') "1" else "0"
    for (typed in listOf(wrong, shown.dropLast(1), shown + "0", "U" + shown.drop(1), "")) {
      AndroidRecoveryCatalogChecks.fails("recovery_code_invalid") { AndroidRecoveryCode.parse(typed) }
    }
    announce("PASS recovery code parse: round trip, aliases; check, length and alphabet refused")
  }

  private fun listing(announce: (String) -> Unit) {
    val folder = "https://dav.example/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/".toHttpUrl()
    val xml = """<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      <d:response><d:href>/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/abc/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      <d:response><d:href>https://dav.example/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/1.json</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response>
      <d:response><d:href>/remote.php/dav/files/u/Other/x/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      <d:response><d:href>https://evil.example/remote.php/dav/files/u/Kloda%20Yedek/.kloda/catalog/y/</d:href></d:response>
      </d:multistatus>"""
    val children = AndroidWebDavListing.children(xml.toByteArray(), folder)
    check(children == listOf(RemoteChild("abc", true), RemoteChild("1.json", false))) { "$children" }
    announce("PASS PROPFIND listing: direct children only (self, other folder, other host ignored)")
  }

  fun run(context: Context, origin: AndroidWebDavJournal, remote: AndroidRecoveryCatalogChecks.MemoryDestination,
    old: AndroidRecoveryCatalog.Keys, renewed: AndroidRecoveryCatalog.Keys, target: String, announce: (String) -> Unit) {
    code(announce); listing(announce)
    val fresh = AndroidRecoveryCatalogChecks.sha("new-device-target")
    val opened = mutableListOf<SQLiteDatabase>()
    fun journal(): AndroidWebDavJournal = AndroidWebDavJournal(SQLiteDatabase.openOrCreateDatabase(
      context.getDatabasePath("import-${UUID.randomUUID()}.db").apply { parentFile?.mkdirs() }, null).also { opened.add(it) })
    fun importer(journal: AndroidWebDavJournal, keys: AndroidRecoveryCatalog.Keys, destination: AndroidBackupTransport) =
      AndroidRecoveryImport(journal.catalog, journal.imports, fresh, keys, destination) {}
    try {
      val device = journal()
      check(device.catalog.installation() != origin.catalog.installation()) { "own installation" }
      var result = importer(device, old, remote).run()
      check(result == AndroidRecoveryImport.Summary(2, 3, 4, 0)) { "$result" }
      check(device.imports.count(fresh) == 4L && device.imports.count(target) == 0L && device.catalog.uncatalogued(fresh, old.chain).isEmpty()) {
        "bound to this destination, never a Completed receipt"
      }
      result = importer(device, old, remote).run()
      check(result.deltas == 3 && device.imports.count(fresh) == 4L) { "re-import adds nothing" }
      announce("PASS import: both chains of the old code verified into 4 restore-only receipts of this destination; idempotent")

      val renewal = importer(device, renewed, remote).run()
      check(renewal.chains == 1 && renewal.entries == 3) { "renewed code reads only its own chain" }
      check(importer(device, AndroidRecoveryCatalog.keys(ByteArray(32) { 7 }), remote).run().chains == 0 &&
        importer(origin, old, remote).run().chains == 0) { "wrong code finds nothing; own catalog skipped" }
      announce("PASS renewed code reads its chain only; wrong code finds nothing; own installation skipped")

      val installation = origin.catalog.installation()
      val folder = AndroidRecoveryCatalog.folder(installation, old.chain, target)
      val altered = remote.files.getValue("$folder/2.json").copyOf().also { it[it.size / 2] = (it[it.size / 2].toInt() xor 1).toByte() }
      val cases = listOf<Triple<String, (AndroidRecoveryCatalogChecks.MemoryDestination) -> Unit, Pair<Int, Int>>>(
        Triple("altered byte", { it.files["$folder/2.json"] = altered }, 1 to 1),
        Triple("missing first delta", { it.files.remove("$folder/1.json") }, 0 to 1),
        Triple("injected delta", { it.files["$folder/3.json"] = "{}".toByteArray() }, 2 to 1),
        Triple("replayed delta", { it.files["$folder/2.json"] = it.files.getValue("$folder/1.json") }, 1 to 1),
        Triple("oversized delta", { it.files["$folder/2.json"] = ByteArray(AndroidRecoveryCatalog.LIMIT + 1) }, 1 to 1),
        Triple("authentic unsafe path", { copy ->
          copy.files["$folder/3.json"] = AndroidRecoveryCatalog.encode(old, installation, target, 3, AndroidRecoveryCatalog.digest(copy.files.getValue("$folder/2.json")),
            listOf(AndroidRecoveryCatalog.Entry("", "../x", AndroidRecoveryCatalogChecks.sha("x"), 1, "file", null, null)))
        }, 2 to 1),
      )
      for ((name, change, expected) in cases) {
        val copy = AndroidRecoveryCatalogChecks.MemoryDestination()
        remote.files.filterKeys { it.startsWith("$folder/") }.forEach { (key, value) -> copy.files[key] = value }
        change(copy)
        val summary = importer(journal(), old, copy).run()
        check(summary.deltas == expected.first && summary.unverified == expected.second) { "$name: $summary" }
      }
      announce("PASS tamper: altered, missing, injected, replayed, oversized and unsafe deltas end the chain and count as unverified")
    } finally { opened.forEach { it.close() } }
  }
}
