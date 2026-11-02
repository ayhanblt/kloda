package com.kloda.sync

import android.content.Context
import android.net.Uri
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import java.util.UUID
import java.io.Closeable
import java.io.InputStream
import java.io.FilterInputStream

internal class AndroidSftpFilesRestore(private val context: Context, private val journal: AndroidSftpJournal,
  private val profiles: AndroidSftpProfiles, private val captured: SftpProfileCapture, private val lan: AndroidSftpLan,
  private val binding: String, override val ticket: UUID, private val owner: () -> Unit) : AndroidSftpRestoreTask {
  private val commitLock = Any()
  @Volatile override var choosing = true
  @Volatile private var cancelled = false
  @Volatile private var transfer: AndroidSftpDownload? = null
  @Volatile private var signal: CancellationSignal? = null
  @Volatile private var stream: Closeable? = null
  override fun pause(includePicker: Boolean) {
    if (!includePicker && choosing) return
    synchronized(commitLock) { cancelled = true }; signal?.cancel(); transfer?.cancel(); runCatching { stream?.close() }
  }
  private fun check() {
    if (cancelled) throw FilesFailure("cancelled")
    owner()
    synchronized(AndroidSyncJournal.sourceLock) {
      if (!profiles.current(captured) || FilesRunContext.webdav(context).binding != binding) throw FilesFailure("settings_changed")
    }
  }
  fun restore(treeReference: String, id: String): Map<String, String> {
    check()
    val tree = Uri.parse(treeReference)
    val resolver = context.contentResolver
    if (tree.scheme != "content" || !DocumentsContract.isTreeUri(tree) || !resolver.persistedUriPermissions.any { it.uri == tree && it.isReadPermission && it.isWritePermission }) throw FilesFailure("destination_permission_lost")
    return run {
      val history = AndroidSftpRestoreJournal(journal.database)
      val snapshots = AndroidFilesSnapshots(context, sftp = true, checkPaused = ::check)
      val download = AndroidSftpDownload(context, journal, profiles, lan, snapshots, ::check)
      transfer = download
      val receipt = download.receipt(id)
      if (receipt.kind != "file") throw FilesFailure("manifest_invalid")
      val previous = history.latest(captured.profile.target.archiveId(), id)
      if (previous?.directory == treeReference) {
        // A provider URI has no stable inode/generation proof after process loss: never resume unknown writes.
        if (previous.phase != "completed" || previous.document == null) throw FilesFailure("review_required")
        val uri = member(treeReference, previous.document)
        read(uri) { verify(it, FilesDigest(receipt.sha256, receipt.size)) }
        check(); return@run mapOf("state" to "completed", "id" to id, "name" to displayName(uri))
      }
      val snapshot = download.stage(id)
      var intent = SftpFileRestore(UUID.randomUUID().toString(), captured.profile.target.archiveId(), id, receipt.name ?: receipt.relativePath.substringAfterLast('/'), receipt.sha256, receipt.size, snapshot.id, treeReference)
      history.save(intent)
      fun save(phase: String) = synchronized(AndroidSyncJournal.sourceLock) { synchronized(commitLock) {
        check(); intent = intent.copy(phase = phase); history.save(intent)
      } }
      try {
        save("creating")
        val parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        check()
        val created = DocumentsContract.createDocument(resolver, parent, "application/octet-stream", intent.name) ?: throw FilesFailure("destination_unavailable")
        if (created.authority != tree.authority) throw FilesFailure("destination_unavailable")
        val scoped = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getDocumentId(created))
        // Retain the returned creation URI before touching any byte; never delete/adopt an uncertain result.
        intent = intent.copy(document = scoped.toString(), phase = "created"); history.save(intent)
        val uri = member(treeReference, scoped.toString())
        read(uri) { if (it.read() != -1) throw FilesFailure("destination_not_empty") }
        save("writing")
        provider(uri, "wa") { descriptor ->
          if (descriptor.statSize > 0) throw FilesFailure("destination_not_empty")
          ParcelFileDescriptor.AutoCloseOutputStream(descriptor).use { output ->
            stream = output
            try {
              snapshots.open(snapshot.id, snapshot.digest.size).use { source ->
                ParcelFileDescriptor.AutoCloseInputStream(source).use { input ->
                  val bytes = ByteArray(65536)
                  while (true) { check(); val count = input.read(bytes); if (count < 0) break; output.write(bytes, 0, count) }
                }
              }
              check(); output.flush(); output.fd.sync(); descriptor.checkError()
            } finally { if (stream === output) stream = null }
          }
        }
        read(uri) { verify(it, snapshot.digest) }
        save("completed"); snapshots.discard(snapshot)
        mapOf("state" to "completed", "id" to id, "name" to displayName(uri))
      } catch (error: Exception) {
        if (intent.phase != "completed") history.save(intent.copy(phase = "review_required", error = when (error) {
          is FilesFailure -> error.code
          is SftpFailure -> error.code
          is SecurityException -> "destination_permission_lost"
          else -> if (isLocalStorageFull(error)) "local_storage_full" else "destination_unavailable"
        }))
        throw error
      } finally { download.cancel(); transfer = null }
    }
  }
  private fun member(tree: String, reference: String): Uri = try {
    AndroidSafSourceScanner(context.contentResolver).checkedDocument(tree, reference, check = ::check)
  } catch (error: FilesFailure) { throw FilesFailure(if (error.code == "source_permission_lost") "destination_permission_lost" else error.code) }
  private fun displayName(uri: Uri): String = context.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use {
    if (!it.moveToFirst()) throw FilesFailure("destination_unavailable")
    it.getString(0).also { name -> if (name.isNullOrEmpty() || name.toByteArray().size > 255 || name in setOf(".", "..") || name.any { char -> char == '/' || char == '\\' || char.isISOControl() }) throw FilesFailure("destination_unavailable") }
  } ?: throw FilesFailure("destination_unavailable")
  private fun verify(input: InputStream, expected: FilesDigest) {
    var count = 0L
    val bounded = object : FilterInputStream(input) {
      override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
        val remaining = expected.size - count
        val read = super.read(bytes, offset, if (remaining >= length) length else remaining.toInt() + 1)
        if (read > 0) { if (read > expected.size - count) throw FilesFailure("hash_mismatch"); count += read }
        return read
      }
    }
    if (AndroidFilesSnapshots.digest(bounded, ::check) != expected) throw FilesFailure("hash_mismatch")
  }
  private fun read(uri: Uri, action: (InputStream) -> Unit) = provider(uri, "r") { descriptor ->
    ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { input ->
      stream = input
      try { check(); action(input); descriptor.checkError() } finally { if (stream === input) stream = null }
    }
  }
  private fun <T> provider(uri: Uri, mode: String, action: (ParcelFileDescriptor) -> T): T {
    val cancellation = CancellationSignal(); signal = cancellation
    try { check(); return (context.contentResolver.openFileDescriptor(uri, mode, cancellation) ?: throw FilesFailure("destination_unavailable")).use(action) }
    finally { if (signal === cancellation) signal = null }
  }
}
