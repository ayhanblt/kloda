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

class KlodaSftpModule : Module() {
  private val token = Any()
  private var destroyed = false
  private val restoreLock = Any()
  @Volatile private var restore: AndroidSftpRestoreTask? = null
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
  @Volatile private var reviews: AndroidSftpReview? = null
  private fun review(): AndroidSftpReview = synchronized(reviewLock) {
    reviews ?: AndroidSftpReview(context(), queue()) { !destroyed && resumed() && AndroidSftpRuntime.interactive(token) }.also { reviews = it }
  }
  private fun context() = appContext.reactContext?.applicationContext ?: throw FilesFailure("native_unsupported")
  private fun resumed() = (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
  private fun checkUi() { if (destroyed || !resumed() || !AndroidSftpRuntime.interactive(token)) throw FilesFailure("candidate_stale") }
  private fun queue() = AndroidSftpRuntime.queue(context())
  private fun <T> guarded(action: () -> T): T = try { action() } catch (error: Exception) {
    val code = when {
      error is SftpFailure -> error.code
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
    RegisterActivityContracts { restorePicker = registerForActivityResult(DirectoryPickerContract(this@KlodaSftpModule, true)) }
    Name("KlodaSftp")
    OnCreate { AndroidSftpRuntime.attach(token, resumed()); AndroidSftpScheduler.reconcileAsync(context()) }
    OnActivityEntersForeground { if (!destroyed) { AndroidSftpRuntime.foreground(token, true); AndroidSftpScheduler.reconcileAsync(context()) } }
    OnActivityEntersBackground { cancelRestore(includePicker = false); reviews?.cancel(); AndroidSftpRuntime.foreground(token, false) }
    OnActivityDestroys { cancelRestore(); reviews?.cancel(); AndroidSftpRuntime.foreground(token, false) }
    OnDestroy { destroyed = true; cancelRestore(); reviews?.cancel(); AndroidSftpRuntime.detach(token) }
    AsyncFunction("sftpStatus") { guarded { if (!AndroidSftpRuntime.supported()) mapOf("supported" to false, "configured" to false, "enabled" to false, "running" to false) else queue().status() + mapOf("supported" to true) + (AndroidSftpScheduler.error(context())?.let { mapOf("automaticError" to it) } ?: emptyMap()) } }
    AsyncFunction("configureSftp") { address: String, port: Int, fingerprint: String, root: String, username: String, password: String -> guarded {
      checkUi(); cancelRestore(); reviews?.cancel(); queue().configure(SftpTarget(address, port, fingerprint, root, username, "native", "native"), password); AndroidSftpScheduler.reconcileAsync(context()); queue().status()
    } }
    AsyncFunction("enableSftp") { guarded { checkUi(); queue().enable(); AndroidSftpScheduler.reconcileAsync(context()); queue().status() } }
    AsyncFunction("disableSftp") { guarded { checkUi(); cancelRestore(); reviews?.cancel(); queue().disable(); AndroidSftpScheduler.reconcileAsync(context()); queue().status() } }
    AsyncFunction("runSftp") { guarded {
      checkUi(); queue().start()
    } }
    AsyncFunction("pauseSftp") { guarded { checkUi(); queue().pause("target_pause"); queue().status() } }
    AsyncFunction("sftpIssues") { after: String -> guarded { checkUi(); AndroidSftpBackups.list(queue(), after, true) } }
    AsyncFunction("reviewSftp") { id: String, request: String -> guarded {
      checkUi(); review().perform(id, UUID.fromString(request))
    } }
    AsyncFunction("cancelSftpReview") { request: String -> guarded { review().cancel(UUID.fromString(request)) } }
    AsyncFunction("sftpBackups") { after: String -> guarded { checkUi(); AndroidSftpBackups.list(queue(), after) } }
    AsyncFunction("restoreSftpFile") Coroutine { id: String, request: String ->
      val session = withContext(Dispatchers.IO) { guarded {
        checkUi()
        val captured = queue().profiles.capture() ?: throw FilesFailure("profile_missing")
        val binding = FilesRunContext.webdav(context()).binding
        val ticket = UUID.fromString(request)
        lateinit var current: AndroidSftpFilesRestore
        current = AndroidSftpFilesRestore(context(), queue().journal, queue().profiles, captured, queue().lan, binding, ticket) {
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
    AsyncFunction("restoreSftpPhotos") Coroutine { id: String, request: String ->
      val session = withContext(Dispatchers.IO) { guarded {
        checkUi()
        val captured = queue().profiles.capture() ?: throw FilesFailure("profile_missing")
        val binding = FilesRunContext.webdav(context()).binding
        val ticket = UUID.fromString(request)
        lateinit var current: AndroidSftpPhotosRestore
        current = AndroidSftpPhotosRestore(context(), queue().journal, queue().profiles, captured, queue().lan, binding, ticket) {
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
    AsyncFunction("cancelSftpRestore") { request: String -> guarded { cancelRestore(UUID.fromString(request)) } }
  }
}
