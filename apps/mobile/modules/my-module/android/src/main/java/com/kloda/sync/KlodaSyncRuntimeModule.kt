package com.kloda.sync

import android.net.Uri
import android.provider.DocumentsContract

import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID


class KlodaSyncRuntimeModule : Module() {
  private fun gallery() = AndroidGallery(appContext.reactContext ?: throw FilesFailure("source_unavailable"))
  override fun definition() = ModuleDefinition {
    lateinit var directoryPicker: AppContextActivityResultLauncher<DirectoryPickerInput, String?>

    RegisterActivityContracts {
      directoryPicker = registerForActivityResult(DirectoryPickerContract(this@KlodaSyncRuntimeModule))
    }

    Name("KlodaSyncRuntime")
    AsyncFunction("pickDirectory") Coroutine { request: String ->
      directoryPicker.launch(DirectoryPickerInput(request))?.let(::saveDirectorySource)?.also { reconcileSources() }
    }

    AsyncFunction("loadDirectorySources") {
      val preferences = preferences()
      val sources = JSONArray(preferences.getString("directorySources", "[]"))
      List(sources.length()) { index ->
        val source = sources.getJSONObject(index)
        mapOf(
          "displayName" to source.getString("displayName"),
          "id" to source.getString("id"),
          "kind" to "directory",
          "reference" to source.getString("reference")
        )
      }
    }

    AsyncFunction("validateDirectorySources") {
      val permissions = appContext.reactContext?.contentResolver?.persistedUriPermissions.orEmpty()
      val sources = JSONArray(preferences().getString("directorySources", "[]"))
      List(sources.length()) { index ->
        val source = sources.getJSONObject(index)
        val reference = source.getString("reference")
        mapOf(
          "accessible" to permissions.any { permission -> permission.isReadPermission && permission.uri.toString() == reference },
          "id" to source.getString("id")
        )
      }
    }

    AsyncFunction("galleryPage") { source: String, offset: Int -> gallery().page(source, offset) }
    AsyncFunction("galleryPreview") { source: String, asset: String, detail: Boolean -> gallery().preview(source, asset, detail) }
    AsyncFunction("galleryHistory") { source: String, asset: String -> gallery().history(source, asset) }
    AsyncFunction("loadPhotoSources") { photos().load() }
    AsyncFunction("removePhotoSource") { id: String -> photos().remove(id).also { reconcileSources() } }
    AsyncFunction("selectPhotoLibrary") Coroutine { ->
      if (requestPhotoAccess()) photos().selectLibrary().also { reconcileSources() } else null
    }
    AsyncFunction("loadPhotoAlbums") Coroutine { ->
      if (requestPhotoAccess()) photos().albums() else emptyList<Map<String, String>>()
    }
    AsyncFunction("selectPhotoAlbum") Coroutine { id: String ->
      if (requestPhotoAccess()) photos().selectAlbum(id).also { reconcileSources() } else null
    }

    AsyncFunction("prepareSourceJobs") {
      val context = appContext.reactContext ?: throw IllegalStateException("Application context is unavailable.")
      val sources = JSONArray(preferences().getString("directorySources", "[]"))
      photos().load().forEach { sources.put(JSONObject(it)) }
      val scanner = AndroidSafSourceScanner(context.contentResolver)
      val media = AndroidPhotosSources(context)
      var queuedFiles = 0
      AndroidSyncJournal(context).use { journal ->
        repeat(sources.length()) { index ->
          val source = sources.getJSONObject(index)
          val reference = source.getString("reference")
          val files = if (AndroidPhotosSources.isPhotos(reference)) media.scan(reference) else scanner.scan(reference)
          queuedFiles += journal.reconcileSourceFiles(source.getString("id"), reference, files)
        }
      }
      mapOf("queuedFiles" to queuedFiles, "scannedSources" to sources.length())
    }

    AsyncFunction("removeDirectorySource") { id: String ->
      synchronized(AndroidSyncJournal.sourceLock) {
      val sources = JSONArray(preferences().getString("directorySources", "[]"))
      val remainingSources = JSONArray()
      var removedReference: String? = null
      repeat(sources.length()) { index ->
        val source = sources.getJSONObject(index)
        if (source.getString("id") == id) removedReference = source.getString("reference")
        else remainingSources.put(source)
      }
      if (removedReference != null && !FilesRunContext.stamp(preferences().edit().putString("directorySources", remainingSources.toString())).commit()) {
        throw IllegalStateException("Could not remove the source.")
      }
      AndroidSyncJournal(appContext.reactContext ?: throw IllegalStateException("Application context is unavailable.")).use { it.removeSource(id) }
      removedReference?.let { reference ->
        runCatching {
          appContext.reactContext?.contentResolver?.releasePersistableUriPermission(
            Uri.parse(reference),
            android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
          )
        }
      }
      }
      reconcileSources()
    }

    AsyncFunction("loadSchedule") {
      val preferences = preferences()
      mapOf(
        "backupMode" to AndroidBackupScheduler.mode(appContext.reactContext?.applicationContext ?: throw IllegalStateException("Application context is unavailable.")),
        "intervalHours" to preferences.getInt("intervalHours", 12),
        "localTime" to preferences.getString("localTime", "12:00")
      )
    }

    AsyncFunction("loadStorageConfig") {
      val preferences = preferences()
      val endpoint = preferences.getString("storageEndpoint", null) ?: return@AsyncFunction null
      val targetPath = preferences.getString("storageTargetPath", null) ?: return@AsyncFunction null
      val username = preferences.getString("storageUsername", null) ?: return@AsyncFunction null
      mapOf("endpoint" to endpoint, "targetPath" to targetPath, "username" to username)
    }

    AsyncFunction("saveStorageConfig") { endpoint: String, targetPath: String, username: String ->
      if (endpoint.isBlank() || targetPath.isBlank() || username.isBlank()) {
        throw IllegalArgumentException("Storage fields are required.")
      }
      if (!preferences().edit()
          .putString("storageEndpoint", endpoint)
          .putString("storageTargetPath", targetPath)
          .putString("storageUsername", username)
          .commit()) {
        throw IllegalStateException("Could not persist the storage configuration.")
      }
    }

    AsyncFunction("saveSchedule") { intervalHours: Int, localTime: String ->
      if (intervalHours != 12 && intervalHours != 24) throw IllegalArgumentException("Interval must be 12 or 24 hours.")
      if (!Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(localTime)) throw IllegalArgumentException("Time must use HH:mm.")
      synchronized(AndroidSyncJournal.sourceLock) {
        val preferences = preferences()
        if ((preferences.getString("backupMode", null) != "scheduled" || preferences.getInt("intervalHours", 12) != intervalHours || preferences.getString("localTime", "12:00") != localTime)
          && !FilesRunContext.stamp(preferences.edit().putString("backupMode", "scheduled").putInt("intervalHours", intervalHours).putString("localTime", localTime)).commit()) {
          throw IllegalStateException("Could not persist the schedule.")
        }
      }
      reconcileSources()
    }
    AsyncFunction("saveLiveSchedule") {
      synchronized(AndroidSyncJournal.sourceLock) {
        val preferences = preferences()
        if (preferences.getString("backupMode", null) != "live"
          && !FilesRunContext.stamp(preferences.edit().putString("backupMode", "live")).commit()) throw FilesFailure("storage_failure")
      }
      reconcileSources()
    }
  }

