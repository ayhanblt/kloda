package com.kloda.sync

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract

internal class AndroidSafSourceScanner(private val contentResolver: ContentResolver) {
  fun scan(treeReference: String): Sequence<QueuedSourceFile> = sequence {
    val treeUri = Uri.parse(treeReference)
    val rootDocumentId = DocumentsContract.getTreeDocumentId(treeUri)
    yieldAll(scanDirectory(treeUri, rootDocumentId, ""))
  }

  private fun scanDirectory(treeUri: Uri, documentId: String, prefix: String): Sequence<QueuedSourceFile> = sequence {
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId)
    contentResolver.query(
      childrenUri,
      arrayOf(
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_SIZE
      ),
      null,
      null,
      null
    )?.use { cursor ->
      val displayNameIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val documentIdIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val modifiedIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
      val mimeTypeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
      val sizeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_SIZE)
      while (cursor.moveToNext()) {
        val name = cursor.getString(displayNameIndex)
        val childId = cursor.getString(documentIdIndex)
        val relativePath = if (prefix.isEmpty()) name else "$prefix/$name"
        if (cursor.getString(mimeTypeIndex) == DocumentsContract.Document.MIME_TYPE_DIR) {
          yieldAll(scanDirectory(treeUri, childId, relativePath))
        } else {
          val size = if (cursor.isNull(sizeIndex)) 0L else cursor.getLong(sizeIndex)
          val modified = if (cursor.isNull(modifiedIndex)) 0L else cursor.getLong(modifiedIndex)
          val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId).toString()
          yield(QueuedSourceFile(fileUri, relativePath, "$size:$modified", size))
        }
      }
    } ?: throw IllegalStateException("Could not read the selected directory.")
  }
}
