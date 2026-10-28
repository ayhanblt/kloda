"""Production Kotlin service/runtime against bounded Android doubles, not OS acceptance."""
from pathlib import Path
import os, subprocess
root = next(p for p in Path(__file__).resolve().parents if (p/'packages/pairing-native/Cargo.toml').is_file())
out = root/'.local-evidence/android-background-owner-2026-10-25/host'
out.mkdir(parents=True, exist_ok=True)
sources = {
'content.kt': '''package android.content
open class Intent(context: Context? = null, cls: Class<*>? = null)
open class Context {
 open val applicationContext: Context get() = this
 val packageName = "fixture"
 val packageManager = android.content.pm.PackageManager()
 @Suppress("UNCHECKED_CAST") fun <T> getSystemService(type: Class<T>): T = android.app.NotificationManager() as T
 fun getString(id: Int) = "fixture"
 open fun startForegroundService(intent: Intent): Any? = startService(intent)
 open fun startService(intent: Intent): Any? = null
}
''',
'pm.kt': '''package android.content.pm
class PackageManager { fun getLaunchIntentForPackage(name: String) = android.content.Intent() }
object ServiceInfo { const val FOREGROUND_SERVICE_TYPE_DATA_SYNC = 1 }
''',
'os.kt': '''package android.os
interface IBinder
object Build { object VERSION { var SDK_INT = 36 } }
''',
'r.kt': '''package android
object R { object drawable { const val stat_sys_upload = 1 } }
''',
'app.kt': '''package android.app
import android.content.*
open class Service: Context() {
 var stops = 0
 var notifications = 0
 open fun onCreate() {}
 open fun onBind(intent: Intent?): android.os.IBinder? = null
 open fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = 0
 open fun onTimeout(startId: Int, fgsType: Int) {}
 open fun onDestroy() {}
 fun startForeground(id: Int, notification: Notification, type: Int = 0) { notifications++ }
 fun stopForeground(flags: Int) {}
 fun stopSelf() { stops++ }
 companion object { const val START_NOT_STICKY = 2; const val STOP_FOREGROUND_REMOVE = 1 }
}
class Notification {
 class Builder(context: Context, channel: String = "") {
  fun setSmallIcon(value: Int) = this
  fun setContentTitle(value: String) = this
  fun setContentText(value: String) = this
  fun setOngoing(value: Boolean) = this
  fun setOnlyAlertOnce(value: Boolean) = this
  fun setContentIntent(value: PendingIntent) = this
  fun build() = Notification()
 }
}
class NotificationChannel(id: String, name: String, importance: Int)
class NotificationManager {
 fun createNotificationChannel(channel: NotificationChannel) {}
 companion object { const val IMPORTANCE_LOW = 2 }
}
class PendingIntent { companion object {
 const val FLAG_IMMUTABLE = 1; const val FLAG_UPDATE_CURRENT = 2
 fun getActivity(context: Context, request: Int, intent: Intent, flags: Int) = PendingIntent()
} }
''',
'doubles.kt': '''package com.kloda.sync
import android.content.*
object R { object string {
 const val kloda_backup_channel = 1; const val kloda_backup_title = 2; const val kloda_backup_body = 3
} }
class FilesFailure(val code: String): Exception(code)
class KlodaPairingPlatform(context: Context) { fun nativeClose(value: String) {} }
object KlodaPairingJni {
 var opens = 0
 val states = mutableListOf<Boolean>()
 fun open(platform: KlodaPairingPlatform): Long = (++opens).toLong()
 fun setForeground(id: Long, active: Boolean) { states.add(active) }
}
class AndroidFilesQueue(context: Context, val onStopped: (Thread)->Unit = {}, val mayRun: ()->Boolean) {
 var pauses = 0
 fun requestPause() { pauses++ }
 fun running() = false
}
class HostContext: Context() {
 var next: AndroidFilesService? = null
 var reject = false
 override fun startService(intent: Intent): Any? {
  if (reject) throw SecurityException("fixture rejection")
  val service = next ?: AndroidFilesService().also { next = it; it.onCreate() }
  service.onStartCommand(intent, 0, 1)
  return service
 }
}
fun main() {
 val context = HostContext()
 val first = Any(); val second = Any()
 AndroidPairingRuntime.attach(first, true)
 val id = AndroidPairingRuntime.currentOwner(context)
 val queue = AndroidPairingRuntime.queue(context)
 AndroidPairingRuntime.foreground(first, false)
 check(AndroidPairingRuntime.currentOwner(context) == id && KlodaPairingJni.opens == 1)
 check(queue.pauses == 0 && !KlodaPairingJni.states.last())
 AndroidPairingRuntime.attach(second, true)
 AndroidPairingRuntime.detach(first)
 check(KlodaPairingJni.states.last())
 try { AndroidPairingRuntime.checkUi(first); error("stale UI accepted") } catch (_: FilesFailure) {}
 AndroidPairingRuntime.checkUi(second)
 println("owner survives UI departure; stale UI token rejected")
 AndroidFilesService.acquire(context)
 check(AndroidFilesService.running() && queue.mayRun())
 val old = context.next!!
 check(old.notifications > 0 && old.onStartCommand(null, 0, 2) == 2)
 AndroidFilesService.stop()
 try { AndroidFilesService.acquire(context); error("retiring service accepted") }
 catch (error: FilesFailure) { check(error.code == "background_unavailable") }
 check(!AndroidFilesService.running())
 context.next = null
 AndroidFilesService.acquire(context)
 val fresh = context.next!!
 val pauses = queue.pauses
 old.onDestroy()
 check(AndroidFilesService.running() && queue.pauses == pauses)
 println("retiring instance rejected; delayed old destroy cannot stop fresh service")
 fresh.onTimeout(1, 1)
 check(!AndroidFilesService.running() && queue.pauses == pauses+1 && fresh.stops > 0)
 fresh.onDestroy()
 check(queue.pauses == pauses+1)
 println("timeout pauses once; no automatic restart")
 context.next = null; context.reject = true
 try { AndroidFilesService.acquire(context); error("platform rejection accepted") }
 catch (error: FilesFailure) { check(error.code == "background_unavailable") }
 check(!AndroidFilesService.running() && !queue.mayRun())
 println("platform start rejection does not grant execution")
}
'''}
for name, text in sources.items(): (out/name).write_text(text)
cache = Path.home()/'.gradle/caches/modules-2/files-2.1'
jars=[]
for group in ('org.jetbrains.kotlin','org.jetbrains.kotlinx','org.jetbrains.intellij.deps','org.jetbrains'):
 jars.extend(str(p) for p in (cache/group).rglob('*.jar') if ('2.1.20' in str(p) or 'kotlinx-coroutines-core-jvm' in str(p) or 'trove4j' in str(p) or 'annotations' in str(p)))
stdlib=next(p for p in jars if p.endswith('/kotlin-stdlib-2.1.20.jar'))
base=root/'apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync'
classes=out/'classes'
subprocess.run(['java','-cp',os.pathsep.join(jars),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-nowarn','-no-stdlib','-no-reflect','-classpath',stdlib,'-d',str(classes),*[str(out/p) for p in sources],str(base/'AndroidFilesService.kt'),str(base/'AndroidPairingRuntime.kt')],check=True)
subprocess.run(['java','-cp',str(classes)+os.pathsep+stdlib,'com.kloda.sync.DoublesKt'],check=True)
