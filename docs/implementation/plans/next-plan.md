# 1.4b/F1 — kalan Android FTPS dar uygulama sözleşmesi

15.11.2026 · GPT plan · **KULLANICI ONAYLI / INITIAL / READY**.
Kullanıcı bu sözleşmenin kapsamını onayladı; CURRENT yalnız F1-FTPS için INITIAL'a
yönlendirildi. Uygulama ayrı kullanıcı-başlatmalı Opus sohbetinde; S3 kabulü korunur.
Başlangıç keşif HEAD `f26e425`; çalışma ağacı dirty. Ürün/test değiştirilmedi.
Dayanak: [B4 §5/§7](../b4-android-vault-lock-policy-2026-11-11.md), ADR0022 D1,
preserved boundaries ve FTPS practical verification; [araştırma](f1-ftps-research-2026-11-15.md).
Eski S3 next-plan [tarihî dosyada](f1-s3-original-plan-2026-11-11.md) korunmuştur.

## 1. Tek goal ve sınır

16.11 R1/R2 ikinci ret sonrası mekanizma eki:
[tek dar stop/recovery sözleşmesi](f1-ftps-r1r2-stop-recovery-contract.md).
Ana goal/ID'ler korunur; ek kullanıcı onaylı, CURRENT FIX. Mevcut Opus `/implement` devri
hazır; bu GPT sohbetinden otomatik uygulama/ajan başlatılmaz.

### 16.11 kullanıcı kararı — FO1 reuse ve fiziksel kabul devri

FO1 şimdi tekrar koşulmayacak, fixture/CA/native asset yeniden kurulmayacak.
03.11 `PASS ftps-owned-os-files` ve güncel WATCH/stop/defer kanıtları reuse edilir
([eşleme](../evidence/f1-ftps-automatic-lock-2026-11-15/fo1-evidence-audit-2026-11-16.md)).
FO1 raporu: **önceki PASS yeniden kullanıldı; yeni success-completion zinciri fiziksel
kabulde DEFERRED / NOT_RUN**. Yeni kodun taze runtime PASS'i iddia edilmez.
Yeni zincirin dar kontrolü §21/Faz4'e taşındı: gerçek başarılı aktarım → tek completion
→ UI açılmadan sonraki JOB callback'i. Bu erteleme F1 geliştirme review'unu engellemez.
Opus mevcut kanıtla toplu review devri hazırlar; GPT bu karara göre gerçek diff'i inceler.
Başka gerçek blocker yoksa GPT FTPS ve üst F1 **geliştirme** maddelerini kapatır;
fiziksel/release kabulü §21/Faz4'te açık kalır. Bu, §3/§5/§6'daki çelişen zorunlu
FO1 tekrar koşusu ve fiziksel kabul bekleyen üst checkbox kurallarını supersede eder.
Lint NOT_RUN ayrı açıklanır; bu karar lint PASS'i veya otomatik review kabulü değildir.

**F1-FTPS:** Geçerli, henüz kabul edilmemiş FTPS otomatik occurrence'ı cihaz kilidi
yüzünden tüketilmeden, yetki verilmeden ve yeniden değerlendirme fırsatı silinmeden
korunsun; yalnız güncel callback kendi plan/OS zamanlamasını değiştirebilsin.
Uygulama ve bağımsız review aşağıdaki tek tabloyu kullanır; yeni goal kopyası üretmez.
**Kullanıcı kararı (bu sohbet):** kilitli WATCH mevcut planı korur; erken çalışma
isteği ayrıca saklanmaz. Açık cihazdaki geçerli WATCH erken tetiklemeyi sürdürür.
Anında unlock teslimi, her WATCH olayını saklama, tüm kaçırılan periyotları telafi,
exactly-once ağ aktarımı veya reboot sonrası eski occurrence'ın aynen kabulü vaat edilmez.
Kapsam dışı: S3 ürün/test/kabulünü yeniden açma; S3 plan/fence/migration kopyalama;
yeni DB/prefs şeması, receiver/izin/servis, WorkManager, vault/alias/Keystore bayrağı,
TLS/LAN/route/receipt/review politikası, UI/JS/iOS/Rust/JNI/ABI/dependency değişikliği.

## 2. Doğrulanmış başlangıç ve kesin dosya sınırı

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.
Kaynak bulgusu runtime kanıtı değildir; ilk RED henüz NOT_RUN.

