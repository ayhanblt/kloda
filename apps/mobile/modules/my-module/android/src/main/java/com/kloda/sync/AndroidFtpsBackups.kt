package com.kloda.sync

internal object AndroidFtpsBackups {
  fun list(queue: AndroidFtpsQueue, after: String, issues: Boolean = false): Map<String, Any> = synchronized(AndroidSyncJournal.sourceLock) {
    AndroidFtpsReviewEntries(queue.journal)
    val target = queue.profiles.capture()?.profile?.target ?: throw FtpsFailure("profile_missing")
    val page = if (issues) queue.journal.issues(target, after.ifEmpty { null }) else queue.journal.catalog(target, after.ifEmpty { null })
    val jobs = page.jobs.filter { if (issues) true else it.kind != "photo_resource" }
    return buildMap {
      put("targetId", target.archiveId())
      put("items", jobs.map { job -> buildMap<String, Any> {
        put("id", job.id); put("name", job.name ?: job.relativePath.substringAfterLast('/')); put("path", job.relativePath)
        put("kind", job.kind); put("size", job.size.toString()); put("sha256", job.sha256)
        if (issues) put("errorCode", queue.journal.state(job).issue ?: if (queue.journal.state(job).completed) "native_7" else "review_required")
      } })
      put("hasMore", page.next != null); page.next?.let { put("next", it) }
      put("canRestoreFiles", true); put("canRestorePhotos", true)
    }
  }
}
