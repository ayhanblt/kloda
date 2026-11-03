package com.kloda.sync

import android.app.Instrumentation
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import java.io.File
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

internal object AndroidWebDavSafChecks {
  fun run(instrumentation: Instrumentation, isolated: Context) {
    check(instrumentation.targetContext.packageName == "com.kloda.sync.test")
    val token = UUID.randomUUID().toString().replace("-", "")
    val root = File(instrumentation.targetContext.cacheDir, "kloda-owned-saf-$token")
    check(!root.exists() && root.mkdirs())
    val sourceFolder = File(root, "source").also { check(it.mkdir()) }
    val targetFolder = File(root, "target").also { check(it.mkdir()) }
    val sourceFile = File(sourceFolder, "payload.bin")
    val bytes = ByteArray(1048576) { (it % 251).toByte() }; sourceFile.writeBytes(bytes)
    val sourceTree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY, "$token:source")
    val targetTree = DocumentsContract.buildTreeDocumentUri(AndroidWebDavDocumentsProvider.AUTHORITY, "$token:target")
    val context = object : android.content.ContextWrapper(isolated) { override fun getPackageName() = isolated.packageName + ".owned.saf." + token }
    val alias = context.packageName + ".webdav.profile.v1"
    val keys = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }; check(!keys.containsAlias(alias))
    var activity: AndroidLifecycleActivity? = null
    val granted = mutableListOf<Pair<Uri, Int>>()
    try {
      fun grant(uri: Uri, flags: Int) {
        // Actual OS advanced grants are recorded even for an owner UID; no fake permission list/provider resolver.
        context.grantUriPermission(instrumentation.targetContext.packageName, uri, flags or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        context.contentResolver.takePersistableUriPermission(uri, flags); granted += uri to flags
        check(context.contentResolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission })
      }
      grant(sourceTree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      grant(targetTree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      val visible = instrumentation.startActivitySync(Intent(instrumentation.targetContext, AndroidLifecycleActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as AndroidLifecycleActivity
      activity = visible; instrumentation.waitForIdleSync()
      val deadline = android.os.SystemClock.elapsedRealtime() + 15000
      while (!visible.resumed || !visible.focused) { check(android.os.SystemClock.elapsedRealtime() < deadline); Thread.sleep(50) }
      val source = UUID.randomUUID().toString()
      val profile = AndroidWebDavProfile(UUID.randomUUID().toString(), "https://10.0.2.2:26443/dav", "owned-saf-$token/foreign-final", "owned", "disposable-https-fixture")
      val preferences = context.getSharedPreferences("kloda-sync", 0)
      check(FilesRunContext.stamp(preferences.edit().putString("directorySources", JSONArray().put(JSONObject().put("id", source).put("reference", sourceTree.toString())).toString())).commit())
      AndroidWebDavVault(context).write(profile)
      AndroidSyncJournal.webdav(context).use { owner ->
        val journal = AndroidWebDavJournal(owner.writableDatabase); journal.setEnabled("webdav", profile.targetId(), true, profile.revision)
        fun backup(): WebDavUpload {
          val captured = AndroidWebDavContext.capture(context, journal)
          val snapshots = AndroidFilesSnapshots(context, true) { captured.check(context, journal) }
          val publisher = AndroidWebDavPublisher(profile.targetId(), captured.binding, journal, snapshots,
            AndroidWebDavTransport(context, profile, snapshots) { captured.check(context, journal) }, { captured.check(context, journal) }, { captured.complete(context, journal, it) }, {})
          val runner = AndroidWebDavFilesRunner(context, publisher); runner.run(captured.sources.sources)
          check(runner.errorCode == "conflict")
          return journal.uploads(profile.targetId()).single { it.phase != "completed" }
        }
        val first = backup()
        val review = AndroidWebDavReview(context) { visible.resumed && visible.focused }
        check(review.perform(first.id, "keep_both", UUID.randomUUID())["state"] == "completed")
        val firstComplete = journal.find(first.id)!!
        check(firstComplete.phase == "completed" && journal.publications.read(firstComplete) != firstComplete.relativePath)
        sourceFile.writeBytes(ByteArray(bytes.size) { (bytes[it].toInt() xor 1).toByte() }); check(sourceFile.setLastModified(System.currentTimeMillis() + 2000))
        val second = backup(); val oldBinding = second.binding
        check(FilesRunContext.stamp(preferences.edit()).commit())
        var blocked: String? = null
        try { review.perform(second.id, "recheck", UUID.randomUUID()) } catch (error: FilesFailure) { blocked = error.code }
        check(blocked == "settings_changed")
        check(review.perform(second.id, "authorize_keep_both", UUID.randomUUID())["state"] == "completed")
        check(journal.find(second.id)!!.binding == oldBinding)
        // Original-source access is not restore authority: own Completed remote bytes remain restorable.
        context.contentResolver.releasePersistableUriPermission(sourceTree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.revokeUriPermission(sourceTree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        granted.removeAll { it.first == sourceTree }
        val restoreBinding = FilesRunContext.webdav(context).binding
        fun restore() = AndroidWebDavFilesRestore(context, profile, restoreBinding, UUID.randomUUID()) {
          if (!visible.resumed || !visible.focused) throw FilesFailure("candidate_stale")
        }.let { session -> session.choosing = false; try { session.restore(targetTree.toString(), first.id) } finally { session.pause() } }
        check(restore()["state"] == "completed")
        val created = targetFolder.listFiles()!!.single(); check(created.readBytes().contentEquals(bytes))
        check(restore()["state"] == "completed" && targetFolder.listFiles()!!.size == 1)
      }
    } finally {
      for ((uri, flags) in granted) { context.contentResolver.releasePersistableUriPermission(uri, flags); context.revokeUriPermission(uri, flags) }
      if (keys.containsAlias(alias)) keys.deleteEntry(alias)
      instrumentation.runOnMainSync { activity?.finish() }
      check(root.name == "kloda-owned-saf-$token"); root.deleteRecursively()
    }
  }
}
