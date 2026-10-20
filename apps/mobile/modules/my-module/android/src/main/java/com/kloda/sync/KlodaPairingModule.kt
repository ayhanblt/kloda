package com.kloda.sync

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.CancellationException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/** Managed callers receive opaque controls and sanitized observed state only. */
class KlodaPairingModule : Module() {
    private val ownerLock = Any()
    private data class OwnedPlatform(val id: Long, val platform: KlodaPairingPlatform)
    private var owner: OwnedPlatform? = null
    @Volatile private var destroyed = false
    @Volatile private var files: AndroidFilesQueue? = null
    @Volatile private var foreground = false
    @Volatile private var restore: AndroidOwnRestore? = null
    @Volatile private var photosRestore: AndroidPhotosSession? = null
    private val photosRequests = PhotosRestoreRequests()

    private fun activityResumed(): Boolean =
        (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true

    override fun definition() = ModuleDefinition {
        lateinit var destinationPicker: AppContextActivityResultLauncher<RestoreDestinationInput, android.net.Uri?>
        RegisterActivityContracts { destinationPicker = registerForActivityResult(RestoreDestinationContract()) }
        Name("KlodaPairing")
        OnCreate { synchronized(ownerLock) {
            foreground = activityResumed()
            appContext.reactContext?.applicationContext?.let { runCatching { AndroidOwnRestore.cleanup(it) } }
        } }
        OnActivityEntersForeground { synchronized(ownerLock) { if (!destroyed) foreground = true } }
        OnActivityEntersBackground {
            foreground = false; files?.requestPause(); restore?.pause(false); photosRestore?.pause()
        }
        OnActivityDestroys {
            foreground = false; files?.requestPause(); restore?.pause(); photosRestore?.pause(); photosRequests.cancel()
        }
        AsyncFunction("runFiles") { record: String -> guarded {
            reference(record)
            synchronized(ownerLock) {
                if (restore != null || photosRestore != null || photosRequests.active) fail("backup_busy")
                if (destroyed || !foreground || !activityResumed()) fail("paused")
                val id = currentOwner()
                val status = JSONObject(KlodaPairingJni.status(id))
                if (status.optString("phase") != "complete" || status.optString("recordId") != record ||
                    status.optBoolean("repairRequired", true)) fail("denied")
                filesQueue().start(record, id)
            }
        } }
        AsyncFunction("rebackupFile") { record: String, job: String -> guarded {
            reference(record); reference(job)
            synchronized(ownerLock) {
                if (restore != null || photosRestore != null || photosRequests.active) fail("backup_busy")
                if (destroyed || !foreground || !activityResumed()) fail("paused")
                val id = transferOwner(record)
                filesQueue().start(record, id, job)
            }
        } }
        AsyncFunction("queueStatus") { guarded { synchronized(ownerLock) { filesQueue().status() } } }
        AsyncFunction("pauseFiles") { guarded { synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); filesQueue().pause() } } }
        AsyncFunction("cancelRestore") { guarded { synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel() }; true } }
        AsyncFunction("listBackups") { record: String, after: String? -> guarded {
            reference(record); after?.let(::reference)
            val id = synchronized(ownerLock) { transferOwner(record) }
            val response = KlodaPairingJni.transfer(id, record,
                JSONObject().put("kind", "list").apply { after?.let { put("after", it) } }.toString(), -1)
            synchronized(ownerLock) { if (owner?.id != id) fail("cancelled"); transferOwner(record) }
            AndroidOwnBackups.list(response, after)
        } }
        AsyncFunction("photoImportStatus") { guarded {
            AndroidPhotosRestore.status(appContext.reactContext?.applicationContext ?: fail("native_unsupported"))
        } }
        AsyncFunction("restorePhotos") Coroutine { record: String, operation: String?, sha256: String?, size: String?, name: String? ->
            val token = guarded { synchronized(ownerLock) {
                if (restore != null || photosRestore != null) fail("backup_busy")
                transferOwner(record)
                photosRequests.reserve()
            } }
            var transfer: AndroidPhotosSession? = null
            try {
                val context = appContext.reactContext?.applicationContext ?: fail("native_unsupported")
                if (!requestPhotosRestorePermissions(context, appContext)) fail("photo_permission_lost")
                val session = withContext(Dispatchers.IO) { guarded { beginPhotosRestore(record, token) } }
                transfer = session
                withContext(Dispatchers.IO) { guarded {
                    if (operation == null && sha256 == null && size == null && name == null) session.restoreAll()
                    else session.restore(operation ?: fail("manifest_invalid"), sha256 ?: fail("manifest_invalid"),
                        size ?: fail("manifest_invalid"), name ?: fail("manifest_invalid"))
                } }
            } finally { synchronized(ownerLock) {
                if (photosRestore === transfer) photosRestore = null
                photosRequests.release(token)
            } }
        }
        AsyncFunction("restoreBackup") Coroutine { record: String, operation: String, sha256: String, size: String, name: String ->
            val transfer = withContext(Dispatchers.IO) { guarded { beginRestore(record, operation, sha256, size, name) } }
            var selected: android.net.Uri? = null
            var started = false
            try {
                guarded { transfer.check() }
                val uri = destinationPicker.launch(RestoreDestinationInput(transfer.backup.name)) ?: fail("cancelled")
                selected = uri
                awaitRestoreForeground(appContext.currentActivity)
                withContext(Dispatchers.IO) { guarded {
                    transfer.choosing = false
                    started = true
                    transfer.restore(uri).also { synchronized(ownerLock) { transfer.check() } }
                } }
            } catch (error: Exception) {
                if (!started) selected?.let { uri -> withContext(NonCancellable + Dispatchers.IO) { guarded { transfer.discardEmpty(uri) } } }
                guarded { if (error is CancellationException) fail("cancelled"); throw error }
            } finally { synchronized(ownerLock) { if (restore === transfer) restore = null } }
        }
        AsyncFunction("status") { invoke { KlodaPairingJni.status(it) } }
        AsyncFunction("scan") { wire: String ->
            if (wire.length > 512 || wire.any { it.code > 127 }) fail("invalid_qr")
            synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); invoke { KlodaPairingJni.scan(it, wire) } }
        }
        AsyncFunction("approve") { operation: String, generation: String ->
            references(operation, generation)
            synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); invoke { KlodaPairingJni.approve(it, operation, generation) } }
        }
        AsyncFunction("deny") { operation: String, generation: String ->
            references(operation, generation)
            synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); invoke { KlodaPairingJni.deny(it, operation, generation) } }
        }
        AsyncFunction("cancel") { operation: String ->
            reference(operation)
            synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); files?.pause(); invoke { KlodaPairingJni.cancel(it, operation) } }
        }
        AsyncFunction("resume") { record: String ->
            reference(record)
            synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); invoke { KlodaPairingJni.resume(it, record) } }
        }
        AsyncFunction("removePairing") { record: String, online: Boolean ->
            reference(record)
            synchronized(ownerLock) { restore?.pause(); photosRestore?.pause(); photosRequests.cancel(); files?.pause(); invoke { KlodaPairingJni.removePairing(it, record, online) } }
        }
        AsyncFunction("close") { closeOwner() }
        OnDestroy {
            synchronized(ownerLock) {
                destroyed = true
                foreground = false
                try { closeOwner() } finally { files?.close(); files = null }
            }
        }
    }

    private fun currentOwner(): Long = synchronized(ownerLock) {
        if (destroyed) fail("cancelled")
        owner?.id ?: run {
            val context = appContext.reactContext?.applicationContext ?: fail("native_unsupported")
            // Each reopened owner receives a new observer. Retain its platform until
            // native close joins the worker, including any synchronous hardware callback.
            val platform = KlodaPairingPlatform(context)
            val id = try {
                KlodaPairingJni.open(platform)
            } catch (error: Throwable) {
                // A failed JNI open has joined any worker it created. This also covers
                // a missing native library, before JNI can take a global reference.
                try { platform.nativeClose("") }
                catch (_: Exception) { fail("outcome_unknown") }
                throw error
            }
            owner = OwnedPlatform(id, platform)
            id
        }
    }
    private fun invoke(action: (Long) -> String): Map<String, Any> = guarded { synchronized(ownerLock) {
        val value = JSONObject(action(currentOwner()))
        val fields = setOf("phase", "operationId", "candidateGeneration", "peerFingerprint",
            "remainingMs", "recordId", "repairRequired", "errorCode", "hardwareClass")
        buildMap {
            for (field in fields) if (value.has(field) && !value.isNull(field)) put(field, value.get(field))
            value.optJSONObject("unpairResult")?.let { result ->
                put("unpairResult", buildMap<String, Any> {
                    put("state", result.getString("state"))
                    if (result.has("errorCode") && !result.isNull("errorCode")) {
                        put("errorCode", result.getString("errorCode"))
                    }
                })
            }
        }
    } }
    private fun transferOwner(record: String): Long {
        if (destroyed || !foreground || !activityResumed()) fail("paused")
        val id = currentOwner()
        val status = JSONObject(KlodaPairingJni.status(id))
        if (status.optString("phase") != "complete" || status.optString("recordId") != record ||
            status.optBoolean("repairRequired", true)) fail("denied")
        return id
    }
    private fun beginRestore(record: String, operation: String, sha256: String, size: String, name: String): AndroidOwnRestore = synchronized(ownerLock) {
        reference(record); reference(operation)
        if (restore != null || photosRestore != null || photosRequests.active) fail("backup_busy")
        val id = transferOwner(record)
        files?.pause()
        val backup = AndroidOwnBackups.status(KlodaPairingJni.transfer(id, record,
            JSONObject().put("kind", "status").put("id", operation).toString(), -1), operation)
        if (backup.sha256 != sha256 || backup.size.toString() != size || backup.name != name) fail("conflict")
        lateinit var transfer: AndroidOwnRestore
        transfer = AndroidOwnRestore(appContext.reactContext?.applicationContext ?: fail("native_unsupported"), backup,
            { synchronized(ownerLock) {
                if (restore !== transfer || owner?.id != id) throw FilesFailure("cancelled")
                if (destroyed || !foreground || !activityResumed()) throw FilesFailure("paused")
            } },
            { command, descriptor ->
                synchronized(ownerLock) { transfer.check() }
                val response = KlodaPairingJni.transfer(id, record, command, descriptor)
                synchronized(ownerLock) { transfer.check() }
                response
            })
        restore = transfer
        transfer
    }
    private fun beginPhotosRestore(record: String, token: Long): AndroidPhotosSession = synchronized(ownerLock) {
        photosRequests.check(token)
        reference(record)
        if (restore != null || photosRestore != null) fail("backup_busy")
        val id = transferOwner(record)
        files?.pause()
        lateinit var session: AndroidPhotosSession
        session = AndroidPhotosSession(appContext.reactContext?.applicationContext ?: fail("native_unsupported"),
            { synchronized(ownerLock) {
                if (photosRestore !== session || owner?.id != id) throw FilesFailure("cancelled")
                if (destroyed || !foreground || !activityResumed()) throw FilesFailure("paused")
            } }, { command, descriptor ->
                session.check()
                val response = KlodaPairingJni.transfer(id, record, command, descriptor)
                session.check()
                response
            })
        photosRestore = session
        session
    }
    private fun filesQueue(): AndroidFilesQueue {
        if (destroyed) fail("cancelled")
        return files ?: AndroidFilesQueue(appContext.reactContext?.applicationContext ?: fail("queue_unavailable")) {
            !destroyed && foreground && activityResumed()
        }
            .also { files = it }
    }
    private fun closeOwner() = guarded {
        synchronized(ownerLock) {
            restore?.pause(); photosRestore?.pause(); photosRequests.cancel()
            try { files?.pause() } finally {
                owner?.let { owned ->
                    try { KlodaPairingJni.close(owned.id) } finally { owner = null }
                }
            }
        }
    }
    private fun reference(value: String) {
        if (value.length != 22 || value.any { !(it.isLetterOrDigit() && it.code < 128 || it == '-' || it == '_') }) fail("candidate_stale")
    }
    private fun references(operation: String, generation: String) {
        reference(operation)
        if (generation.length !in 1..20 || generation.any { it !in '0'..'9' }) fail("candidate_stale")
    }
    private fun <T> guarded(action: () -> T): T = try { action() }
    catch (error: CodedException) { throw error }
    catch (error: FilesFailure) { fail(error.code) }
    catch (_: UnsatisfiedLinkError) { fail("native_unsupported") }
    catch (error: Exception) { fail(error.message?.takeIf { it in codes } ?: "outcome_unknown") }
    private fun fail(code: String): Nothing = throw CodedException(code, code, null)

    private val codes = AndroidFilesTransfer.codes + setOf("source_permission_lost", "source_changed",
        "snapshot_unavailable", "local_storage_full", "queue_unavailable", "paused", "destination_unavailable",
        "destination_permission_lost", "destination_not_empty", "restore_cleanup_failed", "manifest_invalid",
        "photo_permission_lost", "photo_review_required")
}

internal object KlodaPairingJni {
    init { System.loadLibrary("kloda_pairing_native") }
    @JvmStatic external fun open(platform: KlodaPairingPlatform): Long
    @JvmStatic external fun status(owner: Long): String
    @JvmStatic external fun scan(owner: Long, wire: String): String
    @JvmStatic external fun approve(owner: Long, operation: String, generation: String): String
    @JvmStatic external fun deny(owner: Long, operation: String, generation: String): String
    @JvmStatic external fun cancel(owner: Long, operation: String): String
    @JvmStatic external fun resume(owner: Long, record: String): String
    @JvmStatic external fun removePairing(owner: Long, record: String, online: Boolean): String
    @JvmStatic external fun transfer(owner: Long, record: String, command: String, descriptor: Int): String
    @JvmStatic external fun close(owner: Long)
}
