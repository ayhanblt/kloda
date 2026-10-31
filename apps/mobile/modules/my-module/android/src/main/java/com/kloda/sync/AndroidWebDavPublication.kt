package com.kloda.sync

internal class AndroidWebDavPublication(private val journal: AndroidWebDavJournal,
  private val inspect: (String, WebDavUpload) -> String,
  private val upload: (String, WebDavUpload) -> Unit,
  private val move: (String, String) -> Unit, private val check: () -> Unit,
  private val complete: (WebDavUpload) -> Unit) {
  companion object {
    private val lock = Any()
    private val active = mutableSetOf<String>()
    fun <T> withJob(id: String, action: () -> T): T {
      if (!synchronized(lock) { active.add(id) }) throw FilesFailure("backup_busy")
      try { return action() } finally { synchronized(lock) { active.remove(id) } }
    }
    fun temporary(value: WebDavUpload) = value.relativePath.substringBeforeLast('/') + "/.kloda-upload-" + value.id
  }
  fun execute(id: String): Boolean = withJob(id) { executeHeld(id) }
  private fun executeHeld(id: String): Boolean {
    var value = journal.find(id) ?: throw FilesFailure("outcome_unknown")
    check()
    if (value.skipped || value.issue != null) return false
    val temporary = temporary(value)
    val destination = journal.publications.read(value)
    if (value.phase == "completed") {
      if (inspect(destination, value) != "match") throw FilesFailure("review_required")
      check(); return true
    }
    if (value.phase == "prepared") {
      val state = inspect(temporary, value)
      check()
      if (state != "missing") throw FilesFailure("review_required")
      upload(temporary, value)
      journal.advance(value, "uploaded"); value = value.copy(phase = "uploaded")
      check()
    }
    if (value.phase in setOf("uploaded", "moving")) {
      if (inspect(temporary, value) != "match") throw FilesFailure("review_required")
      check()
      if (inspect(destination, value) != "missing") throw FilesFailure("conflict")
      check()
      if (value.phase == "uploaded") { journal.advance(value, "moving"); value = value.copy(phase = "moving") }
      move(temporary, destination)
      // Store a received mutation ACK even when a settings cancellation arrived concurrently.
      journal.advance(value, "moved"); value = value.copy(phase = "moved")
      check()
    }
    if (value.phase != "moved" || inspect(destination, value) != "match") throw FilesFailure("review_required")
    check(); complete(value)
    return true
  }
  fun review(id: String, action: String, validate: (WebDavUpload) -> Unit): Boolean = withJob(id) {
    check()
    val value = journal.find(id) ?: throw FilesFailure("outcome_unknown")
    if (value.phase == "completed" || value.skipped || action !in setOf("recheck", "keep_both", "skip")) throw FilesFailure("review_required")
    if (action == "skip") { journal.issue(value, value.issue ?: "review_required", true); return@withJob false }
    try {
      validate(value); check()
      if (action == "keep_both") {
        if (value.phase !in setOf("uploaded", "moving") || value.issue != "conflict" || inspect(temporary(value), value) != "match") throw FilesFailure("review_required")
        val selected = journal.publications.read(value)
        val path = if (selected != value.relativePath && inspect(selected, value) == "missing") selected else {
          if (inspect(selected, value) == "missing") throw FilesFailure("review_required")
          copyPath(value).also { if (inspect(it, value) != "missing") throw FilesFailure("conflict") }
        }
        check(); journal.publications.choose(value, path)
      }
      check(); journal.publications.clearIssue(value); executeHeld(id)
    } catch (error: Exception) {
      val code = when {
        error is FilesFailure -> error.code
        error is android.database.sqlite.SQLiteException -> "storage_failure"
        error is SecurityException -> "source_permission_lost"
        isLocalStorageFull(error) -> "local_storage_full"
        else -> "outcome_unknown"
      }
      journal.find(id)?.takeIf { it.phase != "completed" && !it.skipped }?.let { journal.issue(it, code) }
      throw FilesFailure(code)
    }
  }
  private fun copyPath(value: WebDavUpload): String {
    val name = value.relativePath.substringAfterLast('/')
    val split = name.lastIndexOf('.').takeIf { it > 0 } ?: name.length
    val stem = name.substring(0, split); val ext = name.substring(split)
    val clock = java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.ROOT).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
    val suffix = " (Kloda " + clock.format(java.util.Date()) + " " + value.sha256.take(8) + " " + java.util.UUID.randomUUID().toString().take(8) + ")" + ext
    val limit = 255 - suffix.toByteArray().size
    val short = StringBuilder()
    for (point in stem.codePoints().toArray()) {
      val char = String(Character.toChars(point))
      if (short.toString().toByteArray().size + char.toByteArray().size > limit) break
      short.append(char)
    }
    if (short.isEmpty()) throw FilesFailure("review_required")
    return value.relativePath.substringBeforeLast('/') + "/" + short + suffix
  }

}
