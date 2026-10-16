package com.kloda.sync

import android.content.ContentResolver
import android.net.Uri
import android.os.CancellationSignal
import android.provider.DocumentsContract

internal class AndroidSafSourceScanner(private val contentResolver: ContentResolver) {
  fun scan(treeReference: String, cancellation: CancellationSignal? = null): Sequence<QueuedSourceFile> = sequence {
    val treeUri = permittedTree(treeReference)
    val rootDocumentId = DocumentsContract.getTreeDocumentId(treeUri)
    yieldAll(scanDirectory(treeUri, rootDocumentId, "", emptySet(), cancellation))
  }

  fun permittedTree(reference: String): Uri {
    val tree = Uri.parse(reference)
    if (tree.scheme != "content" || !DocumentsContract.isTreeUri(tree) ||
      !contentResolver.persistedUriPermissions.any { it.uri == tree && it.isReadPermission }) {
      throw FilesFailure("source_permission_lost")
    }
    return tree
  }

  fun checkedDocument(treeReference: String, reference: String): Uri {
    val tree = permittedTree(treeReference)
    val document = Uri.parse(reference)
    if (document.scheme != "content" || document.authority != tree.authority ||
      !DocumentsContract.isTreeUri(document) ||
      DocumentsContract.getTreeDocumentId(document) != DocumentsContract.getTreeDocumentId(tree)) {
      throw FilesFailure("source_permission_lost")
    }
    val root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
    if (!DocumentsContract.isChildDocument(contentResolver, root, document)) throw FilesFailure("source_changed")
    return document
  }

  private fun scanDirectory(treeUri: Uri, documentId: String, prefix: String, ancestors: Set<String>, cancellation: CancellationSignal?): Sequence<QueuedSourceFile> = sequence {
    cancellation?.throwIfCanceled()
    if (documentId in ancestors || ancestors.size >= 256) throw FilesFailure("backup_path_rejected")
    permittedTree(treeUri.toString())
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
      null,
      cancellation
    )?.use { cursor ->
      val displayNameIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val documentIdIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val modifiedIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
      val mimeTypeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
      val sizeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_SIZE)
      while (cursor.moveToNext()) {
        cancellation?.throwIfCanceled()
        val name = cursor.getString(displayNameIndex)
        val childId = cursor.getString(documentIdIndex)
        if (name.isNullOrEmpty() || name == "." || name == ".." || name.any { it == '/' || it == '\\' || it.isISOControl() }) {
          throw FilesFailure("backup_path_rejected")
        }
        val relativePath = if (prefix.isEmpty()) name else "$prefix/$name"
        if (cursor.getString(mimeTypeIndex) == DocumentsContract.Document.MIME_TYPE_DIR) {
          val child = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId).toString()
          checkedDocument(treeUri.toString(), child)
          yieldAll(scanDirectory(treeUri, childId, relativePath, ancestors + documentId, cancellation))
        } else {
          val size = if (cursor.isNull(sizeIndex)) 0L else cursor.getLong(sizeIndex)
          val modified = if (cursor.isNull(modifiedIndex)) 0L else cursor.getLong(modifiedIndex)
          val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId).toString()
          checkedDocument(treeUri.toString(), fileUri)
          yield(QueuedSourceFile(fileUri, relativePath, "$size:$modified", size))
        }
      }
    } ?: throw FilesFailure("source_changed")
  }
}
