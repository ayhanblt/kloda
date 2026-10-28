"""Run actual SAF scanner/picker with disposable Android doubles; not runtime acceptance."""
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/AndroidSafSourceScanner.kt'

STUBS = {
    'uri.kt': '''package android.net
data class Uri(private val value: String) {
  val scheme: String? get() = java.net.URI(value).scheme
  val authority: String? get() = java.net.URI(value).authority
  val segments: List<String> get() = java.net.URI(value).path.split('/').filter { it.isNotEmpty() }
  override fun toString() = value
  companion object { fun parse(value: String) = Uri(value) }
}
''',
    'os.kt': '''package android.os
object Build { object VERSION { var SDK_INT = 24 } }
class OperationCanceledException : RuntimeException()
class CancellationSignal {
  private var cancelled = false
  fun cancel() { cancelled = true }
  fun throwIfCanceled() { if (cancelled) throw OperationCanceledException() }
}
''',
    'cursor.kt': '''package android.database
class Cursor(private val projection: Array<String>, private val rows: List<Map<String,String>>) : java.io.Closeable {
  private var index = -1
  fun getColumnIndexOrThrow(name: String) = projection.indexOf(name).also { check(it >= 0) }
  fun moveToNext() = (++index < rows.size)
  fun getString(column: Int): String = rows[index][projection[column]] ?: ""
  fun getLong(column: Int) = getString(column).toLong()
  fun isNull(column: Int) = projection[column] !in rows[index]
  override fun close() {}
}
''',
    'resolver.kt': '''package android.content
import android.net.Uri
import android.database.Cursor
import android.os.CancellationSignal
data class UriPermission(val uri: Uri, val isReadPermission: Boolean)
class ContentResolver {
  var persistedUriPermissions = listOf<UriPermission>()
  val children = mutableMapOf<String,List<Map<String,String>>>()
  var queried = 0
  var authoritativeCalls = 0
  var authoritativeChild = false
  var onQuery: () -> Unit = {}
  val persistedCalls = mutableListOf<Pair<Uri,Int>>()
  fun takePersistableUriPermission(uri: Uri, flags: Int) { persistedCalls.add(uri to flags) }
  fun query(uri: Uri, projection: Array<String>, selection: String?, args: Array<String>?, order: String?, cancellation: CancellationSignal? = null): Cursor? {
    queried++
    onQuery()
    return children[uri.segments.last()]?.let { Cursor(projection, it) }
  }
}
class Context(val contentResolver: ContentResolver)
class Intent(val action: String) {
  var flags = 0
  var data: Uri? = null
  fun addFlags(value: Int): Intent { flags = flags or value; return this }
  companion object {
    const val ACTION_OPEN_DOCUMENT_TREE = "open-tree"
    const val FLAG_GRANT_READ_URI_PERMISSION = 1
    const val FLAG_GRANT_WRITE_URI_PERMISSION = 2
    const val FLAG_GRANT_PERSISTABLE_URI_PERMISSION = 64
  }
}
''',
    'activity.kt': '''package android.app
object Activity { const val RESULT_OK = -1; const val RESULT_CANCELED = 0 }
''',
    'expo-provider.kt': '''package expo.modules.kotlin.providers
class AppContext(val reactContext: android.content.Context?)
interface AppContextProvider { val appContext: AppContext }
''',
    'expo-contract.kt': '''package expo.modules.kotlin.activityresult
interface AppContextActivityResultContract<I,O> {
  fun createIntent(context: android.content.Context, input: I): android.content.Intent
  fun parseResult(input: I, resultCode: Int, intent: android.content.Intent?): O
}
''',
    'documents.kt': '''package android.provider
import android.net.Uri
import android.content.ContentResolver
object DocumentsContract {
  object Document {
    const val COLUMN_DISPLAY_NAME = "name"; const val COLUMN_DOCUMENT_ID = "id"
    const val COLUMN_LAST_MODIFIED = "modified"; const val COLUMN_MIME_TYPE = "mime"; const val COLUMN_SIZE = "size"
    const val MIME_TYPE_DIR = "directory"
  }
  fun isTreeUri(uri: Uri) = uri.segments.firstOrNull() == "tree" && uri.segments.size >= 2
  fun getTreeDocumentId(uri: Uri) = uri.segments[1]
  fun getDocumentId(uri: Uri) = uri.segments[3]
  fun buildDocumentUriUsingTree(uri: Uri, id: String) = Uri.parse("content://${uri.authority}/tree/${getTreeDocumentId(uri)}/document/$id")
  fun buildChildDocumentsUriUsingTree(uri: Uri, id: String) = Uri.parse("content://${uri.authority}/tree/${getTreeDocumentId(uri)}/children/$id")
  fun isChildDocument(resolver: ContentResolver, root: Uri, document: Uri): Boolean {
    check(android.os.Build.VERSION.SDK_INT >= 29)
    resolver.authoritativeCalls++
    return resolver.authoritativeChild
  }
}
''',
    'checks.kt': '''package com.kloda.sync
import android.content.ContentResolver
import android.content.UriPermission
import android.content.Context
import android.content.Intent
import android.app.Activity
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.os.OperationCanceledException
internal class FilesFailure(val code: String) : RuntimeException(code)
internal data class QueuedSourceFile(val reference: String,val path: String,val revision: String,val size: Long)
private val tree = "content://fixture/tree/root-1"
private fun document(id: String) = "$tree/document/$id"
private fun row(id: String, directory: Boolean = false) = mapOf("id" to id,"mime" to if (directory) "directory" else "file",
  "name" to id,"size" to "7","modified" to "9")
private fun resolver() = ContentResolver().apply {
  persistedUriPermissions = listOf(UriPermission(Uri.parse(tree), true))
  children["root-1"] = listOf(row("opaque-X", true))
  children["opaque-X"] = listOf(row("unrelated-ID"))
}
private fun rejects(code: String, action: () -> Unit) {
  try { action(); error("Expected $code") } catch (error: FilesFailure) { check(error.code == code) { error.code } }
}
fun main() {
  var groups = 0
  Build.VERSION.SDK_INT = 24
  run {
    val r = resolver(); val s = AndroidSafSourceScanner(r)
    check(s.checkedDocument(tree,document("unrelated-ID")).toString() == document("unrelated-ID"))
    check(r.authoritativeCalls == 0 && r.queried == 2)
    check(s.scan(tree).single().path == "opaque-X/unrelated-ID")
    groups++
  }
  run {
    val s = AndroidSafSourceScanner(resolver())
    rejects("source_changed") { s.checkedDocument(tree,document("root-1-looking-outside")) }
    rejects("source_changed") { s.checkedDocument(tree,document("absent")) }
    groups++
  }
  run {
    val r = resolver(); val s = AndroidSafSourceScanner(r)
    for (bad in listOf("content://other/tree/root-1/document/unrelated-ID", "content://fixture/tree/other/document/unrelated-ID", "https://fixture/tree/root-1/document/unrelated-ID"))
      rejects("source_permission_lost") { s.checkedDocument(tree,bad) }
    check(r.queried == 0)
    groups++
  }
  run {
    val r = resolver(); val s = AndroidSafSourceScanner(r)
    r.persistedUriPermissions = listOf(UriPermission(Uri.parse(tree),false))
    rejects("source_permission_lost") { s.checkedDocument(tree,document("unrelated-ID")) }
    r.persistedUriPermissions = emptyList()
    rejects("source_permission_lost") { s.checkedDocument(tree,document("unrelated-ID")) }
    check(r.queried == 0)
    groups++
  }
  run {
    val r = resolver(); r.children.remove("opaque-X")
    rejects("source_changed") { AndroidSafSourceScanner(r).checkedDocument(tree,document("unrelated-ID")) }
    groups++
  }
  run {
    val r = resolver(); r.children["opaque-X"] = listOf(row("root-1",true))
    rejects("backup_path_rejected") { AndroidSafSourceScanner(r).checkedDocument(tree,document("absent")) }
    groups++
  }
  run {
    val r = resolver()
    for (index in 0..256) r.children[if (index == 0) "root-1" else "dir-$index"] = listOf(row("dir-${index+1}",true))
    rejects("backup_path_rejected") { AndroidSafSourceScanner(r).checkedDocument(tree,document("absent")) }
    groups++
  }
  run {
    val r = resolver(); val signal = CancellationSignal().apply { cancel() }
    try { AndroidSafSourceScanner(r).checkedDocument(tree,document("unrelated-ID"),signal); error("Expected cancellation") }
    catch (_: OperationCanceledException) {}
    check(r.queried == 0)
    groups++
  }
  run {
    val r = resolver(); val signal = CancellationSignal()
    r.onQuery = { signal.cancel() }
    try { AndroidSafSourceScanner(r).checkedDocument(tree,document("unrelated-ID"),signal); error("Expected cancellation") }
    catch (_: OperationCanceledException) {}
    check(r.queried == 1)
    groups++
  }
  run {
    val r = resolver(); var paused = false
    r.onQuery = { paused = true }
    rejects("paused") { AndroidSafSourceScanner(r).checkedDocument(tree,document("unrelated-ID")) {
      if (paused) throw FilesFailure("paused")
    } }
    check(r.queried == 1)
    groups++
  }
  run {
    Build.VERSION.SDK_INT = 29
    val r = resolver(); val s = AndroidSafSourceScanner(r)
    rejects("source_changed") { s.checkedDocument(tree,document("unrelated-ID")) }
    check(r.authoritativeCalls == 1 && r.queried == 0)
    r.authoritativeChild = true
    check(s.checkedDocument(tree,document("unrelated-ID")).toString() == document("unrelated-ID"))
    check(r.authoritativeCalls == 2 && r.queried == 0)
    groups++
  }
  run {
    val r = resolver().apply { authoritativeChild = true }; var checks = 0
    rejects("source_permission_lost") { AndroidSafSourceScanner(r).checkedDocument(tree,document("unrelated-ID")) {
      if (++checks == 2) throw FilesFailure("source_permission_lost")
    } }
    check(checks == 2 && r.authoritativeCalls == 1 && r.queried == 0)
    groups++
  }
  run {
    for (sdk in listOf(24,29)) {
      Build.VERSION.SDK_INT = sdk
      val r = resolver().apply { children["root-1"] = listOf(row("one"),row("two")); authoritativeChild = true }
      val iterator = AndroidSafSourceScanner(r).scan(tree).iterator()
      check(iterator.next().path == "one")
      r.persistedUriPermissions = emptyList()
      rejects("source_permission_lost") { iterator.next() }
    }
    groups++
  }
  run {
    Build.VERSION.SDK_INT = 24
    val r = resolver().apply { children["root-1"] = listOf(row("one"),row("two")) }
    val signal = CancellationSignal(); val iterator = AndroidSafSourceScanner(r).scan(tree,signal).iterator()
    check(iterator.next().path == "one"); signal.cancel()
    try { iterator.next(); error("Expected cancellation") } catch (_: OperationCanceledException) {}
    groups++
  }
  run {
    val r = resolver().apply { children["root-1"] = (1..128).map { row("opaque-$it") } }
    check(AndroidSafSourceScanner(r).scan(tree).count() == 128 && r.queried == 1)
    groups++
  }
  check(groups == 15)
  println("Actual SAF scanner host PASS: $groups groups; opaque/nested membership, outside IDs, authority/tree/read permission, null provider, cycle/depth, cancellation/pause, API29 authoritative proof+post-check")
  run {
    val r = resolver()
    val provider = object : expo.modules.kotlin.providers.AppContextProvider {
      override val appContext = expo.modules.kotlin.providers.AppContext(Context(r))
    }
    val picker = DirectoryPickerContract(provider); val input = DirectoryPickerInput()
    val created = picker.createIntent(Context(r),input)
    check(created.action == Intent.ACTION_OPEN_DOCUMENT_TREE)
    check(created.flags == Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    val granted = Intent("result").apply {
      data = Uri.parse(tree)
      flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
    }
    check(picker.parseResult(input,Activity.RESULT_CANCELED,granted) == null)
    check(picker.parseResult(input,Activity.RESULT_OK,null) == null)
    check(picker.parseResult(input,Activity.RESULT_OK,Intent("result")) == null)
    check(picker.parseResult(input,Activity.RESULT_OK,Intent("result").apply {
      data = Uri.parse(tree); flags = Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
    }) == null)
    check(r.persistedCalls.isEmpty())
    check(picker.parseResult(input,Activity.RESULT_OK,granted) == tree)
    check(r.persistedCalls == listOf(Uri.parse(tree) to Intent.FLAG_GRANT_READ_URI_PERMISSION))
    println("Actual directory picker host PASS: canceled/missing data/missing read do not persist; granted read+write+persistable stores read only")
  }
}
''',
}


