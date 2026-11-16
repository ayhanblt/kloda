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

---

## 1.5 — Regresyon hazırlığı uygulama sözleşmesi / 16.11.2026

### Durum ve yetki
**KULLANICI ONAYLI / UYGULAMAYA HAZIR — INITIAL (16.11.2026).**
Kullanıcı bu sohbet içinde §1.5 sözleşmesinin tamamını onayladı ve yalnız Opus devri istedi.
L15 yolu Apache-2.0'dır. Bu yetki yalnız §1.5 içindir; yukarıdaki onaylı F1 §1–6
aynen korunur. CURRENT önce okunur; aktif F1 yönlendirmesi bu açık kullanıcı
onayını F1 uygulama yetkisine çeviremez. F1'in mevcut işi/diff'i devralınmaz.
Bu bölüm 1.5'in tek goal/kabul kaynağıdır; uygulama ve bağımsız review buna referans verir.
Satırlar tek işin ajan içi kontrolleridir; ayrı görev/onay/sohbet değildir.

### Tek goal / kapsam dışı
**Goal:** mevcut iOS WebDAV journal host kontrolü üretim kalıcılık kurallarını
yeniden çalıştırabilir olsun; üç eksik S3 lisans metni doğrulanmış kaynakla tamamlansın;
B2 Swift fixture-CA dışlama kontrolü gerçek release app artifact kabulüne bağlansın.
Kapsam dışı: ürün journal/TLS/custody/transport değişikliği, migration, yeni CA/auth,
dependency sürüm/lock değişikliği, yeni test sunucusu/fixture, tam regresyon,
Android F1/S3 kabulünü yeniden açma, signing/P5/gerçek cihaz/hesap/medya çalıştırma.
Release kontrolünü tanımlamak gerçek release PASS'i değildir; mevcut erteleme korunur.

### Doğrulanmış başlangıç ve kanıt/diff karşılaştırması
Planlama anındaki dirty ürün diff'i yalnız beş Android FTPS dosyasıdır;
diğer değişiklikler CURRENT/FTPS manifesti ve `fix2/resume-win/` kanıtıdır.
1.5 kaynakları bu dirty diff'te yoktur; bu tek başına eski PASS'in güncelliğini kanıtlamaz.
Kanıt kökü aşağıdaki kısa yollarda `docs/implementation/evidence/` demektir.

| Sınıf | Eski kanıt / mevcut kaynak karşılığı | Tekrar veya reuse kararı |
|---|---|---|
| Yeniden kullanılacak | `s3-native-step17-2026-11-03/verification-2026-11-04/manifest.json` lisans 78/81 ve `license-source.json` | Notices, inventory ve JNI MIT byte hash'i CRLF yüzünden farklı; LF-normalize üçü de kayıtla eşit. Mevcut üç açık boşluk doğrulandı; eski JNI metnini yeniden arama. |
| Değişiklikten etkilenmiş | `cloud18-nextcloud-2026-10-31/multi-target-queue-2026-11-02.json` iosJournal PASS | Sonraki `recovery29-2-2026-11-03.json` açık host kırılması kaydeder; 02.11 PASS güncel harness PASS'i sayılamaz. |
| Eksik | Aynı recovery29-2 kaydı: URLSession/macOS host ve IosCloudTarget kırılması | Güncel script hâlâ client derliyor; journal `queueKinds` için OAuth kinds, init için `createImports()` ister. Script import-journal kaynağını almıyor. Onarım sonrası yalnız bu host koşusu gerekir. |
| Yeniden kullanılacak | `tools/test-ios-recovery-catalog.py` mevcut host izolasyon deseni ve recovery29-2 ios_host PASS | Üretim journal, transport dışı seam ve gerçek initializers yaklaşımı kullanılır; catalog suite sırf yeni sohbet diye tekrarlanmaz. Eski PASS WebDAV publication testinin yerine geçmez. |
| Eksik | `claude-review-2026-11-11.md` B2; `tools/check-s3-native.mjs:69–73` | Kontrol Rust `.a` içindir; Swift marker `IosS3Client.swift:110–113` içindedir. App-level release kapısı eksik; Rust kontrolünü tekrar koşmak açığı kapatmaz. |
| Yeniden kullanılacak / açık | S3 04.11 Photos/automatic/build ve §20–21 sınırları | Bu plan ürün davranışı değiştirmiyor; eski scoped PASS korunur, güncel bütün ürün PASS'i iddia edilmez. Fixture kaybı tekrar gerekçesi değildir. |

