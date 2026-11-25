package com.kloda.sync

import android.content.Context

// Step18B/5 (ADR0028 §5): the publication state machine stays the DAV one; each destination kind supplies only
// its create-only transport. `inspect` answers "missing", "match" or "mismatch" from Kloda's own SHA-256.
// `download` (18B/5r) streams a published file into `receive`; the caller compares the reply's SHA-256/size.
internal interface AndroidBackupTransport {
  fun inspect(path: String, job: WebDavUpload): String
  fun upload(path: String, job: WebDavUpload)
  fun move(from: String, to: String)
  fun download(path: String, job: WebDavUpload, receive: (ByteArray, Int) -> Unit): WebDavReply
  // 29/3: direct children of a folder under the destination root; a missing folder has none.
  fun list(folder: String): List<RemoteChild>
  fun cancel()
}
internal data class RemoteChild(val name: String, val folder: Boolean)

// One queue destination: a DAV profile (original WebDAV entry or an added slot) or an OAuth profile whose
// provider has an upload adapter. Only Dropbox has one so far (user decision 2026-11-03).
internal sealed class AndroidCloudTarget {
  data class Dav(val profile: AndroidWebDavProfile) : AndroidCloudTarget()
  data class OAuth(val profile: AndroidOAuthProfile) : AndroidCloudTarget()
  val kind: String get() = when (this) { is Dav -> profile.provider ?: "webdav"; is OAuth -> profile.provider }
  val revision: String get() = when (this) { is Dav -> profile.revision; is OAuth -> profile.revision }
  fun targetId(): String = when (this) { is Dav -> profile.targetId(); is OAuth -> profile.targetId() }
  fun sameBinding(other: AndroidCloudTarget?): Boolean = when (this) {
    is Dav -> this == other
    is OAuth -> other is OAuth && profile.revision == other.profile.revision && profile.provider == other.profile.provider &&
      profile.accountId == other.profile.accountId && profile.targetPath == other.profile.targetPath &&
      profile.expiresAt == other.profile.expiresAt && profile.accountName == other.profile.accountName
  }
  fun transport(context: Context, snapshots: AndroidFilesSnapshots, check: () -> Unit): AndroidBackupTransport = when (this) {
    is Dav -> AndroidWebDavTransport(context, profile, snapshots, check)
    is OAuth -> when (profile.provider) {
      "dropbox" -> AndroidDropboxTransport(context, profile, snapshots, check)
      "onedrive" -> AndroidOneDriveTransport(context, profile, snapshots, check)
      "yandex" -> AndroidYandexTransport(context, profile, snapshots, check)
      else -> throw FilesFailure("destination_unsupported")
    }
  }
  companion object { val OAUTH_KINDS = setOf("dropbox", "onedrive", "yandex") }
}
