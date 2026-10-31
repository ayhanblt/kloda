package com.kloda.sync

import java.util.UUID

internal interface AndroidWebDavRestoreTask {
  val ticket: UUID
  val choosing: Boolean
  fun pause(includePicker: Boolean = true)
}
