package com.kloda.sync

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class KlodaBackupModule : Module() {
  private val token = Any()
  private var destroyed = false
  private val restoreLock = Any()
  @Volatile private var restore: AndroidWebDavRestoreTask? = null
  private var restoreSelecting = false
  private val cancelledRestoreRequests = mutableSetOf<UUID>()
  private fun cancelRestore(request: UUID? = null, includePicker: Boolean = true) {
    val previous = synchronized(restoreLock) {
      if (request != null) cancelledRestoreRequests.add(request)
      val current = restore
      if (current == null || (request != null && current.ticket != request) || (!includePicker && current.choosing)) null
      else current.also { cancelledRestoreRequests.add(it.ticket); restore = null }
    }
    previous?.pause()
  }
  private val reviewLock = Any()
  @Volatile private var reviews: AndroidWebDavReview? = null
  private fun review(): AndroidWebDavReview = synchronized(reviewLock) {
    reviews ?: AndroidWebDavReview(context()) { AndroidWebDavRuntime.interactive(token) }.also { reviews = it }
  }
  private fun context() = appContext.reactContext?.applicationContext ?: throw FilesFailure("native_unsupported")
  private fun resumed() = (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
  private fun checkUi() { if (destroyed || !resumed() || !AndroidWebDavRuntime.interactive(token)) throw FilesFailure("candidate_stale") }
  private fun queue() = AndroidWebDavRuntime.queue(context())
  private fun <T> guarded(action: () -> T): T = try { action() } catch (error: Exception) {
    val code = when {
      error is FilesFailure -> error.code
      error is android.database.sqlite.SQLiteException -> "storage_failure"
      error is SecurityException -> "source_permission_lost"
      isLocalStorageFull(error) -> "local_storage_full"
      else -> "outcome_unknown"
    }
    throw CodedException(code, code, null)
  }
  override fun definition() = ModuleDefinition {
    lateinit var restorePicker: AppContextActivityResultLauncher<DirectoryPickerInput, String?>
    RegisterActivityContracts { restorePicker = registerForActivityResult(DirectoryPickerContract(this@KlodaBackupModule, true)) }
    Name("KlodaBackup")
    OnCreate { AndroidWebDavRuntime.attach(token, resumed()); AndroidWebDavScheduler.reconcileAsync(context()) }
    OnActivityEntersForeground { if (!destroyed) { AndroidWebDavRuntime.foreground(token, true); AndroidWebDavScheduler.reconcileAsync(context()) } }
    OnActivityEntersBackground { cancelRestore(includePicker = false); reviews?.cancel(); AndroidWebDavRuntime.foreground(token, false) }
    OnActivityDestroys { cancelRestore(); reviews?.cancel(); AndroidWebDavRuntime.foreground(token, false) }
    OnDestroy { destroyed = true; cancelRestore(); reviews?.cancel(); AndroidWebDavRuntime.detach(token) }
    AsyncFunction("webDavStatus") { guarded { queue().status() + (AndroidWebDavScheduler.error(context())?.let { mapOf("automaticError" to it) } ?: emptyMap()) } }
    AsyncFunction("configureWebDav") { endpoint: String, path: String, username: String, password: String -> guarded {
      checkUi(); AndroidRecoveryVault(context()).requireConfirmed(); cancelRestore(); reviews?.cancel(); queue().configure(AndroidWebDavProfile(UUID.randomUUID().toString(), endpoint, path, username, password)); AndroidWebDavScheduler.reconcileAsync(context()); queue().status()
    } }
    AsyncFunction("disableWebDav") { guarded { checkUi(); cancelRestore(); reviews?.cancel(); queue().disable(); AndroidWebDavScheduler.reconcileAsync(context()); queue().status() } }
    AsyncFunction("runWebDav") { guarded {
      checkUi(); queue().start()
    } }
    AsyncFunction("pauseWebDav") { guarded { checkUi(); queue().pause("target_pause"); queue().status() } }
    AsyncFunction("webDavIssues") { after: String -> guarded { checkUi(); review().items(after) } }
    AsyncFunction("reviewWebDav") { id: String, action: String, request: String -> guarded {
      checkUi(); review().perform(id, action, UUID.fromString(request))
    } }
    AsyncFunction("cancelWebDavReview") { request: String -> guarded { reviews?.cancel(UUID.fromString(request)) } }
    AsyncFunction("webDavBackups") { after: String, target: String -> guarded { checkUi(); AndroidWebDavBackups.list(context(), after, target) } }
    AsyncFunction("restoreWebDavFile") Coroutine { id: String, request: String, target: String ->
      val session = withContext(Dispatchers.IO) { guarded {
        checkUi()
        val destination = synchronized(AndroidSyncJournal.sourceLock) { AndroidWebDavContext.restoreTarget(context(), target) }
        val binding = FilesRunContext.webdav(context()).binding
        val ticket = UUID.fromString(request)
        lateinit var current: AndroidWebDavFilesRestore
        current = AndroidWebDavFilesRestore(context(), destination, binding, ticket) {
          synchronized(restoreLock) { if (restore !== current) throw FilesFailure("cancelled") }
          if (!current.choosing) checkUi()
        }
        synchronized(restoreLock) {
          if (ticket in cancelledRestoreRequests) throw FilesFailure("cancelled")
          if (restore != null || restoreSelecting) throw FilesFailure("backup_busy")
          restore = current; restoreSelecting = true
        }
        current
      } }
      try {
        val tree = restorePicker.launch(DirectoryPickerInput(request)) ?: throw FilesFailure("cancelled")
        synchronized(restoreLock) { if (restore === session || restore == null) restoreSelecting = false }
        awaitRestoreForeground(appContext.currentActivity)
        withContext(Dispatchers.IO) { guarded { session.choosing = false; session.restore(tree, id) } }
      } catch (error: Exception) { guarded { throw error } }
      finally {
        synchronized(restoreLock) { if (restore === session) { restore = null; restoreSelecting = false } else if (restore == null) restoreSelecting = false }
        session.pause()
      }
    }
    AsyncFunction("restoreWebDavPhotos") Coroutine { id: String, request: String, target: String ->
      val session = withContext(Dispatchers.IO) { guarded {
        checkUi()
        val destination = synchronized(AndroidSyncJournal.sourceLock) { AndroidWebDavContext.restoreTarget(context(), target) }
        val binding = FilesRunContext.webdav(context()).binding
        val ticket = UUID.fromString(request)
        lateinit var current: AndroidWebDavPhotosRestore
        current = AndroidWebDavPhotosRestore(context(), destination, binding, ticket) {
          synchronized(restoreLock) { if (restore !== current) throw FilesFailure("cancelled") }; checkUi()
        }
        synchronized(restoreLock) {
          if (ticket in cancelledRestoreRequests) throw FilesFailure("cancelled")
          if (restore != null || restoreSelecting) throw FilesFailure("backup_busy")
          restore = current
        }
        current
      } }
      try { withContext(Dispatchers.IO) { guarded { session.restore(id) } } }
      finally { synchronized(restoreLock) { if (restore === session) restore = null }; session.pause() }
    }
    AsyncFunction("cancelWebDavRestore") { request: String -> guarded { cancelRestore(UUID.fromString(request)) } }
    AsyncFunction("pcSelected") { guarded { mapOf("enabled" to AndroidBackupDestinations.hasEnabledPc(context())) } }
    AsyncFunction("pcEnabled") { record: String -> guarded {
      mapOf("enabled" to AndroidBackupDestinations.pcEnabled(context(), record))
    } }
    AsyncFunction("setPcEnabled") { record: String, enabled: Boolean -> guarded {
      checkUi()
      AndroidBackupDestinations.setPcEnabled(context(), record, enabled)
      mapOf("enabled" to enabled)
    } }
  }
}