| Dosya / sembol | Mevcut sorun → beklenen dar değişiklik |
|---|---|
| K/AndroidFtpsScheduler.kt — reconcile, changed, defer, finished, cancel/reportCurrent, current | Kilitte catch cancel; WATCH capture öncesi CAS; token tek başına lifecycle değil → lock-specific bekleme, capture→guard→CAS, exact-owner yan-etki kapısı |
| K/AndroidFtpsJob.kt — Execution, onStart/onStop/onDestroy, execute/finally | Token eşitliğiyle stop ve koşulsuz finally → OS envelope→yerel Execution eşlemesi, exact-E cleanup, tek yetkili completion kararı |
| K/AndroidFtpsQueue.kt — yeni internal retainedPlanForWake | Sadece mevcut ftps_plan + ftps_enabled/confirmed ftps_profile metadata okuması; kilitte sır okumadan opaque wake, ASLA admission/capture yerine kullanılmaz |
| T/AndroidFtpsAutomaticChecks.kt (yeni) | FL1–FL3 testleri korunur; mevcut scope dispatch ve owned fixture/OS kayıt yardımcıları gerektiği kadar internal paylaşılır; test gövdeleri taşınmaz |
| T/AndroidFtpsLifecycleChecks.kt (tek ek androidTest dosyası; 15.11 kullanıcı yönlendirmesi) | Yalnız kalan FW1/FW2/FS1/FS2/FP1/FP2 için ortak üretim Scheduler/Job yollarında projection/exact-Execution sahipliği ve yan-etki regresyonları; FL test kopyası veya ürün helper'ı değil |
| T/AndroidFtpsPolicyChecks.kt (16.11 kullanıcı onayı; sekizinci dosya) | Yalnız FP1 kalan satırları (busy, retry/clock, eski wake + pause/disable/source-profile revision); LifecycleChecks'in `future`/`pendingFor`/`restore` yardımcılarını internal kullanır, yeni fixture/ürün helper'ı yok; `ftps-automatic-lifecycle` scope'una bağlanır |
| T/AndroidFtpsOsChecks.kt | Mevcut owned OS yoluna rearm/token/WATCH ve unlock-temsilci kapsamı; fiziksel kilit testi olduğu iddiası yok |
| T/AndroidFilesQueueRecoveryInstrumentation.kt | Yalnız FTPS scope dispatch; 300-satır sınırı için mevcut ftps-product bloğu yeni test dosyasına delege edilebilir; anlamı korunur |

15.11 dosya-yerleşim kararı: önceki altı sınırına yalnız T/AndroidFtpsLifecycleChecks.kt
eklenir (toplam yedi); hepsini değiştirme zorunluluğu yok, her biri ≤300 nonblank/noncomment
satır. Biçimsel sıkıştırma ile sınır aşılmaz; başka test/ürün helper dosyası yeniden onay ister.
16.11 kullanıcı kararı: LifecycleChecks 299/300'e ulaştığı için yalnız FP1 için T/AndroidFtpsPolicyChecks.kt
eklendi (toplam sekiz; aynı ≤300 kuralı). Goal, §3 tablosu ve kabul ölçütleri değişmedi.
Schedule/FtpsRun/Runtime/Journal/Profiles/Vault, ortak BackupScheduler/receiver/manifest
salt-okunur; mevcut ftps_plan CAS, ftps_run, dispatch token ve exact-run lease kullanılır.
Belge/kanıt: bu sözleşme, araştırma eki, CURRENT ve tek `evidence/f1-ftps-automatic-lock-2026-11-15/MANIFEST.md`.

Yerleşim: FW/FS/FP yeni LifecycleChecks'te; FO1 mevcut OsChecks'te, `ftps-product`
delegasyonu korunur. OsChecks gerçek aktarım/fixture-server yoludur; küçük olması tek başına
deterministik lifecycle matrisini buraya karıştırma gerekçesi değildir. AutomaticChecks'in
`owned`/`Recorder` yardımcıları yalnız gerekli görünürlükle paylaşılır; yeni fixture altyapısı
kurulmaz. Dar yeni scope dispatch mevcut iki test/runner dosyası sınırında kalır; FL scope'u
anlamsal olarak korunur. Paylaşılan yardımcı/üretim yolu değişirse etkilenen FL kanıtı yenilenir.

## 3. Ortak durum–olay–beklenen sonuç / sabit kabul ID'leri

P = (target,binding,occurrence,due,run); D = JOB/WATCH projection kimliği;
E = yerel exact Execution + service instance + saklanan start params. OS stop'unda
start/stop params nesne eşitliği ARANMAZ; platform envelope'u yerel E'ye eşlenir.
FL/FW/FS/FP/FO zorunludur; tabloda bir ID'nin bütün satırları karşılanmadan ID kapanmaz.

