package com.kloda.sync
import java.util.UUID
internal interface AndroidSftpRestoreTask { val ticket: UUID; val choosing: Boolean; fun pause(includePicker: Boolean = true) }
