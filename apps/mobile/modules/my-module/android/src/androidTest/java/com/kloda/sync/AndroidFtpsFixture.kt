package com.kloda.sync

import android.app.Instrumentation
import java.io.File
import java.security.MessageDigest

// Test APK asset only; never an app production CA override.
internal object AndroidFtpsFixture {
  fun load(instrumentation: Instrumentation, scratch: File) {
    check(instrumentation.targetContext.packageName == "com.kloda.sync.test")
    val file = File(scratch, "owned-fixture-libkloda_ftps_native.so")
    check(file.createNewFile())
    instrumentation.context.assets.open("kloda-ftps16/libkloda_ftps_native.so").use { source -> file.outputStream().use { source.copyTo(it) } }
    val expected = instrumentation.context.assets.open("kloda-ftps16/sha256.txt").bufferedReader().use { it.readText().trim() }
    check(MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) } == expected)
    System.load(file.absolutePath)
  }
}
