package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor
import java.util.UUID

internal data class SmbProfileCapture(val profile: AndroidSmbProfile, val context: String)

// Native-only custody owner; source and OS-route authority are separate mandatory checks.
internal class AndroidSmbProfiles(context: Context, private val journal: AndroidSmbJournal) {
  private val vault = AndroidSmbVault(context)
  fun save(target: SmbTarget, password: String): AndroidSmbProfile = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = AndroidSmbProfile(target.copy(profileGeneration = UUID.randomUUID().toString(),
      credentialGeneration = UUID.randomUUID().toString()), password)
    profile.validate()
    vault.read() // Do not overwrite unreadable custody or rotate its known context.
    journal.prepareProfile(profile.target)
    vault.write(profile)
    journal.confirmProfile(profile.target)
    profile
  }
  fun capture(): SmbProfileCapture? = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = vault.read()
    if (profile == null) {
      if (journal.hasProfile()) throw SmbFailure("storage_failure")
      return@synchronized null
    }
    if (!journal.profileCurrent(profile.target)) throw SmbFailure("context_changed")
    SmbProfileCapture(profile, journal.context())
  }
  fun current(value: SmbProfileCapture): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    journal.context() == value.context && journal.profileCurrent(value.profile.target) && vault.read() == value.profile
  }
  fun publishBound(job: SmbUpload, snapshot: ParcelFileDescriptor, socket: ParcelFileDescriptor,
    currentSourceAndRoute: () -> Boolean, completedSource: () -> Boolean = currentSourceAndRoute) = socket.use {
    val captured = capture() ?: throw SmbFailure("profile_missing")
    if (job.target != captured.profile.target || job.context != captured.context) throw SmbFailure("context_changed")
    AndroidSmbPublication.runBound(journal, job, snapshot, captured.profile.password, it,
      current = { current(captured) && currentSourceAndRoute() },
      completed = { current(captured) && completedSource() })
  }
}