  private fun reconcileSources() { appContext.reactContext?.applicationContext?.let {
    AndroidWebDavRuntime.settingsChanged(); AndroidBackupScheduler.reconcile(it); AndroidWebDavScheduler.reconcile(it)
  } }

  private fun preferences() = appContext.reactContext?.getSharedPreferences("kloda-sync", 0)
    ?: throw IllegalStateException("Application context is unavailable.")

  private fun photos() = AndroidPhotosSources(appContext.reactContext ?: throw IllegalStateException("Application context is unavailable."))

  private suspend fun requestPhotoAccess(): Boolean {
    if (photos().hasAccess()) return true
    val permissions = appContext.permissions ?: throw IllegalStateException("Permissions module is unavailable.")
    withContext(Dispatchers.Main) {
      suspendCancellableCoroutine<Unit> { continuation ->
        permissions.askForPermissions({ if (continuation.isActive) continuation.resume(Unit) },
          *AndroidPhotosSources.requestPermissions(android.os.Build.VERSION.SDK_INT))
      }
    }
    return photos().hasAccess()
  }

  private fun saveDirectorySource(reference: String): Map<String, String> = synchronized(AndroidSyncJournal.sourceLock) {
    val sources = JSONArray(preferences().getString("directorySources", "[]"))
    repeat(sources.length()) { index ->
      val existingSource = sources.getJSONObject(index)
      if (existingSource.getString("reference") == reference) {
        return@synchronized mapOf(
          "displayName" to existingSource.getString("displayName"),
          "id" to existingSource.getString("id"),
          "kind" to "directory",
          "reference" to reference
        )
      }
    }
    val documentId = DocumentsContract.getTreeDocumentId(Uri.parse(reference))
    val source = mapOf(
      "displayName" to documentId.substringAfterLast('/').substringAfterLast(':'),
      "id" to UUID.randomUUID().toString(),
      "kind" to "directory",
      "reference" to reference
    )
    sources.put(JSONObject(source))
    if (!FilesRunContext.stamp(preferences().edit().putString("directorySources", sources.toString())).commit()) {
      throw IllegalStateException("Could not persist the source.")
    }
    source
  }
}
