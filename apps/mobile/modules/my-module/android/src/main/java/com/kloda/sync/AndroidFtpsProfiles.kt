package com.kloda.sync

import android.content.Context
import android.os.ParcelFileDescriptor
import java.util.UUID

internal data class FtpsProfileCapture(val profile: AndroidFtpsProfile, val context: String)

// Native-only custody owner; source and OS-route authority are separate mandatory checks.
internal class AndroidFtpsProfiles(context: Context, private val journal: AndroidFtpsJournal) {
  private val vault = AndroidFtpsVault(context)
  fun save(target: FtpsTarget, password: String): AndroidFtpsProfile = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = AndroidFtpsProfile(target.copy(profileGeneration = UUID.randomUUID().toString(),
      credentialGeneration = UUID.randomUUID().toString()), password)
    profile.validate()
    vault.read() // Do not overwrite unreadable custody or rotate its known context.
    journal.prepareProfile(profile.target)
    vault.write(profile)
    journal.confirmProfile(profile.target)
    profile
  }
  fun capture(): FtpsProfileCapture? = synchronized(AndroidSyncJournal.sourceLock) {
    val profile = vault.read()
    if (profile == null) {
      if (journal.hasProfile()) throw FtpsFailure("storage_failure")
      return@synchronized null
    }
    if (!journal.profileCurrent(profile.target)) throw FtpsFailure("context_changed")
    FtpsProfileCapture(profile, journal.context())
  }
  fun current(value: FtpsProfileCapture): Boolean = synchronized(AndroidSyncJournal.sourceLock) {
    journal.context() == value.context && journal.profileCurrent(value.profile.target) && vault.read() == value.profile
  }
  fun publishBound(job: FtpsUpload, snapshot: ParcelFileDescriptor, socket: ParcelFileDescriptor, connect: (String, Int) -> Int,
    currentSourceAndRoute: () -> Boolean, completedSource: () -> Boolean = currentSourceAndRoute) = socket.use {
    val captured = capture() ?: throw FtpsFailure("profile_missing")
    if (job.target != captured.profile.target || job.context != captured.context) throw FtpsFailure("context_changed")
    AndroidFtpsPublication.runBound(journal, job, snapshot, captured.profile.password, it, connect,
      current = { current(captured) && currentSourceAndRoute() },
      completed = { current(captured) && completedSource() })
  }
}
