package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor
import java.util.UUID

internal data class SftpProfileCapture(val profile: AndroidSftpProfile, val context: String)

// Native-only custody owner; source and OS-route authority are separate mandatory checks.
internal class AndroidSftpProfiles(context: Context, private val journal: AndroidSftpJournal) {
  private val vault = AndroidSftpVault(context)
  fun save(target: SftpTarget, password: String): AndroidSftpProfile = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = AndroidSftpProfile(target.copy(profileGeneration = UUID.randomUUID().toString(),
      credentialGeneration = UUID.randomUUID().toString()), password)
    profile.validate()
    vault.read() // Do not overwrite unreadable custody or rotate its known context.
    journal.prepareProfile(profile.target)
    vault.write(profile)
    journal.confirmProfile(profile.target)
    profile
  }
  fun capture(): SftpProfileCapture? = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = vault.read()
    if (profile == null) {
      if (journal.hasProfile()) throw SftpFailure("storage_failure")
      return@synchronized null
    }
    if (!journal.profileCurrent(profile.target)) throw SftpFailure("context_changed")
    SftpProfileCapture(profile, journal.context())
  }
  fun current(value: SftpProfileCapture): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    journal.context() == value.context && journal.profileCurrent(value.profile.target) && vault.read() == value.profile
  }
  fun publishBound(job: SftpUpload, snapshot: ParcelFileDescriptor, socket: ParcelFileDescriptor,
    currentSourceAndRoute: () -> Boolean, completedSource: () -> Boolean = currentSourceAndRoute) = socket.use {
    val captured = capture() ?: throw SftpFailure("profile_missing")
    if (job.target != captured.profile.target || job.context != captured.context) throw SftpFailure("context_changed")
    AndroidSftpPublication.runBound(journal, job, snapshot, captured.profile.password, it,
      current = { current(captured) && currentSourceAndRoute() },
      completed = { current(captured) && completedSource() })
  }
}
