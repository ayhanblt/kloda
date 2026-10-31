package com.kloda.sync

import android.database.Cursor
import android.database.MatrixCursor
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.DocumentsProvider
import android.util.Base64
import java.io.File
import java.io.FileNotFoundException
import java.util.UUID

// Test APK only, MANAGE_DOCUMENTS-protected. Resolves only newly owned cache roots, never external/user paths.
class AndroidWebDavDocumentsProvider : DocumentsProvider() {
  companion object { const val AUTHORITY = "com.kloda.sync.test.webdav.documents" }
  override fun onCreate() = true
  private fun parts(id: String): List<String> {
    val parts = id.split(':')
    if (parts.size !in 2..4 || !Regex("[0-9a-f]{32}").matches(parts[0]) || parts[1] !in setOf("source", "target")) throw FileNotFoundException()
    return parts
  }
  private fun file(id: String): File {
    val p = parts(id)
    val root = File(requireNotNull(context).cacheDir, "kloda-owned-saf-${p[0]}")
    if (!root.isDirectory) throw FileNotFoundException()
    val folder = File(root, p[1])
    val value = when {
      p.size == 2 -> folder
      p[1] == "source" && p.size == 3 && p[2] == "payload" -> File(folder, "payload.bin")
      p[1] == "target" && p.size == 4 && Regex("[0-9a-f]{32}").matches(p[2]) -> File(folder, p[2] + ".bin")
      else -> throw FileNotFoundException()
    }
    if (!value.exists() || java.nio.file.Files.isSymbolicLink(value.toPath())) throw FileNotFoundException()
    return value
  }
  private fun name(id: String): String {
    val p = parts(id)
    val result = if (p.size == 4) String(Base64.decode(p[3], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), Charsets.UTF_8)
      else if (p.size == 3) "payload.bin" else p[1]
    if (result.isEmpty() || result.toByteArray().size > 255 || result in setOf(".", "..") || result.any { it == '/' || it == '\\' || it.isISOControl() }) throw FileNotFoundException()
    return result
  }
  override fun queryRoots(projection: Array<out String>?): Cursor = MatrixCursor(projection ?: arrayOf(DocumentsContract.Root.COLUMN_ROOT_ID))
  private fun row(id: String, projection: Array<out String>?): Cursor {
    val columns = projection ?: arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED)
    val file = file(id)
    val values = mapOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID to id, DocumentsContract.Document.COLUMN_DISPLAY_NAME to name(id),
      DocumentsContract.Document.COLUMN_MIME_TYPE to if (file.isDirectory) DocumentsContract.Document.MIME_TYPE_DIR else "application/octet-stream",
      DocumentsContract.Document.COLUMN_SIZE to file.length(), DocumentsContract.Document.COLUMN_LAST_MODIFIED to file.lastModified(),
      DocumentsContract.Document.COLUMN_FLAGS to if (file.isDirectory && parts(id)[1] == "target") DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE else 0)
    return MatrixCursor(columns).apply { addRow(columns.map { values[it] }.toTypedArray()) }
  }
  override fun queryDocument(documentId: String, projection: Array<out String>?) = row(documentId, projection)
  override fun queryChildDocuments(parentDocumentId: String, projection: Array<out String>?, sortOrder: String?): Cursor {
    val p = parts(parentDocumentId)
    if (p.size != 2) throw FileNotFoundException()
    val columns = projection ?: arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED)
    val cursor = MatrixCursor(columns)
    if (p[1] == "source") row("$parentDocumentId:payload", columns).use { values ->
      check(values.moveToFirst()); cursor.addRow(columns.indices.map { if (values.isNull(it)) null else values.getString(it) }.toTypedArray())
    }
    return cursor
  }
  override fun isChildDocument(parentDocumentId: String, documentId: String): Boolean = runCatching {
    val parent = parts(parentDocumentId); val child = parts(documentId)
    file(parentDocumentId); file(documentId)
    parent.size == 2 && child.size > 2 && parent[0] == child[0] && parent[1] == child[1]
  }.getOrDefault(false)
  override fun openDocument(documentId: String, mode: String, signal: CancellationSignal?): ParcelFileDescriptor {
    signal?.throwIfCanceled()
    if (parts(documentId)[1] == "source" && mode != "r") throw FileNotFoundException()
    return ParcelFileDescriptor.open(file(documentId), ParcelFileDescriptor.parseMode(mode))
  }
  override fun createDocument(parentDocumentId: String, mimeType: String, displayName: String): String {
    val p = parts(parentDocumentId)
    if (p.size != 2 || p[1] != "target") throw FileNotFoundException()
    val token = UUID.randomUUID().toString().replace("-", "")
    val id = "$parentDocumentId:$token:" + Base64.encodeToString(displayName.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    name(id)
    if (!File(file(parentDocumentId), "$token.bin").createNewFile()) throw FileNotFoundException()
    return id
  }
}
