package com.kloda.sync

// Local own receipts only; listing never discovers/adopts remote objects.
internal object AndroidS3Backups {
  fun list(profiles: AndroidS3Profiles, after: String, issues: Boolean): Map<String, Any> = synchronized(AndroidSyncJournal.sourceLock) {
    val journal = profiles.journal
    val target = profiles.capture()?.profile?.target ?: throw S3Failure("profile_missing")
    val archive = target.archiveId(); val installation = journal.installation()
    val phase = if (issues) "review" else "completed"
    var cursor = 0L
    if (after.isNotEmpty()) {
      if (runCatching { java.util.UUID.fromString(after).toString() != after }.getOrDefault(true)) throw S3Failure("invalid_request")
      cursor = journal.database.rawQuery("SELECT l.rowid FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.job=? AND l.archive=? AND l.installation=? AND j.state=?", arrayOf(after, archive, installation, phase)).use {
        if (!it.moveToFirst()) throw S3Failure("invalid_request"); it.getLong(0)
      }
    }
    val jobs = journal.database.rawQuery("SELECT j.header FROM s3_locator l JOIN s3_job j ON j.id=l.job WHERE l.archive=? AND l.installation=? AND j.state=? AND l.rowid>? ORDER BY l.rowid LIMIT 101", arrayOf(archive, installation, phase, cursor.toString())).use {
      buildList { while (it.moveToNext()) add(AndroidS3Job.decode(it.getString(0))) }
    }
    val visible = jobs.take(100)
    val items = visible.filter { issues || it.kind != "photo_resource" }.map { job ->
      if (job.installation != installation || job.target.archiveId() != archive) throw S3Failure("binding_changed")
      if (!issues) journal.receipt(job.id, target)
      buildMap<String, Any> {
        put("id", job.id); put("name", job.name ?: job.id); put("path", job.logicalPath ?: job.reference)
        put("kind", job.kind ?: "file"); put("size", job.size.toString()); put("sha256", job.sha256)
        if (issues) put("errorCode", "review_required")
      }
    }
    val page = buildMap<String, Any> {
      put("targetId", archive); put("items", items); put("hasMore", jobs.size > 100)
      if (jobs.size > 100) put("next", visible.last().id)
      put("canRestoreFiles", !issues); put("canRestorePhotos", !issues)
    }
    mapOf("provider" to journal.provider, "page" to page)
  }
}
