package com.kloda.sync

import android.content.Context
import android.content.ContextWrapper
import org.json.JSONArray
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.util.UUID

// Login Flow v2, per-destination custody and DAV no-overwrite, only against the owned loopback Nextcloud fixture (ADR0027).
internal object AndroidNextcloudChecks {
  private const val SERVER = "https://10.0.2.2:18443"
  private fun rejects(code: String, action: () -> Unit) {
    var observed: String? = null
    try { action() } catch (error: FilesFailure) { observed = error.code }
    check(observed == code) { "Expected $code; observed $observed" }
  }
  private fun sha(bytes: ByteArray) = AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256").digest(bytes))

  // announce() streams a line to the host runner, which plays the browser part with tools/nextcloud-login-driver.py.
  fun run(isolated: Context, announce: (String) -> Unit) {
    val namespace = UUID.randomUUID().toString().replace("-", "")
    val context = object : ContextWrapper(isolated) {
      override fun getPackageName() = isolated.packageName + ".cloud18." + namespace
    }
    origins()
    custody(context)
    granted(context, announce)
    refused(context, announce)
  }

  private fun origins() {
    val server = AndroidNextcloudLogin.server("$SERVER/")
    check(server == AndroidNextcloudLogin.server(SERVER) && server.toString() == "$SERVER/")
    val nested = AndroidNextcloudLogin.server("https://10.0.2.2:18443/cloud/")
    check(nested.toString() == "https://10.0.2.2:18443/cloud")
    listOf("http://10.0.2.2:18443", "https://owned:secret@10.0.2.2:18443", "https://10.0.2.2:18443/?a=b", "https://10.0.2.2:18443/#x", "not a url")
      .forEach { rejects("webdav_fields") { AndroidNextcloudLogin.server(it) } }
    check(AndroidNextcloudLogin.sameOrigin(server, "$SERVER/login/v2/poll").encodedPath == "/login/v2/poll")
    listOf("http://10.0.2.2:18443/login/v2/poll", "https://127.0.0.1:18443/login/v2/poll", "https://10.0.2.2:443/login/v2/poll",
      "https://owned@10.0.2.2:18443/login/v2/poll").forEach { rejects("nextcloud_server_mismatch") { AndroidNextcloudLogin.sameOrigin(server, it) } }
    rejects("nextcloud_server_mismatch") { AndroidNextcloudLogin.sameOrigin(nested, "https://10.0.2.2:18443/other/login/v2/poll") }
  }

  private fun custody(context: Context) {
    val legacy = AndroidWebDavProfile(UUID.randomUUID().toString(), "$SERVER/remote.php/dav/files/owned", "Kloda", "owned", "fixture-password")
    val expected = AndroidWebDavProfile.encode(MessageDigest.getInstance("SHA-256")
      .digest(JSONArray().put(legacy.url().toString()).put("owned").toString().toByteArray()))
    check(legacy.targetId() == expected) { "original WebDAV identity changed" }
    val cloud = legacy.copy(provider = "nextcloud")
    check(cloud.targetId() != legacy.targetId() && cloud.copy(provider = "cloudme").targetId() != cloud.targetId())
    rejects("webdav_fields") { legacy.copy(provider = "dropbox").validate() }
    AndroidWebDavVault(context).write(legacy)
    AndroidWebDavVault(context, cloud.targetId()).write(cloud)
    check(AndroidWebDavVault(context).read() == legacy && AndroidWebDavVault(context, cloud.targetId()).read() == cloud)
    rejects("invalid_request") { AndroidWebDavVault(context, cloud.targetId()).write(legacy) }
    rejects("invalid_request") { AndroidWebDavVault(context).write(cloud) }
    rejects("invalid_request") { AndroidWebDavVault(context, cloud.copy(targetPath = "Other").targetId()).write(cloud) }
    rejects("invalid_request") { AndroidWebDavVault(context, "not-a-target") }
    val extra = (1..6).map { cloud.copy(revision = UUID.randomUUID().toString(), targetPath = "Kloda$it") }
    extra.forEach { AndroidWebDavVault(context, it.targetId()).write(it) }
    check(AndroidWebDavVault.count(context) == AndroidWebDavVault.LIMIT)
    val ninth = cloud.copy(targetPath = "Kloda9")
    rejects("destination_limit") { AndroidWebDavVault(context, ninth.targetId()).write(ninth) }
    val renewed = cloud.copy(revision = UUID.randomUUID().toString(), password = "rotated")
    AndroidWebDavVault(context, cloud.targetId()).write(renewed)
    check(AndroidWebDavVault(context, cloud.targetId()).read() == renewed)
    (extra + cloud).forEach { AndroidWebDavVault(context, it.targetId()).delete() }
    check(AndroidWebDavVault.slots(context).isEmpty() && AndroidWebDavVault(context, cloud.targetId()).read() == null)
    check(AndroidWebDavVault(context).read() == legacy)
    rejects("invalid_request") { AndroidWebDavVault(context).delete() }
    // A new original WebDAV entry also counts toward the limit.
    val fresh = object : ContextWrapper(context) {
      override fun getNoBackupFilesDir() = java.io.File(context.noBackupFilesDir, "fresh").also { check(it.isDirectory || it.mkdirs()) }
    }
    val full = (1..8).map { cloud.copy(revision = UUID.randomUUID().toString(), targetPath = "Fresh$it") }
    full.forEach { AndroidWebDavVault(fresh, it.targetId()).write(it) }
    rejects("destination_limit") { AndroidWebDavVault(fresh).write(legacy) }
    AndroidWebDavVault(fresh, full.last().targetId()).delete()
    AndroidWebDavVault(fresh).write(legacy)
    check(AndroidWebDavVault.count(fresh) == AndroidWebDavVault.LIMIT)
    full.dropLast(1).forEach { AndroidWebDavVault(fresh, it.targetId()).delete() }
  }