| ID/satır | Başlangıç | Olay | Beklenen kalıcı durum / yan etki | Dar kabul testi |
|---|---|---|---|---|
| FL1 | Güncel due P, run=null; cihaz kilitli | JOB admission/capture credential_locked | P ve run sayısı/attempt bütçeleri değişmez; lease/ağ yok; yalnız kendi JOB'una OS backoff, cancel/finally-reconcile yok | İlk RED→GREEN temsilci |
| FL2 | P mevcut; UI kapalı, kilitli | Ordinary reconcile; JOB var/yok | P değişmez; var olan geçerli JOB korunur; yoksa metadata-only gecikmeli wake; sırsız credential_locked teşhisi | pending var/yok karşıtları |
| FL3 | FL1 sonrası aynı config, açık cihaz | Sonraki uygun OS callback | Taze profil/source/opt-in/pause/token/plan/lease kontrolleri; due ise mevcut occurrence kabulü, future ise erken kabul yok | Denial kaldır, aynı P + tek claim |
| FW1 | Live future P, run=null; kilitli | Güncel WATCH | P değişmez; erken istek saklanmaz; JOB korunur; WATCH yeniden gözleme alınır | Capture reddi öncesi/sonrası P eşitliği |
| FW2 | Live P, açık cihaz | Güncel WATCH | Önce taze destination/source guard; aynı hedef/binding ve run=null ise expected-P CAS ile erken occurrence; stale/claimed P yazılmaz | valid, capture fail, CAS mismatch, run!=null |
| FS1 | A emekli/stopped; yeni D/E=B kurulmuş | A'nın success/throw/finally/stop/destroy/defer/report sonucu | B'nin P/token/error/JOB/WATCH/lease'i değişmez; A yalnız kendi cleanup'ını yapabilir; schedule/cancel/finish/reconcile=0 | A'yı barrier'da tut, B'yi kur, A'yı bırak; JOB ve WATCH |
| FS2 | Güncel E; OS yeniden parcel edilmiş stop params gönderir; eski A worker'ı da var | Gerçek OS stop / A'nın geç cleanup'ı | OS stop servis+jobId+token/envelope ile E'yi durdurur; A'nın captured-E cleanup'ı B'ye dokunmaz | parcel-roundtrip params stop + old-service/worker karşıtları |
| FP1 | Güncel run waiting/busy/paused veya ayarlar değişmiş | Defer/finished/clock/disable/source değişimi | Mevcut retry budget/elapsed/boot ve CAS kuralları korunur; locked pre-admission run üretmez; pause/disable eski wake'i yetkiye çeviremez | busy, retry, pause, disable, source/profile revision |
| FP2 | Storage/CAS/OS hatası | Read/commit failure, schedule FAILURE/throw | credential_locked gibi ele alınmaz; fail-closed, sırsız hata, başarı varsayımı yok; yeni owner'a cleanup yok | storage fail, CAS miss, OS fail/throw |
| FO1 | Owned emülatör, gerçek JobScheduler | JOB completion/defer + WATCH replacement/stop | Tabloyla aynı sahiplik; tek completion; UI açılmadan sonraki JOB; yeni WATCH eski finally ile silinmez | Mevcut ftps-product + dar OS extension |

**FS1 somut regresyonu:** FL3 `run-2.log` gözlemi, eski A'nın `finally → reconcile`
catch'inden token/exact-owner kontrolsüz `report(code)` ile B'nin `ftpsAutomaticError` alanını
ezmesi riskidir (Job finally → Scheduler reconcile catch → report). A barrier'da tutulur,
B kurulur ve sırsız ayırt edici error başlangıcı kaydedilir; A'nın hata/finally yolu bırakılır.
B.error dahil FS1 satırındaki tüm sahiplik alanları aynı kalmalı, A schedule/cancel/finish/
reconcile üretememelidir; JOB/WATCH karşıtları gerekir. Teardown'u bekletmek veya error'u
silmek bu ölçütü karşılamaz. `run-2.log` gözlemdir; kontrollü FS1 RED/GREEN kanıtı henüz yok.

## 4. Seçilmiş mekanizma ve yan-etki sınırı

1. `credential_locked` yalnız pre-admission bekleme sebebidir: occurrence/due/run CAS'i
   ve FtpsRun.failed/retried çağrısı yapılmaz. Run zaten kabul edilmişse mevcut queue
   pause/retry/review yolu korunur; post-admission bütçeler bu işte yeniden tasarlanmaz.
