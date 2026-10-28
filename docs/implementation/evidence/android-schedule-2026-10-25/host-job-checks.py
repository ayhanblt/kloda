"""Replay production Scheduler/Job against bounded host doubles; never Android OS acceptance."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

root = next(p for p in Path(__file__).resolve().parents if (p/'packages/pairing-native/Cargo.toml').is_file())
out = root/'.local-evidence/android-schedule-2026-10-25/job-host'
out.mkdir(parents=True, exist_ok=True)
base = root/'apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync'
sources = {
'content.kt': '''package android.content
open class Context {
 open val applicationContext: Context get() = this
 val contentResolver = Any()
 fun getSharedPreferences(name: String, mode: Int) = Host.preferences
 @Suppress("UNCHECKED_CAST") fun <T> getSystemService(type: Class<T>): T = Host.scheduler as T
}
class ComponentName(context: Context, type: Class<*>)
object Host { val preferences = Preferences(); val scheduler = android.app.job.JobScheduler() }
class Preferences {
 var failCommit=false
 val values = java.util.concurrent.ConcurrentHashMap<String,Any>()
 fun contains(key: String) = values.containsKey(key)
 fun getString(key: String, fallback: String?): String? = values[key] as? String ?: fallback
 fun getBoolean(key: String, fallback: Boolean) = values[key] as? Boolean ?: fallback
 fun getInt(key: String, fallback: Int) = values[key] as? Int ?: fallback
 fun getLong(key: String, fallback: Long) = values[key] as? Long ?: fallback
 fun edit() = Editor(this)
 class Editor(val preferences: Preferences) {
  val pending = mutableMapOf<String,Any?>()
  fun putString(key: String, value: String?) = apply { pending[key] = value }
  fun putBoolean(key: String, value: Boolean) = apply { pending[key] = value }
  fun putLong(key: String, value: Long) = apply { pending[key] = value }
  fun putInt(key: String, value: Int) = apply { pending[key] = value }
  fun remove(key: String) = apply { pending[key] = null }
  fun commit(): Boolean { pending.forEach { (key,value) -> if(value==null) preferences.values.remove(key) else preferences.values[key]=value }; return !preferences.failCommit }
 }
}
''',
'job.kt': '''package android.app.job
import android.content.*
import android.os.PersistableBundle
class JobInfo(val id: Int, val extras: PersistableBundle, val latency: Long) {
 class Builder(val id: Int, component: ComponentName) {
  var extras=PersistableBundle(); var latency=0L
  fun setExtras(value: PersistableBundle)=apply { extras=value }
  fun setMinimumLatency(value: Long)=apply { latency=value }
  fun setRequiredNetworkType(value: Int)=this
  fun setPersisted(value: Boolean)=this
  fun addTriggerContentUri(value: TriggerContentUri)=this
  fun build()=JobInfo(id,extras,latency)
 }
 class TriggerContentUri(uri: android.net.Uri, flags: Int) { companion object { const val FLAG_NOTIFY_FOR_DESCENDANTS=1 } }
 companion object { const val NETWORK_TYPE_ANY=1; fun getMinPeriodMillis()=900000L }
}
class JobScheduler {
 val jobs=java.util.concurrent.ConcurrentHashMap<Int,JobInfo>()
 var schedules=0
 fun cancel(id:Int) { jobs.remove(id) }
 fun getPendingJob(id:Int)=jobs[id]
 fun schedule(job:JobInfo):Int { jobs[job.id]=job; schedules++; return RESULT_SUCCESS }
 companion object { const val RESULT_SUCCESS=1 }
}
class JobParameters(val jobId:Int, val extras:PersistableBundle)
open class JobService: Context() {
 val finished=java.util.concurrent.atomic.AtomicInteger()
 open fun onStartJob(params:JobParameters)=false
 open fun onStopJob(params:JobParameters)=false
 open fun onDestroy() {}
 fun jobFinished(params:JobParameters, retry:Boolean) { finished.incrementAndGet() }
}
''',
'os.kt': '''package android.os
class PersistableBundle {
 val values=mutableMapOf<String,Any>()
 fun putString(key:String,value:String) { values[key]=value }
 fun putLong(key:String,value:Long) { values[key]=value }
 fun putInt(key:String,value:Int) { values[key]=value }
 fun getInt(key:String,fallback:Int=0)=values[key] as? Int ?: fallback
 fun getString(key:String)=values[key] as? String
 fun getLong(key:String,fallback:Long=0L)=values[key] as? Long ?: fallback
}
object SystemClock { var now=10_000L; fun elapsedRealtime()=now }
''',
'uri.kt': '''package android.net
data class Uri(val value:String) { companion object { fun parse(value:String)=Uri(value) } }
''',
'provider.kt': '''package android.provider
object Settings { object Global { const val BOOT_COUNT="boot"; var boot=7; fun getInt(resolver:Any,key:String)=boot } }
object DocumentsContract { fun getTreeDocumentId(uri:android.net.Uri)="tree"; fun buildChildDocumentsUriUsingTree(uri:android.net.Uri,id:String)=uri }
object MediaStore {
 object Images { object Media { val EXTERNAL_CONTENT_URI=android.net.Uri("images") } }
 object Video { object Media { val EXTERNAL_CONTENT_URI=android.net.Uri("videos") } }
}
''',
'json.kt': '''package org.json
class JSONObject(val raw:String) {
 fun optString(key:String)=if(key=="phase") raw else ""
 fun optBoolean(key:String,fallback:Boolean)=false
 fun getString(key:String)="peer"
}
''',
'doubles.kt': '''package com.kloda.sync
import android.content.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
class FilesFailure(val code:String):Exception(code)
data class FilesRunContext(val binding:String,val sources:Map<String,String>) { companion object {
 fun capture(context:Context)=FilesRunContext("binding",mapOf("source" to "photos:library"))
} }
object AndroidPhotosSources { fun isPhotos(value:String)=value.startsWith("photos:") }
object AndroidBackupNotifications {
 fun enabled(context:Context)=true
 fun clearFailure(context:Context) {}
 fun progress(context:Context) {}
 fun clear(context:Context) {}
 fun failure(context:Context) {}
}
class HostCursor:java.io.Closeable { fun moveToFirst()=false; fun getString(column:Int)=""; override fun close() {} }
class HostDatabase { fun rawQuery(sql:String,args:Array<String>)=HostCursor() }
class AndroidSyncJournal(context:Context):java.io.Closeable { val readableDatabase=HostDatabase(); override fun close() {} }
object KlodaPairingJni { var phase="complete"; fun status(owner:Long)=phase }
class Queue {
 @Volatile var active=false
 val starts=java.util.concurrent.atomic.AtomicInteger()
 val pauses=java.util.concurrent.atomic.AtomicInteger()
 @Volatile var gate=CountDownLatch(1)
 fun running()=active
 fun start(record:String,owner:Long,expectedBinding:String?=null):Map<String,Any> { starts.incrementAndGet(); active=true; gate=CountDownLatch(1); return mapOf("run" to mapOf("id" to "run-A")) }
 fun requestPause() { pauses.incrementAndGet(); active=false; gate.countDown() }
 fun awaitStopped() { check(gate.await(3,TimeUnit.SECONDS)); active=false }
}
object AndroidPairingRuntime {
 val lock=Any()
 var files:Queue?=Queue()
 @Volatile var lease:Any?=null
 fun hasScheduledLease()=lease!=null
 fun queue(context:Context)=files!!
 fun currentOwner(context:Context)=1L
 fun beginScheduled(token:Any):Boolean { if(lease!=null)return false; lease=token; return true }
 fun endScheduled(token:Any,interrupt:Boolean=false) { synchronized(lock) { if(lease===token) { if(interrupt)files!!.requestPause(); lease=null } } }
}
internal class AndroidScheduleJournal(db:AndroidSyncJournal) {
 companion object {
  val rows=java.util.concurrent.ConcurrentHashMap<String,ScheduledOccurrence>()
  @Volatile var linkedTerminal=false
  val reconciled=java.util.concurrent.atomic.AtomicInteger()
  val stopped=java.util.concurrent.atomic.AtomicInteger()
 }
 fun get(binding:String,occurrence:Long)=rows.values.firstOrNull { it.binding==binding && it.occurrenceMs==occurrence }
 fun find(id:String)=rows[id]
 fun claim(binding:String,record:String,occurrence:Long,wall:Long,elapsed:Long,boot:Int?,dueByElapsed:Boolean=false):ScheduledOccurrence? {
  val old=get(binding,occurrence)
  if(old!=null)return null
  return ScheduledOccurrence("occ-$occurrence",binding,record,occurrence).also { rows[it.id]=it }
 }
 fun reconcileLinked(id:String,attempt:Int):Boolean {
  if(!linkedTerminal)return false
  rows[id]?.let { rows[id]=it.copy(phase="finished",updated=1) }; reconciled.incrementAndGet(); return true
 }
 fun recoverStopped(id:String,idle:Boolean,wall:Long,elapsed:Long,boot:Int?,attempt:Int) { stop(id,wall,elapsed,boot,attempt) }
 fun resumePaused(id:String,wall:Long,elapsed:Long,boot:Int?)=rows[id]?.copy(phase="running")?.also { rows[id]=it }
 fun attachRun(id:String,run:String,attempt:Int) { rows[id]?.let { rows[id]=it.copy(runId=run) } }
 fun stop(id:String,wall:Long,elapsed:Long,boot:Int?,attempt:Int,userPause:Boolean=false,error:String?=null) {
  rows[id]?.let { rows[id]=it.stopped(wall,elapsed,boot,userPause,error) }; stopped.incrementAndGet()
 }
 fun finish(id:String,verified:Boolean,attempt:Int,error:String?=null) { rows[id]?.let { rows[id]=it.copy(phase="finished",updated=if(verified)1 else 0,error=error) } }
}
fun waitFor(label:String, check:()->Boolean) {
 val limit=System.nanoTime()+2_000_000_000L
 while(!check()) { if(System.nanoTime()>limit) error("Timeout: $label preferences=${Host.preferences.values} jobs=${Host.scheduler.jobs.keys}"); Thread.sleep(2) }
}
fun reset() {
 Host.preferences.failCommit=false; AndroidBackupScheduler.resume(Context())
 Host.preferences.values.clear(); Host.scheduler.jobs.clear()
 Host.preferences.values["automaticBinding"]="binding"
 Host.preferences.values["backupMode"]="live"
 AndroidScheduleJournal.rows.clear(); AndroidScheduleJournal.linkedTerminal=false
 AndroidPairingRuntime.files=Queue(); AndroidPairingRuntime.lease=null; KlodaPairingJni.phase="complete"
}
fun params(occurrence:Long,token:String)=android.app.job.JobParameters(AndroidBackupScheduler.JOB,android.os.PersistableBundle().apply {
 Host.preferences.values["automaticDispatchToken"]=token
 putString("binding","binding"); putLong("occurrence",occurrence); putLong("dispatch",occurrence); putString("token",token)
})
fun iso(value:String)=java.time.Instant.parse(value).toEpochMilli()
fun main() {
 val context=Context(); reset()
 AndroidBackupScheduler.reconcile(context)
 check(Host.scheduler.jobs.containsKey(AndroidBackupScheduler.JOB))
 AndroidBackupScheduler.pause(context)
 check(AndroidBackupScheduler.paused(Context()) && Host.scheduler.jobs.isEmpty())
 AndroidBackupScheduler.reconcile(Context())
 check(AndroidBackupScheduler.paused(context) && Host.scheduler.jobs.isEmpty())
 println("PASS pause durable across fresh Context/reconcile; no automatic unpause on opening")
 Host.preferences.failCommit=true
 try { AndroidBackupScheduler.resume(context); error("failed disk commit accepted") }
 catch(error:FilesFailure) { check(error.code=="storage_failure") }
 check(AndroidBackupScheduler.paused(context))
 AndroidBackupScheduler.reconcile(context)
 check(Host.scheduler.jobs.isEmpty())
 Host.preferences.failCommit=false
 AndroidBackupScheduler.resume(context)
 check(!AndroidBackupScheduler.paused(context))
 println("PASS failed resume commit stays blocked even when preferences memory changed")
 reset(); Host.preferences.values["automaticDue"]=1000L
 AndroidBackupScheduler.reconcile(context)
 val pending=Host.scheduler.jobs[AndroidBackupScheduler.JOB]!!
 val pendingToken=pending.extras.getString("token")!!; val count=Host.scheduler.schedules
 AndroidBackupScheduler.next(context,"binding",1000L,null,"old-token")
 check(Host.scheduler.jobs[AndroidBackupScheduler.JOB]===pending && Host.scheduler.schedules==count)
 check(Host.preferences.getString("automaticDispatchToken",null)==pendingToken && Host.preferences.getLong("automaticDue",0)==1000L)
 println("PASS stale finally token cannot cancel or replace newer same-occurrence dispatch")
 reset()
 val original=java.util.TimeZone.getDefault()
 try {
  Host.preferences.values["intervalHours"]=24; Host.preferences.values["localTime"]="02:30"
  java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Europe/Berlin"))
  check(AndroidBackupScheduler.nextScheduled(context,iso("2026-03-29T00:00:00Z"))==iso("2026-03-29T01:00:00Z"))
  check(AndroidBackupScheduler.nextScheduled(context,iso("2026-10-24T23:00:00Z"))==iso("2026-10-25T00:30:00Z"))
  check(AndroidBackupScheduler.nextScheduled(context,iso("2026-10-25T00:45:00Z"))==iso("2026-10-26T01:30:00Z"))
  Host.preferences.values["localTime"]="12:00"
  java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Europe/Istanbul"))
  check(AndroidBackupScheduler.nextScheduled(context,iso("2026-10-25T08:00:00Z"))==iso("2026-10-25T09:00:00Z"))
  java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"))
  check(AndroidBackupScheduler.nextScheduled(context,iso("2026-10-25T08:00:00Z"))==iso("2026-10-25T12:00:00Z"))
 } finally { java.util.TimeZone.setDefault(original) }
 println("PASS actual Calendar spring gap, fall overlap once, and timezone re-anchor")
 for (wallOffset in listOf(-60000L,3600000L)) {
  reset(); val missed=System.currentTimeMillis()+wallOffset
  Host.preferences.values["backupMode"]="scheduled"
  Host.preferences.values["automaticDue"]=missed; Host.preferences.values["automaticOccurrence"]=missed
  Host.preferences.values["automaticDueElapsed"]=android.os.SystemClock.now-1
  Host.preferences.values["automaticDueBoot"]=7
  AndroidBackupScheduler.reconcile(context,clockChanged=true)
  val catchup=Host.scheduler.jobs[AndroidBackupScheduler.JOB]!!
  check(catchup.extras.getLong("occurrence")==missed && catchup.latency==0L)
  check(catchup.extras.getLong("dueElapsed")<=android.os.SystemClock.now)
 }
 println("PASS missed pending occurrence survives time change and backward-wall catch-up")
 reset(); Host.preferences.values["backupMode"]="scheduled"
 Host.preferences.values["intervalHours"]=24; Host.preferences.values["localTime"]="00:01"
 Host.preferences.values["automaticDue"]=System.currentTimeMillis()+600000
 Host.preferences.values["automaticDueElapsed"]=android.os.SystemClock.now+600000
 Host.preferences.values["automaticDueBoot"]=7
 AndroidPairingRuntime.files!!.active=true
 val expected=AndroidBackupScheduler.nextScheduled(context,System.currentTimeMillis())
 AndroidBackupScheduler.reconcile(context,clockChanged=true)
 check(Host.scheduler.jobs[AndroidBackupScheduler.JOB]!!.extras.getLong("dispatch")==expected)
 check(AndroidPairingRuntime.files!!.running())
 println("PASS timezone re-anchor during manual transfer leaves that transfer active")
 val retry=ScheduledOccurrence("retry","binding","peer",1,phase="waiting",retryAt=Long.MAX_VALUE,retryElapsed=310000,retryBoot=7)
 android.os.SystemClock.now=10000
 val start=System.currentTimeMillis(); val due=AndroidBackupScheduler.retryTime(context,retry)!!
 check(due-start in 300000..300100)
 val shifted=AndroidBackupScheduler.retryTime(context,retry.copy(retryAt=0))!!
 check(kotlin.math.abs(shifted-due)<100)
 android.os.SystemClock.now=310000
 check(kotlin.math.abs(AndroidBackupScheduler.retryTime(context,retry)!!-System.currentTimeMillis())<100)
 println("PASS monotonic five-minute dispatch projection ignores forward/backward wall deadline hints")
 reset(); val early=System.currentTimeMillis()-1; Host.preferences.values["automaticDue"]=early
 KlodaPairingJni.phase="idle"
 val earlyJob=AndroidBackupJob(); check(earlyJob.onStartJob(params(early,"early")))
 waitFor("early pairing finished") { earlyJob.finished.get()==1 && Host.preferences.getLong("automaticDue",0)>early }
 check(AndroidPairingRuntime.files!!.starts.get()==0 && AndroidPairingRuntime.lease==null)
 check(Host.scheduler.jobs[AndroidBackupScheduler.JOB]!!.extras.getLong("dispatch")>early)
 println("PASS early pairing-not-complete retains future Live opportunity without trust resume or queue start")
 reset(); val old=System.currentTimeMillis()-1; Host.preferences.values["automaticDue"]=old
 AndroidScheduleJournal.rows["linked"]=ScheduledOccurrence("linked","binding","peer",old,runId="run-A")
 AndroidScheduleJournal.linkedTerminal=true
 val recovery=AndroidBackupJob(); check(recovery.onStartJob(params(old,"recovery")))
 waitFor("linked recovery") { recovery.finished.get()==1 }
 check(AndroidPairingRuntime.files!!.starts.get()==0 && AndroidScheduleJournal.rows["linked"]!!.updated==1)
 println("PASS linked terminal run-A recovers without queue.start creating run-B")
 reset(); val now=System.currentTimeMillis()-1; Host.preferences.values["automaticDue"]=now
 val job=AndroidBackupJob(); val a=params(now,"A")
 check(job.onStartJob(a)); waitFor("first start") { AndroidPairingRuntime.files!!.starts.get()==1 }
 check(!job.onStartJob(a)); check(AndroidPairingRuntime.files!!.starts.get()==1)
 check(!job.onStopJob(a)); waitFor("first stop") { AndroidScheduleJournal.stopped.get()>0 && AndroidPairingRuntime.lease==null }
 waitFor("old stop scheduling") { (Host.scheduler.jobs[AndroidBackupScheduler.JOB]?.extras?.getLong("dispatch",0) ?: 0) > now }
 val second=now+1; Host.preferences.values["automaticDue"]=second
 val b=params(second,"B"); check(job.onStartJob(b)); waitFor("second start") { AndroidPairingRuntime.files!!.starts.get()==2 }
 val pauses=AndroidPairingRuntime.files!!.pauses.get()
 job.onStopJob(a)
 check(AndroidPairingRuntime.files!!.pauses.get()==pauses && AndroidPairingRuntime.files!!.running() && AndroidPairingRuntime.lease!=null)
 AndroidBackupScheduler.pause(context); job.onStopJob(b)
 waitFor("final release") { AndroidPairingRuntime.lease==null }
 println("PASS duplicate dispatch coalesced; delayed onStop token-A cannot interrupt token-B")
 println("HOST ONLY: Android scheduling, persisted delivery, process death and device acceptance NOT RUN")
}
'''}
for name, source in sources.items():
    (out/name).write_text(source)
cache = Path.home()/'.gradle/caches/modules-2/files-2.1'
jars = [str(p) for group in ('org.jetbrains.kotlin','org.jetbrains.kotlinx','org.jetbrains.intellij.deps','org.jetbrains')
        for p in (cache/group).rglob('*.jar') if ('2.1.20' in str(p) or 'kotlinx-coroutines-core-jvm' in str(p)
        or 'trove4j' in str(p) or 'annotations' in str(p))]
stdlib = next(p for p in jars if p.endswith('/kotlin-stdlib-2.1.20.jar'))
production = ['AndroidBackupScheduler.kt', 'AndroidBackupJob.kt', 'ScheduledOccurrence.kt']
compiler = ['java','-cp',os.pathsep.join(jars),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-nowarn',
            '-no-stdlib','-no-reflect','-classpath',stdlib,'-d',str(out/'classes'),
            *[str(out/name) for name in sources],*[str(base/name) for name in production]]
compiled = subprocess.run(compiler, capture_output=True, text=True)
(out/'compile-output.txt').write_text(compiled.stdout+compiled.stderr)
if compiled.returncode:
    print(compiled.stdout+compiled.stderr)
    raise SystemExit(compiled.returncode)
result = subprocess.run(['java','-cp',str(out/'classes')+os.pathsep+stdlib,'com.kloda.sync.DoublesKt'],capture_output=True,text=True)
(out/'output.txt').write_text(result.stdout+result.stderr)
(out/'verification.json').write_text(json.dumps({'kind':'Production Scheduler/Job Kotlin host replay with bounded Android/storage/runtime doubles',
    'exitCode':result.returncode,'productionSources':{name:hashlib.sha256((base/name).read_bytes()).hexdigest() for name in production},
    'limits':['No real Android JobScheduler, storage journal, native authority or process death exercised here.',
              'SharedPreferences persistence is a shared host map, not Android disk proof.',
              'Occurrence journal/membership SQL and real child-process reopen are checked separately.']},indent=2)+'\n')
print(result.stdout+result.stderr)
raise SystemExit(result.returncode)
