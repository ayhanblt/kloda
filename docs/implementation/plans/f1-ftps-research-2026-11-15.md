# F1/FTPS — dar salt-okunur keşif / tasarım dayanakları

15.11.2026 · GPT plan eki. Executable contract: [next-plan](next-plan.md).
Ürün/test/runtime değişikliği ve test koşusu yok. Yeni kurulum/dependency yok.
Bu ek ilk araştırma bulgularını saklar; uygulamada tamamını tekrar okuma zorunluluğu yok.

## Kaynak bulguları (keşif anındaki satırlar)

- `AndroidFtpsScheduler.kt:33–99`: destination capture'daki credential_locked genel
  catch'e düşer, cancel(JOB/WATCH) çağrılır; plan SQLite'da kalsa da OS fırsatı silinir.
- `AndroidFtpsJob.kt:62–86`: due/plan/matches kontrolleri run claim'inden önce gelir.
  FTPS, eski S3 gibi prefs due tüketmez; mevcut kalıcı plan ve CAS kullanılabilir.
- `AndroidFtpsScheduler.kt:101–111`: changed, run=null planın occurrence/due alanlarını
  destination/source capture başarısından önce yazar. Sonraki kilit reddi bunu geri almaz.
- `AndroidFtpsJob.kt:29–34`: endAutomatic exact owner olsa da jobFinished, WATCH cancel
  ve reconcile koşulsuz/yalnız stopped şartlıdır; yeni projection bundan etkilenebilir.
- `AndroidFtpsJob.kt:39–49`: onStop token eşitliği kullanır; exact params kimliği yoktur.
  executions map'i service instance'a aittir; eski instance cleanup'ı da karşıt testtir.
- `AndroidFtpsSchedule.kt:6–31`: target/binding/occurrence/due/run ve expected-P SQL CAS
  zaten mevcut. Yeni S3 acceptance tablosu veya migration eklemek için gerekçe yok.
- `AndroidFtpsRuntime.kt:47–54`: lease token+run'a bağlı; endAutomatic başka token'ın
  lease'ini bırakamaz. Bu mekanizma korunur, OS projection yetkisi yerine geçirilmez.
- `AndroidFtpsQueue.kt:31–34,96–117`: taze source/profile capture, opt-in, mayRun ve
  binding kontrolleri mevcut. Metadata-only wake bu kontrolleri atlayamaz.
- `AndroidFtpsJournal.kt:168–174`: queue açılışında recoverInterrupted context'i
  invalidate eder. RAM lifecycle kimliği veya eski plan.binding reboot yetkisi değildir.
  Reopen'da eski occurrence'ı aynen koruyan S3 benzeri yeni recovery tasarımı bu işte yok.
- `FtpsRun.kt:23–42,49`: credential_locked/os_interrupted için 300000 ms retry zaten var;
  pre-admission lock için run yaratıp bu run bütçesini tüketmek gerekmiyor.

## Kilitli WATCH kararı / onay sınırı

Kullanıcı bu GPT sohbetinde **Mevcut planı koru** seçti: locked WATCH mevcut P'yi
değiştirmez; ek erken çalışma isteği saklanmaz. Yeni durable dirty/intent, tablo veya
prefs anahtarı gerekmez. Açık cihazdaki WATCH'ın taze guard sonrası erken tetiklemesi
korunur. Bu ürün kararı bütün uygulama planının onaylandığı anlamına gelmez.

## Neden S3 çözümü taşınmıyor?

FTPS'in `ftps_plan` CAS'i, automatic occurrence içeren FtpsRun'ı ve exact-run Runtime
lease'i zaten var. Asıl eksikler lock-specific completion/reconcile ayrımı, WATCH
write sırası ve lifecycle/projection sahipliğidir. Monitor, mevcut token, params
kimliği ve mevcut OS backoff/replacement mekanizmalarıyla sınırlandırılır.
Yeni proof/migration şeması, S3 queue/manual storage fence politikası veya clock
commit recovery'si otomatik eklenmez. OS throw belirsizliğinde kör completion yok;
yalnız exact pending kanıtı veya sonraki yetkili recovery kullanılır.

## Güncel Android doküman kontrolü / sınırlama

