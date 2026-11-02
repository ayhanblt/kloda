package com.kloda.sync

import android.app.Activity
import android.app.Instrumentation
import android.content.Context
import android.content.ContextWrapper
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.os.Bundle
import java.io.File

class AndroidFilesQueueRecoveryInstrumentation : Instrumentation() {
  private var restartPhase: String? = null
  private var restartToken: String? = null
  private var scope: String? = null
  private var provider: String? = null
  override fun onCreate(arguments: Bundle?) {
    restartPhase = arguments?.getString("restartPhase")
    restartToken = arguments?.getString("restartToken")
    scope = arguments?.getString("scope")
    provider = arguments?.getString("provider")
    super.onCreate(arguments); start()
  }

  override fun onStart() {
    if (scope !in listOf("local-files", "media-fixture", "webdav-journal", "webdav-https", "webdav-os", "webdav-files", "webdav-saf", "webdav-photos-restore", "smb-files", "smb-product", "smb-photos-owned", "smb-profile", "sftp-files", "sftp-sources", "sftp-photos-owned", "sftp-product", "cloud18-nextcloud", "cloud18-destination", "cloud18-oauth")) {
      finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", "Explicit scope required: local-files, media-fixture or webdav-journal\n") })
      return
    }
    restartPhase?.let { phase ->
      try {
        check(phase in listOf("write", "read") && Regex("[0-9a-f]{32}").matches(restartToken.orEmpty()))
        val root = File(targetContext.cacheDir, "kloda-restart-$restartToken")
        if (phase == "write") check(!root.exists() && root.mkdirs()) else check(root.isDirectory)
        AndroidRestartChecks.run(IsolatedContext(targetContext, root), phase)
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "PASS restart-$phase\n") })
        if (phase == "read") root.deleteRecursively()
      } catch (error: Throwable) {
        finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", error.stackTraceToString()) })
      }
      return
    }
    val scratch = File(targetContext.cacheDir, "kloda-files-check-${AndroidFilesSnapshots.randomId()}")
    try {
      check(scratch.mkdirs())
      fun group(name: String, check: () -> Unit) {
        sendStatus(0, Bundle().apply { putString("stream", "START $name\n") })
        check()
        sendStatus(0, Bundle().apply { putString("stream", "PASS $name\n") })
      }
      if (scope == "sftp-files" || scope == "sftp-sources") {
        if (scope == "sftp-files") {
          group("sftp-owned-files") { AndroidSftpFilesChecks.run(this, scratch) }
          group("sftp-profile-owner") { AndroidSftpProfileChecks.run(this, scratch) }
        } else { System.loadLibrary("kloda_sftp_native") }
        group("sftp-owned-sources") { AndroidSftpSourceChecks.run(this, scratch) }
        group("sftp-photos-codec-authority") { AndroidSftpPhotosChecks.run(scratch) }
        group("sftp-product-factory-service") { AndroidSftpProductChecks.run(this) }
        group("sftp-owned-os-files") { AndroidSftpOsChecks.run(this) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "SFTP owned Files/profile/source/codec PASS\n") }); return
      }
      if (scope == "sftp-product") {
        group("sftp-product-factory-service") { AndroidSftpProductChecks.run(this) }
        group("sftp-owned-os-files") { AndroidSftpOsChecks.run(this) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "SFTP owned product/OS PASS\n") }); return
      }
      if (scope == "sftp-photos-owned") {
        System.loadLibrary("kloda_sftp_native")
        group("sftp-owned-photos-restore") { AndroidSftpPhotosRestoreChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "SFTP owned Photos source/publication/download/restore/reopen PASS\n") }); return
      }
      if (scope == "cloud18-destination") {
        group("cloud18-destination-migration") { AndroidDestinationMigrationChecks.run(scratch) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "backup_destination shared kind migration: rows kept, new kinds accepted, unknown refused, idempotent, fresh create, rollback PASS; production upgrade on device, queue wiring and iOS NOT_RUN here\n") })
        return
      }
      if (scope == "cloud18-oauth") {
        val provider = this.provider.orEmpty()
        group("cloud18-own-$provider") {
          AndroidOAuthChecks.run(IsolatedContext(targetContext, scratch), provider, {
            startActivitySync(android.content.Intent(targetContext, AndroidLifecycleActivity::class.java)
              .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) as Activity
          }) { sendStatus(0, Bundle().apply { putString("stream", "$it\n") }) }
        }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "$provider code+PKCE, Keystore custody, refresh and revoke where offered PASS; KlodaCloud module glue, product UI and physical hardware NOT_RUN\n") })
        return
      }
      if (scope == "cloud18-nextcloud") {
        group("cloud18-owned-nextcloud") {
          AndroidNextcloudChecks.run(IsolatedContext(targetContext, scratch)) { sendStatus(0, Bundle().apply { putString("stream", "$it\n") }) }
        }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Nextcloud Login Flow v2 grant/expiry/cancel, origin guards, per-destination Keystore custody/limit and owned DAV no-overwrite/revoke PASS; multi-destination queue, product UI, iOS and physical hardware NOT_RUN\n") })
        return
      }
      if (scope == "smb-profile") {
        group("smb-profile-owner") { AndroidSmbProfileChecks.run(this, scratch) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "SMB profile generations/pending-ready/native Keystore/unreadable-custody PASS; OS route/source/product/iOS positive Keychain NOT_RUN\n") })
        return
      }
      if (scope == "smb-files" || scope == "smb-product") {
        if (scope == "smb-product") group("smb-product-factory-service") { AndroidSmbProductChecks.run(this) }
        group("smb-owned-files") { if (scope != "smb-product") AndroidSmbFilesChecks.run(this, scratch) }
        group("smb-owned-sources") { AndroidSmbSourceChecks.run(this, scratch) }
        group("smb-photos-codec-authority") { AndroidSmbPhotosChecks.run(scratch) }
        if (scope == "smb-product") group("smb-owned-os-files") { AndroidSmbOsChecks.run(this) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Owned SMB JNI/SQLite/SAF/source-generation/OS-bound Files publication/reuse/keep-both/local restore and Photos codec authority PASS; media Photos/product flow/iOS/physical NOT_RUN\n") })
        return
      }
      if (scope == "smb-photos-owned") {
        group("smb-native-loader") { AndroidSmbFilesChecks.run(this, scratch) }
        group("smb-owned-photos-restore") { AndroidSmbPhotosRestoreChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Owned SMB MediaStore source/publication/metadata-only/receipt-bound restore/no duplicate/recovery checks PASS; iOS/product/physical NOT_RUN\n") })
        return
      }
      if (scope == "webdav-photos-restore") {
        group("webdav-owned-photos-restore") { AndroidWebDavPhotosRestoreChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Owned new MediaStore PNG, favorite-only DAV revision without media reupload, native receipt-bound Photos restore/metadata, same-process DB reopen/no duplicate, source-context and unknown-create fences PASS; Expo UI, fresh process, iOS, old APIs and physical hardware NOT_RUN\n") })
        return
      }
      if (scope == "webdav-saf") {
        group("webdav-owned-saf") { AndroidWebDavSafChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Actual owned DocumentsProvider/persisted URI permissions, native source scanner/HTTPS conflict/keep-both, explicit current-context review and local Files restore/reverify passed; system picker, Expo product UI, Photos and physical hardware NOT_RUN\n") })
        return
      }
      if (scope == "webdav-files") {
        group("webdav-owned-files-download") { AndroidWebDavFilesChecks.run(IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Owned private-byte HTTPS PUT/MOVE/GET and verified restore download, native vault/catalog without backup opt-in, unknown MOVE refusal PASS; SAF picker/provider, Photos import, UI and physical hardware NOT_RUN\n") })
        return
      }
      if (scope == "webdav-os") {
        group("webdav-real-jobservice") { AndroidWebDavOsChecks.run(this) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Actual native JobScheduler/JobService lease, MediaStore HTTPS backup without PC identity, durable next plan and global Pause passed; production cadence/physical hardware NOT_RUN\n") })
        return
      }
      if (scope == "webdav-https") {
        group("webdav-owned-https") { AndroidWebDavHttpsChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Source/snapshot/HTTPS PUT-MOVE-GET, lost replies, strict hostname, cookie/redirect, conflict/disk/excess, Photos metadata-only sidecar and context completion fence passed; UI/background/restore NOT_RUN\n") })
        return
      }
      if (scope == "webdav-journal") {
        group("webdav-publication-journal") { AndroidWebDavChecks.run(IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "WebDAV SQLite, native credential custody and sidecar checks passed; network/source/background/restore NOT_RUN\n") })
        return
      }
      group("native-library-load") { Class.forName("com.kloda.sync.KlodaPairingJni") }
      group("files-runs") { AndroidFilesRunChecks.run(IsolatedContext(targetContext, File(scratch, "runs").also { check(it.mkdirs()) })) }
      group("scheduled-journal") { AndroidScheduleChecks.run(IsolatedContext(targetContext, File(scratch, "schedule").also { check(it.mkdirs()) })) }
      group("files-recovery") { AndroidFilesQueueRecoveryChecks.run(IsolatedContext(targetContext, scratch)) }
      if (scope == "local-files") {
        group("foreground-service") { AndroidLifecycleChecks.run(this, IsolatedContext(targetContext, scratch)) }
        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Local Files/runtime checks passed; Photos/restore/transport NOT_RUN\n") })
        return
      }
      group("photos-sources") { AndroidPhotosSourceChecks.run(this, IsolatedContext(targetContext, scratch)) }
      group("own-restore") { AndroidOwnRestoreChecks.run(IsolatedContext(targetContext, scratch)) }
      group("photos-manifest") { AndroidPhotoManifestChecks.run(this, IsolatedContext(targetContext, scratch)) }
      group("photos-rebackup") { AndroidPhotoRebackupChecks.run(IsolatedContext(targetContext, File(scratch, "rebackup").also { check(it.mkdirs()) })) }
      group("photos-import") { AndroidPhotosImportChecks.run(this, IsolatedContext(targetContext, scratch)) }
      group("photos-catalog") { AndroidPhotosCatalogChecks.run(IsolatedContext(targetContext, scratch)) }
      group("foreground-service") { AndroidLifecycleChecks.run(this, IsolatedContext(targetContext, scratch)) }
      finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Android Files recovery, Photos manifest publication, import crash reconciliation and latest-asset catalog checks passed\n") })
    } catch (error: Throwable) {
      finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", error.stackTraceToString()) })
    } finally { scratch.deleteRecursively() }
  }

  private class IsolatedContext(context: Context, private val scratch: File) : ContextWrapper(context) {
    private fun directory(name: String): File = File(scratch, name).also { check(it.isDirectory || it.mkdirs()) }
    override fun getDatabasePath(name: String): File = if (File(name).isAbsolute) File(name) else File(directory("databases"), name)
    override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?): SQLiteDatabase =
      SQLiteDatabase.openOrCreateDatabase(getDatabasePath(name).path, factory)
    override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?, errorHandler: DatabaseErrorHandler?): SQLiteDatabase =
      SQLiteDatabase.openOrCreateDatabase(getDatabasePath(name).path, factory, errorHandler)
    override fun deleteDatabase(name: String): Boolean = SQLiteDatabase.deleteDatabase(getDatabasePath(name))
    override fun getFilesDir(): File = directory("files")
    override fun getNoBackupFilesDir(): File = directory("no-backup")
    override fun getCacheDir(): File = directory("cache")
    override fun getSharedPreferences(name: String, mode: Int) = super.getSharedPreferences("${scratch.name}-$name", mode)
  }
}
