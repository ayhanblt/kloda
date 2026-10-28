package com.kloda.sync

import android.content.ContentResolver
import android.net.Uri
import android.os.Build
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

  fun checkedDocument(treeReference: String, reference: String, cancellation: CancellationSignal? = null, check: () -> Unit = {}): Uri {
    cancellation?.throwIfCanceled(); check()
    val tree = permittedTree(treeReference)
    val document = Uri.parse(reference)
    if (document.scheme != "content" || document.authority != tree.authority ||
      !DocumentsContract.isTreeUri(document) ||
      DocumentsContract.getTreeDocumentId(document) != DocumentsContract.getTreeDocumentId(tree)) {
      throw FilesFailure("source_permission_lost")
    }
    val root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
    val contained = if (Build.VERSION.SDK_INT >= 29) DocumentsContract.isChildDocument(contentResolver, root, document)
      else listedDescendant(tree, DocumentsContract.getTreeDocumentId(tree), DocumentsContract.getDocumentId(document), emptySet(), cancellation, check)
    cancellation?.throwIfCanceled(); check()
    if (!contained) throw FilesFailure("source_changed")
    return document
  }

  // Document IDs are opaque: older APIs prove membership through provider children, never path prefixes.
  private fun listedDescendant(tree: Uri, parent: String, target: String, ancestors: Set<String>, cancellation: CancellationSignal?, check: () -> Unit): Boolean {
    cancellation?.throwIfCanceled(); check()
    if (parent in ancestors || ancestors.size >= 256) throw FilesFailure("backup_path_rejected")
    permittedTree(tree.toString())
    val directories = mutableListOf<String>()
    contentResolver.query(DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent),
      arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null, cancellation
    )?.use { cursor ->
      val id = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val mime = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
      while (cursor.moveToNext()) {
        cancellation?.throwIfCanceled(); check()
        val child = cursor.getString(id) ?: throw FilesFailure("source_changed")
        if (child == target) return true
        if (cursor.getString(mime) == DocumentsContract.Document.MIME_TYPE_DIR) directories.add(child)
      }
    } ?: throw FilesFailure("source_changed")
    return directories.any { listedDescendant(tree, it, target, ancestors + parent, cancellation, check) }
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
        permittedTree(treeUri.toString())
        val name = cursor.getString(displayNameIndex)
        val childId = cursor.getString(documentIdIndex)
        if (name.isNullOrEmpty() || name == "." || name == ".." || name.any { it == '/' || it == '\\' || it.isISOControl() }) {
          throw FilesFailure("backup_path_rejected")
        }
        val relativePath = if (prefix.isEmpty()) name else "$prefix/$name"
        if (cursor.getString(mimeTypeIndex) == DocumentsContract.Document.MIME_TYPE_DIR) {
          val child = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId).toString()
          // Pre29 discovery already traverses provider edges; actual opens revalidate independently.
          if (Build.VERSION.SDK_INT >= 29) checkedDocument(treeUri.toString(), child, cancellation)
          yieldAll(scanDirectory(treeUri, childId, relativePath, ancestors + documentId, cancellation))
        } else {
          val size = if (cursor.isNull(sizeIndex)) 0L else cursor.getLong(sizeIndex)
          val modified = if (cursor.isNull(modifiedIndex)) 0L else cursor.getLong(modifiedIndex)
          val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId).toString()
          if (Build.VERSION.SDK_INT >= 29) checkedDocument(treeUri.toString(), fileUri, cancellation)
          yield(QueuedSourceFile(fileUri, relativePath, "$size:$modified", size))
        }
      }
    } ?: throw FilesFailure("source_changed")
  }
}