def main():
    cache = Path.home() / '.gradle/caches/modules-2/files-2.1'
    jars = [str(p) for group in ('org.jetbrains.kotlin', 'org.jetbrains.kotlinx', 'org.jetbrains.intellij.deps', 'org.jetbrains')
            for p in (cache / group).rglob('*.jar') if ('2.1.20' in str(p) or 'kotlinx-coroutines-core-jvm' in str(p)
                or 'trove4j' in str(p) or 'annotations' in str(p))]
    stdlib = next(p for p in jars if p.endswith('/kotlin-stdlib-2.1.20.jar'))
    with tempfile.TemporaryDirectory(prefix='kloda-saf-host-') as directory:
        path = Path(directory)
        sources = [str(SOURCE), str(SOURCE.with_name('DirectoryPickerContract.kt'))]
        for name, source in STUBS.items():
            file = path / name
            file.write_text(source)
            sources.append(str(file))
        subprocess.run(['java', '-cp', os.pathsep.join(jars), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
            '-no-stdlib', '-no-reflect', '-nowarn', '-classpath', stdlib, '-d', str(path / 'classes'), *sources], check=True)
        subprocess.run(['java', '-cp', str(path / 'classes') + os.pathsep + stdlib, 'com.kloda.sync.ChecksKt'], check=True)


if __name__ == '__main__':
    main()
