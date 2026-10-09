package com.kloda.sync

import android.content.Context
import android.app.KeyguardManager
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/** Native JNI object only: this is not an Expo module or a JS signing API. */
internal class KlodaPairingPlatform(context: Context) {
    private val applicationContext = context.applicationContext
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private var alias: String? = null
    private var privateKey: PrivateKey? = null
    private val routes = NativeLanRoutes(applicationContext)

    fun nativeRouteSnapshot(peer: String): String = routes.snapshot(peer)
    fun nativeDirectory(unused: String): String {
        require(unused.isEmpty())
        return java.io.File(applicationContext.noBackupFilesDir, "pairing").absolutePath
    }
    @Synchronized fun nativeClose(unused: String): String {
        require(unused.isEmpty())
        try {
            routes.close()
        } finally {
            privateKey = null
            alias = null
        }
        return "closed"
    }

    private fun requireUnlocked() {
        val manager = applicationContext.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            ?: throw IllegalStateException("identity_unavailable")
        check(!manager.isDeviceLocked) { "identity_unavailable" }
    }

    @Synchronized fun nativeCreateIdentity(tag: String): String = open(tag, true)
    @Synchronized fun nativeOpenIdentity(tag: String): String = open(tag, false)

    private fun open(tag: String, create: Boolean): String {
        if (!tag.matches(Regex("com\\.kloda\\.pairing\\.v1\\.[0-9a-f]{64}"))) return "identity_unavailable"
        if (alias != null && alias != tag) return "identity_unavailable"
        return try {
            requireUnlocked()
            if (!store.containsAlias(tag)) {
                if (!create) return "continuity_lost"
                generate(tag)
            }
            val key = store.getKey(tag, null) as? PrivateKey ?: return "identity_unavailable"
            val info = KeyFactory.getInstance("EC", "AndroidKeyStore").getKeySpec(key, KeyInfo::class.java)
            if (info.keySize != 256 || info.origin != KeyProperties.ORIGIN_GENERATED ||
                info.purposes != KeyProperties.PURPOSE_SIGN || info.isUserAuthenticationRequired ||
                info.digests.toSet() != setOf(KeyProperties.DIGEST_SHA256)) return "native_unsupported"
            val hardware = if (Build.VERSION.SDK_INT >= 31) {
                when (info.securityLevel) {
                    KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
                    KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "hardware_tee"
                    else -> return "native_unsupported"
                }
            } else {
                @Suppress("DEPRECATION")
                if (!info.isInsideSecureHardware) return "native_unsupported"
                // Before API31 KeyInfo cannot distinguish TEE from secure element.
                "secure_hardware"
            }
            val public = store.getCertificate(tag)?.publicKey as? ECPublicKey ?: return "identity_unavailable"
            val expected = java.security.AlgorithmParameters.getInstance("EC").apply {
                init(ECGenParameterSpec("secp256r1"))
            }.getParameterSpec(java.security.spec.ECParameterSpec::class.java)
            if (public.params.order != expected.order || public.params.generator != expected.generator ||
                public.params.curve != expected.curve || public.params.cofactor != expected.cofactor) return "native_unsupported"
            alias = tag
            privateKey = key
            hardware
        } catch (_: Exception) { "identity_unavailable" }
    }

    private fun generate(tag: String) {
        if (Build.VERSION.SDK_INT >= 28 && applicationContext.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)) {
            try { generateKey(tag, true); return }
            catch (_: StrongBoxUnavailableException) {
                // Only creation may choose another hardware implementation. Never replace a key.
                if (store.containsAlias(tag)) throw IllegalStateException("identity_unavailable")
            }
        }
        generateKey(tag, false)
    }

    private fun generateKey(tag: String, strongBox: Boolean) {
        val builder = KeyGenParameterSpec.Builder(tag, KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)
        if (Build.VERSION.SDK_INT >= 28) {
            builder.setIsStrongBoxBacked(strongBox)
            builder.setUnlockedDeviceRequired(true)
        }
        KeyPairGenerator.getInstance("EC", "AndroidKeyStore").apply { initialize(builder.build()) }.generateKeyPair()
    }

    @Synchronized fun nativePublicSpki(unused: ByteArray): ByteArray {
        require(unused.isEmpty())
        val tag = alias ?: throw IllegalStateException("identity_unavailable")
        return store.getCertificate(tag)?.publicKey?.encoded ?: throw IllegalStateException("identity_unavailable")
    }

    @Synchronized fun nativeSign(message: ByteArray): ByteArray {
        require(message.size in 1..4096)
        requireUnlocked()
        val key = privateKey ?: throw IllegalStateException("identity_unavailable")
        return Signature.getInstance("SHA256withECDSA").run { initSign(key); update(message); sign() }
    }
}
