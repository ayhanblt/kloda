package com.kloda.sync

internal fun contextChecks() {
  fun source(id: String, ref: String) = "{\"id\":\"$id\",\"reference\":\"$ref\"}"
  val a = source("a", "content://tree/a")
  val b = source("b", "photos-library")
  val original = mapOf<String, Any>("directorySources" to "[$a]", "photoSources" to "[$b]",
    "intervalHours" to 12, "localTime" to "12:00", "filesContextRevision" to "revision-a")
  val binding = FilesRunContext.from(original)
  check(binding.sources == mapOf("a" to "content://tree/a", "b" to "photos-library"))
  check(binding.binding.matches(Regex("[0-9a-f]{64}")))
  check(FilesRunContext.from(original.toMutableMap()).binding == binding.binding)
  for (change in listOf(mapOf("directorySources" to "[]"), mapOf("photoSources" to "[]"),
    mapOf("directorySources" to "["+source("a", "content://tree/replaced")+"]"),
    mapOf("intervalHours" to 24), mapOf("localTime" to "13:00"),
    mapOf("filesContextRevision" to "revision-returned-to-old-values"))) {
    check(FilesRunContext.from(original + change).binding != binding.binding)
  }
  check(FilesRunContext.from(original + mapOf("storageEndpoint" to "different-webdav", "storageUsername" to "other")).binding == binding.binding)
  for (change in listOf(mapOf("directorySources" to 4), mapOf("directorySources" to "[$a,$a]"),
    mapOf("intervalHours" to 0), mapOf("localTime" to "99:00"), mapOf("filesContextRevision" to 4))) {
    check(runCatching { FilesRunContext.from(original + change) }.isFailure)
  }
  check(FilesRunContext.from(emptyMap<String, Any>()).binding == FilesRunContext.from(emptyMap<String, Any>()).binding)
  val old = FilesRun("old", "same-peer", null, 2, "finished", null, null, context = binding.binding)
  check(old.visibleFor(binding.binding) && !old.visibleFor("different-context"))
  check(old.copy(state = "failed", error = "settings_changed").visibleFor("different-context"))
  check(!old.copy(context = null).visibleFor(binding.binding))
  println("PASS actual FilesRunContext: source/ref/schedule/revision binding, change-away/back, stable reopen, WebDAV separation, malformed input rejection")
}
