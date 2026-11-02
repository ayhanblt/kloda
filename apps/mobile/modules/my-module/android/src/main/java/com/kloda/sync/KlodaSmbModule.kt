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

class KlodaSmbModule : Module() {
  private val token = Any()
  private var destroyed = false
  private val restoreLock = Any()
  @Volatile private var restore: AndroidSmbRestoreTask? = null
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
  @Volatile private var reviews: AndroidSmbReview? = null
  private fun review(): AndroidSmbReview = synchronized(reviewLock) {
    reviews ?: AndroidSmbReview(context(), queue()) { !destroyed && resumed() && AndroidSmbRuntime.interactive(token) }.also { reviews = it }
  }
  private fun context() = appContext.reactContext?.applicationContext ?: throw FilesFailure("native_unsupported")
  private fun resumed() = (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
  private fun checkUi() { if (destroyed || !resumed() || !AndroidSmbRuntime.interactive(token)) throw FilesFailure("candidate_stale") }
  private fun queue() = AndroidSmbRuntime.queue(context())
  private fun <T> guarded(action: () -> T): T = try { action() } catch (error: Exception) {
    val code = when {
      error is SmbFailure -> error.code
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
    RegisterActivityContracts { restorePicker = registerForActivityResult(DirectoryPickerContract(this@KlodaSmbModule, true)) }
    Name("KlodaSmb")
    OnCreate { AndroidSmbRuntime.attach(token, resumed()); AndroidSmbScheduler.reconcileAsync(context()) }
    OnActivityEntersForeground { if (!destroyed) { AndroidSmbRuntime.foreground(token, true); AndroidSmbScheduler.reconcileAsync(context()) } }
    OnActivityEntersBackground { cancelRestore(includePicker = false); reviews?.cancel(); AndroidSmbRuntime.foreground(token, false) }
    OnActivityDestroys { cancelRestore(); reviews?.cancel(); AndroidSmbRuntime.foreground(token, false) }
    OnDestroy { destroyed = true; cancelRestore(); reviews?.cancel(); AndroidSmbRuntime.detach(token) }
    AsyncFunction("smbStatus") { guarded { if (!AndroidSmbRuntime.supported()) mapOf("supported" to false, "configured" to false, "enabled" to false, "running" to false) else queue().status() + mapOf("supported" to true) + (AndroidSmbScheduler.error(context())?.let { mapOf("automaticError" to it) } ?: emptyMap()) } }
    AsyncFunction("configureSmb") { address: String, port: Int, share: String, root: String, username: String, domain: String, password: String -> guarded {
      checkUi(); cancelRestore(); reviews?.cancel(); queue().configure(SmbTarget(address, port, share, root, username, domain, "native", "native"), password); AndroidSmbScheduler.reconcileAsync(context()); queue().status()
    } }
    AsyncFunction("enableSmb") { guarded { checkUi(); queue().enable(); AndroidSmbScheduler.reconcileAsync(context()); queue().status() } }
    AsyncFunction("disableSmb") { guarded { checkUi(); cancelRestore(); reviews?.cancel(); queue().disable(); AndroidSmbScheduler.reconcileAsync(context()); queue().status() } }
    AsyncFunction("runSmb") { guarded {
      checkUi(); queue().start()
    } }
    AsyncFunction("pauseSmb") { guarded { checkUi(); queue().pause("target_pause"); queue().status() } }
    AsyncFunction("smbIssues") { after: String -> guarded { checkUi(); AndroidSmbBackups.list(queue(), after, true) } }
    AsyncFunction("reviewSmb") { id: String, request: String -> guarded {
      checkUi(); review().perform(id, UUID.fromString(request))
    } }
    AsyncFunction("cancelSmbReview") { request: String -> guarded { review().cancel(UUID.fromString(request)) } }
    AsyncFunction("smbBackups") { after: String -> guarded { checkUi(); AndroidSmbBackups.list(queue(), after) } }
    AsyncFunction("restoreSmbFile") Coroutine { id: String, request: String ->
      val session = withContext(Dispatchers.IO) { guarded {
        checkUi()
        val captured = queue().profiles.capture() ?: throw FilesFailure("profile_missing")
        val binding = FilesRunContext.webdav(context()).binding
        val ticket = UUID.fromString(request)
        lateinit var current: AndroidSmbFilesRestore
        current = AndroidSmbFilesRestore(context(), queue().journal, queue().profiles, captured, queue().lan, binding, ticket) {
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
    AsyncFunction("restoreSmbPhotos") Coroutine { id: String, request: String ->
      val session = withContext(Dispatchers.IO) { guarded {
        checkUi()
        val captured = queue().profiles.capture() ?: throw FilesFailure("profile_missing")
        val binding = FilesRunContext.webdav(context()).binding
        val ticket = UUID.fromString(request)
        lateinit var current: AndroidSmbPhotosRestore
        current = AndroidSmbPhotosRestore(context(), queue().journal, queue().profiles, captured, queue().lan, binding, ticket) {
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
    AsyncFunction("cancelSmbRestore") { request: String -> guarded { cancelRestore(UUID.fromString(request)) } }
  }
}
