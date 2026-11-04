package com.kloda.sync

internal interface AndroidS3RestoreTask {
  val ticket: java.util.UUID
  var choosing: Boolean
  fun pause(includePicker: Boolean = true)
}
