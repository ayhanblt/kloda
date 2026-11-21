package com.kloda.sync

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class KlodaS3Module : Module() {
  private val uiOwner = Any()
  private val restoreLock = Any()
  @Volatile private var restore: AndroidS3RestoreTask? = null
  private var restoreSelecting = false
  private val cancelledRestoreRequests = mutableSetOf<UUID>()
  private fun cancelRestore(ticket: UUID? = null, includePicker: Boolean = true) {
    val previous = synchronized(restoreLock) {
      ticket?.let { cancelledRestoreRequests.add(it) }
      restore?.takeIf { (ticket == null || ticket == it.ticket) && (includePicker || !it.choosing) }?.also { cancelledRestoreRequests.add(it.ticket); restore = null }
    }
    previous?.pause()
  }
  @Volatile private var destroyed = false
  private val testGrant = AndroidS3TestGrant()
  private fun checkUi() {
    val owner = appContext.currentActivity as? androidx.lifecycle.LifecycleOwner
    if (destroyed || (appContext.reactContext?.getSystemService(android.app.KeyguardManager::class.java)?.isDeviceLocked != false) || owner?.lifecycle?.currentState?.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED) != true) throw S3Failure("candidate_stale")
  }
  private val queues = java.util.concurrent.ConcurrentHashMap<String, AndroidS3Queue>()
  private fun queue(provider: String): AndroidS3Queue = synchronized(AndroidSyncJournal.sourceLock) {
    queues.getOrPut(provider) {
      if (provider == "amazon-s3") return@getOrPut AndroidS3Runtime.queue(appContext.reactContext ?: throw S3Failure("storage_failure"))
      AndroidS3Queue(appContext.reactContext?.applicationContext ?: throw S3Failure("storage_failure"), owner(provider)) { runCatching { checkUi() }.isSuccess }
    }
  }
  private fun stopQueues() {
    cancelRestore(includePicker = false); testGrant.deactivate(); queues.values.forEach { it.cancelInMemory() }
    queues.values.forEach { runCatching { it.pauseForeground() } }
  }
  private fun requirePersonal(provider: String) { if (provider != "amazon-s3") throw S3Failure("provider_verification_required") }
  private val owners = mutableMapOf<String, AndroidS3Profiles>()
  private fun owner(provider: String): AndroidS3Profiles = synchronized(AndroidSyncJournal.sourceLock) {
    if (!BuildConfig.KLODA_S3_NATIVE) throw S3Failure("native_unavailable")
    if (provider !in setOf("amazon-s3", "s3-compatible")) throw S3Failure("invalid_request")
    if (provider == "amazon-s3") return@synchronized AndroidS3Runtime.queue(appContext.reactContext ?: throw S3Failure("storage_failure")).profiles
    owners.getOrPut(provider) {
      val context = appContext.reactContext ?: throw S3Failure("storage_failure")
      AndroidS3Profiles(context, AndroidS3Journal(context, provider))
    }
  }
  private fun status(provider: String): Map<String, Any> {
    if (provider !in setOf("amazon-s3", "s3-compatible")) throw S3Failure("invalid_request")
    if (!BuildConfig.KLODA_S3_NATIVE) return mapOf("provider" to provider, "supported" to false, "configured" to false, "enabled" to false, "canRun" to false)
    val personal = provider == "amazon-s3"
    val state = if (personal) queue(provider).status() else emptyMap()
    val captured = owner(provider).capture()
    return buildMap {
      put("provider", provider); put("supported", true); put("configured", captured != null); put("enabled", state["enabled"] ?: false); put("canRun", state["canRun"] ?: false); put("running", state["running"] ?: false)
      put("automaticEnabled", state["automaticEnabled"] ?: false); put("canAutomatic", personal && captured != null && state["enabled"] == true)
      put("canEnable", personal && captured != null); put("canTest", state["running"] != true && captured != null && captured.profile.target.prefix.isNotEmpty())
      state["run"]?.let { put("run", it) }
      captured?.profile?.target?.let { t -> put("profile", mapOf("endpoint" to t.endpoint, "region" to t.region, "bucket" to t.bucket, "prefix" to t.prefix, "pathStyle" to t.pathStyle)) }
    }
  }
  override fun definition() = ModuleDefinition {
    lateinit var restorePicker: AppContextActivityResultLauncher<DirectoryPickerInput, String?>
    RegisterActivityContracts { restorePicker = registerForActivityResult(DirectoryPickerContract(this@KlodaS3Module, true)) }
    Name("KlodaS3")
    Function("s3TestRequest") { UUID.randomUUID().toString() }
    Function("cancelS3Test") { request: String -> safe { testGrant.cancel(ticket(request)) } }
    OnCreate { if (BuildConfig.KLODA_S3_NATIVE) { AndroidS3Runtime.foreground(uiOwner, runCatching { checkUi() }.isSuccess); AndroidS3Automatic.reconcileAsync(appContext.reactContext ?: return@OnCreate) } }
    OnActivityEntersForeground { if (!destroyed && BuildConfig.KLODA_S3_NATIVE) { AndroidS3Runtime.foreground(uiOwner, runCatching { checkUi() }.isSuccess); appContext.reactContext?.let { AndroidS3Automatic.reconcileAsync(it) } } }
    OnActivityEntersBackground { AndroidS3Runtime.foreground(uiOwner, false); stopQueues() }
    OnActivityDestroys { AndroidS3Runtime.foreground(uiOwner, false); cancelRestore(); stopQueues() }
    OnDestroy { destroyed = true; AndroidS3Runtime.foreground(uiOwner, false); cancelRestore(); stopQueues() }
    AsyncFunction("testS3") { provider: String, request: String -> safe {
      checkUi(); if (queues[provider]?.available() == false) throw S3Failure("backup_busy"); val ticket = ticket(request); testGrant.activate(protected = true); testGrant.start(ticket)
      try {
        val profiles = owner(provider); val captured = profiles.capture() ?: throw S3Failure("profile_missing")
        val app = appContext.reactContext?.applicationContext ?: throw S3Failure("storage_failure")
        AndroidS3Diagnostic.run(app, profiles, captured, ticket) { checkUi(); testGrant.current(ticket) }
      } finally { testGrant.finish(ticket) }
    } }
    AsyncFunction("enableS3") { provider: String -> safe { checkUi(); requirePersonal(provider); testGrant.deactivate(); queue(provider).enable(); appContext.reactContext?.let { AndroidS3Automatic.reconcileAsync(it) }; status(provider) } }
    AsyncFunction("disableS3") { provider: String -> safe { checkUi(); cancelRestore(); testGrant.deactivate(); queue(provider).disable(); appContext.reactContext?.let { AndroidS3Automatic.reconcileAsync(it) }; status(provider) } }
    AsyncFunction("runS3") { provider: String -> safe { checkUi(); requirePersonal(provider); queue(provider).start(); status(provider) } }
    AsyncFunction("pauseS3") { provider: String -> safe { queue(provider).pause(); queue(provider).setAutomatic(false); appContext.reactContext?.let { AndroidS3Automatic.reconcileAsync(it) }; status(provider) } }
    AsyncFunction("automaticS3") { provider: String, enabled: Boolean -> safe {
      checkUi(); requirePersonal(provider); cancelRestore(); queue(provider).setAutomatic(enabled)
      appContext.reactContext?.let { AndroidS3Automatic.reconcileAsync(it) }; status(provider)
    } }
    AsyncFunction("reviewS3") { provider: String, id: String, request: String -> safe {
      checkUi(); requirePersonal(provider); ticket(id)
      if (!queue(provider).available() || restore != null) throw S3Failure("backup_busy")
      val token = ticket(request); testGrant.activate(true); testGrant.start(token)
      try {
        val profiles = owner(provider); val copy = AndroidS3Copy(profiles, id, request) { testGrant.current(token) }
        val app = appContext.reactContext?.applicationContext ?: throw S3Failure("storage_failure")
        var result: AndroidS3Job? = null
        AndroidS3Files(app, profiles, copy).run({ !testGrant.current(token) }) { result = it }
        val done = result ?: throw S3Failure("source_unavailable")
        mapOf("id" to done.id, "state" to "completed", "path" to (done.logicalPath ?: done.reference))
      } finally { testGrant.finish(token) }
    } }
    AsyncFunction("s3Backups") { provider: String, after: String, issues: Boolean -> safe {
      checkUi(); AndroidS3Backups.list(owner(provider), after, issues)
    } }
    AsyncFunction("cancelS3Restore") { request: String -> safe { cancelRestore(ticket(request)) } }
    AsyncFunction("restoreS3File") Coroutine { provider: String, id: String, request: String ->
      val session = withContext(Dispatchers.IO) { safe {
        checkUi(); ticket(id); if (queues[provider]?.available() == false) throw S3Failure("backup_busy")
        val profiles = owner(provider); val captured = profiles.capture() ?: throw S3Failure("profile_missing")
        val app = appContext.reactContext?.applicationContext ?: throw S3Failure("storage_failure")
        val binding = FilesRunContext.webdav(app).binding; val token = ticket(request)
        lateinit var current: AndroidS3FilesRestore
        current = AndroidS3FilesRestore(app, profiles.journal, profiles, captured, binding, token) {
          synchronized(restoreLock) { if (restore !== current) throw S3Failure("cancelled") }
          if (!current.choosing) checkUi()
        }
        synchronized(restoreLock) {
          if (token in cancelledRestoreRequests) throw S3Failure("cancelled")
          if (restore != null || restoreSelecting) throw S3Failure("backup_busy")
          restore = current; restoreSelecting = true
        }
        current
      } }
      try {
        val tree = restorePicker.launch(DirectoryPickerInput(request)) ?: throw S3Failure("cancelled")
        synchronized(restoreLock) { if (restore === session || restore == null) restoreSelecting = false }
        awaitRestoreForeground(appContext.currentActivity)
        withContext(Dispatchers.IO) { safe { session.choosing = false; session.restore(tree, id) } }
      } catch (error: Exception) { safe { throw error } }
      finally {
        synchronized(restoreLock) { if (restore === session) { restore = null; restoreSelecting = false } else if (restore == null) restoreSelecting = false }
        session.pause()
      }
    }
    AsyncFunction("restoreS3Photos") Coroutine { provider: String, id: String, request: String ->
      val session = withContext(Dispatchers.IO) { safe {
        checkUi(); ticket(id); if (queues[provider]?.available() == false) throw S3Failure("backup_busy")
        val profiles = owner(provider); val captured = profiles.capture() ?: throw S3Failure("profile_missing")
        val app = appContext.reactContext?.applicationContext ?: throw S3Failure("storage_failure")
        val binding = FilesRunContext.webdav(app).binding; val token = ticket(request)
        lateinit var current: AndroidS3PhotosRestore
        current = AndroidS3PhotosRestore(app, profiles.journal, profiles, captured, binding, token) {
          synchronized(restoreLock) { if (restore !== current) throw S3Failure("cancelled") }; checkUi()
        }
        synchronized(restoreLock) {
          if (token in cancelledRestoreRequests) throw S3Failure("cancelled")
          if (restore != null || restoreSelecting) throw S3Failure("backup_busy")
          restore = current
        }; current
      } }
      try { withContext(Dispatchers.IO) { safe { session.restore(id) } } }
      finally { synchronized(restoreLock) { if (restore === session) restore = null }; session.pause() }
    }
    AsyncFunction("s3Status") { provider: String -> safe { status(provider) } }
    AsyncFunction("configureS3") { provider: String, fields: Map<String, Any?> -> safe {
      checkUi(); cancelRestore(); testGrant.deactivate(); queues[provider]?.pause("settings_changed")
      if (fields.keys != setOf("endpoint", "region", "bucket", "prefix", "pathStyle", "accessKey", "secret", "token") ||
        fields["pathStyle"] !is Boolean || (fields["token"] != null && fields["token"] !is String)) throw S3Failure("invalid_request")
      fun text(key: String): String = fields[key] as? String ?: throw S3Failure("invalid_request")
      val accessKey = text("accessKey")
      val generation = UUID.randomUUID().toString()
      owner(provider).save(S3Target(provider, text("endpoint"), text("region"), text("bucket"), text("prefix"), fields["pathStyle"] as Boolean,
        S3Target.hash(accessKey), generation, generation), accessKey, text("secret"), fields["token"] as? String, ::checkUi)
      appContext.reactContext?.let { AndroidS3Automatic.reconcileAsync(it) }; status(provider)
    } }

  }
  private fun ticket(value: String): UUID = runCatching { UUID.fromString(value).also { if (it.toString() != value) throw S3Failure("invalid_request") } }
    .getOrElse { throw S3Failure("invalid_request") }
  private fun <T> safe(block: () -> T): T = try { block() }
    catch (error: S3Failure) { throw expo.modules.kotlin.exception.CodedException(error.code, error.code, null) }
    catch (error: FilesFailure) { throw expo.modules.kotlin.exception.CodedException(error.code, error.code, null) }
    catch (_: Exception) { throw expo.modules.kotlin.exception.CodedException("storage_failure", "storage_failure", null) }
}
