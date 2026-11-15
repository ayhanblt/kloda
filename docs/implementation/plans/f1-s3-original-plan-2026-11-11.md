# 1.4b / F1 — S3 atomik otomatik kabul ve tek-sahipli OS projection

> Tarihî sözleşme: 15.11 FTPS planlamasında eski `next-plan.md` buraya taşındı;
> aşağıdaki onay/tarihçe yeniden uygulama yetkisi değildir. Güncel S3 kabulü ve
> supersession zinciri CURRENT → R14-C1 review/manifest'tir. Eski belgelerdeki
> S3 `next-plan.md` bölüm atıfları bu tarihî içeriğe aittir, yeni FTPS planına değil.

> **12.11 aktif FIX yönlendirmesi:** İlk uygulama planını yeniden uygulama.
> R12/R3 için kullanıcı-onaylı [ayrı clock reconcile sözleşmesi](f1-r12-clock-reconcile-fix.md)
> geçerlidir; ilgili clock-dirty/early-callback/wake/test bölümlerini scoped supersede
> eder. Güncel durum ve son manifest/review pointers: `../CURRENT.md`.

Tarih: 11.11.2026. GPT tasarımı; HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`.

**Durum: S3 uygulama kapsamı kullanıcı tarafından onaylandı — 11.11.2026; ayrı Opus uygulamasına hazır.**
Kullanıcı §7 kesin S3 uygulama kapsamını ve DB belirsizliği çözülene kadar ilgili
queue'da manuel başlangıçları da engelleyen §4.1 storage fence davranışını açıkça
onayladı. İzin yalnız bu planın kapsamındaki ayrı Opus uygulamasıdır; GPT bu
oturumda ürün kodu değiştirmez. Bu belge önceki koşullu
S3 tasarımını supersede eder; araştırma bulguları aşağıda korunur. 1.4b kapanmaz:
FTPS düzeltmesi ayrıca planlanacaktır; bu uygulama FTPS ürün/şema değişikliği içermez.
Uygulama ayrı kullanıcı-başlatmalı Opus, kabul ayrı GPT gerçek-diff review oturumudur.
Native/güvenlik diff'i nedeniyle high önerilir; model/effort otomatik değiştirilmez.

## 1. Amaç, dayanak ve kapsam

Yetkili ama henüz kabul edilmemiş Amazon S3 occurrence'ı kilitte tüketilmesin;
UI açılmadan sonraki uygun OS fırsatında taze guard'larla değerlendirilebilsin.
Anında unlock teslimi, kaçırılmış bütün periyotları telafi veya exactly-once ağ
aktarımı vaat edilmez. Atomiklik yalnız yerel plan tüketimi + run kabulüdür.

Dayanak: CURRENT backlog 1.4b; B4 vault-lock belgesi §5/§7; ADR0022 D1/D3,
Step17, preserved boundaries ve FTPS practical verification. Bayrak eklememe ve
kalan risk kararı korunur. Vault/credential formatı, Keystore, TLS/LAN/ACL,
multipart/journal remote ACK kuralları, iOS, FTPS, UI/JS, Rust/C/JNI ABI ve
dependency değişmez. Yeni receiver/izin, WorkManager, foreground service yok.

**Provider sınırı:** `KlodaS3Module:31–49,85–91` yalnız `amazon-s3` için personal
queue/automatic yetkisi verir. Runtime journal'ı `amazon-s3`dür. Yeni store bunu
zorunlu doğrular; `s3-compatible`a automatic yetkisi veya legacy plan aktarılmaz.
Diagnostic journal ve diğer provider DB'lerine yeni automatic state yazılmaz.

## 2. Kaynak kanıtı ve kapatılan belirsizlikler

`K` = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`.
`T` = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.
Satırlar araştırma anındaki kaynak içindir; runtime kanıtı değildir.

1. `AndroidS3Automatic:41–44` prefs due'yu `queue.start`tan önce tüketir; `reconcile:27,39` kilitte capture hatasıyla OS işini cancel eder.
2. `AndroidS3Queue:59–68` guard/capture/run transaction/active sırasıdır. `:70–82` worker başladıktan sonra `status()` tekrar capture yapabilir ve throw edebilir. Dönüş/exception kabul kanıtı olamaz.
3. `AndroidS3Journal:30–33` aynı database üzerinde sourceLock'lu transaction sağlar; `AndroidS3Runs:17–19` run insert'i bu transaction'a katılabilir. Eski prefs ve SQLite arasında atomiklik yoktur.
4. `AndroidS3Runs:5,9,30` eski run'larda automatic/occurrence ayrımı bulunmadığını ve recovery'nin running→paused/os_interrupted yaptığını gösterir. Eski run'dan kayıp occurrence çıkarılamaz.
5. `AndroidS3Automatic:65–70` servis-geneli alive kullanır; eski callback yeni execution'ı etkileyebilir. `AndroidS3Runtime:21–23` token lease'i olsa da stop global queue'yu durdurur.
6. `AndroidS3AutomaticChecks` yalnız queue authority testidir; JobService/rearm seam'i yoktur. Runner `:59–62`, Gradle `:28` ve mevcut test APK örnekleri yeni dar scope için kullanılabilir.
7. FTPS WATCH'ın capture öncesi occurrence değiştirmesi ve finally'nin stale OS yan etkileri ayrı açık bulgulardır (`AndroidFtpsScheduler:101–111`, `AndroidFtpsJob:29–34`); bu plan bunları düzeltmez.

