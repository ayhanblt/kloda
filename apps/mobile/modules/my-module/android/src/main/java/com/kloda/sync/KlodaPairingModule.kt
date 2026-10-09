package com.kloda.sync

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/** Managed callers receive opaque controls and sanitized observed state only. */
class KlodaPairingModule : Module() {
    private val ownerLock = Any()
    private data class OwnedPlatform(val id: Long, val platform: KlodaPairingPlatform)
    private var owner: OwnedPlatform? = null
    private var destroyed = false

    override fun definition() = ModuleDefinition {
        Name("KlodaPairing")
        AsyncFunction("status") { invoke { KlodaPairingJni.status(it) } }
        AsyncFunction("scan") { wire: String ->
            if (wire.length > 512 || wire.any { it.code > 127 }) fail("invalid_qr")
            invoke { KlodaPairingJni.scan(it, wire) }
        }
        AsyncFunction("approve") { operation: String, generation: String ->
            references(operation, generation)
            invoke { KlodaPairingJni.approve(it, operation, generation) }
        }
        AsyncFunction("deny") { operation: String, generation: String ->
            references(operation, generation)
            invoke { KlodaPairingJni.deny(it, operation, generation) }
        }
        AsyncFunction("cancel") { operation: String ->
            reference(operation)
            invoke { KlodaPairingJni.cancel(it, operation) }
        }
        AsyncFunction("resume") { record: String ->
            reference(record)
            invoke { KlodaPairingJni.resume(it, record) }
        }
        AsyncFunction("close") { closeOwner() }
        OnDestroy {
            synchronized(ownerLock) { destroyed = true }
            // Native ownership survives teardown until close has joined all callbacks.
            Thread({ runCatching { closeOwner() } }, "kloda-pairing-close").start()
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
    private fun invoke(action: (Long) -> String): Map<String, Any> = guarded {
        val value = JSONObject(action(currentOwner()))
        val fields = setOf("phase", "operationId", "candidateGeneration", "peerFingerprint",
            "remainingMs", "recordId", "repairRequired", "errorCode", "hardwareClass")
        buildMap {
            for (field in fields) if (value.has(field) && !value.isNull(field)) put(field, value.get(field))
        }
    }
    private fun closeOwner() = guarded {
        synchronized(ownerLock) {
            owner?.let { owned ->
                try { KlodaPairingJni.close(owned.id) } finally { owner = null }
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
    catch (_: UnsatisfiedLinkError) { fail("native_unsupported") }
    catch (error: Exception) { fail(error.message?.takeIf { it in codes } ?: "outcome_unknown") }
    private fun fail(code: String): Nothing = throw CodedException(code, code, null)

    private val codes = setOf("invalid_qr", "unsupported_version", "lan_unavailable", "native_unsupported",
        "identity_unavailable", "continuity_lost", "tls_rejected", "proof_rejected", "invitation_expired",
        "candidate_stale", "already_paired", "storage_failure", "connection_closed", "outcome_unknown", "cancelled", "revoked")
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
    @JvmStatic external fun close(owner: Long)
}
