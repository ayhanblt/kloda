package com.kloda.sync

import java.util.concurrent.atomic.AtomicLong

internal class PhotosRestoreRequests {
  private val generation = AtomicLong(0)
  val active: Boolean get() = generation.get() and 1L != 0L
  fun reserve(): Long {
    while (true) {
      val current = generation.get()
      if (current and 1L != 0L) throw FilesFailure("backup_busy")
      if (generation.compareAndSet(current, current + 1)) return current + 1
    }
  }
  fun check(token: Long) { if (generation.get() != token) throw FilesFailure("cancelled") }
  fun release(token: Long) { generation.compareAndSet(token, token + 1) }
  fun cancel() { generation.updateAndGet { if (it and 1L != 0L) it + 1 else it + 2 } }
}