2. `changed` taze destination/source capture başarısından ÖNCE ftps_plan yazamaz.
   Capture sonrası target/binding/run ve exact owner tekrar kontrol edilir; expected-P
   CAS kaybı yeni planı ezmez. Kilitli WATCH için dirty/intent kaydı veya erken due yok.
3. Lock-aware reconcile, P'yi salt-okunur alır. `retainedPlanForWake` confirmed profile
   ile enabled kaydının eşleşmesini ve aynı target'ı doğrular; disable/global pause'ta
   wake yok. Bu metadata, credential/source/route yetkisi değildir. Reopen context'i
   değişmiş olsa da yalnız wake sağlayabilir; unlock sonrası taze capture zorunludur.
   JOB yoksa en az mevcut credential_locked gecikmesi (300000 ms) ile yeniden kur;
   latency P.due'yu değiştirmez. P yoksa fake plan/run/yetki yaratma; mevcut receiver akışı kalır.
4. Exact lifecycle kayıtları Job'da, JOB/WATCH için güncel projection kimliği Scheduler'da
   tutulur; WATCH'ın kendi token'ı vardır (ortak watch helper zaten üretir), JOB token'ı
   ona uygulanmaz. Yalnız callback kaydının varlığı projection yetkisi değildir.
   Başka projection/ayar iptali eskisini emekli eder; ordinary idempotent reconcile
   aynı geçerli projection'ı değiştirmez. Pending eşitliği P'nin TÜM alanlarını kapsar.