Üç dağıtım bildirimi henüz tamamlanmadı; seçilen Apache-2.0 yolu ve kaynaklar:
[1.5 araştırma eki §L15](backlog-1.5-research.md#l15--kaynak-engeli).
Varsayım: macOS'ta aynı dar compile closure onarımı yeterlidir; bu oturumda runtime
kanıtı yoktur. Yeni SDK hatası ürün değişikliği yetkisi vermez.

### Dosya / sembol / kesin değişiklik sınırı
`ios/` aşağıda `apps/mobile/modules/my-module/ios/` kısaltmasıdır.

| Hedef dosya / sembol | Mevcut sorun → seçilen değişiklik | Kabul |
|---|---|---|
| `tools/test-ios-webdav-journal.py` / sources, generated stub, seed/reopen | HTTP client host derlemesini çıkar; yalnız kullanılan `IosWebDavClient.encode` gövdesini üretimden aynen çıkarıp host seam'e koy; eşleşme yoksa açık hata. `IosCloudTarget.oauthKinds` deklarasyonunu recovery scriptindeki gibi üretimden al; `IosRecoveryImportJournal.swift` gerçek kaynağını closure'a ekle. | H15, P15 |
| `packages/pairing-native/apple/tests/IosWebDavPublicationChecks.swift` / main | Mevcut seed/reopen assertion'ları korunur; plan yeni test dosyası/assertion gerektirmiyor. Beklenti gevşetme veya satır silme yok. | P15 |
| `packages/s3-native/THIRD_PARTY_NOTICES.md` / üç eksik bölüm | Apache-2.0 seçimini, resmî tam metni ve paket/sürüm/kaynak bağını ekle; mevcut gerçek bildirimleri koru (cesu8 Rust atıfları dahil). Mevcut JNI/diğer metinlere dokunma. | L15 |
| `docs/implementation/20-21-acceptance-collection-2026-11-04.md` / §20 dağıtım kapısı | B2 için aşağıdaki artifact/flags/nm/kayıt koşullarını bağla; lisans açık/kapalı durumunu yalnız L15 kanıtına göre güncelle. | B15 |
| `docs/implementation/evidence/backlog-1.5/MANIFEST.md` ve dar loglar | Uygulamada tek kanıt haritası: bu sözleşmenin ID'si → hash/komut/log/fresh/reuse/open; goal kopyalama yok. | V15 |

Üretim Swift dosyaları, `tools/check-s3-native.mjs`, diğer host scriptleri
**değişmeyecek**. Sibling destination host scriptindeki benzer borç bu işe eklenmez.
L15 metni mevcut notices dosyasına eklenir; yeni lisans dosyası/bağımlılık gerekmez.

### L15 seçilen çözüm — Apache-2.0, risk feragati değil
Üç paketin sunulan Apache-2.0 seçeneği kullanılır; orijinal çift lisans beyanı da
kaynak bilgisi olarak korunur. Paketin kendi lisansı değiştirilmez.
Tam metin `https://www.apache.org/licenses/LICENSE-2.0.txt` kaynağından aynen alınır;
paketten çıkmış bir dosya diye sunulmaz. Her eksik bölüm bu metni ve seçimi açıkça taşır.
Paket/sürüm beyanı ile standart metnin kaynağı ayrı kaydedilir; exact upstream LICENSE
dosyasının bulunması artık önkoşul değildir. Copyright sahibi/tarih uydurulmaz.
Mevcut sürüm kaynaklarındaki ilgili copyright/atıf ve varsa NOTICE korunur;
cesu8 1.1.0 README ve COPYRIGHT-RUST.txt içindeki Rust kökeni/çift lisans bildirimi
esas alınır. Rust'ın ilgisiz bileşen listesinden yeni bağımlılık/izin sonucu çıkarılmaz.
Bu dar bildirim kontrolü implementasyon içidir; yeni sunucu/test/fixture araştırması değildir.
Değiştirilmiş bağımlılık dosyası varsa Apache §4(b) değişiklik bildirimi gerekir;
plan bağımlılık değiştirmez. Çelişen gerçek lisans bildirimi çıkarsa GPT'ye dönülür.
§20, bu notices metninin dağıtılan uygulamanın lisans materyallerinde bulunmasını
kabul şartı yapar: yalnız repoda bulunması dağıtım PASS'i değildir. Gerçek release
paketinde bulunurluk kontrolü mevcut release kapısında açık kalır; yeni paketleme işi yok.

### Invariant / olay-sırası ve ortak kabul tablosu
Ürün concurrency/kalıcılık algoritması değişmez. Test seam'i sadece kullanılmayan
HTTP/PC bağlantılarını ayırır; production journal/publication/schedule/restore aynen derlenir.
Sahte `createImports/createCatalog`, sahte CAS/ACK, sabit kopya OAuth listesi yok.

| ID | Başlangıç | Olay / kesinti / geç callback | Beklenen state ve kalıcı/OS yan etki | Kabul testi / kanıt |
|---|---|---|---|---|
| H15 | Güncel host kaynak listesi compile olamıyor | macOS'ta mevcut komut; ardından yalnız harness düzeltmesi | Aynı üretim journal/publication derlenir; network, Keychain, OS dispatch yok | `python3 -I tools/test-ios-webdav-journal.py`; ilk compile teşhisi ve final GREEN logu |
| P15 | prepared / uploaded / moving; eski target planı | PUT/MOVE yanıt kaybı, ACK sonrası context değişimi, stale plan callback; sonra yeni süreç reopen | Kayıp PUT prepared, kayıp MOVE moving; ACK sonrası moved, sahte Completed yok; yeni plan stale callback ile ezilmez; OS işi yok | Mevcut seed/reopen, rejects/CAS, immutable/keep-both/restore kimliği assertion'larının tümü korunarak H15 GREEN |
| L15 | Üç lisans bölümünde unavailable | Apache-2.0 seçimi, standart tam metin ve mevcut gerçek bildirimlerin eklenmesi | Üç belge boşluğu kapanır; copyright atfı uydurulmaz; dependency/ürün/OS etkisi yok; release paketinde sunum ayrı açık kapıdır | Her paket için sürüm/lisans beyanı kaynağı, resmî Apache metni URL/hash'i, gerçek bildirim kontrolü ve notices karşılaştırması; §20 dağıtıma dahil etme şartı |
| B15 | Rust marker kontrolü var, app kontrolü yok | Release artifact kabul talebi veya fixture bayrağı/artifact eksikliği | App kanıtı olmadan dağıtım kabulü verilmez; marker/fixture bayrağı varsa FAIL; belirsiz/eksik kanıt OPEN; OS etkisi yok | §20 prosedürünün temiz/marker bulunan/araç hatası/eksik artifact durumlarını kapsayan review'u; gerçek release koşusu ertelenmiş |
| V15 | H15/P15/L15/B15 kanıtları derlendi | Uygulama devri ve ayrı GPT gerçek-diff review | Zorunlu eksik varken REVIEW-ready değil; Opus checkbox kapatmaz; bağımsız kabul ayrı | Tek manifestte ID eşlemesi, tam tracked+untracked kapsamı, fresh/reuse/deferred ayrımı |

### B15 kesin kabul prosedürü (yeni script yok)
§20, gerçek `.app`/archive içindeki CFBundleExecutable yolunu, Release config/SDK/
architecture ve kaynak revision'ını, app executable SHA256'sını ve build settings
kanıtını ister. Swift `KLODA_S3_OWNED_FIXTURE` ve Rust owned-fixture etkin olamaz.
`xcrun nm --no-llvm-bc <app-executable>` çıktısı/exit'i saklanır; tam sembol
`_kloda_s3_owned_fixture_marker` bulunursa FAIL. Rust archive sonucu app yerine geçmez.
Strip edilmiş/okunamayan semboller veya nm başarısızlığı “marker yok/PASS” değildir:
aynı link'in strip öncesi executable kanıtı ve final artifact bağı gerekir; yoksa OPEN.
Flag yokluğu + kullanılabilir sembol çıktısı + artifact/config bağı birlikte aranır.
Bu iş yalnız kapıyı bağlar; yeni release build/signing/kurulum veya fixture-CA koşusu istemez.

### En dar doğrulama ve uygulama sırası
1. Onaydan sonra HEAD/status/işe ait diff/hash baseline'ını kaydet; mevcut F1'e dokunma.
   Önkoşul: macOS + xcrun/swiftc + SQLite3/CryptoKit, yazılabilir disposable temp,
   mevcut golden JSON. Sunucu/cihaz/CA gerekli değil; eksikse kurulum icat etme.
2. İlk temsilci: mevcut H15 komutunun compile hatasını bir kez yakala; yalnız
   yukarıdaki harness closure/seam onarımı → aynı mevcut seed/reopen GREEN.
   Somut tekrar gerekçesi: bozuk compile bağlantısı değişti; journal geçişleri artık yürümeli.
3. Temsilci GREEN sonrası seçilen L15 Apache-2.0 çözümü uygulanır ve B15 belge kapısı bağlanır;
   H15/P15 ürün veya closure değişmediyse tekrar koşulmaz. Geniş fixture matrisi yok.
4. Zorunlu: değişen Python için AST/sözdizimi kontrolü (pycache bırakmadan),
   H15/P15 derleme+çalışma, L15 kaynak/metin karşılaştırması, B15 negatif koşul review'u,
   `git diff --check`, hedef diff/standart incelemesi. Swift typecheck/build H15 içindedir.
   TS/JS/Kotlin/Rust değişmediğinden Jest/ESLint/tsc/Android/native ABI ve tam app
   build tekrarına gerek yok; kaynak değişirse kapsam kararı için GPT'ye dön.
   Bu planlama oturumunda ürün test/build koşulmadı; fresh runtime PASS yok.

### Review, model, bütçe ve durdurma
Review: davranış ve etkilenen callers/compile closure kanıtı; assertion kaybı yokluğu;
test-only seam'in üretimden alındığı; temiz kod/FSD/i18n/stil/300 satır kurallarına
uygunluk (UI değişmiyor); ilgili test/lint/typecheck/build'in yukarıdaki gerekçeli kapsamı.
Zorunlu H15/P15/L15/B15/V15 eksikleri review-ready'yi engeller. Fiziksel/release
çalıştırması, signing/storage/P5 ve Faz3–4 önceki açık kapılardır; yeniden açılmaz/waive edilmez.
Risk: orta, güvenlik/release kanıtı içerir; normal **Opus `/implement`**, effort otomatik
değişmez. B15 nedeniyle bu iş Sonnet pilotu değildir; ilk uygun düşük riskli işte
kullanıcı seçimiyle `/implement-pilot` önerisi korunur, modeli kendiliğinden değiştirme.
Usage UNKNOWN; 15000 thinking-dahil output ajan içi verimlilik kontrolüdür.
Ölçüm yoksa ilk temsilci sonunda kapsam/tekrar/ilerleme notu; onaylı tüm satırlara devam.
UNKNOWN/eşik/tek satır bitişi onay veya sohbet duruşu değildir.
Aynı yaklaşım/invariant iki başarısız fix'te DUR; sayaç manifestte ve oturumlar arası korunur.
Ürün/güvenlik kararı, sözleşme çatışması, eksik gerçek altyapı veya yıkıcı işlem de DUR.
**Açık karar:** kritik tasarım kararı yok; §1.5 uygulama onayı bu sohbette alındı.
macOS önkoşulu uygulama kanıtı için zorunlu; Windows'ta H15 PASS'i ileri sürülmez.
**Tek sonraki adım / Opus uygulama:** bu işin mevcut Opus sohbeti varsa onu kullan;
yoksa ayrı Opus sohbeti aç. Devir hazırlayan GPT uygulama/ajan başlatmaz.
Tam komut/prompt:
`/implement — Kullanıcı onaylı INITIAL kapsam yalnız docs/implementation/plans/next-plan.md §1.5.
AGENTS.md → CURRENT.md oku; CURRENT'teki F1 yönlendirmesini bu işe uygulama.
§1.5 tek goal/kabul kaynağıdır; H15/P15/L15/B15/V15 tek işin iç kontrolleridir.
Mevcut kanıtı/diff'i eşleştir; ilk H15 temsilcisi → dar onarım → kalan onaylı kapsam.
F1 §1–6, mevcut F1 diff'i ve diğer backlog işleri kapsam dışı; kanıt/erteleme sınırlarını koru.
macOS önkoşulu yoksa H15'i PASS sayma; somut engeli kaydet, altyapı kurulumunu varsayma.
Tek manifestte fresh/reuse/deferred ve ilgili doğrulamaları kaydet; REVIEW/unchecked bırak.
Bağımsız GPT review gerekir. Commit/push yok.`

<a id="21g1--mobil-etkinlik-uygulama-sözleşmesi-taslağı--16112026"></a>
## 2.1/G1 — Mobil Etkinlik uygulama sözleşmesi / 16.11.2026

### Durum / yetki / tek kaynak
**KULLANICI ONAYLI / INITIAL / UYGULAMAYA HAZIR — D-G1 kabul edildi (16.11.2026).**
Kullanıcı tarihsiz, sınırlı PC journal görünümü uyarlamasını onayladı; bu tur yalnız
sözleşmeyi hazırlar, uygulama/ajan/model başlatmaz. Sonraki uygulama kullanıcı başlatmalıdır.
Yalnız bu bölüm G1 sözleşmesidir; F1 §1–6 ve §1.5 aynen korunur, bu işe taşınmaz.
CURRENT/backlog/checkbox kullanıcı sınırı gereği değiştirilmedi; CURRENT'teki G1
“henüz onaylı değil” notunu yalnız bu iş için yukarıdaki açık onay supersede eder.
F1/1.5 INITIAL/FIX yönlendirmeleri G1'e uygulanmaz; G1 bu bölümden INITIAL olarak yürütülür.
Doğrulanmış keşif ve eski kanıt eşlemesi: [araştırma §1–4](g1-activity-research.md).
HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`; ürün/test değişikliği ve taze test PASS yok.

### Tek goal / kapsam dışı
**G1:** Mobil Etkinlik kullanıcısı Şu an ve Geçmiş segmentlerinde gerçek native journal
kayıtlarının durumunu ayırt edebilsin; tamamlanma, geçmiş kapsamı ve zaman bilgisi uydurulmasın.
Onaylı en küçük çözüm aşağıdaki bounded/latest-state sunumudur; G1 kapanışı bu uyarlanmış
kapsama göre değerlendirilir. Tam Lovable tarihli veya birleşik provider geçmişi iddiası yoktur.
Kapsam dışı: F1/1.5 diff/kanıt/ertelemeleri, scheduler/OS ownership, transfer/ACK politikası,
journal yazımı/migration/event store, yeni native API, uzak yedek kataloğunu geçmişe çevirme,
provider birleşik tarihçesi, export/restore/retry yetkisi değişimi ve yeni fixture/hesap/SDK.
Kabul satırları tek işin iç kontrolleridir; ayrı görev, onay veya sohbet değildir.

### Doğrulanmış bulgu / onaylı çözüm / karar
Mevcut queueStatus gerçektir; FileQueue en çok 100 job + totalJobs/hasMore verir.
Timestamp/cursor/geçmiş query yok; Android rowid ağırlıklı, iOS ID sıralı; tarih sırası yok.
Android Photos publication ek listesi yalnız tombstone'dur; tüm provider geçmişi değildir.
**D-G1 — KABUL:** Native-free, tarihsiz ve sınırlı **PC aktarım kayıtları** uyarlaması.
M11 segment/filter biçimini koru; geçmişte “journal'daki mevcut son durum”
kapsamını açıkla; tarih/saat/gün grubu/toplam oturum özeti gösterme, native sırayı koru.
Şu an = completed dışındaki tüm queue job'ları; Geçmiş = completed/paused/blocked/owner_deleted.
Paused/blocked/owner_deleted iki görünümde bulunabilir: bekleyen sorun ve retained sonuçtur;
ayrı olay veya başarısız tamamlanmış oturum olarak adlandırılmaz. done = yalnız completed;
issues = paused/blocked/owner_deleted; all = bu geçmiş kümesinin tamamı.
Provider durum/review panelleri Şu an'da mevcut davranışlarıyla kalır; Geçmiş bunları kapsadığını söylemez.
hasMore varsa her segment/filter'da sayımın tüm journal değil dönen pencere olduğu görünür;
boş filtre sonucu “geçmiş yok” değildir. Kayıt sayısından oturum/başarı toplamı türetilmez.
Bu görünür kapsam/görsel uyarlama açık kullanıcı onayıdır; çözülmemiş kritik ürün kararı yoktur.
Tarihli event API/migration/provider birleşimi sonradan gerekirse kapsam genişletme sayılır;
implementer tasarlamaz, aynı GPT plan sohbetine döner. Bu sözleşme native yığınına yetki vermez.

### Hedef dosya / sembol / sorun → beklenen değişiklik / kabul
M = `apps/mobile/src/`; native üretim dosyaları bu sözleşmede salt-okunur.

| Hedef | Sorun → beklenen dar değişiklik | Kabul |
|---|---|---|
| M/features/file-transfer/model/activity-journal.ts (yeni saf selector) | Ayrım yok → doğrulanmış FileQueue'dan now/past/filter projection; kaynak sıra/ID/ACK değişmez | G1-01/02/03 |
| Aynı yerde activity-journal.spec.ts (yeni, mevcut queue nesnelerini kullan) | Sınıflama kanıtı yok → tek karma snapshot, sonra sınır/null/truncation karşıtları | G1-01/02/03/04 |
| M/pages/activity/ui/activity-page.tsx — ActivityPage | Tek scroll → yalnız view=activity için now/past state ve segment; queue/hook filtrelenmez | G1-01/05/06 |
| Aynı dizinde activity-journal-panel.tsx (yeni) | Geçmiş yok → read-only satırlar/filter/empty/limited/error; mevcut Text/ByteProgress/ikon örüntüsü | G1-02/03/04/07 |
| Aynı dizinde activity-page.spec.tsx; activity-journal-panel.spec.tsx (yeni) | Segment erişimi ve geç yanıt görünürlüğü yok → dar render/event kontrolleri | G1-01–07 |
| M/shared/i18n/locales/{tr,en,de}.json | Segment/filter/kapsam/empty/limited metinleri yok → eş anahtarlar; JSX literal yok | G1-03/07 |
| Mevcut activity-{automatic,destinations}.spec.tsx ve backups-page.spec.tsx | Ortak page etkilenecek → mevcut beklentiler korunur; yalnız gerekli segment seçimi uyarlanır | G1-05/06 |

`useFileTransfer`, file-transfer parser/API, Home hook ve native kod değişikliği kapsam dışıdır.
Geçmiş yeni hook/poll/listBackups/persisted JS cache kullanmaz; tek queue snapshot'ını paylaşır.
Yeni UI dosyası sorumluluk ayrımıdır; katmanların tümünü tek seferde geliştirme yetkisi değildir.

### Invariant ve ortak durum–olay–beklenen sonuç / bitti ölçütleri
Journal/ACK/kimlik ve mevcut OS yan etkileri G1 tarafından değiştirilmez; sunum completion üretmez.
Yalnız native completed + parser'ın exact ACK/size kanıtı başarılı satırdır; %100 finalizing değildir.
Hook instance sekmede yeniden kurulmaz; Now panelleri mounted kalıp hidden/a11y olarak gizlenir.
Bu, provider cleanup/cancel tetiklememek içindir; Geçmiş'te görünmez action/focus erişimi olmaz.
Mevcut hook foreground/epoch/mounted ve native recovery davranışı aynen korunur.
Tab/filter değişimi ek status/run/pause/resume/rebackup/restore çağrısı ve kalıcı yazım üretmez.

| ID | Başlangıç | Olay / kesinti veya geç callback | Beklenen state ve kalıcı/OS yan etki | Dar kabul testi |
|---|---|---|---|---|
| G1-01 | Karma doğrulanmış queue, now | Past seç; all/done/issues; now'a dön | Yukarıdaki kesin kümeler; sıralama/ID korunur; queue mutasyonu/ek native işlem yok | Selector + segment render; ilk temsilci |
| G1-02 | uploading, ACK=size | finalizing poll; ardından native completed | İlk iki state past success değil; yalnız completed done'a girer; ACK/journal yazımı G1'de yok | Mevcut exact-progress testini koru; yeni geçiş beklentisi |
| G1-03 | hasMore=true ve geçmiş kümesi boş veya filtre boş | Past/filter seç | “Dönen kayıtlarda yok” + sınırlılık; tam geçmiş boş/başarı iddiası yok; hayalî load-more yok | 100 queued + total101 ve boş filtre; false hasMore karşıtı |
| G1-04 | Queue okunuyor veya önceki veri var | status hata/null; background→geç yanıt; reopen | Loading/error boş başarı değildir; eski yanıt epoch kontrolünü aşamaz; yeni native pause/iş yok | Deferred promise + tüm AppState listener'ları; önceki stale-read testini kullan |
| G1-05 | Native upload/review sürüyor | Tab değiştir; arka plan veya page departure | Tab provider unmount/cancel yaratmaz; background/departure mevcut cleanup'ını korur; upload pause eklenmez | Tab için call-count; mevcut lifecycle/automatic spec'leri |
| G1-06 | view=backups/embedded/target veya Home | Page render / Now'da sync/rebackup | Backups'a segment/queue sızmaz; başlık/geri/restore korunur; current authority ve confirmation aynı; Home ham queue alır | Mevcut backups/destinations/owner_deleted/automatic testleri |
| G1-07 | TR/EN/DE, light/dark, büyük yazı | Segment/filter erişimi ve render | Lovable segment/filter biçimi; seçili tab erişilebilir; gizli Now odaklanmaz; kapsam metni görünür; demo tarih/sayaç yok | Dar render/a11y ve mevcut batch-capture yolu ile görsel karşılaştırma |

G1-01–07 geliştirme kabulüdür; bağımsız review hepsini aynı tabloya karşı değerlendirir.
Tarihsel kanıt yeni sekme PASS'i değildir; uygulama manifesti yalnız ID→kanıt/durum eşler,
goal veya tabloyu kopyalayıp yeniden tanımlamaz. Her gerekli eksik açık raporlanır.

### Kanıt yeniden kullanımı → en dar doğrulama → etkilenen genişletme
Önce [araştırma §3](g1-activity-research.md#3-eski-kanıt--mevcut-kaynakdiff-eşlemesi):
eş LF hash'li native journal/ACK/tombstone yolları prior PASS REUSE; Queue/JS aradan beri
değişmiş, eski tüm-suite PASS'i bugüne taşınmaz; yeni segment/filter/truncation kanıtı EKSİK.
1. Uygulama önkoşulu: HEAD/dirty sınırı, Node/pnpm/node_modules ve mevcut workspace
   Jest/tsc/ESLint/export kullanılabilirliğini bir kez doğrula; kurulum/cihaz erişimi varsayma.
2. İlk temsilci G1-01: mevcut spec queue örüntüsüyle karma job snapshot'ı ve segment seçimi
   regression'ı → saf selector + minimum UI bağlantısı → yalnız bu testin RED/GREEN'i.
   Regression üretim page/selector yolunu çağırır; expected sonuç bu tablodan gelir.
3. GREEN sonrası G1-02–07 ve mevcut etkilenen callers; bütün satırlar aynı işte devam eder.
   Mevcut activity-page spec'i 300-satır eşiğine yakın: yeni testleri yeni scoped spec'e koy;
   unrelated test taşıma/sıkıştırma ve yeni genel fixture katmanı yok.
4. `apps/mobile` içinde mevcut `pnpm test -- --runTestsByPath ...` ile yalnız değişen
   spec'ler + activity-page/automatic/destinations/backups; parser değişmezse parser suite
   tekrarı zorunlu değil. UI branch değişimi bu page testlerinin somut tekrar gerekçesidir.
5. `pnpm exec tsc --noEmit`; değişen TS/TSX için scoped ESLint; son JS/i18n halinde bir kez
   `pnpm run build` (iki platform JS export). Yeni import/render/i18n paketleme etkisi gerekçedir.
   Tam repo Jest/native/build matrisi Faz3'te; ilk temsilci öncesi geniş build yok.
6. Test/lint/typecheck/export ve görsel sonuç logları `docs/implementation/evidence/backlog-2.1-g1/`
   altında tek manifestte fresh/prior reuse/NOT_RUN/DEFERRED olarak; başarısız exit örtülmez.

### Windows / Mac / zorunlu ve ertelenmiş kapılar
Windows: onaylı selector/UI/çeviri + scoped JS test/lint/tsc/export; native kod yazılmaz.
JS export Swift/Kotlin derlemesi veya journal→Expo runtime kanıtı değildir.
Bu native-free çözümde eski native invariants kanıtı reuse edilir; G1 mock testleri
yeni gerçek-OS journal PASS'i sayılmaz. B1 gerçek JS→native runtime/tam entegrasyon Faz3'te kalır.
Mac gerektiren: iOS native değişikliği seçilirse Swift compile/Simulator build/runtime;
bu sözleşme buna yetki vermez. iOS native ekran/a11y capture da Mac/Simulator gerektirir.
G1 scoped görsel kontrolü eksikse fresh görsel PASS yazma; G1-07 açıkken review-ready deme.
Mevcut kalıcı batch capture script açığı CURRENT'te korunur; runnable komut uydurma,
ayrı capture altyapısı işi açma. Gerçek altyapı yoksa gereken scoped kanıtı BLOCKED-ENV kaydet.
Fiziksel keyguard/Doze/OS, gerçek provider/iCloud/custody, FO1 success zinciri, signing/P5,
release ve tam a11y/performance matrisleri mevcut Faz3–4 kapılarıdır; tekrar açılmaz/waive edilmez.
F1 fix2 → 1.5 H15/P15 Mac kuyruğunun sırası ve açık checkbox'ları değişmez.

### Review / risk-model / bütçe / durdurma / devir
Review: tablo davranışı + etkilenen callers kanıtı; action/cancel/poll yan etki yokluğu;
temiz FSD sınırları, NativeWind/global token/Lucide/TR-EN-DE/300-satır standardı;
ilgili scoped test/lint/typecheck/build ve G1-07 görsel kanıtı zorunlu. Self-review bağımsız kabul değildir.
Onaylı JS-only uyarlama **düşük riskli Sonnet pilot adayıdır**: kullanıcı açıkça seçerse
`/implement-pilot`; aksi halde ayrı Opus `/implement`. Model/effort kendiliğinden değişmez.
Journal/migration/OS ownership genişlemesi pilot değildir; yeni GPT tasarımı + normal Opus gerekir.
Usage UNKNOWN; 15000 thinking-dahil output ajan içi verimlilik kontrolüdür, onay/duruş değildir.
Ölçüm yoksa ilk temsilci sonunda tekrar/kapsam/ilerleme notu; sonra tüm onaylı satırlara devam.
Aynı yaklaşım/invariant iki başarısız fix'te DUR; sayaç manifestte ve sohbetler arası korunur.
Ürün/güvenlik/scope kararı, sözleşme çatışması, eksik gerçek altyapı veya izinsiz yıkıcı işlem de DUR.
**Tek sonraki adım (kullanıcı başlatır):** G1'in mevcut Opus uygulama sohbeti varsa onu
kullan; yoksa ayrı Opus sohbetinde aşağıdaki komutu ver. Bu GPT turunda uygulama yok.
Tam komut/prompt:
`/implement — AGENTS.md → CURRENT.md oku. Kullanıcı onaylı INITIAL kapsam yalnız
docs/implementation/plans/next-plan.md §2.1/G1; CURRENT'in eski onaysız G1 notu için
bu bölümdeki 16.11 onayı esas alınır. Tek goal ve G1-01–07 tablosunu uygula:
ilk temsilci regression → dar uygulama → etkilenen kapsamın tamamı ve zorunlu kontroller.
Eski kanıtı diff ile eşle; F1/1.5 diff/sözleşme/ertelemelerine ve native koda dokunma.
Tek manifestte fresh/reuse/deferred/eksikleri kaydet; REVIEW/unchecked bırak.
Bağımsız GPT review gerekir. Commit/push yok.`
Sonnet pilotu ayrıca kullanıcı `/implement-pilot` seçerse aynı sözleşmeyle yürür;
bu kapsam onayı model seçimi değildir. Varsayılan devir Opus'tur; otomatik başlatma yok.
