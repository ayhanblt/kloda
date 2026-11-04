package com.kloda.sync

import android.content.Context
import java.util.UUID

internal data class S3Capture(val profile: AndroidS3Profile, val context: String)
internal class AndroidS3Profiles(context: Context, val journal: AndroidS3Journal) {
  private val vault = AndroidS3Vault(context, journal.provider)
  fun save(target: S3Target, accessKey: String, secret: String, token: String?, check: () -> Unit) = synchronized(AndroidSyncJournal.sourceLock) {
    val target = target.copy(accountBinding = S3Target.hash(accessKey), profileGeneration = UUID.randomUUID().toString(), credentialGeneration = UUID.randomUUID().toString())
    val profile = AndroidS3Profile(target, accessKey, secret, token)
    check(); profile.validate(); vault.read()
    journal.prepareProfile(target); check(); vault.write(profile); check(); journal.confirmProfile(target)
  }
  fun capture(): S3Capture? = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = vault.read()
    if (profile == null) { if (journal.hasProfile()) throw S3Failure("storage_failure"); return@synchronized null }
    if (!journal.profileCurrent(profile.target)) throw S3Failure("context_changed")
    S3Capture(profile, journal.context())
  }
  fun current(value: S3Capture): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    journal.context() == value.context && journal.profileCurrent(value.profile.target) && vault.read() == value.profile
  }
}