5. Mevcut Scheduler monitorü tek mutation/OS arbiter olur: expected-P/owner kontrolü
   ve bu karara ait CAS/report/cancel/schedule/finish aynı yetki çitinden geçer.
   Sıra Scheduler monitor → sourceLock; sourceLock altındaki current/lease valid okuması
   monitor ALMAZ (immutable/volatile kimlik snapshot'ı). Runtime begin/endAutomatic,
   queue callback/worker bekleme ve aktarım monitor dışında kalır; ters kilit sırası yok.
   Fresh capture hazırlığı uzun lifecycle kilidine dönüştürülmez; mutation öncesi source
   revision/header ve expected P yeniden kontrol edilir. Stop ile OS kararı serialize olur.
6. OS stop service+jobId+dispatch envelope ile o lane'in aktif E'sine eşlenir; Binder'dan
   gelen params için `===` yok. Backoff redelivery eski E emekli olduktan sonra alınır;
   aynı projection token'ıyla iki aktif E kabul edilmez. Worker closure'ları captured-E
   ister; yeni E'yi token'dan tekrar bulamaz. Finish saklanan start params'ı kullanır.
   Lease bırakma `endAutomatic(E)` ile monitor dışında; eski finally yeni reconcile gönderemez.
7. Pre-admission locked JOB: tek `jobFinished(params,true)` (OS backoff), token/P korunur;
   stopped ise finish yok, güncel exact onStop için yetkili retry kararı döndürülür.
   Normal JOB sonucu/busy: yetkili plan geçişi ardından next JOB'u schedule-as-completion;
   başarıda ayrıca finish yok. Explicit RESULT_FAILURE'da yalnız hâlâ kendi lifecycle'ına
   tek backoff fallback; throw belirsizliğinde cancel+finish çiftiyle kör telafi yok:
   pending exact projection okunup kanıtlanır; ayrıntılı old/new token ve belirsizlik
   kararı [ek §OS sonuç protokolünde](f1-ftps-research-2026-11-15.md#os-sonuç-protokolü)
   kilitlidir. Belirsiz projection admission'ı kapatır, manuel queue fence'i eklemez.
8. WATCH completion: tüketilmiş exact WATCH'ı aynı URI'lerle replace ederek yeniden gözle;
   schedule-as-completion başarıda ayrıca jobFinished/cancel yok. Kilitli WATCH da bu
   yoldadır, fakat P'yi değiştirmez. FAILURE/throw için §4.7'nin tek fallback/belirsizlik
   kuralı uygulanır. Yeni WATCH'ı eski `finally cancel(WATCH)` asla silemez.

## 5. İlk temsilci → dar genişletme / kanıt kapısı

Önce yalnız FL1: mevcut runner'a dar scope + gerçek isolated FTPS DB/plan; capture
sınırında throw-only credential_locked enjeksiyonu, OS kayıt portu ve Job'un ortak
üretim completion yolu. Başlangıç P/run-count/lease/OS kaydı al; callback bitiminde
P aynen, runs=0, lease=null, cancel=0, tek retry=true bekle. Eski üründe yanlış
cancel/finish nedeniyle RED gör; test kopyası/yalnız Scheduler testi Job kanıtı değildir.
Sonra minimum FL1 düzeltmesi ve GREEN; diğer matris altyapısını önce inşa etme.
Sahte denial gerçek Keyguard/Keystore PASS'i değildir. Fixture UUID namespace/owned
test paketi; yalnız kendi SAF/DB/alias teardown'u; secrets loglanmaz, kişisel veri yok.
Temsilci sonrası FL2–3→FW→FS→FP→FO sırasıyla tüm onaylı kapsam sürdürülür;
her ID kanıtlanır, satır başına kullanıcı onayı/sohbet/review açılmaz.
Önce mevcut APK/native asset/fixture/runner ve tek emülatör hazır mı doğrula; sonra
dar build/instrumentation. Kesin mevcut komut dayanakları araştırma ekinde; ilk koşu
öncesi gerçek ortam/seri/task doğrulanır, uydurma runnable capture komutu yok.
Test/lint/typecheck/build yalnız etkilenen kapsamda; lint eski iki-deneme blokajını
üçüncü kör denemeyle aşma, NOT_RUN kalırsa review'da açıkça değerlendir. Tam matris Faz3.
Risk: native custody/lifecycle yüksek; ayrı Opus `/implement`, Sonnet pilotu değil.
16.11 süreç kararı: 15000 output-token ajan içi verimlilik kontrolü; UNKNOWN durma
nedeni değil. İki başarısız aynı yaklaşımda DUR; sayaç oturumla sıfırlanmaz.
Review öncesi bütün zorunlu kanıtlar ve kod standartları kontrol edilir. Eski lint
blokajı çözülmüş veya ertelenmesi onaylanmış sayılmaz; zorunlu eksikse KISMİ/BLOCKED,
review-ready değil. Mevcut açık kapılar ve ürün kabul ölçütleri değişmedi.

## 6. Bitti / üst F1 / devir

**FTPS alt işi:** FL/FW/FS/FP/FO bütün zorunlu satırları kaynak/varyant/APK hash'leriyle
manifestte kanıtlı + ilgili dar build/kontroller açıklanmış + ayrı GPT gerçek-diff kabulü.
Opus işi unchecked REVIEW bırakır; temsilci GREEN veya bütçe checkpoint'i kapanış değildir.
**Üst 1.4b/F1:** bu FTPS kabulü tek başına kapatmaz. GPT roll-up, S3'ün mevcut G13/G14/GP
kabulünü değiştirmeden, özgün F1'in S3 ve FTPS ölçütlerinin tamamını kanıta eşlemeli;
açık S3 ölçüt/bulgu çıkarsa ayrı S3 kapsamına ayrılmalı, bu FTPS diff'ine eklenmemeli.
F1'e ait gerçek lock→unlock/UI-kapalı doğal OS delivery, Doze, ilk unlock/CE,
reboot/recovery ve force-stop sınırı Faz4'te açık kalır; 16.11 kullanıcı kararıyla
geliştirme checkbox'ının kapanışını bekletmez. Yeni FO1 zinciri de bu kapıya eklendi.
Fiziksel test için cihaz/hesap/medya izni varsayılmaz; force-stop'ta çalışma garantisi yok.
Production signing/storage/custody, B4 kalan riskleri, P5 ve genel Faz3–4/20–21 kapıları
ayrı açık kalır; sentetik/forced OS koşusu bunları kapatmaz. Sırf üst maddeyi kapatmak
için kanıt uydurulamaz; mühendislik-only üst kapanış 16.11 kullanıcı kararıyla onaylandı.
Onaydan sonraki INITIAL baseline: HEAD/status, tracked+untracked işe ait diff ve CURRENT
snapshot'ı; mevcut dirty S3/AGENTS/commands değişikliklerini bu işe mal etme.
Tek manifest: ID/satır→test/log→fresh/reuse/NOT_RUN→review/açık kapı, invariant sayaçları.
S3'ün kabul kaydı/sayaçları korunur; ayrı SP-STOP kaynak kaygısı ekte, FTPS fix'i değildir.
Bu plan test/ürün kabulü veya commit/push izni değildir. Kritik açık ürün kararı yok;
uygulamada sözleşme/fixture çelişirse DECISION ile bu GPT sohbetine dön, beklentiyi gevşetme.
Mevcut RAM-intent/geri-saat sınırlamaları saklanmaz; fiziksel/release notlarında açık kalır.
**Devam / Opus:** mevcut kanıtı yeniden kullanarak review devrini tamamla;
FO1 koşusu/fixture kurulumu yok. Sonra toplu bağımsız GPT review ve geliştirme kapanışı.
