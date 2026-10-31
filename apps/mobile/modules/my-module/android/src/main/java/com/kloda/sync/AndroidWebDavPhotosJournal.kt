package com.kloda.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import java.util.UUID

internal data class WebDavPhotoImportIntent(val key: String, override val manifest: WebDavPhotoManifest,
  val token: String, override val folder: String, val library: String, val target: String,
  override val phase: String = "prepared", override val uri: String? = null,
  override val owned: Boolean = true, val reason: String = "") : PhotoMediaIntent {
  override val resource get() = manifest.resources.single()
  override val desiredFolder get() = AndroidWebDavPhotosJournal.folder(target, manifest)
  override val name: String get() = manifest.resources.singleOrNull()?.let {
    var start = maxOf(0, it.name.length - 45)
    if (start > 0 && Character.isLowSurrogate(it.name[start])) start++
    "kloda-dav-$token-${it.name.substring(start)}"
  } ?: ""
  fun validate() {
    WebDavPhotoManifestCodec.decode(WebDavPhotoManifestCodec.encode(manifest))
    if (!Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(target) || !Regex("[0-9a-f]{32}").matches(token) ||
      key != AndroidWebDavPhotosJournal.identity(target, manifest.sourceDeviceId, manifest.assetId) || !owned || library.isEmpty() || library.length > 4096 ||
      !folder.startsWith("DCIM/Kloda/WebDAV/") || folder.length > 4096 || folder.split('/').any { it == "." || it == ".." || it.any(Char::isISOControl) } ||
      phase !in setOf("prepared", "creating", "inserted", "written", "organizing", "completed", "organization_review", "review_required") ||
      (uri != null && (uri.length > 8192 || android.net.Uri.parse(uri).scheme != "content")) ||
      reason.length > 128 || (reason.isNotEmpty() && !Regex("[a-z][a-z0-9_]*").matches(reason)) ||
      (phase == "completed" && uri == null) || (phase == "prepared" && uri != null)) throw FilesFailure("outcome_unknown")
  }
}

internal class AndroidWebDavPhotosJournal(private val database: SQLiteDatabase, private val target: String,
  private val commit: (() -> Unit) -> Unit) {
  companion object {
    fun identity(target: String, device: String, asset: String) = AndroidPhotosImportJournal.identity(target, "$device:$asset")
    fun folder(target: String, manifest: WebDavPhotoManifest): String {
      val album = manifest.albums.singleOrNull() ?: return "DCIM/Kloda/WebDAV/${target.take(12)}/Library/"
      val safe = album.name.map { if (it.isLetterOrDigit() || it == ' ' || it == '-' || it == '_') it else '_' }.take(45).joinToString("").trim().ifEmpty { "Album" }
      return "DCIM/Kloda/WebDAV/${target.take(12)}/$safe [${identity(target, manifest.sourceDeviceId, album.id)}]/"
    }
  }
  init {
    database.execSQL("CREATE TABLE IF NOT EXISTS webdav_photo_import(key TEXT NOT NULL,token TEXT NOT NULL,target TEXT NOT NULL,manifest TEXT NOT NULL,folder TEXT NOT NULL,library TEXT NOT NULL,phase TEXT NOT NULL,uri TEXT,reason TEXT NOT NULL,PRIMARY KEY(key,token))")
    database.execSQL("""CREATE TRIGGER IF NOT EXISTS immutable_webdav_photo_import BEFORE UPDATE ON webdav_photo_import
      WHEN NEW.key IS NOT OLD.key OR NEW.token IS NOT OLD.token OR NEW.target IS NOT OLD.target OR NEW.library IS NOT OLD.library
      OR (OLD.uri IS NOT NULL AND NEW.uri IS NOT OLD.uri) OR (OLD.phase!='prepared' AND NEW.phase='prepared')
      BEGIN SELECT RAISE(ABORT,'binding'); END""")
    database.execSQL("CREATE TRIGGER IF NOT EXISTS retain_webdav_photo_import BEFORE DELETE ON webdav_photo_import BEGIN SELECT RAISE(ABORT,'retained'); END")
  }
  fun get(key: String): WebDavPhotoImportIntent? = database.rawQuery("SELECT manifest,token,folder,library,phase,uri,reason FROM webdav_photo_import WHERE key=? AND target=? ORDER BY rowid DESC LIMIT 1", arrayOf(key, target)).use {
    if (!it.moveToFirst()) null else WebDavPhotoImportIntent(key, WebDavPhotoManifestCodec.decode(it.getString(0).toByteArray(Charsets.UTF_8)), it.getString(1), it.getString(2), it.getString(3), target,
      it.getString(4), if (it.isNull(5)) null else it.getString(5), true, it.getString(6)).also(WebDavPhotoImportIntent::validate)
  }
  fun prepare(manifest: WebDavPhotoManifest, library: String): WebDavPhotoImportIntent {
    val key = identity(target, manifest.sourceDeviceId, manifest.assetId)
    return get(key) ?: WebDavPhotoImportIntent(key, manifest, UUID.randomUUID().toString().replace("-", ""), folder(target, manifest), library, target).also(::save)
  }
  fun save(intent: WebDavPhotoImportIntent) {
    intent.validate(); if (intent.target != target) throw FilesFailure("outcome_unknown")
    get(intent.key)?.let { previous ->
      val sameBytes = intent.manifest.resources.size == previous.manifest.resources.size && intent.manifest.resources.indices.all { index ->
        val a = intent.manifest.resources[index]; val b = previous.manifest.resources[index]
        a.role == b.role && a.name == b.name && a.mimeType == b.mimeType && a.sha256 == b.sha256 && a.size == b.size
      }
      if (!sameBytes || intent.manifest.revision < previous.manifest.revision || (intent.manifest.revision == previous.manifest.revision && intent.manifest != previous.manifest)) throw FilesFailure("source_revision_changed")
    }
    val values = ContentValues().apply {
      put("key", intent.key); put("token", intent.token); put("target", target); put("manifest", String(WebDavPhotoManifestCodec.encode(intent.manifest), Charsets.UTF_8))
      put("folder", intent.folder); put("library", intent.library); put("phase", intent.phase); put("uri", intent.uri); put("reason", intent.reason)
    }
    val write = {
      if (database.update("webdav_photo_import", values, "key=? AND token=? AND target=?", arrayOf(intent.key, intent.token, target)) == 0) {
        if (intent.phase != "prepared" || intent.uri != null) throw FilesFailure("outcome_unknown")
        database.insertOrThrow("webdav_photo_import", null, values)
      }
      Unit
    }
    if (intent.phase == "completed") commit(write) else write()
  }
}