  private fun granted(context: Context, announce: (String) -> Unit) {
    val login = AndroidNextcloudLogin(context)
    val start = login.start(SERVER)
    check(start.login.host == "10.0.2.2" && start.poll.encodedPath == "/login/v2/poll")
    check(login.poll(start) == null)
    announce("GRANT " + start.login)
    val credential = login.waitForGrant(start, 1000, 120_000)
    check(credential.loginName == "owned" && credential.appPassword.length >= 32)
    check(login.poll(start) == null) { "poll token must be single use" }
    val profile = login.profile(start, credential, "KlodaCloud18-" + AndroidFilesSnapshots.randomId())
    check(profile.provider == "nextcloud" && profile.endpoint == "$SERVER/remote.php/dav/files/owned")
    AndroidWebDavVault(context, profile.targetId()).write(profile)
    check(AndroidWebDavVault(context, profile.targetId()).read() == profile)
    val client = AndroidWebDavClient(context, profile) {}
    AndroidWebDavClient.require(client.collection(profile.targetPath), 201)
    val first = ByteArray(65537) { (it % 251).toByte() }
    val second = ByteArray(17) { 7 }
    fun put(name: String, bytes: ByteArray) = client.request(name, "PUT", mapOf("If-None-Match" to "*"), ByteArrayInputStream(bytes), bytes.size.toLong())
    fun move(from: String) = client.request(from, "MOVE", mapOf("Destination" to profile.url("photo.bin").toString(), "Overwrite" to "F"))
    AndroidWebDavClient.require(put(".kloda-upload-a", first), 201)
    rejects("conflict") { AndroidWebDavClient.require(put(".kloda-upload-a", second), 201) }
    AndroidWebDavClient.require(move(".kloda-upload-a"), 201)
    AndroidWebDavClient.require(put(".kloda-upload-b", second), 201)
    rejects("conflict") { AndroidWebDavClient.require(move(".kloda-upload-b"), 201) }
    val read = client.request("photo.bin", "GET", maximum = first.size.toLong())
    check(read.status == 200 && read.size == first.size.toLong() && read.sha256 == sha(first)) { "overwrite was not refused" }
    login.revoke(profile)
    AndroidWebDavVault(context, profile.targetId()).delete()
    check(AndroidWebDavVault(context, profile.targetId()).read() == null)
    rejects("webdav_auth") { AndroidWebDavClient.require(AndroidWebDavClient(context, profile) {}.request("photo.bin", "GET"), 200) }
  }

  private fun refused(context: Context, announce: (String) -> Unit) {
    val ignored = AndroidNextcloudLogin(context)
    val start = ignored.start(SERVER)
    announce("DENY " + start.login)
    rejects("nextcloud_login_expired") { ignored.waitForGrant(start, 1000, 6000) }
    val cancelled = AndroidNextcloudLogin(context)
    val pending = cancelled.start(SERVER)
    Thread { Thread.sleep(1500); cancelled.cancel() }.start()
    rejects("cancelled") { cancelled.waitForGrant(pending, 500, 60_000) }
    rejects("cancelled") { cancelled.start(SERVER) }
  }
}
