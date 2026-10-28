package com.kloda.sync

import android.database.sqlite.SQLiteFullException
import android.system.ErrnoException
import android.system.OsConstants
import java.io.IOException

// Pure cause classification; this does not fill a disk or exercise an Android provider.
internal object AndroidStorageErrorsChecks {
  @JvmStatic fun main(args: Array<String>) {
    check(isLocalStorageFull(ErrnoException("write", OsConstants.ENOSPC)))
    check(isLocalStorageFull(ErrnoException("write", OsConstants.EDQUOT)))
    check(isLocalStorageFull(SQLiteFullException()))
    check(isLocalStorageFull(IOException("wrapped", ErrnoException("write", OsConstants.ENOSPC))))
    check(!isLocalStorageFull(ErrnoException("write", OsConstants.EACCES)))
    check(!isLocalStorageFull(IOException("unknown write failure")))
    val first = IOException("first")
    val second = IOException("second", first)
    first.initCause(second)
    check(!isLocalStorageFull(first))
    println("PASS typed ENOSPC/quota/SQLite/nested classification and unrelated/cyclic failures")
  }
}