**Güncel OS dokümanı:** Bu GPT devamında mevcut CLI, `npx --no-install ctx7@latest`
ile 1 resolve + 2 hedefli docs sorgusu çalıştırıldı; paket kurulmadı.
`/websites/developer_android`, resmî kaynaklar:
- [JobScheduler.schedule](https://developer.android.com/reference/android/app/job/JobScheduler): aynı ID'yi replace eder; running iş durdurulur; RESULT_FAILURE mümkün, sık schedule throttle edilebilir.
- [JobInfo.Builder.addTriggerContentUri açıklaması](https://developer.android.com/reference/android/app/job/JobInfo.Builder): iş bittikten sonra aynı ID ile schedule, jobFinished yerine kullanılabilir; bu durumda ayrıca jobFinished gerekmez. Bu plan content-trigger eklemez, yalnız açıklanan replacement lifecycle'ını kullanır.
- [JobService.jobFinished](https://developer.android.com/reference/android/app/job/JobService): true backoff ister; onStop sonrası çağrı gerekmez; Doze teslimi farklı/gecikmeli olabilir.

Seçim: normal completion/defer için **schedule-as-completion**; başarıda finish yok.
Schedule failure ve dış OS stop için OS backoff, yalnız karşılıklı dışlanan fallback.
Doküman kaynaklı tasarımdır; gerçek OS adapter smoke'u aşağıda zorunlu dar kapıdır.

## 3. SQLite otoritesi ve geçiş

Yeni `AndroidS3AutomaticPlan.kt`, mevcut Amazon journal database'ini kullanır.
DDL/başlangıç aynı sourceLock disiplininde; yeni dosya/DB veya yeni secret deposu yok.
İki additive tablo; mevcut s3_run/job şeması ve recovery kodu değiştirilmez:

- `s3_auto_state`: tek `id=1`, schemaVersion=1 (satırın varlığı migration commit
  marker'ıdır); nullable pending occurrence UUID, target archiveId, profile/source
  schedule-binding hash, journal context, logical due, configuration-bound wakeToken,
  retryNotBefore. Boş plan için pending alanları birlikte NULL'dır; mevcut plan
  retained/disarmed olabilir (wakeToken=NULL). Revoke occurrence/due'yu tüketmez.
- `s3_auto_accept`: immutable occurrence PRIMARY KEY, run UNIQUE FK→s3_run(id),
  target/binding/context/due. Run ile aynı transaction'da insert; update/delete
  kabul edilmez. Mevcut retained run ömrüne bağlı küçük kabul kaydı; cleanup yok.

Wake token yalnız **uyandırma envelope**'udur; occurrence kabul yetkisi değildir.
Occurrence UUID her kabulde değişir; wakeToken aynı configuration için kalabilir.
Pause/disable/cancel ve configuration/binding değişiminde wakeToken revoke/rotate
edilir. Claim her zaman exact occurrence + due + target/binding/context CAS'i,
taze profil/source/flags ve execution lease gerektirir. OS extras yalnız protocol=1,
provider=amazon-s3, wakeToken ve projectionNonce içerir. projectionNonce tek OS
schedule isteğini ayırır, yetki değildir; SQLite şemasına eklenmez.
Secret/URI/captured profile extras'a yazılmaz.

### 3.1. Legacy prefs → SQLite, tek yönlü ve idempotent

Legacy kaynak `kloda-s3-automatic` içindeki due/binding/dispatch'tir. `dispatch`
aktarılmaz; legacy OS callback yeni protokolde doğrudan run kabul edemez.

1. Feature/pause/lock erken kontrolleri; migration kilitliyken vault okumaz veya
   marker yazmaz. Kalıcı legacy plan varsa yalnız recovery wake korunur (§6).
2. Unlocked durumda sourceLock altında önce source capture/bindSources, ardından
   fresh Amazon profile capture, enabled/automatic ve schedule binding doğrulanır.
   State context'i source binding'in etkisinden sonra alınır; normal reconcile da
   aynı sırayı kullanır. Tek prefs snapshot'ı alınır.
3. DDL sonrası tek SQLite transaction: marker yoksa geçerli/eşleşen nonnegative due
   olduğu gibi içeri alınır (past due korunur); yeni occurrence/wake UUID atanır.
   Binding eşleşmiyorsa eski due başka configuration'a taşınmaz, mevcut next()
   kuralıyla yeni plan kurulur. Yetki/opt-in yoksa marker + boş plan yazılır.
   Bozuk legacy tip/değer storage/outcome hatasıdır; sessizce yeni yetki üretmez.
4. Commit'ten sonra yalnız legacy due/binding/dispatch temizliği denenir. Cleanup
   başarısızlığı SQLite otoritesini geri almaz; marker varsa prefs bir daha okunmaz.
   Gelecekte legacy prefs'e mirror/dual-write yok; otomatik downgrade desteklenmez.
   Eski binary'ye dönüşte aynı plan güvenliği iddia edilmez, dağıtım notuna yazılır.
5. Migration OS schedule'dan bağımsızdır: commit başarılı/schedule başarısızsa
   sonraki callback/reconcile aynı SQLite planını yeniden project eder, import etmez.
   Migration commit acknowledgment'ı belirsizse marker var/yok varsayılmaz; §4.1'in
   sonlanmış transaction + tutarlı okuma şartı uygulanır. Doğrulanmadan prefs
   temizlenmez, yeni import/admission yapılmaz; çözülmezse storage gate açık kalır.

| Kesinti noktası | Yeniden açılış davranışı |
| --- | --- |
| DDL var, marker yok / import transaction rollback | Legacy snapshot yeniden değerlendirilir; yarım satır kabul edilmez. |
| Marker+plan commit, prefs cleanup öncesi | SQLite kazanır; aynı due ikinci kez import edilmez. |
| Prefs cleanup failure | Plan korunur; sır sızdırmayan evidence notu; dual authority yok. |
| Migration sırasında lock/feature/pause/storage reddi | Yeni run/başarılı migration yok; yetki yeniden doğrulanmadan import yok. |
| Eski consume olmuş ama run yok | Geriye dönük kayıp occurrence üretilemez; legacy'de kalan next due korunur. |
| Eski running/paused/review veya bilinmeyen remote ACK | Mevcut recovery/review korunur; bunlara accept kaydı uydurulmaz, resume/adoption yapılmaz. |

Legacy'nin daha önce kaybettiği occurrence'ları kurtarmama, yeni işte kabul
edilmemiş occurrence atlama izni değildir. Yeni protokolde locked/busy/precommit
red due'yu tüketemez. Süreç-çökme garantisi yeni SQLite kabulünden itibaren başlar.

## 4. Admission protokolü — tek transaction, worker dışarıda

`AndroidS3Queue.start()` manuel API/dönüş şekli korunur. Yeni, ayrı internal
`startAutomatic(expectedOccurrence, planStore, owner, finished)` status map değil
üç ayrık sonuç döndürür: `Accepted(runId)`, `NotAccepted(reason)` veya
`OutcomeUnknown(attempt)`. Attempt, owner identity + beklenen exact occurrence
snapshot'ı + transaction'dan önce üretilmiş candidateRunId içerir; secret içermez.
`NotAccepted` yalnız hiçbir kabul gerçekleşmediği kanıtlıysa kullanılabilir.
`OutcomeUnknown` exception'dan rollback/başarı çıkarılamayan transaction sonucudur.
Semboller önerilen yeni sözleşmedir; bugün mevcutmuş gibi kullanılmaz.

1. sourceLock altında exact execution owner/lease/cancel, paused, automatic flag,
   available/pauseFailed ve mevcut Runtime unlocked admission kontrol edilir.
   Kaynak ve profil taze capture edilir; enabled/target/binding/context ve due
   tekrar kontrol edilir. Store ve queue aynı Amazon journal/database olmalıdır.
2. Source capture'ın `bindSources` etkisinden SONRA current context kaydedilir;
   beklenen plan uyumsuzsa kabul edilmez, taze reconcile gerekir. Capture/lock
   reddi ile durable kabul sonrası hata ayrı sonuçlardır; exception adı tek başına
   rollback nedeni olmaz. Terminal profil/storage hatası locked retry diye yutulmaz.
3. nextDue mevcut live/daily next() kuralıyla hesaplanır. Tek journal.transaction:
   exact plan CAS → runs.start(new run) → immutable accept(occurrence,run) → state'i
   yeni occurrence/nextDue'ya ilerlet; retryNotBefore sıfırla. SQLite all-or-nothing
   kalır; ancak exception caller'ın hangi sonucu gördüğünü kanıtlamaz. Commit veya
   rollback acknowledgment'ı belirsizse `OutcomeUnknown`, asla varsayılan rollback
   dönülmez. Aynı occurrence ikinci run'a kabul edilemez.
4. Transaction commit sonrası active execution atanır; lock bırakıldıktan sonra
   worker başlatılır. Otomatik çağrı `status()` çalıştırmaz. Worker injection yalnız
   instance-bound executor'dur; production mevcut Thread/body/check'lerini kullanır.
5. Worker başlatma reddi accepted run'ı hata/paused olarak mevcut kurallarla kapatır;
   occurrence geri alınmaz. Callback-once, source/generation/guard ve remote unknown
   multipart kuralları korunur. Callback startAutomatic dönmeden gelse de aynı
   Execution'ın accepted run'ına aittir; exception'dan kabul durumu türetilmez.
   Coordinator queue çağrısının tamamı boyunca dış sourceLock tutmaz; böylece
   queue kendi lock'unu bıraktığında worker/callback gerçekten lock dışındadır.

### 4.1. Belirsiz commit'in çözümü — kabulü veya rollback'i tahmin etme

OutcomeUnknown'da worker başlatılmaz; Attempt coordinator'da fenced tutulur.
Queue'nun ayrı `admissionUncertain` storage fence'i yeni başlangıçları (manuel
dahil) reddeder; enable/automatic toggle veya UI status bunu temizleyemez. Bu,
automaticPaused'ın manuele uygulanması değildir: paylaşılan queue'nun çözülmemiş
DB yazma belirsizliğidir. Normal manuel davranış resolved durumda aynen korunur.

Transaction'ın sonlandığı doğrulandıktan sonra **aynı database üzerinde tutarlı
tek read transaction** ile exact accept + candidate run + current state okunur.
Runtime singleton/aktif DB körlemesine kapatılmaz, yenisi oluşturularak recovery
yan etkisi tetiklenmez. Aynı Attempt için bir çözüm okuması yapılır; busy-wait yok:

| Kanıtlanan snapshot | Çözüm / izin verilen devam |
| --- | --- |
| Accept exact occurrence/candidateRunId/target/binding/context/due ile eşleşiyor; run bağlı ve consumed occurrence pending değil | `ResolvedAccepted(runId)`. Worker bu kurtarma yolunda başlatılmaz. Başlamamış running run, mevcut paused/os_interrupted politikasıyla kaydedilir; hata varsa fence kalkmaz. Sonra yalnız next occurrence project edilir. |
| Accept yok, candidate run yok, exact beklenen pending occurrence değişmemiş; transaction kesin sonlanmış | `ResolvedNotAccepted`. Fence kalkabilir; eski Attempt yeniden kullanılmaz. Sonraki izinli callback yeni owner/lease ve taze guard'larla aynı occurrence'ı deneyebilir. |
| Read failure, transaction hâlâ belirsiz/açık, tek başına run, uyuşmaz accept/state veya diğer eksik kanıt | `Unresolved`. Fence kalır; yeni admission/rollback/next plan uydurulmaz, hata açık raporlanır. |

Unknown ilk sonucu ve sonradan resolved sonucu ayrı evidence'dır; terminal run
callback'i gibi iki kez completion üretilmez. Resolved kabul yalnız yerel kabul
kanıtıdır, başarılı aktarım değildir. Unresolved yürütme OS sahipliğini tutmaz:
exact lease bırakılır, bir kez `jobFinished(params,false)` ile kapatılır; yalnız
belirsizlik nedeniyle retry job yaratılmaz. Sonraki açık lifecycle/reconcile veya
process yeniden açılışı storage çözümünü tekrar değerlendirebilir; çözülmeden run
başlatamaz. Process death sonrası mevcut queue recovery running→paused yapar,
accept/state aynı kaldığından accepted occurrence replay edilmez. Eksik/tutarsız
kalıcı kayıt varsa otomatik reset yok; uygulama/review storage gate'i açık kalır.

| Kesinti/hata | Kalıcı sonuç / yeniden deneme |
| --- | --- |
| Guard/capture/lock/busy veya transaction öncesi stop | Due/occurrence tüketilmez, run/accept yok. Locked/busy için sınırlı OS defer. |
| Statement failure + rollback'ın tutarlı snapshot ile kanıtlanması | NotAccepted; due/occurrence aynı, run/accept yok. |
| Commit/rollback acknowledgment kaybı veya sonucu okunamayan failure | OutcomeUnknown → §4.1'in üç çözüm dalı; otomatik rollback/kör start yok. |
| Commit sonrası active/Thread start öncesi process death | Accept ve next occurrence birlikte vardır. Existing recover running→paused; kabul edilmiş occurrence replay edilmez. |
| Worker start failure / callback dönüşten önce / status benzeri dış UI hatası | Accepted occurrence korunur; tek completion; yeni run'a rollback/retry yok. |
| Worker sırasında process death / bilinmeyen multipart ACK | Existing review/recovery; sadece sonraki bağımsız occurrence değerlendirilir, eski işlem resume edilmez. |

Atomik kabul başarılı çalışma değildir; kabul sonrası başlayamayan run'ı gizlice
yeniden denememe mevcut S3 interrupted-work politikasının devamıdır.

## 5. Kilitler, manuel queue ve execution'a özel completion

Tek authority monitor'ü `AndroidSyncJournal.sourceLock` olur. Automatic'in özel
lock'u kaldırılır; queue→automatic-lock ters sırası yok. Kısa state/run/scheduler
projection kararları bu monitor'de serialize edilir; network, await/join, worker
başlatma ve kullanıcı callback'i monitor dışında olur. Runtime leaseLock yalnız
kısa owner erişimi yapar, tutulurken sourceLock/queue çağrısı yapmaz. Ters sıra yok.

Coordinator Execution: unique owner identity, original JobParameters identity,
wakeToken, captured expected occurrence/Attempt, optional accepted runId ve
`Starting/Running/Resolving/Completing/Stopped/Done` durumu. Global alive veya
shared token değişkeni yok. Completion sadece kayıtlı
**aynı Execution** için bir kez çalışır; projection da aynı kontrolü tekrar yapar.
JobService lifecycle ve OS projection/completion yan etkileri tek main-looper
event sırasındadır; DB/queue hazırlığı worker'dadır. Worker sonuçları owner-tag'li
event olarak döner; lock içinde veya yabancı thread'de OS completion çağrılmaz.

**Start dönmeden gelen callback:** Starting owner queue çağrısından önce kayıtlıdır.
Run callback'i erken gelirse (runId/outcome) buffer'lanır; Accepted dönüşüyle aynı
runId doğrulanmadan lease bırakma/rearm/finish yapılmaz. Accepted olunca buffer
bir kez drain edilir. NotAccepted/Unknown ile run callback'i çelişiyorsa storage/
contract hatasıdır; yeni admission yok. Starting sırasında stop olmuşsa sonuç
geldiğinde OS completion yapılmaz; committed kabul korunur, sadece exact owner'a
ait run kesilir. Aynı run callback'inin tekrarı ve eski owner's event'i no-op'dur.

Runtime begin/end owner identity kullanır. Queue Execution da automatic owner'ı
taşır. `stop(owner, runId?)` yalnız o lease'e ve aynı owner'ın active automatic
run'ına uygulanır; runId henüz raporlanmadıysa owner eşitliği zorunludur. Eski stop
manuel veya yeni run'ı pause etmez; Starting stop'u global queue stop'a dönüşmez.
Queue'ya exact automatic run pause yolu eklenir. Servis onDestroy mevcut execution'ı
stop eder; geç worker completion lease/state/OS işine dokunamaz.

Manuel `start()`, status map, mayRun UI/unlocked guard'ı, foreground pause,
explicit pause/disable, pauseFailed ve callback-once davranışı korunur. Manuel
başlangıç migration/plan/accept kaydı yazmaz; global automaticPaused manuel işi
engellemez. §4.1'deki çözülmemiş DB belirsizliği tek ek storage fence'idir.
Queue busy ise automatic occurrence tüketilmez. Eski internal
`start(automatic=true)` bypass'ı kaldırılır; ilgili authority testi yeni automatic
API'ye taşınır. `s3-compatible` manuel/component yolları automatic store'a bağlanmaz.

## 6. OS projection — tek sahip ve kesin completion tablosu

`AndroidS3AutomaticCoordinator` state+queue+lease+OS portlarının tek sahibidir.
`AndroidS3Automatic` facade/receiver/foreground çağrıları aynı coordinator'a gider;
JobService yalnız lifecycle adapter'ıdır. Tek JOB=2712, aynı service/manifest,
unmetered+batteryNotLow+persisted kısıtları korunur. Yeni kalıcı polling işi yok;
locked/busy defer mevcut JobScheduler işinin sınırlı tekrar teslimidir.

`retryNotBefore = now + 300000ms` yalnız değerlendirmeye uygun locked/busy
callback'te logical occurrence'a dokunmadan kaydedilir. Her callback'in en erken
giriş zamanı `eligibleAt=max(due,retryNotBefore)`dır; projection latency de budur.
Future eligibleAt varken unlock gözlemi, foreground veya forced OS delivery bu
kapıyı aşamaz. Clock event yalnız pending planı mevcut next() semantiğiyle yeniden
hesaplar; eski expected snapshot invalid olur, claimed run replay edilmez.

### 6.1. Backoff ve foreground arasında sahiplik protokolü

Coordinator'da monoton epoch'lu tek ProjectionOwner bulunur; bu ayrı tablo/sütun
değil process-local lifecycle state'idir. `Executing`, `Replacing`, `HandingToOS`,
`OSOwned`, `StorageBlocked` veya `Idle` olabilir. Aynı Execution'ın outcome'u bu
owner durumuyla birlikte tek main-looper event'inde değiştirilir:

1. Normal completion/defer, worker bittiğinde ve lease bırakıldıktan sonra owner'ı
   **OS çağrısından önce** Replacing yapar. Yeni projectionNonce ile tek schedule
   çağrısı yapılır. SUCCESS'te Execution Replaced/Done ve owner OSOwned olur;
   jobFinished çağrılmaz. Reentrant test callback'i event olarak sonradan işlenir.
2. RESULT_FAILURE veya uygulanmadığı kesin adapter validation hatasında owner
   **jobFinished(true)'dan önce** HandingToOS yapılır. Exact params için finish
   bir kez çağrılır, sonra OSOwned kalır. onStopJob→true dönüşü de dönüşten önce
   aynı devri kurar. Bu aralıkta getPendingJob=null olması devir iptali değildir.
3. HandingToOS/OSOwned sırasında aynı epoch/wake için foreground/receiver
   reconcile **schedule/cancel/finish çağırmaz**, token/occurrence/deadline
   değiştirmez. Pending sorgusu boş dönse bile owner'ı Idle'a çekmez. Bir kez
   dirty notu yeterlidir; backoff'u bypass eden tekrar, timer/polling yoktur.
4. Yeni OS onStartJob exact current wake ve **yeni params identity** ile gelince
   sahiplik Executing'e geçer. Eski Execution callback'i/aynı params tekrarı devir
   alamaz. Current state okunur; eski expected occurrence kullanılmaz. Değerlendirme
   bitince yeni tek completion sonucu seçilir. Dirty reconcile ayrı ikinci schedule
   değildir; aynı outcome'un güncel plan seçimine katılır.
5. Revocation (pause/disable/feature/config/source invalidation) beklemez: sourceLock
   altında epoch artırılır, wake disarm edilir, exact owner durdurulur. OS cancel
   main-lane'e epoch-tag'li gider; eski cancel event'i yeni epoch'un işini silemez.
   Resume fresh validation + yeni wake ile yeni epoch açar. Sıradan foreground,
   kilidin açılması veya pending=null revocation sayılmaz.
   Clock/mode event'i active run varsa dirty olarak completion'a katılır; yalnız
   pending/OSOwned durumda explicit schedule revision'dır, wake/epoch rotate edip
   pending due'yu mevcut clock kuralıyla yeniden project edebilir. Bu istisna
   sıradan foreground'a veya lock-unlock gözlemine uygulanmaz.
6. Process yeniden oluştuğunda RAM owner yoktur: geçerli protocol/provider/wake ile
   pending JOB varsa mevcut envelope OSOwned olarak benimsenir; projectionNonce
   farklı/eski olabilir, bu normal backoff olabilir. Aynı configuration için
   foreground onu overwrite etmez. Pending sorgusu başarısızsa absent varsayılmaz.
   Pending'in gerçekten absent olduğu ve active/devir olmadığı doğrulanırsa yalnız
   taze geçerli SQLite planı için bir recovery projection yapılabilir. Force-stop /
   OS'nin işi kabul etmemesi için sınırsız liveness garantisi verilmez.

**Erken callback:** current wake olsa bile now<eligibleAt ise Runtime lease,
capture veya queue admission yapılmaz. Aynı logical plan ve **aynı** retryNotBefore
korunarak bir replacement kurulur; deadline tekrar now+5dk yapılmaz. Böylece
forced/erken delivery ya da foreground hem backoff'u aşamaz hem de vadeyi sürekli
ileri itemez. now>=eligibleAt olduğunda ancak taze locked/busy sonucu yeni 5dk defer
yaratabilir. OS backoff'un kendi ek gecikmesi foreground tarafından azaltılmaz.

OSOwned'un aynı process'te pending=null kaldığı ama yeni callback gelmediği durum
kanıtsız schedule ile onarılmaz; OS reddi/teslim kapısı açık raporlanır. Yeni açık
resume/configuration eylemi revocation+fresh epoch oluşturabilir; gizli ikinci
rearm sahibi yaratılmaz. DB Unresolved ise StorageBlocked bütün admission ve yeni
projection'ı durdurur; basit foreground bunu override edemez (§4.1).

**Beklenmedik schedule exception'ı:** generic throw, RESULT_FAILURE gibi körlemesine
sınıflandırılmaz. Tek pending okumasında exact yeni projectionNonce görülürse
replacement kabulü doğrulanır ve jobFinished yoktur. Aksi halde ProjectionUnresolved
(OSOwned altında) kalır; aynı completion'dan ikinci schedule/finish(true) yoktur.
Exact OS onStop gelirse yalnız onun lifecycle'ı kapatılır ve **false** dönülür;
sonucu belirsiz replacement'ın üzerine eski işi retry etme yetkisi verilmez.
Eski callback admission yapamaz. Otomatik loop/polling
yok; exception uygulama smoke'unu engeller ve sınırlı hata kesitiyle raporlanır.
Bu olağandışı platform/adapter hatası normal liveness başarısı sayılmaz.

| Durum | Tek OS işlemi / fencing |
| --- | --- |
| Current callback locked/busy; admission yok | Lease bırak; retryNotBefore kaydet; aynı ID ile replacement schedule. SUCCESS → Execution Replaced, jobFinished çağırma. Logical due/occurrence/accept değişmez. |
| Terminal NotAccepted veya ResolvedNotAccepted(storage/contract failure) | Kör retry yok. Exact owner için plan disarm + cancel; state yazılamıyorsa storage fence + exact finish(false). Yeni epoch varsa eski Execution hiçbir OS yan etkisi yapmaz. Plan/run geçmişi silinmez; açık recovery/fresh yetki doğrulaması gerekir. |
| Accepted run terminal | Exact owner lease end; next plan project et; SUCCESS → Replaced, ayrıca finish/reconcile yok. Çalışan transfer bitmeden normal rearm yapılmaz. |
| schedule RESULT_FAILURE / kanıtlı pre-call validation failure | Önce HandingToOS; bir kez `jobFinished(params,true)`; foreground sahipliği alamaz. Generic throw için §6.1'in ProjectionUnresolved dalı. |
| OS onStopJob (replacement kaynaklı değil) | Exact Execution stopped; yalnız onun run'ını interrupt et, jobFinished yok. Current enabled/config ve plan uygunsa HandingToOS→true; revoke/feature-off/StorageBlocked/ProjectionUnresolved ise false. Eski callback no-op. |
| Başarılı replacement sonrası onStopJob/geç callback | Replaced Execution için no-op/false; yeni lease, run veya JOB cancel edilmez. |
| Pause/disable/cancel/configuration iptali | sourceLock altında wake revoke + exact execution stop; scheduler.cancel(JOB). Callback sonradan rearm yapamaz. Resume taze guard'larla yeni wake üretir. |
| Foreground/receiver reconcile, active/devir/OSOwned var | Yalnız dirty kaydet; revoke hariç OS işlemi/token/deadline değişimi yok. Pending=null devir sırasında bu kuralı kaldırmaz. |
| OS backoff callback, aynı wake/config ama önceki occurrence kabul edilmiş | Yeni params kimliğiyle ownership al; current pending state ve eligibleAt okunur. Erken ise deadline değiştirmeden yalnız replacement; eligible ise fresh snapshot/guard'larla kabul. |
| Admission OutcomeUnknown | Resolving; §4.1 kanıtı olmadan run veya next projection yok. Unresolved→StorageBlocked ve exact finish(false); accepted/rollback sonucu yalnız tek outcome'a katılır. |
| Eski/revoked wake token callback | Admission/lease yok. Yeni işi cancel/rearm etme; return false. Current callback için execution identity de zorunlu. |

Legacy OS extras protokol=1 değildir: yalnız marker henüz yok ve legacy plan
mevcutsa migration/recovery reevaluation tetikleyebilir; asla doğrudan admission
yapamaz. Kilitte legacy snapshot'taki token ile en az 5dk gecikmeli **legacy-recovery**
projection kurulur (extras protokolü farklıdır); unlock sonrası fresh migration
tamamlanınca protocol=1 işi replace eder. Snapshot/token değişmişse eski recovery
no-op. Plan/opt-in yoksa recovery işi yaratılmaz. Storage/şema bozuksa retry ile
yetki yaratılmaz. Marker sonrası bütün legacy callback'ler stale'dir.

Failure fallback için wake token'ın occurrence'dan ayrı olması önemlidir: kabul
sonrası schedule başarısız olursa OS eski envelope'u backoff ile getirebilir; bu
eski accepted occurrence'ı değil, current pending state'i yeniden değerlendirir.
Geç **completion** ise current state'i yeniden project edemez (Execution fence).

Process death/reboot OS teslimi ile DB commit arasında distributed transaction
yoktur. DB planı durable, projection idempotenttir; sonraki izinli OS/lifecycle
fırsatı onarır. OS'nin schedule/backoff'u reddettiği veya force-stop ettiği durumda
UI'sız sonsuz liveness garantisi yok; hata/kanıt açık raporlanır. Normal kilit/unlock
akışı için pending replacement/backoff yolu korunur; USER_UNLOCKED her unlock
tetikleyicisi varsayılmaz. Doze/ilk unlock/gerçek kilit fiziksel kapıdır.

## 7. Kesin uygulama diff sınırı — onay istenen liste

5 ürün Kotlin + 5 test Kotlin + 1 test manifest; başka ürün dosyası yok.

| Dosya | Değişiklik |
| --- | --- |
| `K/AndroidS3Automatic.kt` | Prefs consume/private lock/global alive kaldır; facade + ince JobService adapter; production coordinator/OS port bağlama. |
| `K/AndroidS3Queue.kt` | Üç sonuçlu startAutomatic + uncertain storage fence/resolve; ortak prepare/launch/finish reuse; instance executor seam; owner-tag'li exact automatic run pause; normal manuel API korunur. |
| `K/AndroidS3Runtime.kt` | Owner-identity lease/end/stop; exact run fencing; mevcut unlocked/foreground guard'ı değişmez. |
| Yeni `K/AndroidS3AutomaticPlan.kt` | İki tablo/validasyon/immutable accept; migration ve CAS; exact uncertain snapshot çözümü; gerçek transaction/read boundary portları; legacy cleanup; provider kontrolü. |
| Yeni `K/AndroidS3AutomaticCoordinator.kt` | Starting callback buffer/Resolving ve ProjectionOwner epoch'ları; tek main-lane OS completion; early callback/defer/backoff/dirty/revoke protokolü; instance-bound portlar. |
| `T/AndroidS3AutomaticChecks.kt` | Eski authority/callback assertions korunarak yeni automatic API'ye uyarlama; compatible-provider testini yeni yetkiye çevirmeden Amazon isolated queue kullanma. |
| `T/AndroidFilesQueueRecoveryInstrumentation.kt` | Yalnız üç explicit dar scope kaydı; geniş eski scope'lar otomatik çalışmaz. |
| Yeni `T/AndroidS3AutomaticPlanChecks.kt` | Migration/rollback/reopen/provider/legacy unknown-run; commit/rollback ack-loss ve unreadable/inconsistent snapshot çözümü. |
| Yeni `T/AndroidAutomaticLockChecks.kt` | Shared coordinator+gerçek isolated queue/store; Starting callback, manual storage fence, erken wake ve backoff→foreground/pending-null interleaving'leri. |
| Yeni `T/AndroidS3AutomaticOsChecks.kt` | Disposable pakette test-only JobService harness + aynı coordinator/OS adapter; replacement/failure/stop gözlemi. |
| `apps/mobile/modules/my-module/android/src/androidTest/AndroidManifest.xml` | Yalnız test harness service, BIND_JOB_SERVICE korumalı. Production manifest/izin değişmez. |

Plan/evidence kapsamı: bu dosya, gelecekte
`docs/implementation/evidence/f1-s3-automatic-lock-2026-11-11/` tek manifest/loglar,
Opus devrinde CURRENT yalnız açık checkpoint/prompt (checkbox kapanmaz).
Review kabulü ayrı GPT'ye aittir. Yeni semboller yalnız listelenen dosyalarda;
300-line sınırını koru. Ek helper/dosya, şema sütunu/authority genişlemesi,
build-config/dependency veya ABI değişikliği gerekirse dur ve yeni plan kararı al.
`AndroidS3Journal/Runs/Profiles/Vault`, engine/files/photos/publisher, production
manifest, shared backup scheduler/module, bütün FTPS dosyaları salt-okunurdur.

**Bu düzeltmenin kapsam farkı:** Dosya sayısı ve iki tablo/sütun sınırı değişmedi.
Önceki taslağa göre üç sonuçlu internal admission/resolve, manuel dahil geçici
uncertain-storage fence, process-local ProjectionOwner ve extras projectionNonce
açıklaştırıldı. Bunlar onay istenen davranışın parçasıdır; yeni native export/ABI,
global test override veya ek framework değildir. Listedeki dosyalara sığmıyorsa
implementer bölemez/genişletemez; ayrı plan kararı ister.

## 8. Ağsız doğrulama — ilk temsilci, sonra dar genişletme

Bu GPT oturumu test/build/cihaz başlatmadı. Aşağıdaki yeni scope'lar henüz mevcut
değildir; implementer ekledikten sonra çalıştırılacak kesin hedeflerdir, PASS değil.

### 8.1. Ortak seam ve ilk S3 regression

Production ve test aynı Plan/Queue/Coordinator kodunu kullanır. Portlar constructor
instance'ına bağlıdır: OS schedule/cancel/pending/finish, clock, erken locked-deny,
worker executor, lease adapter. Global mutable unlock override veya Runtime
singleton reset yok. Fake unlocked portu gerçek Runtime/vault guard'ını kaldırmaz.

Test Context applicationContext=this, UUID package/alias + prefs namespace ve owned
noBackup directory sağlar; gerçek SQLite, synthetic profile/Keystore kullanılır.
Gerçek emulator unlocked şartı preflight'tır; locked port yalnız daha erken RED
üretir. Captured worker Runnable çalıştırılmaz; test executor onu tutar/reddeder.
Network body testte çalıştırılamaz; accepted callback testi exact queue pause ile
kapanır. Gerçek profile/vault guard'ı bypass edilmez; gerçek OS lock kanıtı denmez.

İlk `s3-automatic-lock` vakası: authorized due plan → early locked → run/accept=0,
aynı occurrence/due, tek >=5dk OS replacement → fake clock eligibleAt'e ilerlemiş
ve gerçek emulator unlocked iken fresh capture → aynı
occurrence için bir accept+run, next plan atomik ilerlemiş → exact pause/completion,
bir next projection. Aynı callback/occurrence tekrarında ikinci accept/run yok.
Özgün F1 davranışını referans alan failing assertion ile regression'ın nedenini
kaydet; yeni semboller eski kaynakta yok diye compile failure'ı RED kanıtı sayma.

### 8.2. Yalnız etkilenen ek batch

- `s3-automatic-plan`: DDL-only/marker/prefs-cleanup kesintileri; past due import;
  consumed legacy due/no-dispatch; binding mismatch; disabled; malformed store;
  failed CAS/run/accept/state rollback; commit/reopen sonrası tek claim; provider
  ayrımı; diagnostic/compatible DB untouched; eski unknown run/remote journal unchanged.
- Belirsiz commit ayrı zorunlu alt matristir: (a) gerçek SQLite COMMIT tamamlanır,
  caller acknowledgment almadan boundary throw → ilk OutcomeUnknown, sonra exact
  accept/run/state ile ResolvedAccepted, worker launch=0 ve duplicate=0;
  (b) gerçek rollback tamamlanır, ardından boundary throw → OutcomeUnknown,
  consistent snapshot ile ResolvedNotAccepted, sonraki fresh owner tek kabul;
  (c) resolution read fail veya transaction-sonu kanıtı yok → Unresolved, manuel/
  otomatik start ve enable/toggle fence'i açamaz; (d) tek başına run, uyuşmaz
  accept veya state snapshot'ı → fail-closed, reset/retry/adoption yok.
  Injection PlanStore'un instance-bound transaction/read boundary portundadır:
  production port mevcut journal.transaction/read transaction'ı çağırır; test
  aynı gerçek transaction'ı çalıştırıp yalnız acknowledgment/read noktasında hata
  enjekte eder. Salt fake DB sonucu atomiklik kanıtı sayılmaz. Migration marker
  commit acknowledgment kaybında da prefs cleanup/import/admission olmaması kapsanır.
- `s3-automatic-lock`: stop-before/after commit, callback-before-return, executor
  throw, busy/manual overlap, same wake/old occurrence, revoked wake, feature-off,
  pause/disable/source/profile/clock değişimi; fake schedule failure/backoff ve
  failure→fresh callback→repair. Her başlıca interleaving deterministic bariyerle;
  sleep ile concurrency assertion'ı yok. Schedule error terminal hattan ayrılır.
- Sahiplik zorunlu interleaving'leri: RESULT_FAILURE→HandingToOS→finish(true)
  sırasında pending=null + foreground (ikinci schedule/finish=0); OSOwned + aynı
  pending wake veya geçici pending=null + tekrarlı foreground (token/deadline aynı);
  fresh process pending envelope benimseme; yeni params callback ile ownership
  transferi; eski params/completion no-op; revoke sırasında queued eski cancel
  yeni epoch'u silemez. Unknown schedule exception'ında exact yeni nonce kanıtı
  yoksa ikinci projection/backoff çağrısı olmaması da test edilir.
- Erken wake matrisi: lock defer'den sonra fake unlocked olsa bile now<eligibleAt
  iken lease/capture/admission=0; deadline uzamaz. now=eligibleAt'te taze guard'la
  tek kabul. Starting callback buffer→Accepted drain, callback tekrarı, stop-before-
  return ve Unknown sonucu ile çelişkili callback için fail-closed ayrı assertions.
- Etkilenen mevcut `s3-automatic-contract`, `s3-pause`, `s3-global-pause` aynı
  batch'te; manuel status/foreground pause ve automaticPaused'ın manuel işe
  uygulanmaması assertions'ları eklenir. Eski başarılı başka scope'lar tekrarlanmaz.

### 8.3. Gerçek OS adapter, ağsız disposable harness

Yeni `s3-automatic-os` yalnız identity doğrulanmış disposable emulator +
`com.kloda.sync.test` paketinde çalışır. Test manifestindeki harness kendi isolated
coordinator/queue/store'unu kurar; production singleton/gerçek app/vault kullanılmaz.
OS portu gerçek JobScheduler/JobParameters/JobService completion'dır. Production
ve harness, `AndroidS3Automatic.kt` içinde aynı internal OS adapter'ını kullanır;
constructor'daki ComponentName production'da mevcut service, harness'te yalnız
test manifestindeki service'tir. OS scheduler/component **gerçek kurulu test
paketi** context'inden, queue/store/alias ise isolated Context'ten alınır; sahte
namespace package adına OS işi schedule edilmez. Test locked
deny ve held worker kullanır; fiziksel credential/kilit ayarı, medya, SAF kişisel
kaynak, ağ/hesap/fixture server yok. Paket/AVD ownership kanıtı yoksa install/run yok.

Tek temsilci akışta gerekli forced delivery'ler ile (yalnız owned package JOB=2712)
deferred replacement pending extras/latency/nonce, eski onStop'un yeni işi silmemesi,
unlock-deny kaldırıldıktan sonra **erken** delivery'nin reddi, ardından harness'in
instance clock'u eligibleAt'e ilerletilince bir kabul, callback-once/next projection
ve exact cancel gözlenir. Gerçek OS saati/keyguard ayarı değiştirilmez; bu sentetik
clock, gerçek delivery zamanlaması kanıtı diye sunulmaz. Explicit
barrier/latch + bounded deadline; doğal Doze/unlock teslimi PASS'i değildir.
Schedule failure deterministik port testinde; gerçek OS'nin keyfî failure üretmesi
istenmez. Test-only service stop/destroy ve geç callback de aynı coordinator'dan
geçer. Production service wiring compile/source assertion ile kontrol edilir;
normal production app'te gerçek vault+OS lock testi Faz 3/4'e açık kalır.

### 8.4. Komut/varyant ve kanıt

Mevcut altyapı: `tools/test-android-destination-migration.py:17–27` aynı modül
test APK build/metadata/install/instrument yolunu, `tools/test-android-sftp.py:40–48`
native-flag'li varyantı gösterir. Bu betikler çalıştırılmaz (başka scope/ağ etkileri).
`android/build.gradle:25,28,116` S3 flag ve runner'ı doğrular. Komutlar repo'daki
wrapper/path'ten türetilmiş gelecek hedeflerdir; bu oturum çalıştırılmadı:

1. `apps/mobile/android` içinde `./gradlew :my-module:assembleDebugAndroidTest -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a --console=plain`.
2. Metadata applicationId=`com.kloda.sync.test`, APK ABI/BuildConfig S3=true ve
   üretim/test Kotlin compile doğrulanır. Rust paketi hash'lerini kontrol et;
   beklenmedik native rebuild isteğinde dur, kör `-x` veya bayrak kapatma yok.
3. Owned emulator seçimi ve çıktı metadata'sından APK yolu doğrulandıktan sonra
   `adb -s <owned-serial> install -r -t <verified-test-apk>`.
4. Her explicit scope için `adb -s <owned-serial> shell am instrument -w -r -e scope <scope> com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation`;
   sırasıyla ilk temsilci, plan/negatif/mevcut dar batch, en son OS scope.
   Yeni scope'lar: `s3-automatic-lock`, `s3-automatic-plan`, `s3-automatic-os`.
5. Aynı varyantta `./gradlew :my-module:lintDebug -PklodaS3Native=true --console=plain`;
   mevcut unrelated baseline failure'ı scoped sonuçtan ayır, gizleme. Yeni Kotlin
   dosyalarının 300 nonblank/noncomment sınırını ayrıca kontrol et. JS/iOS/Rust
   matrisleri bu diff'ten etkilenmediğinden tekrar yok; FTPS build/test yok.

Tüm komutlar/exit code/tam log evidence'da; kaynak/APK/variant hash'leri, başlangıç
tracked+untracked diff ve değişecek dosyaların önceki içerikleri kaydedilir.
SDK/dependency/emulator/izin eksikse NOT_RUN ve engel; kurulum/cihaz genişlemesi yok.
Gerçek OS harness başarılı olmadan scheduler lifecycle kabul edildi denmez.
Bu gate çalıştırılamazsa kod devri yapılabilir ama S3 alt işi review'da kapanmaz.
Başarısız aynı yaklaşımda iki denemeden sonra dur; yeni oturum sayacı sıfırlamaz.

## 9. Kabul, kalan kapılar ve uygulama onayı

- S1: Locked/busy/precommit reddinde aynı due/occurrence; run/accept/network yok,
  sonraki OS wake korunur; repeated locked tetikleme run/retry budget tüketmez.
- S2: Plan tüketimi + accept + run tek transaction; her crash noktasında bir
  occurrence en fazla bir run; OutcomeUnknown/üç çözüm dalı kanıtlı; accepted
  unknown/interrupted iş replay edilmez, unresolved storage fence'i bypass edilemez.
- S3: Migration marker sonrası tek otorite SQLite; yarım import/cleanup yeni
  yetki veya duplicate üretmez; provider ve manuel davranış değişmez.
- S4: Exact Execution/run/lease stop/destroy/geç callback fencing; bir completion
  bir OS sonucu; Starting buffer ve backoff handoff/pending-null/foreground
  interleaving'leri; erken wake eligibleAt'i aşamaz; replacement success +
  jobFinished birlikte yok; gerçek OS smoke.
- S5: Taze capture/source/profile/generation/opt-in/paused/unlocked kontrolleri;
  stale/revoked wake ve eski occurrence yeni yetki vermez. Vault/ABI/FTPS untouched.

İlk kilit açılmadan CE erişimi, reboot/force-stop/Doze/gerçek keyguard/production
service/physical signing/storage güvenliği Faz 3/4'te açıktır. FTPS F1, B4 kalan
riskleri, P5 vendor ve önceki kabul kapıları kapanmaz. Tarihî PASS taze kanıt değil.

**Checkpoint:** Önceki devamda yerel kaynak/ADR/test altyapısı incelemesi ve 3
read-only ctx7 komutu yapıldı. Kullanıcının iki belge patch hatası sonrası verdiği
devam izniyle bu düzeltmede güncel plan okundu; erken hazır durumu kaldırıldı,
admission belirsizliği/testleri ve OS sahipliği/erken callback protokolü düzeltildi.
Yalnız bu plan güncellendi. Ürün/test/CURRENT/ADR, evidence, test/build/emulator/
fixture/hesap ve Git index/commit/push değişmedi; yeni ctx7 sorgusu yapılmadı.
Yeni test seam'i henüz implement edilmedi; hiçbir test/build PASS iddiası yok.

**Tek tutarlılık kontrolü:** Admission/çözüm tablosu, migration, manuel storage
fence, OS ownership/erken callback ve test karşılıkları birlikte incelendi; aynı
geçiş için hem replacement hem finish(true) öngörülmediği kontrol edildi. Bir
read-only belge kontrolü üç sonuç/üç çözüm dalını, ack-loss/erken wake testlerinin
varlığını ve 11 hedef dosya sayısını doğruladı. Bu yalnız plan iç kontrolüdür;
ürün doğrulaması veya ayrı GPT bağımsız diff review'u değildir. Yeni sorgu/test/
build matrisi çalıştırılmadı; mevcut gerçek OS smoke ve storage kanıt kapıları
uygulamanın kabul şartları olarak açık kaldı.

**Uygulama onayı — kullanıcı, 11.11.2026:** “Plandaki kesin S3 uygulama kapsamını
ve DB belirsizliği çözülene kadar ilgili queue’da manuel başlangıçları da
engelleyen storage fence davranışını onaylıyorum.” Onay: §7'deki 5 ürün Kotlin +
5 test Kotlin + 1 test manifesti ve belirtilen evidence/devir belgeleri; bunun
dışındaki ürün/dosya/şema/policy genişlemesi ayrıca plan kararı gerektirir.
Bu onay uygulanmışlık, test başarısı, bağımsız review veya 1.4b kapanışı değildir.
Onay kaydında yalnız bu plan değişti; CURRENT/ürün/test/ADR değişmedi, test/build
çalışmadı. FTPS alt işi ve bütün açık kabul kapıları korunur.

**Durum:** S3 uygulaması onaylı; kodlama başlamadı, ayrı Opus devri hazır.
**Devam:** YENİ SOHBET — rol değişimi. **Rol:** GPT plan → Opus uygulama.
**Sonraki adım:** Kullanıcı Opus oturumunu açıp aşağıdaki promptu verir.

**Onaylı uygulama devri — yeni Opus sohbeti için prompt:**
“AGENTS.md → CURRENT.md backlog 1.4b → docs/implementation/plans/next-plan.md oku.
Onaylı S3 alt planını §7 kesin dosya sınırında uygula; FTPS/vault/ABI/diğer backlog
salt-okunur. Başlangıç diff/içerik/hash'lerini ve tek evidence manifestini kaydet;
atomik SQLite migration/admission, execution-özel fencing ve tek-sahipli replacement
OS yolunu uygula. OutcomeUnknown/üç çözüm dalı, manuel storage fence, Starting
callback buffer ve §6.1 HandingToOS/OSOwned/erken eligibleAt kurallarını koru.
Önce §8.1 tek ağsız regression, sonra yalnız §8 etkilenen kapsam;
OS harness kapısını ve NOT_RUN ayrımını gizleme. Beklenmedik rebuild/dosya/şema/
policy genişlemesinde dur; iki başarısız denemeden sonra devam etme. CURRENT'ta
1.4b'yi işaretlemeden GPT review bekliyor checkpoint'i bırak; start HEAD, gerçek
tracked+untracked diff, fresh/reuse kanıt/loglar ve açık FTPS/Faz3–4 kapılarıyla
ayrı GPT review'una devret. Commit/push yok.”