Context7 girişimi: `npx --no-install ctx7@latest library Android ...` başarısız:
`npx canceled due to missing packages ... ctx7@0.11.1`; `command -v ctx7` da boş.
Bu quota/DNS hatası değil; yeni paket kurulmadı. Eğitim verisine dönülmedi; resmî
Android referansları doğrudan okunup ilgili API bölümleri doğrulandı (15.11.2026):

- [JobService.jobFinished/onStopJob](https://developer.android.com/reference/android/app/job/JobService#jobFinished(android.app.job.JobParameters,%20boolean)):
  true, OS backoff ister; Doze'da sonraki maintenance window olabilir. onStopJob'dan
  sonra jobFinished gerekmez. Params exact running job instance'ını tanımlar.
- [JobInfo.Builder.addTriggerContentUri](https://developer.android.com/reference/android/app/job/JobInfo.Builder#addTriggerContentUri(android.app.job.JobInfo.TriggerContentUri)):
  WATCH tekrar gözlemi aynı ID/URI'lerle schedule-as-completion ister; bu yolda ayrıca
  jobFinished gerekmez. İşlenmeden erken replacement mevcut işi durdurur. Trigger
  job persisted/periodic olamaz; kilitli WATCH'ı kalıcı job'a dönüştürme yok.
- [JobScheduler.schedule](https://developer.android.com/reference/android/app/job/JobScheduler#schedule(android.app.job.JobInfo)):
  aynı ID replacement running işi durdurur; SUCCESS/FAILURE ayrıdır, sık schedule
  throttle edilebilir. İdempotent reconcile mevcut geçerli projection'ı döndürmemeli.

Bunlar API sözleşmesidir, FO1 veya fiziksel teslim PASS'i değildir. JobService main
callback'lerinde capture/aktarımı çalıştırma; worker kararları ve kısa lifecycle
işaretlemesini ayır, monitor içinde network/await/Runtime ters-kilit yolu kurma.

### OS stop kimliği — S3'ten kopyalanmayan tasarım

[AOSP JobServiceEngine](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/apex/jobscheduler/framework/java/android/app/job/JobServiceEngine.java)
15.11 doğrudan okundu: `JobInterface.startJob:124`, `stopJob:143` ayrı gelen
JobParameters'ı kendi mesajlarında taşır; handler `:165/:182` bunları doğrudan
onStartJob/onStopJob'a verir. Start params nesnesinin stop'ta aynı kalacağı garanti
değildir. İlk denenen eski GitHub core/java yolu bulunamadı; yukarıdaki güncel AOSP
yolu başarılıdır. Bu keşif sırasında ürün/test çalıştırılmadı.

FTPS seçimi: public jobId+token+tam dispatch envelope, service/lane'in aktif yerel E'sini
eşler; stop.params === start.params koşulu yoktur. Aynı lane'de iki aktif delivery
yoktur; implicit OS backoff aynı token'ı taşıyabilir ama eski E terminal/stopped
olmadan yeni E kabul edilmez. OS callback sırası platform lifecycle'ına aittir;
uygulamanın geç worker closure'ı her zaman E taşır, token'dan güncel E'yi seçmez.
Yeni projection her schedule replacement'ta yeni token alır. WATCH ayrı lane/token'dır.
FS2 pozitif testi start params'ın parcel-roundtrip kopyasıyla gerçek stop'u kabul eder;
FS1/FS2 negatifleri emekli captured-E callback'ini reddeder. Yeni params nesnesi olması
tek başına stale kanıtı sayılmaz. FO1 gerçek OS stop doğrulaması ayrıca zorunludur.

### OS sonuç protokolü

Bu bölüm next-plan §4.7–8'in ayrıntısıdır, ikinci goal değildir. Bütün kararlar aynı
Scheduler arbiter'ında ve yalnız hâlâ güncel origin/projection için uygulanır:

- Replacement öncesi yeni RAM D ve benzersiz dispatch token ayrılır. JOB için mevcut
  ftpsDispatchToken anahtarına commit edilir; eski envelope/token geri dönüş kanıtı
  olarak tutulur. WATCH için mevcut ayrı pending token kullanılır, yeni prefs anahtarı yok.
- RESULT_SUCCESS: yeni D installed; eski E kendi completion'ını replacement ile
  tamamlamıştır, ayrıca finish/backoff/cancel yok. Reentrant stop eski E'ye bağlıdır,
  yeni D'yi emekli etmez. OS çağrısı sourceLock altında yapılmaz.
- Explicit RESULT_FAILURE: yalnız aynı D hâlâ güncelse ve eski lifecycle canlıysa
  JOB'un önceki token'ı başarıyla geri yüklenir; eski E tek finish(true) fallback
  kullanabilir. Yeni owner varsa rollback/finish yok. Token storage başarısızsa
  outcome başarıya çevrilmez: projection blocked/error, yeni automatic admission yok.
- Throw: pending'in yeni token+service+tam envelope eşleşmesi varsa SUCCESS kanıtıdır.
  Pending kesin eski envelope ise önceki token restore + tek fallback yolu mümkündür.
  Pending null/foreign/okunamaz ise kabul sonucu belirsizdir: ikinci schedule/cancel/
  finish yok; D unresolved kalır, automatic admission kapalı, sadece kendi lease cleanup'ı.
- Sonraki ordinary reconcile unresolved'u önce pending ile çözer: exact new → installed;
  exact old → old canlı lifecycle varsa fallback; yoksa taze guard'larla tek reproject.
  Kesin null ve o D'ye ait yeni start/admitted run/lease yok → arbiter eski D'yi emekli
  eder, taze guard'larla tek reproject; yeni start varsa kendi envelope'uyla OS teslim
  kanıtı olarak eşlenir, ikinci projection kurulmaz. Yabancı veya
  okunamaz pending → blocked/error kalır. İlk throw'da null, henüz devam eden OS çağrısının
  yokluk kanıtı sayılmaz; recovery yeni seri arbiter turudur. Eski E recovery başlatamaz.
  Explicit pause/disable, kendi revoke yetkisiyle unresolved dahil iptal eder.
- Missing JOB için metadata-only locked wake de bu protokolü kullanır; callback yoksa
  finish fallback yoktur. Recovery yetkisi sır açma/plan tüketme yetkisi değildir.
- Tests: normal replacement, FAILURE, accepted-then-throw/exact-new, exact-old, null,
  read-fail→restore, reentrant stop ve yeni B kurulmuşken geç A sonucu. Karşıtlar FP2/FS1'e
  eşlenir. Başka provider'ın storage/manual fence veya migration protokolü taşınmaz.

## Test/komut dayanakları / önkoşullar

- Runner `AndroidFilesQueueRecoveryInstrumentation.kt:145–160`: mevcut `ftps-product`
  scope, FtpsFixture.load + ProductChecks + FtpsOsChecks çalıştırır. Yeni temsilci için
  ayrık `ftps-automatic-lock` eklenir; henüz var olan komut gibi raporlanmaz.
- Gradle `apps/mobile/modules/my-module/android/build.gradle:18–30,28`: namespace
  com.kloda.sync, native flag `klodaFtpsNative`, özel instrumentation runner mevcut.
  Wrapper `apps/mobile/android/gradlew` yerel dizin okumasıyla mevcut; glob'un ignored
  build ağacını göstermemesi wrapper yokluğu sayılmadı. Mevcut build kalıbının FTPS
  flag'li dar hedefi, bu dizinden: `./gradlew :my-module:compileDebugKotlin
  :my-module:assembleDebugAndroidTest -PklodaFtpsNative=true
  -PreactNativeArchitectures=arm64-v8a --console=plain`. Bu oturumda NOT_RUN.
  Native task'ların çağırdığı ABI listesi ayrı olabilir; önce asset/artifact hazır mı
  kontrol et, eksik native build matrisini otomatik başlatma. `-x` yalnız kaynak/varyant
  hash'i doğrulanmış hazır artifact varsa; doğrulanmamış `.so` ile test yok.
- Temsilci build/kurulum sonrası çağrı: `adb -s <doğrulanan-seri> shell am instrument
  -w -r -e scope ftps-automatic-lock
  com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation`.
  Scope bu planda EKLENECEK; bugün runnable/tested olduğu iddiası yok. Seri ve native
  enabled APK hash'i/runner paket kaydı kurulumdan önce doğrulanır.
- Runner mevcut 300 nonblank/non-linecomment satırdır. Mevcut ftps-product dispatch
  bloğunu yeni test dosyasına taşımak yalnız FTPS yönlendirmesi kapsamındadır;
  başka provider testini silme/yeniden düzenleme veya satır sınırını aşma izni değildir.
- FtpsFixture yalnız test APK'daki `kloda-ftps16/libkloda_ftps_native.so` ve sha256
  asset'lerini yükler. Bunlar yoksa kapsam dışı yeni CA/native build kurma; readiness engeli yaz.
- FtpsOsChecks yalnız boş disposable `com.kloda.sync.test`, ranchu/goldfish emülatörde,
  owned SAF ve alias ile çalışır. Mevcut fixture endpoint `10.0.2.2:27449`; bunu
  kişisel endpoint'e çevirme. Fixture/hostname/native asset ve server önce doğrulanır.
- Mevcut owned OS callback örneği: `cmd jobscheduler run -f com.kloda.sync.test 2710`.
  Bu forced dispatch doğal delivery veya gerçek kilit kanıtı değildir.
- İlk temsilci için gerçek server gerekmez: claim/ağ öncesi throw-only denial ve
  kaydedilen OS çağrıları yeterlidir. Network'lü FO1 ancak temsilci GREEN ve readiness sonrası.

## S3 kabulü / açık kapı ayrımı

CURRENT → `evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/r13-r14/`
`r14-c1/review.md` ve MANIFEST: F1-S3-R13R14 G13/G14/GP bağımsız kabul; blocker yok.
Dedicated identity-mismatch runtime, fresh C1 OS ve lint NOT_RUN kayıtları blocker'a
çevrilmedi veya FTPS testine karıştırılmadı. Eski rejected parent tabloları latest
authoritative disposition ile birlikte okunur; tarihî ret güncel açık bulgu sayılmaz.
**SP-STOP — ayrı S3 kaynak kaygısı, FTPS'e dahil değil:** salt-okunur kontrol
`AndroidS3AutomaticCoordinator.kt:218–219` stop'ta params nesne kimliği arandığını;
`AndroidS3Automatic.kt:67` gerçek OS params'ını doğrudan ilettiğini gösterdi. Yukarıdaki
AOSP yolu nedeniyle gerçek OS stop eşlemesi ayrıca incelenmelidir. Bu yeni karşıt
runtime koşusu NOT_RUN; kabul edilen G13/G14/GP incelemesi geri alınmadı, S3 ürünü veya
manifest/CURRENT değiştirilmedi. S3 düzeltme yetkisi verilmedi. Ayrı GPT S3 incelemesi
kanıt ve kapsam kararı gerekir; FTPS uygulaması S3'e dokunarak bunu kapatamaz.
Kabulün özgün bütün F1/S3 ölçütlerini kapattığı burada ileri sürülmez: üst roll-up
kanıt envanteridir, S3 ürününe yeni edit yetkisi değildir.
Fiziksel/release kapıları: CURRENT ve 20–21 koleksiyonu; üst F1 kapanış şartları
yalnız next-plan §6'da tanımlıdır. Ürün/runtime için yeni PASS yok, commit/push yok.

## Planlama checkpoint'i

Kullanıcı bütün FTPS plan kapsamını onayladı; CURRENT→INITIAL ve next-plan onayı işlendi.
İlk planlama belge kontrolü: next-plan 152 satır, 10 benzersiz kabul satırı ve yerel dosya linkleri
doğrulandı; tarihî S3 içeriği HEAD'deki eski next-plan ile arşiv notu dışında birebir.
Plan/onay kapsamı: next-plan, bu ek, tarihî S3 plan kopyası ve CURRENT yönlendirmesi;
mevcut diğer dirty dosyalar ve S3 kabul kayıtları değişmedi. Runtime/build/lint NOT_RUN.
Sıradaki ayrı Opus sohbetinde `/implement`; önce FL1 temsilcisi. Checkbox'lar açık;
uygulama sonrası ayrı GPT review gerekir. Commit/push yetkisi yok.
