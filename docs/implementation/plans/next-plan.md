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

### 16.11 kullanıcı kararı — görsel kapının Faz3'e devri
G1-07'nin cihaz/emülatör/Simulator üzerinde TR/EN/DE, light/dark ve büyük yazı
görsel karşılaştırması **Faz3'e DEFERRED / NOT_RUN**. Bu eksiklik tek başına
geliştirme review'unu engellemez; görsel PASS veya bilinen tasarım sapmasına onay değildir.
Bu karar aşağıdaki görsel kanıtı review öncesi zorunlu tutan hükümleri yalnız
bu kapsamda supersede eder. Goal, G1-01–07 tablosu, M11 segment/filter biçimi,
JS/render kontrolleri ve bağımsız review gereği değişmez.

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

---

## 2.2/G2–G3 — Desktop tray/sürüm/kapanış sözleşmesi / 18.11.2026

### Durum / yetki / tek kaynak
**KULLANICI ONAYLI / INITIAL / UYGULAMAYA HAZIR — 18.11.2026.**
Kullanıcı D-G23 önerisini ve bu dar sözleşmeyi onayladı; yalnız hazır/onaylı kayıt
güncellemesi istedi. Bu GPT oturumunda uygulama başlatılması açıkça yasaktır.
Bu bölüm yalnız 2.2'nin sözleşmesidir; yukarıdaki F1/1.5/G1 bölümleri korunur.
Bu bölümün onayı başka işin uygulama yetkisi değildir; CURRENT'teki sıradaki 2.2
plan yönlendirmesi bu kayıtla karşılanır. Uygulama yalnız kullanıcı-başlatmalı Opus devrindedir.
Uygulama ve bağımsız review aşağıdaki aynı goal/ID/tabloya referans verir; kopyalamaz.
Satırlar tek işin ajan içi kontrolleridir; ayrı görev/onay/sohbet değildir.
Keşif HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; çalışma ağacı dirty, ürün diff'i yok.
Bu oturumda uygulama/GUI/test/build çalıştırılmadı; yalnız salt-okunur inceleme yapıldı.

### Tek goal / kapsam dışı
**Goal:** Desktop D13 placeholder yerine gözlenen alıcı/yedekleme durumunu ve mevcut
pencereyi aç/tek güvenli Quit akışını sunar; D12 gerçek uygulama sürümünü ve ADR0018'e
uygun gözlenen kapanış davranışını gösterir; desteklenmeyen pause veya tercih çalışır görünmez.
Kapsam dışı: yeni pause/resume protokolü, admission/ACL değişikliği, yeni kapanış tercihi,
kalıcılık/migration, receiver ownership/journal/TLS/provider/custody değişikliği, native
menünün yeniden tasarımı/yerelleştirilmesi, autostart kaydı, dependency/lock/sürüm bump,
mobil/F1 düzeltmesi, 2.3–2.5 veya tam regresyon ve fiziksel/release kabulü.

### Doğrulanmış bulgular / onaylı karar
- `App.tsx:82` D13 yalnız başlık/açıklama; gerçek native tray zaten `background.ts` içindedir.
- Frozen `outgoing.tsx.reference:171–239`: D12 tray/quit seçicisi yerel state;
  D13 incoming **ve outgoing** pause yalnız demo toast, durum pill'i sabit demo verisidir.
- `background.ts` snapshot/refresh/canHide/confirmQuit gerçek durum ve tek Quit sahibidir.
  `preload.cts:19–24` ve `desktop.ts:120–125` pause veya sürüm API'si sunmuyor.
- `pairing.ts:29–99` suspend yalnız foreground invitation işini geçersizleştirir;
  transfer pause değildir. `runtime_desktop.rs::suspend_pairing` buna karşılık gelir.
- ADR0018 §Decision/Implemented: çarpı kullanılabilir kontrol varsa gizler; yoksa görünür
  kalır. Yeni tray/quit seçici bu karara sessizce eklenemez. Blur receiver'ı kapatmaz.
- **D-G23 — KULLANICI ONAYLI, 18.11.2026:** D13'te iki pause düğmesi açıklamalı
  disabled; D12'de tercih yerine `canHide/environmentLimited` kaynaklı salt-okunur
  kapanış satırı. Native tray mevcut gerçek kontrollerini korur; sahte pause eklenmez.
  Bu Lovable davranış farkı burada açıkça kaydedilir; ADR değişikliği önerilmez.
  Açık kritik tasarım kararı kalmadı; implementer bu sınırı genişletemez.
- Sürüm kaynağı seçildi: main `app.getVersion()` → mevcut status snapshot'ında `appVersion`;
  yeni IPC kanalı/preload metodu yok. `0.9.0 (prototype)` kopyalanmaz; mevcut `0.0.0`
  gerçek metadata ise aynen görünür, release olgunluğu iddiası değildir. [API kanıtı](2.2-g2-g3-research.md#dar-dış-araştırma).

### Kanıt → mevcut diff: yeniden kullanılacak / etkilenmiş / eksik
Karşılaştırma ve sınırlar: [dar araştırma eki](2.2-g2-g3-research.md#kanıt-ve-kaynak-karşılaştırması).
| Sınıf | Eski kanıt / karşılaştırma | Bu işte kullanım veya tekrarın somut gerekçesi |
|---|---|---|
| Yeniden kullanılacak | 16.10 lifecycle 117 Desktop/97 native, compiled smoke tarihî PASS; c9af0b82→HEAD background/preload/API/test kaynakları aynı | Korunan native lifecycle/foreground sözleşmesi için önceki kanıt; test anı hash zinciri eksik, taze HEAD PASS'i değil; native/full matrix tekrar yok |
| Yeniden kullanılacak | 28.10 checks.json route/Brand SHA256 bugün eşit | Rota codec/logo değişmiyorsa yeniden üretme; yeni D13 görünümü için kanıt sayma |
| Değişiklikten etkilenmiş | Aynı manifestin App/global.css/shell hash'leri bugün farklı; Background UI'da c9af0b82 sonrası yalnız metin renk sınıfı değişmiş | 42 eski capture yeni D12/D13'ü kanıtlamaz; yalnız yeni yüzeylerin görünüm/erişilebilirlik kontrolü gerekir |
| Değişiklikten etkilenecek | snapshot'a appVersion; Background/App kompozisyonu | İlgili main/renderer testleri, iki TS katmanı ve renderer build yeni alan/çağıran uyumunu doğrular; eski build yeni alanı kapsamaz |
| Eksik | Gerçek D13 render/action, D12 version/close eşlemesi; mevcut testlerde bunlar yok | Önce tek G23-01 regression; sonra yalnız G23-02–08'in kapsanmayan assertion'ları mevcut test seam'lerinde |
| Eksik, tekrar gerekçesi değil | 16.10 `.local-evidence` capsule bu checkout'ta yok; 28.10 pixel-diff NOT_RUN | Fixture yeniden kurma/full matrix yetkisi yok; önceki sonuç tarihî kalır. Yeni yüzey için gerekli kanıt sağlanamazsa açık BLOCKED |
Mevcut dirty değişiklikler CURRENT, 1.5/F1 manifestleri ve Windows devir kaydı/1.5 kanıtları;
bu işe ait değildir. Onaydan sonra yalnız bu işin başlangıç/final diff ve hash'leri kaydedilir.

### Hedef dosya / sembol / sorun → beklenen değişiklik / kabul
Yollar `apps/desktop/` altındadır; bu tablo D-G23 ile onaylanan kesin dar sınırdır.
| Dosya / sembol | Mevcut sorun → beklenen değişiklik | Kabul |
|---|---|---|
| `src/app/App.tsx::App` | Placeholder → mevcut mounted Background'a tray sunumu/onOpen callback'i; ikinci poller yok; onOpen mevcut `navigate('receiver')`, protectedDecision atlanmaz | G23-01,03,08 |
| `src/features/desktop-background/DesktopBackground.tsx::DesktopBackground` | settings boolean ötesi D13 sunumu + D12 sürüm/kapanış; mevcut single-flight/alive/settingsVersion korunur; mevcut autostart ve Quit aynen | G23-01–06 |
| Yeni `src/features/desktop-background/DesktopTray.tsx::DesktopTray` | Yalnız sunum: status/error/unknown pill, logo, onOpen/Quit, açıklamalı disabled pause; ayrı bridge/poll/state/persistence yok | G23-01–04,07 |
| `electron/runtime/background.ts::snapshot` | Sürüm yok → salt-okunur `appVersion: app.getVersion()`; attach/canHide/refresh/confirmQuit/trusted davranışı değişmez | G23-05,06,08 |
| `src/shared/api/desktop.ts::BackgroundStatus` | Snapshot tipi eksik → appVersion; preload.status mevcut kanalı aynen taşır | G23-05,08 |
| `src/shared/i18n/locales/{tr,en,de}.json` | Yeni tray/kapanış/sürüm/yetenek açıklamaları ve a11y adları; eş anahtarlar, literal yok | G23-04,05,07 |
| `electron/runtime/background.spec.ts::electron mock/fixture` | getVersion mock + snapshot alanı assertion'ı; mevcut lifecycle testlerini yeni snapshot ile uyumla | G23-05,06,08 |
| `src/features/desktop-background/DesktopBackground.spec.tsx::fixture/tests` | Yeni alan ve D13/D12 state/action/late reply assertion'ları; mevcut seam'i genişlet | G23-01–07 |
| `src/app/App.spec.tsx::App tests` | Tray→receiver/settings entegrasyonu ve rezervasyon altında navigation fence; mevcut backup draft korunur | G23-03,08 |
`electron/main.ts::showWindow`, `preload.cts`, `pairing.ts`, native runtime, journal,
autostart ve global.css salt-okunur korunacak komşulardır; değişiklik gerekirse scope kararı.
Mevcut Tailwind/global token/Lucide/logo/FSD/300-satır standardı; yeni inline/page CSS yok.

### Invariant ve ortak durum–olay–beklenen sonuç / bitti ölçütleri
Yeni kalıcı state yok. UI state, native authority veya transfer sonucu değildir.
Hata > bilinmeyen > gözlenen faaliyet > dinliyor > kullanılamıyor; aktif FILE sayısı
dosya/iş/ilerleme değildir. `available` telefon erişilebilirliği veya completion kanıtlamaz.
| ID | Başlangıç | Olay / kesinti / geç callback | Beklenen state ve kalıcı/OS yan etki | Kabul testi / kanıt |
|---|---|---|---|---|
| G23-01 | D13, bridge mevcut | Status idle→bağlantı/backup active→error→recovery | Gerçek gözlem pill/metinde; hata gizlenmez; sentetik progress/completion yok; disk/OS yazımı yok | İlk renderer regression: errorCode varken available=true; demo receiving değil hata; sonra gözlem dizisi |
| G23-02 | Poll pending | Route ayrılışı/unmount veya yeni autostart sonucu→eski reply | Unmount reply etkisiz; eski reply yeni tercih sonucunu ezmez; ikinci poller yok; native owner değişmez | Mevcut stale-autostart testi reuse; değişen tray kompozisyonunun geç-reply assertion'ı |
| G23-03 | D13 veya gerçek tray | Open / Quit; ardışık Quit→Cancel/Confirm; close promise geç biter/reject | Renderer Open receiver'a gider; native Open mevcut showWindow; Quit tek default-Cancel. Cancel owner/schedule'ı korur; Confirm close'u bekler; hata görünür, tray kalır; journal silinmez/Completed üretilmez | Renderer bridge spy + mevcut main coalesce/active/awaited-close/failure testleri; yeni bir Quit controller yok |
| G23-04 | Aktif/idle/unknown durum | Incoming/outgoing pause düğmesine erişim | İki kontrol disabled + açıklama; suspend/revoke/close/prepareToQuit çağrısı ve pause state/disk yazımı yok | Renderer disabled/a11y assertion'ları; bridge side-effect spy |
| G23-05 | D12, metadata mevcut/yok | Status yanıtı / bridge failure | Version main değeri; failure'da unknown, prototype/uydurma fallback yok. Kapanış canHide'a göre read-only; tercih yazılmaz | Main getVersion mock→snapshot; renderer version/unknown/close satırı |
| G23-06 | Yetkili receiver; Linux kontrol doğrulanmamış veya tray yok | Çarpı / gerçek tray activation / blur-hide-navigation | Kontrol doğrulanmadan görünür kalır; renderer Open kanıt sayılmaz. Doğrulanınca gizlenebilir; receiver retained, foreground invitation/approval late callback invalid; ACL/journal korunur | Mevcut Linux/fallback lifecycle ve foreground kaynak/önceki native kanıtı reuse; snapshot delta testleri |
| G23-07 | D12/D13 TR/EN/DE | Klavye, light/dark, dar/geniş görünüm | Lovable D12/D13 düzeni, okunur durum, açıklamalı capability farkı; translated erişilebilir adlar, overflow yok | Renderer dil/a11y testleri + yalnız değişen iki yüzey için izole scripted görsel karşılaştırma; gerçek OS kabulü değil |
| G23-08 | Settings/receiver/backup/pairing; reserved candidate | Tray navigation veya yeni snapshot alanı | Protected navigation/draft korunur; autostart opt-in değişmez; trusted sender/frame/origin/focus aynı; yeni grant/owner veya gizli mutasyon yok | Etkilenen App/main testleri + call-site/diff review + scoped lint/typecheck/build |

### En dar doğrulama / önkoşullar / ilk temsilci kapısı
1. Kullanıcı-başlatmalı Opus uygulamasında INITIAL baseline: HEAD, işe ait tracked+untracked diff,
   source hash ve mevcut kanıt eşlemesi; gerçek userData/authority/OS ayarına erişme.
2. Mevcut Vitest/JSDOM/Electron mock seam'i ve bağımlılıkların hazır olduğunu kontrol et;
   kurulum/fixture/SDK yeniden yaratma yok. G23-01 tek regression önce RED, dar sunum
   düzeltmesi sonra GREEN: `npm run test --workspace @kloda/desktop -- src/features/desktop-background/DesktopBackground.spec.tsx`.
3. Temsilci GREEN sonrası snapshot/version ve D12/D13 entegrasyonunu dar katmanlarla
   genişlet; aynı koşuya `electron/runtime/background.spec.ts` ve `src/app/App.spec.tsx`
   ekle. Tabloyun tüm zorunlu satırlarını bitir; satır başına izin/sohbet yok.
4. Değişen dosyalarda ESLint; Desktop renderer typecheck ve main/preload TypeScript;
   renderer production build. Mevcut workspace script/build zincirini kullan; native
   rebuild yalnız gerçek kaynak/ABI etkisi varsa. Eski native/full-suite PASS'i taze diye sunma.
5. G23-07 yeni yüzey görsel kanıtı gerekir; mevcut izole scripted capture yolunu önce
   doğrula. Hazır komut yoksa uydurma/2.5'i üstlenme; eksik kanıtı BLOCKED kaydet.
   Yeni D12/D13 görsel kapısı kendiliğinden Faz3'e ertelenmiş değildir; gerçek OS tray
   erişilebilirliği/theme/login/sleep/Windows/macOS/Linux fiziksel kabulü Faz4'te açık.
6. Tek iş manifesti `docs/implementation/evidence/backlog-2.2-g2-g3/MANIFEST.md`:
   ID→fresh/reuse/NOT_RUN/deferred, log/hash/diff kapsamı, kalan kapılar ve invariant sayacı.
   Bu yalnız sonraki uygulama kanıtıdır; bu GPT plan turu manifest oluşturmaz.

### Review / model / bütçe / durdurma / devir
Review baştan: gerçek diff ve etkilenen callers; tablo davranışı/yan etki yokluğu;
temiz kod/FSD/Tailwind/Lucide/TR-EN-DE/300 sınırı; scoped test/lint/iki TS katmanı/build
ve G23-07 kanıtı. Zorunlu eksik kontrol review-ready'yi engeller; self-review bağımsız kabul değil.
F1 fix2 compile/RED-GREEN/dar lint Faz3 DEFERRED/NOT_RUN; F1 kabul edilmez, sayaç resetlenmez.
FO1 delta Faz4; S3/G1/1.5 scoped kabul, G1-07 Faz3 ertelemesi, B2/release/P5/provider/
signing/storage ve 20–21 fiziksel kapıları aynen korunur; yeni fixture/FO1 koşusu yok.
Risk **orta / güvenlik komşuluğu**: snapshot ve Quit/foreground/Linux yolları temas eder;
normal Opus `/implement`, mevcut effort değişmez. Bu iş Sonnet pilotu değil; ilk uygun
düşük riskli ayrı işte `/implement-pilot` önerisi korunur, kullanıcı seçmeden model değişmez.
Usage UNKNOWN; 15000 thinking-dahil output ajan içi verimlilik kontrolü, onay/duruş değil.
Ölçüm yoksa ilk temsilci sonunda tekrar/kapsam/ilerleme notu; sonra onaylı tüm kapsam sürer.
Aynı yaklaşım/invariant iki başarısız fix'te DUR; sayaç manifestte/sohbetler arası korunur.
Scope/ürün/güvenlik kararı, sözleşme çatışması, gerçek eksik altyapı veya izinsiz yıkıcı
işlem DUR nedenidir; beklentiyi/testi gevşetme, GPT'ye somut kanıtla dön.
**Tek sonraki adım:** kullanıcı aynı işe ait mevcut Opus uygulama sohbetinde aşağıdaki
komutu verir; böyle bir sohbet yoksa yeni Opus sohbeti açar. Bu GPT turu uygulama başlatmaz.
Tam komut/prompt:
`/implement — AGENTS.md → CURRENT.md oku. INITIAL kapsam yalnız
docs/implementation/plans/next-plan.md §2.2/G2–G3; 18.11 kullanıcı onayı bu bölümde
kayıtlıdır. D-G23 ve G23-01–08 ortak sözleşmesini kullan; yeni goal kopyası üretme.
Eski kanıtı gerçek başlangıç diff'iyle eşle; ilk temsilci regression → dar uygulama →
etkilenen kapsamın tamamı ve zorunlu kontroller. İki pause açıklamalı pasif;
kapanış canHide kaynaklı salt-okunur. ADR0018 foreground/Linux sınırlarını,
F1/Faz3–4 ertelemelerini ve eski scoped kabulleri koru. Zorunlu görsel kanıtı
kendiliğinden erteleme; kayıp fixture tek başına tekrar gerekçesi değildir.
Tek manifestte fresh/reuse/eksik/deferred ve sayaçları kaydet; REVIEW/unchecked bırak.
Bağımsız GPT review gerekir. Kapsam dışı kod/iş yok; commit/push yok.`

---

## 2.3/G4–G6 — Native-free M13 ve kapsam eşlemesi / 18.11.2026

### Durum / onay / tek kaynak
**KULLANICI ONAYLI / INITIAL / UYGULAMAYA HAZIR — D-G456, 18.11.2026.**
Kullanıcı native-free M13 uyarlamasını onayladı; bu bölüm o kararın tek uygulama
sözleşmesidir. Uygulama/review aynı goal ve tabloyu referans alır, yeniden tanımlamaz.
CURRENT 2.3 plan yönlendirmesi bu bölümle karşılanır; eski F1/1.5/G1/2.2 INITIAL/FIX
başlıkları bu işe yetki vermez. Önceki bölümler ve CURRENT bu plan turunda değiştirilmez.
Keşif HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; mobil dirty diff yok.
Doğrulanmış bulgular/kanıt hash'leri: [dar araştırma eki](2.3-g4-g6-research.md).
Ürün/test yazılmadı; test/build/runtime NOT_RUN. READY uygulama tasarımı içindir, PASS değildir.

### Tek goal / kapsam dışı
**Goal:** M13 kullanıcısı mevcut ağ ve gizlilik yeteneklerinin sınırını ve gerçek
yapılandırma sürümünü yanıltıcı switch/izin iddiası olmadan görüp mevcut ilgili akışa
gidebilsin; D10 birleşimi ve G6'nın step19 sınırı tasarım eşlemesinde açıkça kayıtlı olsun.
Kapsam dışı: yeni native/OS/SDK API'si, dependency/lock/app-version değişikliği,
hücresel erişimi açma, izin okuma/isteme/OS-settings kısayolu ekleme, gallery/status
poller/cache, permission snapshot, journal/scheduler/foreground/authority değişikliği,
yeni Desktop rota/ekranı, F1/2.4/2.5/tam regresyon, fixture/hesap veya step19 geliştirmesi.

### Onaylı tasarım ve korunacak davranış
- **D-G456:** M13 backup/privacy/about grupları Lovable M13 sırası/ikon/token biçimini
  izler; aşağıdaki capability uyarlamaları açık kullanıcı onaylı tasarım farkıdır.
- Hücresel satır: değiştirilemeyen **kapalı/unsupported** kontrol + görünür açıklama;
  gerçek ağ politikası aynen kalır. “Bu sürümde hücresel yedekleme seçeneği yok” denir;
  bütün sağlayıcıların/OS tesliminin test edildiği, yalnız Wi-Fi veya ücretsiz ağ garantisi verilmez.
  NativeWind ile mevcut Pressable + switch rolü/checked=false/disabled=true; yeni native Switch yok.
- Foto erişim satırı: durum pill'i yok; “Fotoğraf kaynağı seçimini Kaynaklar'da yönet”
  açıklaması ve `navigate('sources')`. Granted/limited/denied, kaynak sayısından türetilmez.
- Bildirim satırı: switch/durum pill'i yok; “Yedekleme bildirimleri mevcut aktarım
  akışında istenir; Etkinlik'i aç” açıklaması ve `navigate('activity')`.
  Bu bağlantı kendi başına izin istemez, bildirim açmaz/kapatmaz veya yedekleme başlatmaz;
  Activity'nin mevcut poll/lifecycle'ı ve açık kullanıcı Sync/Continue eylemleri değişmez.
- Sürüm: tek kaynak `apps/mobile/app.json::expo.version`; shared/config üzerinden salt-okunur
  import, yalnız boş olmayan string gösterilir, geçersiz/eksikte çevirili bilinmiyor.
  Etiket **Yapılandırma sürümü**; kurulu binary/build/release sürümü iddiası yok.
  Mevcut `0.0.0` aynen görünür; prototype sabiti veya package.json fallback'i yok.
- Tema/dil seçimi, kaynak/program/yedek/recovery/etkinlik/setup ve geri yolları korunur;
  setup için yeni reset/confirmation, OS ayar bağlantısı veya alakasız görsel rewrite yok.
- D10: `BackupSetup::sources` içinde kaynak+program birleşimi bilinçli korunur;
  ayrı `/d/sources` eklenmez. G6 step19 iOS Live Activities ve mahremiyet kapısında kalır.

### Dosya / sembol / mevcut sorun → seçilen değişiklik / kabul
M = `apps/mobile/`; tablo uygulama allowlist'idir, hepsini değiştirme zorunluluğu yok.
| Dosya / sembol | Sorun → beklenen değişiklik | Kabul |
|---|---|---|
| M/src/pages/settings/ui/settings-page.tsx::SettingsPage | M13 capability/privacy/version eksik → yukarıdaki sunum ve yalnız mevcut navigate bağlantıları | G456-01–05,07 |
| M/src/shared/config/app-version.ts (yeni)::configuredAppVersion | Yapılandırma sürümü sunum kaynağı yok → app.json version doğrulayan saf string/null okuması; React/native/persistence yok | G456-04 |
| M/src/pages/settings/ui/settings-page.spec.tsx (yeni) | M13 assertion yok → gerçek SettingsPage render, navigation/yan-etki/tema-dil/sürüm/a11y kontrolleri | G456-01–05,07 |
| M/src/shared/i18n/locales/{tr,en,de}.json | Yeni açıklama/a11y/unknown metinleri yok → eş anahtarlar; eski anahtar anlamlarını değiştirme | G456-01–05,07 |
| docs/ui/lovable-design-reference.md::uyarlama eşlemesi | M13 farkı/D10 birleşimi dağınık → D-G456 ve dosya/akış eşlemesi, G6 step19 referansı; yeni goal/tablo kopyası yok | G456-06 |
| docs/implementation/evidence/backlog-2.3-g4-g6/MANIFEST.md ve dar kanıtları | Henüz yok → yalnız ID→kanıt/hash/diff/fresh-reuse-open, sayaç/delegasyon kaydı | G456-01–07 |
`App.tsx`, SourcePage, ActivityPage/hook/API, theme provider, native kod, app.json,
Desktop kaynakları/global CSS salt-okunur. Bu plan/araştırma eki yalnız gerekçeli scoped açıklama için güncellenebilir.
Yeni ortak UI helper/komponent/bağımlılık gerekmez; kapsam genişlemesi GPT kararı ister.

### Invariant ve ortak durum–olay–beklenen sonuç / bitti ölçütleri
Yeni concurrency/kalıcı state yok; Settings hiçbir callback/poll/permission observer eklemez.
Salt render/arka plan/dönüş disk/OS işi yaratmaz; yalnız tema/dil mevcut yan etkilerini korur.
Navigation sonrası hedefin mevcut lifecycle'ı korunur; “yan etki yok” hedefin normal poll'unu yasaklamaz.
| ID | Başlangıç | Olay / kesinti / geç callback | Beklenen state ve yan etki | Kabul testi |
|---|---|---|---|---|
| G456-01 | Settings, her iki platform | Hücresel kontrole bas/eriş | Kapalı ve disabled; açıklama görünür; tercih/native/ağ/persistence çağrısı yok | İlk gerçek page regression: rol/checked/disabled ve press karşıtı |
| G456-02 | Settings; foto kaynağı yok/var veya erişim değişmiş olabilir | Foto satırına bas | Yalnız sources'a bir navigate; permission/galeri okuma ve izin iddiası yok | Navigate spy; gallery/source-selection native spy'ları 0 |
| G456-03 | Settings; bildirim izni bilinmiyor/reddedilmiş olabilir | Bildirim satırına bas | Yalnız activity'ye bir navigate; Settings status/request/run/resume çağırmaz; hedef akışı değişmez | Navigate ve fileTransfer/native çağrı spy'ları; read-only caller incelemesi |
| G456-04 | Yapılandırma sürümü geçerli/boş/geçersiz | Render veya farklı sürümle yeniden yükleme | Tek config değeri veya bilinmiyor; installed/prototype/release iddiası yok; yazım yok | Gerçek config bağlantısı + kontrollü eksik/geçersiz config varyantları |
| G456-05 | Settings, tema/dil veya mevcut bağlantılar | Seçim; back/unmount→yeniden giriş | Mevcut tema/dil davranışı ve tüm navigate hedefleri korunur; yeni asenkron iş/geç callback yok | Dar page testi, mevcut theme-provider/App kanıtı; caller/diff kontrolü |
| G456-06 | D10 birleşik; G6 step19 kapısı açık | Eşleme belgesi okunur | BackupSetup kaynak/program akışı belgeli; yeni rota/native/Live Activity uygulanmış sayılmaz | Belge↔gerçek sembol/rota statik eşleme; Desktop/native diff boş |
| G456-07 | M13 TR/EN/DE; light/dark; büyük yazı | Render/erişilebilir gezinme | Onaylı gruplar ve fark açıklamaları görünür; literal/dummy izin yok; disabled erişilebilir; taşma yok | Dil/a11y render testleri + dar scripted M13 görsel karşılaştırması; scoped lint/tsc/export ve bağımsız review |
Bütün zorunlu satırlar tek işin iç kontrolüdür; ayrı görev/onay/sohbet değildir.

### Kanıt reuse → dar doğrulama → etkilenen genişletme
1. Başlangıçta HEAD/işe ait tracked+untracked diff/hash kaydı; ekin kanıt tablosunu
   yalnız yeni semantic fark varsa güncelle. Eski testleri yeni oturum/fixture kaybı için tekrarlama.
2. Önkoşul: mevcut Node/workspace bağımlılıkları, Jest/tsc/ESLint/export erişimi;
   izolasyon/mock native sınırı ve writable disposable çıktı. Kurulum/cihaz/hesap izni varsayma.
3. Değişmeyen başlangıcın G1 compile kanıtını reuse et; G456-01 regression'ı eklenince
   `pnpm exec tsc --noEmit` (workdir M; G1 komutu) ile dar TS kapısı, sonra yalnız
   üretim SettingsPage testi: eksik kontrol nedeniyle RED→minimum sunumla GREEN.
   Compile/mock kurulum hatası hedef RED sayılmaz; önceden toplu test altyapısı yazılmaz.
4. Aynı seam'de G456-02–07'ye genişlet; G1 komut örüntüsüyle M içinde
   `pnpm test -- --runTestsByPath src/pages/settings/ui/settings-page.spec.tsx`.
   Yeni genel fixture/permission harness kurma; gerekli spy'lar mevcut jest-setup/API örüntüsünden.
5. Final semantic diff için bir kez M `pnpm exec tsc --noEmit`; kök mevcut ESLint ile
   değişen TS/TSX dosyaları; üç locale parse/anahtar eşliği ve `git diff --check`.
   Yeni config import/çeviri paketlemesi için M `pnpm run build` (iOS+Android JS export),
   G1 manifestindeki disposable output-dir varyantı kullanılabilir. Native app build gerekmez.
6. G1'in sekiz etkin final kaynağı LF/CRLF eşdeğer; 40 test ve önceki scoped kontroller
   kendi varyantında reuse. Yeni M13/config/locale deltasını eski PASS sayma.
   App/theme/source/Activity/API değişmediği için eski suite'leri sırf navigation callback'i
   eklendi diye tekrar etme; mevcut App.spec/theme-provider komutları yalnız yeni somut delta varsa seçilir.
7. G456-07 için önce tek temsilci M13 scripted görsel kontrol; frozen M13 ile gruplar/
   capability farklarını karşılaştır, ardından yalnız metin/tema/ölçekten etkilenen kontroller.
   Hazır capture komutu/ortamı varsayma; `capture-android-connections.py` M13 komutu değildir.
   Kullanılabilir mevcut izole yol yoksa BLOCKED-ENV; 2.5 altyapısını kurma, kendiliğinden erteleme.

### Model / tek yazar / review / bütçe / durdurma / devir
Risk **düşük, sunum/config/metin**; tek giriş normal **Opus `/implement`**, ana model/effort aynı.
Sonnet 5.5 (`claude-agent/sonnet`) tek bounded M13 işi: yalnız tablodaki SettingsPage,
app-version.ts, settings-page.spec.tsx ve üç locale; kabul G456-01–05/07, komutlar yukarıda.
Opus önce aynı kodu uygulamaz; Sonnet tek yazar. Ana Opus paralelde yalnız D10/G6 belge
eşlemesini ve read-only caller kontrolünü yapabilir; ortak build/cihaz koşuları çakıştırılmaz.
Sonnet diff/komut/log/hash/açıkları devreder; Opus doğrular, geçerli koşuları yinelemez;
onaylı tüm satırları bitirip REVIEW/unchecked bırakır. Destek model erişimi yoksa bildir, sessiz fallback yok.
Bağımsız GPT review: tablo davranışı ve normal/hata/departure caller kanıtı; temiz
FSD/NativeWind/global token/Lucide/TR-EN-DE/300-satır standardı; ilgili test/lint/tsc/export
ve dar M13 görsel kanıtı. Gerekli eksik varken review-ready değil; self-review kabul değildir.
G1-07/F1 fix2 Faz3, FO1 Faz4, step19, B2/release/P5/provider/signing/storage ve tam
fiziksel/a11y/performance kapıları açık; M13 kabulü bunları kapatmaz veya yeniden açmaz.
Usage UNKNOWN ise uydurma; 15000 thinking-dahil output ajan içi verimlilik kontrolü,
ölçüm yoksa ilk temsilci sonunda manifest notu; UNKNOWN/eşik/satır bitişi durma/onay değildir.
Aynı yaklaşım/invariant iki başarısız fix'te DUR; sayaç model/oturumla sıfırlanmaz.
Scope/ürün/güvenlik çatışması, eksik gerçek altyapı veya izinsiz yıkıcı işlemde somut engelle GPT'ye dön.
Kritik açık tasarım kararı yok; capture önkoşulu henüz doğrulanmadı, PASS/erteleme uydurulmaz.
**Tek sonraki adım:** bu işin mevcut Opus sohbetinde, yoksa yeni Opus sohbetinde:
`/implement — Yalnız kullanıcı onaylı docs/implementation/plans/next-plan.md §2.3/G4–G6
D-G456 sözleşmesini uygula. G456-01 temsilcisi→dar M13→tüm kabul satırları; bounded
Sonnet allowlist/tek yazar ve kanıt reuse kurallarını koru. Native-free sınırı,
D10 birleşimi, step19 ve F1/Faz3–4 ertelemeleri değişmez. Zorunlu kanıt eksikse
 BLOCKED, aksi halde REVIEW/unchecked; bağımsız GPT review gerekir. Commit/push yok.`

## 2.4 — Eşleşme/aktarım açıklığı ve güvenli WebDAV teşhisi / 18.11.2026

### Durum / onay / tek kaynak
**KULLANICI ONAYLI / INITIAL / UYGULAMAYA HAZIR — D24, 18.11.2026.**
Kullanıcı bu sözleşmeyi onayladı ve Opus devir mesajını istedi; bu GPT turu uygulama başlatmaz.
Goal ve sabit G24 kabul tablosu yalnız bu bölüm; implement/review kopyalamaz, referans verir.
CURRENT backlog 2.4 esas; 2.1/2.2/2.3 ve F1 sözleşmeleri yeniden uygulanmaz.
Keşif/kanıt/hash ayrıntısı: [2.4 araştırma eki](2.4-clarity-diagnostics-research.md).
Başlangıç HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; hedef kaynaklar HEAD-EQUAL,
locale ve diğer dirty kullanıcı değişiklikleri korunur. Test/build bu planda NOT_RUN.

### Tek goal / kapsam dışı
**Goal:** kullanıcı mevcut gerçek state'ten kimin hangi onayı beklediğini ve aktarım
belirsizliğini anlayabilsin; mobil/Desktop WebDAV formunda tam HTTPS endpoint+port+
DAV kökü+mevcut hedef alt klasörü ayrımını görebilsin; başarısız bağlantı testinde
gözlenen aşama/HTTP durumunu sır içermeyen, yerelleştirilmiş teşhisle ayırt edebilsin.
**Kapsam dışı:** saha kesintisinin kanıtsız kök nedenini düzeltme; native transport/log API,
retry/deadline/bütçe/fence değişimi, CA/trust-all/pin/auth/NTLM/mTLS, yeni timeout politikası,
gezgin/boş targetPath/MKCOL hedef oluşturma, export/A5, 2.5 capture altyapısı, F1 ve step19.
Gerçek sunucu/credential gönderimi, cihaz/veri/hesap temizliği veya yeni fixture kurulumu yok.

### Doğrulanmış bulgu → D24 seçilen çözüm
- C24-A/C: mobil probe bütün aşamaları genel hataya indiriyor; UI belirsizliği gösterirken
  ayrıntıyı kaybediyor. Var olan hata `message` kodları korunur, yalnız güvenli metadata eklenir.
- C24-D/F: Desktop ham Error metnini gösterebiliyor; Electron'da Error özel alanlarına güvenilmez.
  Yalnız test IPC cevabı plain-data success/failure envelope olur; runtime Promise<void> değişmez.
- C24-G/H: onay tarafları/metinleri sadeleşir; normal akış PC onayı, repair önce telefonun
  açık rızası sonra PC onayıdır. Bu rıza eşleşme veya dosya izni tamamlandı anlamına gelmez.
- `os_interrupted`: “çalışma kesildi; kesin neden bu durumdan belirlenemiyor” anlamı;
  `webdav_auth`: HTTP erişim reddi, parola yanlıştır/NTLM gerekir iddiası değil.
  OS fırsatı/erişim denemesi ayrımı ve ACK bekleme/korunan ilerleme metinleri korunur.
- İki formda ayrı port/yeni URL normalizer yok: çevrilebilir statik örnek
  `https://server.example:8083/webdav/` + `Kloda` → `https://server.example:8083/webdav/Kloda/`.
  Port URL içinde; hedef koleksiyon önceden mevcut/erişilebilir olmalı; test kendi geçici
  verisini yazıp siler. HTTPS/OS trust/Basic sınırı açıklanır; gerçek endpoint önizlemesi/logu yok.

### Dosya / sembol / sorun → değişiklik / kabul
Yollar repo köküne göre; aşağıdaki sınır dışında genişleme önce GPT/kullanıcı kararı ister.
| Hedef dosya/sembol | Beklenen dar değişiklik | Kabul |
|---|---|---|
| `apps/mobile/src/shared/api/webdav.ts::testWebDavWriteAccess`; yeni aynı dizin `webdav-diagnostics.ts` | Her gerçek request/readback sınırında metadata; eski message/cancel/cleanup davranışı aynı. Helper allowlist ve safe projection. validateWebDavForm semantiği aynı. | G24-03–06 |
| `apps/mobile/src/features/backup-setup/model/use-backup-setup.ts::testStorage/editStorage/leaveStorage`; `pages/setup/ui/webdav-page.tsx::WebDavPage` | Ayrı geçici diagnostic state; güncel başarısız testte göster, edit/yeni test/leave'de temizle. Kalıcı warning ayrı. Form açıklamaları mevcut panel/Tailwind içinde. Dinamik hata mesajını key yapma; mevcut kod allowlist/fallback kullan. | G24-02–06 |
| `apps/mobile/src/features/pairing/ui/pairing-modal.tsx::PairingModal` | Yalnız repair açıklaması action approve/deny sürerken eski eylem talimatı gibi görünmesin; mevcut action/uncertain önceliğini kullan. Diğer phase metinleri locale'den; yeni state/API yok. | G24-01 |
| `apps/desktop/electron/runtime/webdav-errors.ts::WebDavFailure`; `webdav.ts::verifyWriteAccess/cleanupProbe/probeMutation` | Optional safe diagnostic; yalnız probe sınırlarında aşama/status/readback bilgisi ekle. failureCode/networkFailure/httpFailure ve cleanup önceliği değişmez; normal upload'a yeni politika yok. | G24-03–06 |
| Yeni `apps/desktop/electron/runtime/webdav-test-result.ts`; `electron/main.ts::kloda:test-storage` | Test çağrısını safe projection ile `{ok:true}` veya `{ok:false,code,diagnostic?}` döndüren helper'a bağla; mevcut trusted sender kontrolünden SONRA. Unknown→unknown; ham Error/cause IPC cevabında yok. | G24-04/06 |
| `apps/desktop/src/shared/api/desktop.ts::testStorage`; yeni aynı dizin `webdav-test-result.ts` | Renderer dönüş tipi + unknown payload parser/allowlist. Preload invoke aynı kalır; native ABI, runtime/types.ts DesktopBridge ve runtime.testStorage Promise<void> değişmez. | G24-04/06 |
| `apps/desktop/src/pages/backup/BackupSetup.tsx::testStorage` ve diğer catch'ler | Safe test envelope tüket; bütün bu bileşenin load/select/schedule/start/saveStorage catch'lerinde raw reason.message yerine yerelleştirilmiş işlem fallback'i. Test bilgisi yalnız güncel storageVersion'da; form hint'leri. | G24-02/04/06 |
| İki app `src/shared/i18n/locales/{tr,en,de}.json` | pairing phase/repair/help, transfer os_interrupted/webdav_auth ve form hints/diagnostic stage/reason/http anahtarları; altı mevcut dirty dosyada yalnız ilgili key'ler. | G24-01–07 |
| Mobil `shared/api/webdav-settings.spec.ts`, yeni `shared/api/webdav-diagnostics.spec.ts`, `app/App.spec.tsx`, `pages/pairing/ui/pairing-page.spec.tsx`, `pages/activity/ui/activity-automatic.spec.tsx` | Mevcut fetch/SecureStore/deferred/native mock'larını genişlet; normal/hata/stale/repair ve dil assertion'ları. | G24-01–07 |
| Desktop `electron/runtime/webdav.spec.ts`, `webdav-errors.spec.ts`, yeni `webdav-test-result.spec.ts`; `src/pages/backup/BackupSetup.spec.tsx` (yeni), `src/pages/pairing/PairingPage.spec.tsx`, yeni `src/shared/api/webdav-test-result.spec.ts` | Mevcut mock desenleriyle probe→projection→parser→render; envelope ve ham secret sentinel regression. Yeni server fixture yok. | G24-01–07 |

### Güvenli teşhis ve korunacak invariant'lar
Teşhis bir log sistemi değil, yalnız test sonucunun RAM'deki sunumudur. İzinli alanlar:
`stage`: `propfind|mkcol|put|move|get|delete_file|delete_directory`;
`kind`: `http|transport_unknown|readback_mismatch`; `status`: yalnız gözlenen HTTP integer 100–599
(yalnız kind=http). Başka alanlar projection'da kopyalanmaz; malformed payload generic fallback.
Yöntem/aşama sabit enum'dan, status Response'tan; exception.message/cause/stack/header/body/
Authorization/username/password/host/path/query/QR/operation ID taşınmaz, persist/log/analytics yok.
HTTP 401/403 erişim reddi, 404 koleksiyon/yol erişimi doğrulanamadı, 405 yöntem reddi;
DNS/TCP/TLS/timeout, yanlış parola veya gerekli auth yöntemi tahmin edilmez.
Mobil message kodları `webdav_connection`, `webdav_probe_incomplete`, cancelled/probe aynı;
metadata bu sınıflamayı değiştirip warning/retry/kurtarmayı atlatamaz. Desktop code eski
failureCode sınıflaması; parser bunu ayrı allowlist ile sınırlar, metadata retry girdisi olmaz.
Mobil beforeMutation/secure tuple/testedAt/probeWarning ve Desktop retry journal/cleanup
algoritmaları aynen kalır. İlk PROPFIND başarısızsa mutasyon yok; kayıp MOVE cevabı sahiplenme/
silme izni değil. Eski warning yeni başarıda silinmez; yeni ayrıntı reopen'da uydurulmaz.
Edit/background/unmount/visibility kaybında mevcut grant/version/abort fence'leri gevşemez.
Geç sonuç yeni formu başarılı göstermez; yalnız mevcut kalıcı belirsizlik uyarısı korunabilir.
PC retained receiver/ACL, ayrı dosya onayı ve QR foreground fence'leri ADR0016/0018'e göre aynı.

### Ortak durum–olay–beklenen sonuç / sabit bitti ölçütleri
| ID | Başlangıç | Olay / kesinti-geç callback | Beklenen state, kalıcı durum ve OS yan etkisi | Kabul testi |
|---|---|---|---|---|
| G24-01 | Normal/repair/pending/consumed/complete/uncertain pairing | İlgili snapshot render; repair approve in-flight; stale hata | Doğru taraf/sıra; in-flight yeni onay talimatı değil; pending≠complete, trust≠file grant. Native eylem/izin değişmez. | Mobil pairing + Desktop PairingPage mevcut mock'ları; TR/EN/DE; kullanıcı eylemi olmadan çağrı yok. |
| G24-02 | Dört alanlı iki form | Hint render; portlu endpoint/target mevcut validator/client'e girer | Statik örnek ve mevcut koleksiyon gereği açık; port/path korunur. Sır tekrar gösterilmez; yeni ağ/OS çağrısı yok. | Form render/a11y + mevcut probe mock'unda ilk URL `https://fixture.example:8083/webdav/Kloda/`; unsafe input reddi korunur. |
| G24-03 | Mobil eski tested profil | PROPFIND 404 veya transport rejection | testedAt=null, eski tuple korunur; mutation yok. Güncel teşhis propfind+404 veya transport_unknown; kesin TLS/auth nedeni iddiası yok. | İlk temsilci webdav-settings mevcut fake network/store; HTTP ve ağ karşıtı; URL/secret sentinel yok. |
| G24-04 | Mobil/Desktop başarılı başlangıç aşaması | MKCOL/PUT/MOVE/GET/iki DELETE aşamasında HTTP/transport/readback hatası | Son gözlenen hatalı aşama/status; başarı yok. Mobil intent/warning, Desktop mevcut cleanup/error önceliği değişmez. Hiçbir yeni retry/OS schedule yok. | Mevcut probe testlerine tablo assertion; GET mismatch, iki DELETE ayrımı; Desktop helper→renderer payload testi. |
| G24-05 | A testi yazma intent'inden sonra bekliyor; yeni B formu | Edit/background/leave ardından A geç failure/success; reopen; B başarı | A diagnostic/başarı B'ye taşınmaz. Mevcut warning=true kalır, profil şeması değişmez; reopen genel warning, uydurulmuş ayrıntı yok. Yeni aktarım/cleanup başlatılmaz. | Mevcut App stale/deferred ve settings reopen testlerini genişlet; background/unmount; Desktop storageVersion edit karşıtı. |
| G24-06 | Raw exception/payload içinde sahte sırlar | Probe hata, IPC projection, malformed/unknown reply, BackupSetup diğer catch'leri | Allowlist dışında veri metinde/serialized reply'da/logda yok; generic fallback. Success yalnız ok=true; eski void/bozuk reply başarı değil. Retry class/deadline/attempt ve journal aynı. | Her gerçek catch→render hattında sentinel; serializer/parser unit; mevcut Desktop retry/storage tests, source/caller diff audit. |
| G24-07 | Aynı native queue ve iki form/pairing UI | Üç dil; os_interrupted, auth red, waiting/ACK ve hata render | Doğrulanmayan neden/garanti yok; access/OS sayaç ayrımı ve sonuç belirsizliği korunur. Erişilebilir hint/alert; Lovable yerleşimi bozulmaz. | Locale parity + ilgili render/a11y + scoped lint/tsc/build; yeni metinlerin dar scripted görsel karşılaştırması aşağıdaki kapı. |

### Tek doğrulama seçimi / ilk temsilci → dar genişletme
1. Uygulama başında tracked+untracked scope/baseline hash ve test ortamını manifestte kaydet.
   Araştırma ekindeki reuse ayrımını kullan; eski native/163-test PASS'i taze gösterme.
   Node/workspace deps, mevcut Jest fetch/SecureStore mocks, Desktop Vitest/SQLite binding hazır mı
   salt-okunur kontrol et; fixture/SDK/platform matrisi kurma. Eksikse yalnız etkilenen kontrol BLOCKED.
2. İlk temsilci G24-03: mevcut testte PROPFIND 404→safe diagnostic assertion; önce dar tsc,
   eski varyantın derlendiğini ayır, sonra hedef RED→minimum mobil metadata→GREEN.
   Derleme hatası RED değil. Bu kapı geçmeden Desktop IPC veya geniş test yığınına başlama.
3. Mobil G24-04/05/06'ya genişlet; sonra Desktop probe→safe envelope→parser→form temsilcisi
   (404+secret sentinel) ve kalan ilgili hatalar. Runtime retry class ve persistent schema aynı kalmalı.
4. Sonnet locale işi aşağıdaki tek-yazar sözleşmesiyle bağımsız ilerleyebilir; tüketiciler hazır
   olunca ilgili G24-01/02/07 render'ları. Satır başına izin/sohbet yok; bütün onaylı kapsam sürer.
5. Komut deseni reuse: kökten `node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json`;
   Desktop için `node_modules/.bin/tsc --noEmit -p apps/desktop/tsconfig.json` ve
   `node_modules/.bin/tsc --noEmit -p apps/desktop/tsconfig.main.json`.
   Sonraki testler: `npm test --workspace @kloda/mobile -- --runTestsByPath <tablodaki değişen specs>`;
   cwd apps/desktop: `../../node_modules/.bin/vitest run --config vitest.config.ts <seçilen specs>`.
   Desktop mevcut webdav-connection-test/storage-settings specs yalnız probe/envelope diff'inin
   etkilediği retry/storage sınıflaması için seçilir; tüm suite/root pretest/native rebuild yok.
6. Kök `node_modules/.bin/eslint <değişen TS/TSX>`; altı locale JSON parse/iki app içinde
   key+interpolation parity; `git diff --check`. Cwd apps/desktop `../../node_modules/.bin/vite build`;
   cwd apps/mobile `../../node_modules/.bin/expo export --platform ios --output-dir <izole-çıktı>`
   ve Android karşılığı. Kanıt/çıktı `docs/implementation/evidence/backlog-2.4/` altında;
   derleme iki form/bridge paketlemesi içindir, native/production kabul değil.
7. G24-07 dar scripted görsel kapısı: mevcut capture'ın gerçekten bu ekranları izole açabildiğini
   doğrula; yalnız değişen form/pairing durumları, TR/EN/DE/light-dark/büyük yazı.
   Bilinen mobil izole capture açığı 2.5'tedir; yeni script/fixture burada yazılmaz.
   Hazır yol yoksa G24-07 visual BLOCKED/NOT_RUN: aynı GPT sohbetinde yalnız bu kapının kararı
   gerekir. G1/G456 eski ertelemesi yeniden açılmaz veya 2.4'e otomatik genişletilmez.
8. Final normal/recovery/error caller taraması ve acceptance→test eşlemesi; başarılı değişmemiş
   koşuları tekrarlama. Gerekli kontrol eksikse REVIEW-ready değil; erteleme/PASS uydurma.

### Model / review / bütçe / durdurma / devir
Risk **orta; credential-boundary/persistence korunumu hassas**. Ana Opus model/effort aynı;
probe, safe IPC/parser, state/fence ve testleri Opus. Tek giriş normal `/implement`.
Bounded Sonnet 5.5 (`claude-agent/sonnet`) işi: yalnız altı locale dosyasında D24 anlamına
uygun çeviri; G24-01/02/07 ve diagnostic stage/kind/http key'leri. Yeni dependency/API/test yok.
Sonnet tek yazar; Opus bu locale'leri paralel değiştirmez. Sonnet yalnız ekin §Locale komutunu ve
`git diff --check -- <altı locale>` çalıştırır; diff/log/hash/açıkları devreder. Opus gözden geçirir,
aynı işi baştan yazmaz. Ortak build/cihaz koşusu yok; erişim yoksa bildir, sessiz fallback yok.
Bağımsız GPT review: tablo davranışı/etkilenen normal-hata-recovery yolları; sır sızdırmama,
retry/fence/profile/cleanup diff'i; temiz FSD/Tailwind/NativeWind/global CSS/Lucide/TR-EN-DE/
300-satır standartları; ilgili test/lint/tsc/build ve G24-07 kanıtı. Self-review kabul değildir.
Zorunlu G24 kontrolleri ayrı; F1 fix2/G1/G456 Faz3, FO1 Faz4, step19, B2/release/P5/
provider/signing/storage ve fiziksel/tam regresyon kapıları açık kalır, yeniden koşulmaz.
Usage UNKNOWN ise uydurma; 15000 thinking-dahil output ajan içi verimlilik kontrolü,
ölçüm yoksa ilk temsilci sonunda mevcut manifeste not; bu eşik/UNKNOWN/onay satırı duruş değil.
Aynı yaklaşım/invariant iki başarısız fix'te DUR; sayaç oturum/model değişimiyle sıfırlanmaz.
Kapsam/ürün/güvenlik çatışması, kalıcı şema/native ABI ihtiyacı veya eksik altyapı kararı GPT'ye;
kritik tasarımı implementer seçmez. Tasarım açık kararı yok; D24 onaylandı, görsel önkoşul ayrı.
**Tek sonraki adım:** bu işin Opus sohbeti varsa orada, yoksa yeni Opus sohbetinde
aşağıdaki komutu kullanıcı verir; otomatik ajan/uygulama başlatma yok:
`/implement — Yalnız docs/implementation/plans/next-plan.md §2.4 D24 onaylı sözleşmesi.
G24-03 ilk temsilci→dar mobil→Desktop safe envelope→tüm G24 kabulü; locale Sonnet tek yazar,
kanıt reuse, retry/fence/kalıcılık ve ertelemeler korunur. G24-07 hazır capture yoksa yeni
altyapı kurma veya erteleme varsayma; eksik kapıyı bildir. REVIEW/unchecked; commit/push yok.`

## 2.5 — Kalıcı batch capture sözleşmesi / 18.11.2026

### Durum / tek kaynak / onay
**D25-M KULLANICI ONAYLI / UYGULAMAYA HAZIR — 18.11.2026.**
Kullanıcı ayrı test-only mobil entry + disposable bundle/Keychain izolasyonunu
onayladı; bu devam turu yalnız sözleşme netleştirmesidir, uygulama başlatmaz.
Yalnız 2.5; önceki sözleşmeler korunur. Bulgular: [araştırma eki](2.5-batch-capture-research.md).
Goal ve G25 kabul kimlikleri yalnız burada; implement/review bunları kopyalamaz.

### Tek goal / kapsam dışı
Gözlenebilir sonuç: mevcut capture yollarından türetilmiş kalıcı bir batch girişi,
uygulanmış ekran/dil/tema/büyük-yazı kapsamını açıkça listeler; seçilen eksik
hücreleri doğru hedefte yakalar, kanıt kökenini kaydeder ve eksik/yanlış çıktı,
yanlış hedef veya restore hatasında başarı yerine nonzero exit verir.
2.5 kabulü runner hazırlığı + dar temsilci kanıtıdır; bütün görsel matrisin ürün
kabulü değildir. Matris üretimi/karşılaştırmalı tam kabul Faz3'te kalır.
Kapsam dışı: ürün UI/route/metin/politika değişikliği, yeni gerçek hesap/sağlayıcı,
transfer/restore/izin verme/eşleşme işlemi, schema/native ABI, production signing,
step19, tam regresyon ve fiziksel/release kabulü. Capture uğruna fence gevşetilmez.

### Doğrulanmış başlangıç / D25-M kesin çözüm
Android betiği yalnız Connections + sabit eski koordinatlar; genel mobil runner yok.
G23 renderer betiği sentetik/native-free; mobil native kabulüne taşınmaz.
Eski iOS linked-entry gerçek bileşeni gösteriyor ama disposable kimlik/Keychain'e
bağlı. Activity unmount native cancelRestore, pairing mount/cleanup native çağrı
üretiyor; genel uygulamada gezinme salt-okunur varsayılamaz.
**D25-M:** iOS linked-entry yöntemini kalıcılaştır; gerçek sayfa/shell/font/global
CSS/native modüller, ayrı fixture bundle ve yalnız o bundle'a ait Keychain grubu.
Mevcut Simulator/app devralınmaz: her native run yeni `Kloda-Capture25-<runID>`
Simulator oluşturur. Bu izolasyon kaynaklarını oluşturma ve yalnız kendi oluşturduğu
cihazı sonunda silme runner kapsamıdır; eski Kloda/kişisel cihazlar dokunulmaz.
Fixture binary cache'i ve grup kimliği reuse edilebilir; her run'ın boş Simulator
Keychain/container'ı ayrıdır. Product App/route/hook/native politikası değişmez.
Desktop sentetik renderer, iOS gerçek bileşen+native-fixture diye ayrı etiketlenir;
Android native/UI ve fiziksel sonuçlara eşdeğerlik iddiası yok.

### Dosya / sembol / sorun → hedef değişiklik
Aşağıdaki yeni dosyalar kesin allowlist; henüz mevcut/runnable değildir.

| Hedef | Mevcut sorun → beklenen değişiklik | Kabul |
|---|---|---|
| `tools/capture-ui.py` — CLI/preflight/run/cleanup | Dağınık geçici komut → matrix/list/select/resume ve tek sonuç protokolü | G25-01/04/05 |
| `tools/ui-capture/matrix.json`, `matrix.py`, `test_matrix.py` — load/select/fingerprint | Kalıcı envanter yok → kaynak/ref/driver/variant/gate/kanıt; saf seçim/reuse karşıtları | G25-01/03 |
| `tools/ui-capture/common.py` — ownership/results/cleanup | Kalıcı süreç aidiyeti ve sonuç protokolü yok → atomik kayıt/lock/runID/phase ve hata önceliği | G25-04/05 |
| `tools/ui-capture/desktop.py` — renderer adapter | G23 tek-kullanımlık → loopback/disposable context; bilinmeyen bridge çağrısı fail-closed | G25-02/04 |
| `tools/ui-capture/ios.py` — prepare/run/cleanup; `ios_fixture.rb` — stage_project | Geçici yollar/sabit UDID → scratch proje, fixture kimliği, yeni Simulator ve bounded native capture | G25-02/04/05 |
| `apps/mobile/capture/{entry,screens}.tsx`, `protocol.ts`, `tsconfig.json` — CaptureRoot/ScreenRegistry/phase parser | Ürün dışında kalıcı entry; gerçek komponent adapter'ları, runID/phase doğrulaması; ayrı typecheck | G25-01/02/04/05 |
| `tools/ui-capture/test_capture.py` — saf runner kontrolleri | Yanlış hedef/eksik çıktı/restore exit testi yok → cihazsız dar regression | G25-04/05 |
| `docs/implementation/evidence/backlog-2.5/` — manifest/log/hash | Yeni runner kanıtı yok → yalnız yeni davranışa ait dar kanıt ve reuse pointers | tümü |

Ürün kodu, eski evidence scriptleri ve geçmiş manifestler değiştirilmez.
Ürün App/package/Metro/Babel/Podfile/Xcode projesi ve native kaynakları salt-okunur.
Scratch proje/fixture/ownership dosyaları yalnız yeni run/fixture kökünde üretilebilir.
Yeni araçlar 300 satır/sorumluluk sınırına uyar; yeni dependency/SDK kurulumu yok.

### Kapsam matrisi sözleşmesi
Envanter `DesktopRoute`, `MobilePage`, provider dalları ve frozen page-map'e eşlenir;
Lovable demo rotası doğrudan uygulanmış ürün ekranı sayılmaz.
Desktop: welcome/receiver/pairing/incoming/devices/backups/trash/connections/add/detail,
backup/storage/sources/jobs/settings/tray; D10 mevcut birleşik adım, yeni rota yok.
Mobil: welcome/home/photos/sources/schedule/computer/pairing/activity/backups,
connections/add/provider/settings/recovery/storage; provider ailesi ayrı satırlar.
Her satır TR/EN/DE × light/dark × normal/büyük-yazı hücrelerini listeler.
Ölçülen fontScale/content-size/root font bilgisi yazılır; zoom native büyük yazı sayılmaz.
M11 Now/Past + all/done/issues + açık filter; M13 üst/alt; WebDAV form/help/diagnostic;
pairing idle/help/protected metinler ayrı state satırlarıdır.
Mevcut güvenli durumla üretilemeyen satır BLOCKED + somut neden taşır; yeni erteleme
uydurulmaz. İlk sürücüler desktop-renderer/ios-native-entry; Android eski Connections
betiği yalnız tarihî pointer'dır, otomatik çalıştırılmaz/diğer ekranları destekler denmez.
Native entry public props ile açılan başlangıç ekranlarını destekler; M11 history/
filter-open, uzun sayfa altı, protected pairing ve diagnostic gibi gesture/seed isteyen
alt durumlar native üretilemiyorsa `interaction_required`/`state_unavailable` kalır.
Envanter bunları atlayamaz; Faz3 görsel kabulü kapandı sayılmaz. State seed,
QR scan, gerçek test/save veya izin işlemiyle sessizce oluşturulmaz.
step19 kartları ve OS tray gerçek davranışı açık haricî kapıdır; listeden kaybolmaz.
G1-07/G456-07/G24-07 Faz3 DEFERRED/NOT_RUN korunur; 2.5 bunları PASS'e çevirmez.

### Invariant / durum–olay–beklenen sonuç / sabit kabul
Runner'ın dosya/OS yan etkileri için aşağıdaki tek tablo geçerlidir.

| ID | Başlangıç | Olay | Beklenen state / yan etki | Dar kabul testi |
|---|---|---|---|---|
| G25-01 | Envanter + önceki kanıt | list/plan veya dar seçim | Tüm uygulanmış aileler ve varyantlar görünür; eksik/deferred ayrılır; list cihaz açmaz | Saf matrix keşfi + seçim/duplicate/eksik locale testi |
| G25-02 | Doğrulanmış izole hedef + kaynak/build hash | Tek temsilci render | Gerçek ekran/locale/tema/font doğrulanır; doğru tür PNG + ölçüm; native/synthetic ayrık | Önce Desktop settings/TR/light/1440; sonra iOS M13/TR/light/normal; büyük yazı/tema raporu saf karşıtları |
| G25-03 | Önceki capture/hash + güncel diff | Resume/reuse | Aynı kaynak/variantta reuse; etkilenen dependency/key gösterilir; UNKNOWN taze PASS olmaz | Bir reuse ve bir değişen-hash fixture'ı; yeni cihaz fixture'ı değil |
| G25-04 | Seçili hücre çalışıyor | Eksik PNG/yanlış ekran/console error/timeout | Hücre FAIL; exit nonzero; bounded deadline; matris yeşile boyanmaz | Saf hata enjeksiyonu + tek temsilci çıktı kontrolü |
| G25-05 | INTENT/CREATED/RUNNING; own süreç/ayar kaydı | Kesinti/geç rapor/cleanup hatası | Eski run/phase raporu etkisiz; yalnız own süreç/cihaz kapanır; RESTORE_PENDING→CLEANED kanıtı olmadan PASS yok | Oluşturmadan önce/sonra kesinti, geç rapor, PID reuse ve cleanup failure saf regression + native finally kaydı |
| G25-06 | Tüm gerekli runner kanıtı | Review devri | Diff/log/hash/komutlar + reuse/gates açık; ürün/native/full visual PASS iddiası yok | Bağımsız GPT diff ve kabul→kanıt incelemesi |

Ek invariant: mevcut kişisel app/container/Keychain okunmaz, temizlenmez, yeniden
imzalanmaz. Çıktı yalnız yeni run dizinine; overwrite/clobber yok. Port yalnız
loopback; bilinmeyen native/bridge mutasyonu reddedilir. App data snapshot/log/PNG
sır içermemeli; gerçek endpoint/kullanıcı/fingerprint medyası capture'a alınmaz.
Seçimde BLOCKED hücre varsa exit nonzero; başarılı başka hücre onu örtemez.
Reuse fingerprint'i satırın kaynak/ortak stil/font/protokol ve locale key-family
bağımlılıklarıdır; yalnız alakasız locale key/bundle değişimi tekrar gerekçesi değildir.
Bağımlılık aidiyeti kanıtlanamazsa UNKNOWN; eski görüntü kendi varyantında korunur.
Native mount/unmount çağrıları yalnız yeni boş fixture sandbox'ında normal çalışır;
source/account/peer yok, mutasyon düğmeleri sürülmez; native status mock'lanmaz.
Beklenmeyen configured/peer/run/recovery-secret/izin ekranı veya dış ağ ihtiyacı FAIL.

### Mobil lifecycle / kalıcı ve OS yan-etki sırası
1. **PREPARED:** yeni output + exclusive ownership; runID/nonce ve kaynak/binary/
   fixture grup hash'leri. Fixture manifest yok/uyumsuzsa `run` build başlatmaz.
2. **Fixture hazırlığı:** eski geçici yolları kurma. `prepare-ios` mevcut prebuild/
   Pods/native kütüphanelerinden scratch ağaç ve Xcodeproj 1.28.1 ile yalnız app target
   ayarlarını değiştirir: `com.kloda.fixture.capture25.r<uuid>`, aynı tek Keychain
   grubu, fixture Info.plist, inherited linker flags + XML/DER entitlement sections.
   Ürün-relative yollar scratch mirror'da korunur; orijinal proje kaydedilmez.
   Yalnız fixture app target'ta `ENABLE_DEBUG_DYLIB=NO`; ayrı debug dylib düzeni kapalı.
   Bu ayar entitlement section garantisi değildir: main executable readback zorunlu.
   Fixture plist bundle/display/provenance dışında ürün BGTask/URL/capability
   ilanlarını korur; bunlar yalnız yeni boş Simulator'dadır. Extension embed fazından
   çıkarılır; Live Activity başlatılmaz. ATS/izin/trust/native registration gevşetilmez.
   Debug/arm64 iphonesimulator; ürün signing/iCloud/AppGroup/kişisel grup yok.
   DER round-trip, linked entitlements/main executable ve bundle/platform readback
   doğrulanır; ürün/native/Pods input hash'i değişirse fixture geçersizdir.
3. **CREATING→CREATED:** desteklenen kurulu runtime/device type doğrulanır; benzersiz
   cihaz adı ve create intent'i diske yaz, `simctl create` UDID'sini hemen kaydet.
   Mevcut UDID kabul edilmez; yalnız bu creation kaydıyla cihaz boot/install edilir.
   Create sonrası kayıt öncesi kesinti: aynı intent'in benzersiz adı/runtime'ı ile
   yalnız tek eşleşme kanıtlanırsa recovery; belirsiz aidiyette silme yok, FAIL.
4. **RUNNING:** OS appearance/content-size baseline; ephemeral loopback portları,
   own process group ile mevcut Expo Metro. Ayrı capture entry URL'si explicit
   `simctl launch <ownUDID> <fixtureBundle> --initialUrl <captureBundleURL>` ile açılır.
   Ürün default entry'ye fallback FAIL. Entry gerçek ThemeProvider/i18n/fonts/
   SafeArea/Gesture root ve sayfa/shell'i kullanır; kaynak kopyası/inline stil yok.
   Fazlar yalnız allowlist ekran/locale/theme/size taşır; public props/navigation
   adapter'ı sunumu seçer, native test/save/run/scan/permission eylemi çağırmaz.
5. **Phase ACK:** runID+phase+nonce eşleşmesi, active app, fontsLoaded/no fontError,
   i18n dili/theme mode/ölçülen fontScale ve layout-ready raporu; arbitrary native
   payload/exception metni yok. OS `large` normal, `accessibility-extra-extra-extra-large`
   büyük yazı; büyük yazıda measured fontScale>1.5. Eşleşmeden screenshot yok.
   Host event/ACK bekler; sabit sleep ile “hazır” varsaymaz. Metro hazır olma 90s,
   phase 60s; aşım FAIL/teşhis, otomatik timeout artırma veya ikinci build yok.
6. **RESTORE_PENDING→CLEANED:** yeni phase'leri kes, own app terminate, ayarları geri
   al, own Metro/server process group'larını kapat ve wait; sonra yalnız kaydedilmiş
   own Simulator shutdown/delete. Delete doğrulaması fixture Keychain/container
   disposal kanıtıdır; uninstall tek başına Keychain cleanup sayılmaz.
   SIGINT/TERM aynı finally; hard kill'de `cleanup --run` kalıcı kayıttan devam eder.
   Cleanup başarısızsa PASS korunmaz; resume öncesi cleanup gerekir, yeni test koşulmaz.
   Süreç aidiyetinde aşağıdaki **G25-R2 onaylı FIX kararı** geçerlidir. PID/PGID
   tek başına yetmez; aidiyet belirsizse süreci öldürme. Scratch/artifact geniş rm yok.
   Cleanup realpath/run-root sınırını doğrular, mirror symlink'lerini takip ederek
   ürün dosyası silmez; subprocess argümanları shell interpolation olmadan geçirilir.

### Diff → yol → kontrol → reuse / sıra
1. G1/G23/G456/G24 kanıtları ve değişmeyen testler reuse; tüm suite/build tekrar yok.
   İlgili locale key/API diff ayrılmadan G23 görselleri topluca geçersiz sayılmaz.
2. Önce yeni Python/Ruby syntax ve mobil ayrı tsc, sonra saf runner regression;
   aşağıdaki komutlar **uygulanacak CLI sözleşmesi**, bugün hazır/PASS iddiası değil.
3. İlk temsilci Desktop tek TR/light/settings; mevcut renderer hash/freshness ve
   Python Playwright/browser binary önkoşulları doğrulanır. Stale build kullanılırsa
   kendi source hash'i yazılır, güncel UI PASS'i denmez. Tam native build yapılmaz.
4. Desktop temsilcisi geçmeden native fixture/runtime yığınına başlama. Sonra yalnız
   yeni D25-M kimliği/linked entitlement ve entry için gereken compile→mobil M13.
   Build gerekçesi yeni izolasyon yeteneğidir, eski fixture'ın kaybı değil. Geçerli
   fixture kaynak/SDK/native hash eşleşiyorsa reuse; JS-only delta native rebuild değil.
5. Normal seçim, hata, kesinti/geç rapor, restore ve resume yollarını bir defa doğrula;
   tam ekran/dil görüntü matrisi ve Lovable karşılaştırması Faz3'te, burada NOT_RUN.
6. Loglar yeni evidence dizininde gerçek exit code ile; manifest source/build/script/
   matrix/font/viewport/locale/theme/driver/run-ID ve eski kanıt pointer'larını tutar.

### Kesin doğrulama komutları / önkoşullar
Kökten, sırayla; her komut stdout/stderr ve gerçek exit code'u evidence'da tutulur.
Önkoşul: mevcut workspace deps/Python Playwright+Chromium, Ruby xcodeproj 1.28.1/
derq/Xcode, hazır iOS prebuild+Pods/native link inputs ve yeterli disk. Otomatik
install/prebuild/pod install/SDK indirme yok; eksik katman somut BLOCKED-ENV.
E = `docs/implementation/evidence/backlog-2.5`; aşağıdaki yollar henüz üretilmedi.

```text
python3 -I tools/capture-ui.py check
ruby -c tools/ui-capture/ios_fixture.rb
node_modules/.bin/tsc --noEmit -p apps/mobile/capture/tsconfig.json
node_modules/.bin/eslint apps/mobile/capture/entry.tsx apps/mobile/capture/screens.tsx apps/mobile/capture/protocol.ts
python3 -I -m unittest discover -s tools/ui-capture -p 'test_*.py'
python3 -I tools/capture-ui.py list --format json
python3 -I tools/capture-ui.py run --driver desktop-renderer --screen settings --locale tr --theme light --size normal --width 1440 --renderer apps/desktop/dist/renderer --out docs/implementation/evidence/backlog-2.5/desktop-smoke
python3 -I tools/capture-ui.py prepare-ios --out docs/implementation/evidence/backlog-2.5/ios-fixture
python3 -I tools/capture-ui.py run --driver ios-native-entry --screen settings --locale tr --theme light --size normal --fixture docs/implementation/evidence/backlog-2.5/ios-fixture/fixture.json --runtime com.apple.CoreSimulator.SimRuntime.iOS-26-5 --device-type com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro --out docs/implementation/evidence/backlog-2.5/ios-smoke
git diff --check -- tools/capture-ui.py tools/ui-capture apps/mobile/capture docs/implementation/evidence/backlog-2.5
```

`check` syntax/JSON/import-preflight yapar; cihaz/build açmaz, pycache yazmaz.
`prepare-ios` alt komutu scratch workspace'te `xcodebuild -workspace <staged.xcworkspace>
-scheme KlodaSecurePhotosSync -configuration Debug -sdk iphonesimulator
-destination generic/platform=iOS\ Simulator -derivedDataPath <fixture/derived>
CODE_SIGNING_ALLOWED=NO build` çalıştırır; app'e özel settings Ruby'de, Pods'a global
bundle/linker override yok. XML→DER komutu `tools/test-ios-smb-custody.py:38–46` reuse;
yalnız fixture ürünleri ad-hoc imzalanır. Tam native matris/export/release build yok.
Desktop stale kaynak eşleşmiyorsa yalnız mevcut `apps/desktop` Vite build komutu;
legacy renderer'ı güncel kaynak sonucu sayma. Native runtime değişirse otomatik
başka hedef seçme; installed eşdeğer hedefi manifeste gerekçeyle kaydet.
Recovery: `python3 -I tools/capture-ui.py cleanup --run <output>` yalnız own kaynaklar;
`resume --run <output>` cleanup sonrası önceki tamamlanmış hücreleri hash/PNG/
ölçüm/provenance eşitliğiyle reuse eder. Cleanup sonucu olmayan run reuse edilmez.

### Model / risk / review / bütçe / durdurma / devir
Risk **orta**, native fixture/signing/Keychain/süreç sahipliği **hassas: Opus**.
Tek giriş `/implement`; ana model/effort değişmez. Sonnet 5.5 bounded işi yalnız
`tools/ui-capture/{matrix.json,matrix.py,test_matrix.py}`; G25-01/03. Komutları:
`python3 -I -m unittest discover -s tools/ui-capture -p 'test_matrix.py'` ve bu üç
dosyada `git diff --check`. CLI/OS/native/test beklentisi/dependency değiştiremez.
Opus aynı dosyaların ikinci yazarı olmaz; paralelde lifecycle/adapter işini yapar.
Sonnet hash/diff/log/eksikleri verir; Opus doğrular, geçerli koşuyu tekrarlamaz.
Ortak cihaz/build eşzamanlı koşmaz; sensitive fixture/lifecycle ve kabul Sonnet'e verilmez.
Review: davranış ve tüm etkilenen normal/hata/cleanup yolları, source provenance,
scope/temiz kod/300 satır, ilgili saf test/lint/compile ve iki dar temsilci kanıtı.
Zorunlu runner kanıtı eksikken review-ready yok. G1/G456/G24 görselleri, F1 fix2
Faz3; FO1 Faz4; step19/OS/physical/release/provider/signing/storage kapıları korunur.
15000 thinking-dahil output iç verimlilik checkpoint'i; usage UNKNOWN durma/onay değil.
İlk temsilci sonunda tekrar/kapsam/kanıt reuse değerlendirmesi manifeste yazılır.
Aynı invariant/yaklaşım iki başarısız fix'te DUR; yeni ajan/oturum sayacı sıfırlamaz.
İzin/kapsam/güvenlik çatışması veya eksik altyapı kararı GPT'ye; sessiz fallback yok.
Kritik açık tasarım kararı yok; altyapı/compile/runtime önkoşulları uygulamada kanıtlanır.
### G25-R2 onaylı FIX kararı

Kullanıcı, INITIAL review sonrası aynı GPT sohbetinde **run başına yerel gözeticiyi**
ve gözetici de kaybolduğunda kanıtlanamayan süreçlerin fail-closed bırakılmasını onayladı.
Bu yalnız §Mobil lifecycle 6'daki süreç aidiyeti/recovery yöntemini günceller;
tek goal ve G25-01–06 aynı kalır.

- Desktop ve iOS'ta süreç başlatma ve durdurma sorumluluğu gözeticide kalır.
  Gözetici ve kalıcı run intent hazır olmadan browser/Metro başlatılmaz; public CLI
  başlangıç/launch/kayıt aralığında ölse de gözetici cleanup sorumluluğunu kaybetmez.
  Yalnız kanıtlanmış, gözeticinin hâlâ sahip olduğu süreçlere ve sürücünün kendi
  kapanış yoluna müdahale edilir. Reap edilmiş handle, PID/PGID, `lstart`, ata
  zinciri veya sonradan okunan marker tek başına sinyal yetkisi değildir.
- Public `run` SIGINT/TERM veya SIGKILL ile kesilir, gözetici ayakta kalırsa
  kesinti algılanır; yalnız own kaynakların kapanışı doğrulanınca sonuç diske
  **CLEANED + FAIL** olarak geçer. Cleanup tamamlanamazsa **RESTORE_PENDING +
  nonzero**; kesilmiş run'ın tüm hücreleri önceden yazılmış olsa bile PASS yok.
- Gözetici de kaybolur ve süreç aidiyeti kanıtlanamazsa `cleanup --run` o sürece
  sinyal göndermez; aidiyeti ayrıca doğrulanan Simulator ayrı temizlenebilir.
  Çözülemeyen süreç kaydı **RESTORE_PENDING + nonzero** kalır; `resume` reuse etmez.
  Retry önceki hatayı yok sayarak başarı üretemez. Normal başarıda gerçek cleanup
  kanıtı ve kayıt/lock sırası korunur.

**Tek scoped FIX:** [G25-R1–R5 bulguları ve karşıtları](../evidence/backlog-2.5/review.md#engelleyici-bulgular)
ve [FIX-R1 tur kaydı](../evidence/backlog-2.5/MANIFEST.md#fix-r1--onaylı-toplu-devir)
birlikte uygulanır. Önce cihazsız regresyon: normal kapanış, launch/kayıt kesintisi,
public CLI SIGKILL, gözetici kaybı, eski PID/handle, belirsiz browser/Metro, retry
ve G25-R1/R3/R4/R5 karşıtları. Değişen driver yollarına birer dar temsilci seç;
geçerli fixture/native build'i yeniden kullan, tam matrisi koşma. Kesin dosya
  sınırı, 300 satır, ürün koduna/dependency'ye dokunmama ve REVIEW/unchecked geçerli.

### G25-R1/R2 onaylı DECISION — kalıcı çıkış onayı ve kaynak bazlı cleanup

Kullanıcı FIX-R2 reddinden sonra ayrı kalıcı çıkış onayını ve kanıtlanamayan
kaynağın RESTORE_PENDING kalmasını onayladı. Bu karar yalnız §Mobil lifecycle
6 ve yukarıdaki süreç cleanup sözleşmesini kesinleştirir; goal/G25-01–06,
16 dosya sınırı ve ertelemeler aynen kalır. G25-R5 yeniden açılmaz.

| Başlangıç → olay | Kalıcı sonuç / G25 beklentisi |
| --- | --- |
| Gözetici normal capture/cleanup tamamlar → provisional sonuç ve kaynak kapanış kanıtını yazar | G25-04/05: Cleanup temizse `CLEANED`; provisional başarı tek başına public `PASS`/reuse değildir. |
| CLI doğrudan beklediği gözeticinin çıkışını alır → aynı run'ın lock'u altında aynı provisional sonuç neslini doğrular | G25-04/05: CLI kesilmediyse ve gerçek exit beklenen kodla aynıysa, run ID + sonuç nesli + exit onayını public sonuçla birlikte atomik yazar; ancak bundan sonra başarılı hücre reuse edilebilir. |
| Gözetici sonucu yazdı → CLI onaydan önce ölür, kesilir, exit uyuşmaz veya sonuç nesli değişir | G25-03/04/05: Cleanup doğrulanmışsa `CLEANED + FAIL` olarak görülür; `cleanup` ve `resume` sonradan çıkış onayı üretemez. Eski şema/eksik onay başarı sayılmaz. Normal onaylı FAIL/BLOCKED ayrımı korunur. |
| Bir kaynak `launching`, kapanışı kanıtlanmamış veya kaçmış → cleanup/retry, kök PID/PGID yok | G25-05: Kanıtlanmamış kayıt kendi geçerli kapanış kanıtı olmadan terminale dönmez. İlk cleanup'ta görülen kaçakların kaydı retry'da saklanır; canlı/belirsiz kaçak veya ayrı sürücü pending/nonzero, eski PID'ye sinyal yok. Süreç belirsizliği, aidiyeti bağımsız kanıtlanan Simulator cleanup'ını engellemez. |

**16 dosya içinde uygulama yolu:** `capture-ui.py`/`common.py` sonuç onayı ve
lock; `supervision.py` kalıcı kaynak durumları ve kaçak kayıtlarının yeniden
doğrulanması; ilgili driver'lar yalnız kendi cleanup kanıtını yazar. Desktop'ta
Playwright sürücüsü ve Chromium için iki ayrı intent ve receipt: driver intent'i
`start()` öncesi, Chromium intent'i `launch()` öncesi; normalde mevcut
`browser.close()` ve `playwright.stop()` yollarını kullan, ilgili kapanışı ayrı
doğrula. Kurulu sürümde `run-driver`, gözeticinin doğrudan çocuğu olarak başlar;
`stop()` transport beklemesini içerir. Mevcut süreç tablosuyla dar, benzersiz
çocuk/rol gözlemi + kapanış doğrulaması yapılabilir; private API çağrısı, yeni
dependency veya PID/argv'den sinyal yetkisi yok. Özellikle normal başarılı yol
ve browser yokken driver canlı/belirsiz yolu kanıtlanmalı. Kimlik/kapanış kanıtı
yoksa receipt yok; başarılı temsilci bu sınırda üretilemezse kapsam kararı için
dur. Metro'da unreaped-handle sınırı ve bilinen kaçak kaydı korunur; yalnız
root group yokluğundan tüm kaynaklar için toplu kapanış çıkarılmaz.

**Tek scoped tur:** [G25-R1–R4 devam bulguları](../evidence/backlog-2.5/review.md#fix-r2-engelleyici-bulgular)
ve [manifest §onaylı DECISION devri](../evidence/backlog-2.5/MANIFEST.md#onaylı-decision-ve-scoped-devir)
esas. Önce gerçek cleanup/resume/settle girişinde cihazsız RED: onaydan önce
CLI kaybı, exit uyuşmazlığı, aday nesli değişimi, onaylı normal sonuç; root gone/
kaçak canlı iki retry; browser gone/driver canlı veya kimliği bilinmiyor.
G25-R3 çizilen `ui.language`/`ui.languages.*` fingerprint karşıtı (ilgisiz locale
reuse), G25-R4 geçersiz chunk karşıtı (geçerli Desktop/iOS PNG korunur) aynı turda.
İlk temsilci Desktop; sonra yalnız değişen iOS runtime/cleanup yoluna dar kanıt.
Geçerli native fixture/tarif hash'ini reuse et; otomatik rebuild/tam matris yok.

### FIX-R4 onaylı DECISION — onay noktası ve teardown öncesi kayıt

Kullanıcı FIX-R3 reddi sonrası bu sırayı onayladı. Önceki G25-R1/R2 kararının
eşzamanlı kesinti/teardown sırasını kesinleştirir; tek goal, G25-01–06, mevcut
16 dosya ve ertelemeler değişmez. Yalnız G25-R1/R2/R4; R3/R5 yeniden açılmaz.

| Olay | Beklenen sonuç |
| --- | --- |
| CLI gerçek gözetici exit'ini aldı → run kilidi altında aynı run/nesil/sonuç ve beklenen kod doğrulandı → tek onay kararı | G25-R1: SIGINT/SIGTERM ile onay kararı tek sıraya konur. Karar öncesi teslim edilmiş **veya bekleyen** kesinti onayı engeller; temizlik doğrulanmışsa CLEANED+FAIL, reuse yok. `wait()` dönüşünde kopyalanmış boolean veya commit dışında ikinci bir kontrol yeterli değil. |
| Karardan sonra SIGINT/SIGTERM → atomik kalıcı yazım tamamlanır veya tamamlanamaz | G25-R1: Başarılı yazım onaylıdır; sonradan gelen kesinti onayı geri almaz. Yazım başarısızsa veya CLI atomik yazım tamamlanmadan öldürülürse onay yok. Offline cleanup/resume hiçbir onay üretmez; normal FAIL/BLOCKED/RESTORE_PENDING ayrımı korunur. |
| Gözetici cleanup'ta kaçak torunu gözler → ilk süreç teardown adımı | G25-R2: Önceden bilinen ve yeni gözlenen kaçaklar birleştirilip run kaydına kalıcı yazılmadan o süreç grubuna ilk sinyal, bekleme veya reap yok. Yazım başarısızsa bu grupta teardown ilerlemez; nonzero, kapanış iddiası yok. Erken kayıp sonrası retry kalıcı kaynak kaydını kullanır; kök yokluğu canlı/belirsiz kaçak veya ayrı driver'ı kapatmaz. |
| Playwright/Chromium start/launch hata verdi → tek gözlem boş | G25-R2: Boş snapshot olumlu no-launch/close kanıtı değil. Açık intent `RESTORE_PENDING`/nonzero kalır; PID/argv tahminine göre sinyal yok. Normal iki ayrı kapanış receipt'i ve aidiyeti ayrı kanıtlanan Simulator temizliği korunur. |
| Indexed PNG → zorunlu palet boş | G25-R4: Capture ve resume ortak doğrulayıcısı reddeder; geçerli paletli PNG ve mevcut Desktop/iOS PNG'leri korunur. |

**Mevcut kapsam içinde yol:** `capture-ui.py`/`common.py` tek onay kararı ve kayıt;
`supervision.py` write-ahead kaçak kaydı; `desktop.py` launch hata durumu;
`common.py` PNG palet doğrulaması. Dar karşıtlar mevcut `test_supervision.py` ve
`test_capture.py` içinde; gerekirse mevcut 16 dosya içinde sorumlulukları böl,
300 satır sınırını koru. Yeni dosya, dependency veya ürün kaynağı yok; mevcut
araçlarla onay/kapanış kanıtlanamazsa kapsam kararı için dur.

**Tek scoped tur:** [FIX-R3 engelleyicileri](../evidence/backlog-2.5/review.md#fix-r3-engelleyici-bulgular)
ve [manifest §FIX-R4 devri](../evidence/backlog-2.5/MANIFEST.md#fix-r4--onaylı-decision-ve-scoped-devir).
Önce cihazsız RED: production CLI'de lock/commit sınırının iki yanında kontrollü
SIGINT/SIGTERM (sadece handler stub'ı değil), yazım kesilmesi/başarısızlığı, offline
reuse; gözlem→durable kayıt→gözetici kaybı→iki retry, kayıt hatasında sıfır grup
sinyali, belirsiz launch, boş/geçerli palet. Normal yol ve değişen driver
temsilcileriyle dar GREEN; yeni iOS fixture rebuild/tam matris varsayma.

### G25-R2 sadeleştirme — onaylı FIX-R5

19.11 kullanıcı davranış daraltmasını ve test dosyası sınırını onayladı.
FIX-R4 review'u R1/R4'ü kapattı; yalnız R2/G25-05 için scoped FIX-R5 yetkilidir.
Dayanak: `supervision.py:148–159` yazım hatasında yeni gözlemi geri alıyor;
`stop_owned:169–170` sahiplik yokken eksik kaydı yokluk kanıtı sayabiliyor.
`fix-r4/reviewer-retry.log` iki karşıtı gösteriyor; tekrar koşulmadı.
Sadece `null → []` veya yalnız yeni listeyi RAM'de tutmak yeterli değil:
başarısız yazım sonrası gözetici de kaybolursa gözlem diskte hiç bulunmayabilir.

**Onaylı sınır:** driver-managed Desktop receipt akışını değiştirmeden, `Run.spawn`
ile yönetilen Metro/süreç grubu için eksik kapanış kanıtından otomatik offline
iyileşme çıkarma. Canlı unreaped handle yok + mevcut kalıcı durum terminal değilse
PID/PGID/kaçakların görünmemesinden `gone` üretme: structured pending/exit 3.
Kalıcı doğrulanmış terminal kayıt ve canlı sahibin normal cleanup yolu korunur.
Bu, önceki root/escaped absence ile otomatik recovery beklentisini daraltır;
olağandışı gözetici kaybında gerçek süreçler bitmiş olsa da pending kalabilir.
Manuel doğrulama gerektiren bu durumu gizleme; yeni manuel-cleanup ürünü/komutu,
kalıcı retry motoru veya yeni journal oluşturma. R1/R3/R4/R5 yeniden açılmaz.

| Mevcut G25-R2/G25-05 olay sırası | Onaylı sonuç |
| --- | --- |
| Canlı sahip yeni kaçak gözler → kayıt yazımı başarısız | Birleşik gözlem RAM'de tutulur, `null` üretilmez; sinyal/wait/reap yok. Sonraki başarılı kayıt gözlemi kaybetmez. |
| Aynı sahip tekrar dener; RAM listesi artık aynı → kayıt hâlâ başarısız | Liste eşitliği durable kanıt değildir; gerekli write-ahead yazımı başarılı olmadan teardown yok. Yeni dirty-state protokolü yerine mevcut save kullanılabilir. |
| İlk/ek gözlem yazılamadı → gözetici kayboldu → disk eski, kök ve eski kaçak yok, yeni kaçak canlı/bilinmiyor → iki retry | Nonterminal sahiplik kaydı yeterli belirsizliktir; sıfır sinyal, RESTORE_PENDING/CLEANUP_FAILED/3. Resume 3; crash veya CLEANED+FAIL yok. |
| Eski nonterminal kayıtta `escaped: null` → public cleanup | Bilinmeyen bilgi boş kanıt sayılmaz; structured pending/3, TypeError yok. |
| Canlı unreaped sahip → yazım başarılı → normal cleanup; veya önceden kalıcı terminal kayıt | Normal kapanış/sonuç ve onaylı resume yolu korunur. |
| Metro pending, Simulator aidiyeti bağımsız kanıtlı | Simulator cleanup devam eder; toplam run pending kalır. |

**Onaylı dosya kararı:** `supervision.py` (178 satır) minimum değişiklik;
`test_supervision.py` (299) içindeki `WriteAheadTests` sorumluluğunu yeni
`tools/ui-capture/test_recovery.py` dosyasına ayır, birleşik write-fail/loss/retry
karşıtlarını orada tut. Toplam allowlist 16→17, yeni dosya yalnız test; dependency,
ürün veya yeni runtime dosyası yok. Test sayısını azaltmak/sıkıştırmak hedef değil.
Mevcut `test_supervisor_lost_then_retry` kök yokluğunda otomatik başarı beklentisi
bu yeni karar gereği pending'e uyarlanır; eski kabul gibi sunulmaz.

**Doğrulama:** önce mevcut iki reviewer karşıtı + yazım sonrası hiç final kayıt
olmadan gözetici kaybı + aynı sahipte tekrar yazım hatası, production cleanup/resume
üzerinden cihazsız RED→GREEN; terminal pozitif/canlı cleanup/iki Desktop receipt/
bağımsız Simulator cleanup kanıtıyla etkilenen Python suite bir kez. Mevcut 68/68
değişen kaynaklara taze PASS sayılmaz; etkilenmeyen assertion ve 19.11 smoke/resume,
fixture/build/PNG kanıtlarını reuse et. Yeni cihaz/native build/tam matris varsayma.
Sayaç R2=4 korunur. Aynı küçük Sonnet uygulama sohbetine tek scoped FIX-R5
devri; sonuç mevcut bağımsız GPT review'a. Onay kabul/PASS değildir; kutu açık.

## 3 — Faz3 tek tam regresyon / 19.11.2026

**20.11 ekip yürütme güncellemesi:** AGENTS.md Faz3–Faz4 ekip kararı geçerlidir.
Kullanıcının `/ekip devam` komutuyla GPT koordinatör → Sonnet uygulama/test →
ayrı GPT review devri otomatik yürür; rutin adımda yeni kullanıcı onayı yok.
Bul → kök nedene göre grupla → çöz → dar doğrula. Aşağıdaki ürün/dosya/güvenlik
sınırları korunur; kapsam içi scoped FIX'i GPT netleştirip otomatik devreder.
Sınır dışı değişiklik veya kabul azaltma kullanıcı kararıdır. M13-alt
state_unavailable çözüm değildir; zorunlu görsel kapı açıktır. Tarihî "yalnız
belge devri" duruşu yeni ekip başlangıç komutu sonrasında yürütmeyi engellemez.
Güncel sonuç ve alt oturum ID'lerinin tek kaydı Faz3 MANIFEST'tir.

**Durum: Dar kapsamlar ONAYLI; tam matris henüz koşuya hazır değil.**
Kullanıcı 19.11'de [görsel yakalama ve F1 start-RED sınırlarını](faz3-research.md#en-dar-kapsam-kararı)
onayladı. 2.5 FIX-R5 bağımsız kabulü runner kabulüdür, Faz3 PASS değildir.
Bugünkü devir yalnız belge güncellemesidir; kod, preflight veya regresyon
başlatılmaz. Onay, kalan hücre/ortam/hesap önkoşullarını kapatmaz.
[Kalan yürütme önkoşulları](faz3-research.md#kalan-yürütme-önkoşulları):
sabit aday değişmedi. 20.11'de kullanıcı [izole B1 probunu](faz3-research.md#2011--b1p3-03-yetkili-koşu-yolu)
onayladı; prob çalıştırılmadı. Kullanıcı yetkili DAV yedeği olmadığını
bildirdi ve [tek seferlik izole test setini](faz3-research.md#2011--dav-fixture-geri-getirme-kararı)
onayladı. Set henüz oluşturulmadı; yalnız DAV'a bağlı alt kontroller engelli.

### Tek goal / değişiklik sınırı

**P3-06/FTPS — kullanıcı onaylı test düzeneği istisnası (21.11).**
Tek hedef: güncel adayın Android arm64 JNI yolunda, yerel FTPS sunucusuna
tek sentetik dosyanın doğrulanmış aktarımını tekrar üretilebilir kılmak.
[Eksik/eski kanıt](../evidence/faz3/p3-06/ftps-wire-reusability.md).
Bu ilk dilim iOS, gerçek LAN/cihaz, release, hata enjeksiyonu veya tam P3-06
kabulü değildir. Ürün kaynakları, TLS doğrulaması ve üretim paketleri değişmez.

| Kabul | Durum → sonuç |
| --- | --- |
| P3-06-FTPS-1 | Sahipli boş geçici kök → tek standart test sunucusu, yalnız loopback, sentetik dosya ve geçici kimlik bilgileri. Normal TLS kontrol/veri yolu önce host'ta doğrulanır; sunucu sürümü/tarifi ve public CA hash'i kaydedilir. |
| P3-06-FTPS-2 | Güncel kaynak + test CA → arm64 test `.so` (mevcut `android-jni` + `owned-fixture`) ve yalnız `androidTest` APK. JNI export/fixture marker ve staging'de asset hash'i eşleşir; üretim build checker'ının marker yasağı ve ürün APK hash'leri korunur. |
| P3-06-FTPS-3 | Sahipli read-only Android emülatör → tek normal FTPS dosya aktarımı → alıcı bayt boyutu/SHA-256 ve mevcut tamamlanma fişi eşleşir. Gerçek instrumentation sonucu, aday/variant kimliği, komut/exit kaydedilir. Stale `.so`, host probe veya yalnız derleme bu satırı kapatmaz. |
| P3-06-FTPS-4 | Başarı veya hata → yalnız bu koşuya ait sunucu, varsa port eşlemeleri ve emülatör kapatılır. Geçici özel anahtar ham loglara/repoya girmez ve doğrulama sonunda yalnız aidiyetli geçici anahtar kaldırılır. Recipe tekrar üretilebilir, ancak üretilen dosyalar/anahtarlar sürümlenmez. |

**FTPS-1 dar tanı kararı:** Geçerli aktarım kanıtını reuse et. Aynı izole imaj
ve konfigürasyonla en fazla bir koşuda, geçici test probunda veri kapanışı ile
normal QUIT arasına yaklaşık 5 saniyelik gözlem aralığı koy. İstemci olaylarını
anında zaman damgala ve aidiyetli konteynerde `/proc` üzerinden PID/PPID/durum
örnekle; aynı zaman tabanında karşılaştır veya saat farkını açıkça belirt.
Örnekleme sinyali alan PID'yi kanıtlamazsa bunu açık bırak. Bu bir kararlılık
FIX tekrarı veya kabul PASS'i değildir. Yeni paket, restart politikası,
güvenlik ayarı değişikliği ya da Android koşusu yok. Sonucu ve tek sonraki
adımı mevcut FTPS host kanıtına ekle; eski sayaçları koru.

**FTPS-1 sonraki yol:** Çöken fixture tekrar kullanılmaz, debugger koşusu ve
restart politikası yok. Kullanıcı kapsam içi rutin fixture edinimlerini onayladı:
yalnız resmi Ubuntu deposundan, aynı geçici arm64 konteynerde, sürümü sabit ve
desteklenen bir standart FTPS sunucusu. Önce bir adayın normal explicit TLS
uyumunu, bakım/güvenlik durumunu ve gerektirdiği izinleri doğrula. Ürün güveni,
izolasyon ve kabul değişmez. Host olağan aktarım ve sağlıklı kapanış geçmeden
Android yok; eski aktarım kanıtı ve başarısız kararlılık sayaçları korunur.

**FTPS-4 DECISION — tek sahip ve mutlak süre sınırı.** Yalnız mevcut
`ftps-android/build-recipe.sh` değişir. Yeni dosya/bağımlılık yok: tarifin zaten
kullandığı Python 3 standart kütüphanesiyle tek gömülü yürütücü yaşam döngüsünü
yönetir. Başarı sonrası sahiplik bayrakları ve iterasyon sayan boot döngüsü
kaldırılır. PKI/build/transfer sözleşmesi ve tarif başarısız=2 korunur.

| Olay | FTPS-4 beklenen sonuç |
| --- | --- |
| Docker oluşturma/başlatma hata verir veya zaman aşar | İndirme, kurulum ve servis için benzersiz ad + koşu etiketi oluşturma isteğinden önce kayda alınır. `create` ve `start` ayrılır. Temizlik doğrulanmış ID ile; ID dönmediyse tam ad ve etiket eşleşmesiyle yapılır. Yabancı kaynak silinmez. |
| ADB boot sorgusu cevap vermez | Tek monotonik boot son tarihi (300 s); her sorgu en çok 5 s ve kalan bütçeyi aşmaz. Emülatör erken çıkarsa dur. Diğer dış komutlara da aşama süre sınırı koy; boru hattı komut hatasını maskelemesin. |
| Başarı, hata, INT veya TERM | Tek `finally` temizliği. Emülatör doğrudan ayrı süreç grubunda başlatılır; ADB yokken de aidiyetli gruba sınırlı TERM/KILL uygulanır. Kurulum ve reverse niyetleri işlemden önce kayda girer; ADB temizliği yalnız aidiyeti doğrulanmış emülatöre gider. Yerel özel anahtarlar silinir. Bağımsız temizlik adımlarından biri takılırsa diğerleri yine denenir. |
| Temizlik tamamlanamaz veya sahiplik belirsiz | Süre sınırında `CLEANUP_INCOMPLETE`, sıfır olmayan çıkış ve kalan kaynak kimliği; PASS yok. Host kapanması/SIGKILL sonrası otomatik temizlik iddiası yok. Aidiyet kaydı geçici kökte ve sır içermez. |

**Dar doğrulama:** gerçek yürütücü akışına sahte Docker/ADB/emülatör bağla:
start hatası, ID dönmeden yaratma + timeout, askıda boot sorgusu ve yabancı
etiket veya erişilemeyen servis. Sonlu bitiş, çıkış kodu, yerel anahtar
temizliği ve silinen/kalan kimlikleri doğrula. `sh -n` ek kontrol. Gerçek
derleme/cihaz/FTPS tekrarı yok; host ve Android runtime PASS reuse, yeni
tarif uçtan uca çalıştırılmış sayılmaz. Aynı bağımsız reviewer ardından
bu dar FTPS-4 kararını değerlendirir.

**FTPS-4 yeni yürütücü — bağımsız review sonrası dar FIX.**
Create yanıtı alınamadıysa, ilk `NotFound` daemon işleminin tamamlandığını
göstermez: doğrulanmış kaynak bulunamazsa cleanup belirsiz ve çıkış nonzero
kalır. Söküm yalnız inspect ile doğrulanan tam ID'ye gider; isim hedef olarak
kullanılmaz. İç beklemeler, TERM/KILL ve reap dahil, kendi mutlak son tarihini
aşmaz; dış servis gecikmesi emülatör grubu kapatmanın ayrılmış bütçesini
tüketemez. Temizlikte INT/TERM kaydedilir, temizlik kesilmez ve PASS verilmez.
Önceki kabul korunur; yalnız yeni inert geç-yaratım, bütçe ve temizlikte sinyal
senaryolarıyla doğrula. Gerçek FTPS/derleme/cihaz yok.

**FTPS-4 dar FIX — mutlak zaman sınırı.** `run()` çağrı son tarihini
`Popen` öncesi belirler; süreç açıldıktan sonra `communicate` ve KILL/reap
öncesi kalan süre yeniden hesaplanır. Minimum bekleme koyma; bütçe
tükendiyse yalnız beklemesiz sinyal/poll yap ve kalan durumu raporla.
Aynı kural emülatör TERM/KILL/reap adımları için geçerli. İşletim sistemi
süreç başlatmayı geciktirirse süreyi geri alma iddiası yok; dönüşte yeni
bloklayan bekleme verilmez. Dar inert kabul: 10 ms bütçe, süreç açılışında
bütçenin kısmen/tamamen tüketilmesi, kısa emülatör temizliği; her beklemeye
verilen süre ve toplam sanal zaman ölçülür. Diğer kabul kanıtları reuse.

**En küçük çözüm ve sınır:** `AndroidFtpsFixture.kt` yükleyicisi ve `kloda-ftps16`
asset sözleşmesi yeniden kullanılacak; eski binary/CA canlı ağaçta silinmez veya
değiştirilmez. Güncel test asset'leri yalnız ayrılmış test kopyasında üretilir.
`AndroidFtpsFilesChecks.kt` normal publish/receipt bölümünü kullan; karışık
`ftps-files` kapsamını ilk koşuda açma. Gerekli ise sadece bu dosya ve
`AndroidFilesQueueRecoveryInstrumentation.kt`'de mevcut assertion'ları bozmadan
tek pozitif seçici; önce geçici test kopyası. **En çok bir** yeni tekrar üretim
tarifi (`tools/` altında fixture-only araç veya evidence altında tam komut kaydı,
ikisini birden değil). Mevcut Android derleyici ayarları ve marker sınırı
referanstır; genel üretim script'ine `owned-fixture` anahtarı eklenmez.

**Uygulama öncesi denetim:** 127.0.0.1:27449 kullanan Files testi ile diğer
senaryoların adreslerini karıştırma; kontrol ve pasif veri yolu için aynı
sahipli, çakışmayan eşlemeyi iki taraflı doğrula. Önce mevcut/cache'lenmiş,
sürümü sabitlenebilir standart FTPS sunucusunu ve TLS desteğini doğrula; el
yapımı FTP sunucusu, genel fixture framework'ü veya yeni kalıcı bağımlılık yok.
Uygun sunucu yoksa tam bileşen/sürüm ve fixture-only edinim ihtiyacıyla dur;
sessiz kurulum veya dış servis yok. **Sıra:** önkoşul → host TLS → arm64/test
APK → tek Android aktarımı → scoped bağımsız review. Aynı başarısız yaklaşımı
iki kez denedikten sonra dur; yalnız etkilenen kontrol tekrar edilir.

**P3-05 dar FIX — biyometrik izin bildirimi (21.11):** Yalnız
`apps/mobile/modules/my-module/android/src/main/AndroidManifest.xml` içinde,
aday birleşik Debug APK manifestinde zaten bulunan `USE_BIOMETRIC` iznini
modül düzeyinde bildir. Mevcut ADR0029 onay akışı, uygulama izin kümesi ve
bağımlılıklar değişmez. [Kök neden](../evidence/faz3/p3-05/lint-design-note.md).
Önce/sonra aynı varyant birleşik izin kümesi aynı olmalı; dar modül lint'inde
bu iki `MissingPermission` kapanmalı. Kalan S3 `NewApi` nedeniyle tam lint
yeşil sayılmaz; S3 Android 7.x politikası ayrı kullanıcı kararıdır.

**P3-05 S3 API 24/25 — kullanıcı onaylı dar FIX (21.11):** Android 7.0/7.1
S3 otomatik yedekleme desteklenmez; Amazon S3 ekranında TR/EN/DE açıklaması ve
kapalı/etkinleştirilemeyen otomatik kontrol. Elle yedekleme, restore, kayıtlı
tercih ve Android 8+ / iOS davranışı korunur.

| Kabul | Durum → sonuç |
| --- | --- |
| P3-05-S3-1 | API24/25 → otomatik reconcile/delivery/enable → yeni iş kurulmaz/başlamaz, API26 setter çağrılmaz. Doğrudan enable isteği mevcut otomatik durumu/restore'u değiştirmeden reddedilir. Kullanıcının açık disable/pause yolu ve mevcut guard'lar korunur. |
| P3-05-S3-2 | API24/25 Amazon S3 → yerelleştirilmiş “Android 8 veya üzeri gerekir” mesajı; otomatik açık gösterilmez ve etkinleştirilemez. Native public status'ta yalnız gerekirse otomatiğe özel optional boolean; yokluğu eski iOS/bridge ile uyumlu. Manual ve genel `supported` değişmez. |
| P3-05-S3-3 | API26+ → mevcut akış ve `UNMETERED`/`BatteryNotLow`/kalıcı job korunur. Bir dar API sınırı ve JS UI/bridge regression, arm64 dar compile/lint: `NewApi` düşer; mevcut 2 biyometrik lint sonucu korunur. Scoped sonuç tam K2/native cihaz/Faz3 PASS değildir. |

Dosya sınırı: modülde `AndroidS3Automatic.kt`, `KlodaS3Module.kt`, ilgili
mevcut `AndroidS3Automatic*Checks.kt` testlerinden en darı; mobilde
`s3-page.tsx`, `s3.ts`, ilgili mevcut `s3-queue-page.spec.tsx` ve S3 status
spec'i, üç locale. Başka dosya gerekiyorsa koordinatöre dön. Genel S3 gate,
minimum SDK, izinler, pil kısıtı, fixture, bağımlılık ve lint suppression
yok. Ayrı bağımsız GPT incelemesi.

**P3-10 / D12 kullanıcı onaylı tek ürün istisnası (20.11):** [c144e989 D12
görüntüsü ve eş koşul karşılaştırması](../evidence/faz3/p3-10/desktop-settings-matched/RESULT.md)
üzerinden yalnız Masaüstü Ayarlar sunumunu Lovable'a yaklaştır. Diğer P3
non-goal'ları ve D13/native tray/güvenlik sınırları değişmez.

| Kabul | Gözlenebilir sonuç |
| --- | --- |
| D12-1 | `#/settings`: Arka plan önce; sonra Genel → Tema → Dil → gerçek sürüm; ayrı Çık en altta. Lovable panel hiyerarşisi, segmented görünüm ve boşluklar dar yerleşimde takip edilir. Radio klavye/odak, seçili durum ve TR/EN/DE anahtarları korunur. |
| D12-2 | ADR0018: kapatma davranışı gözlenen `canHide` üzerinden açıklanır, yeni seçim yok. Autostart, gerçek OS durum/uyarıları, sürüm ve mevcut Quit onayı/bridge yoluyla aynı kalır. Demo uyarı, sahte sürüm ve mutasyonlu kurulum sıfırlama eklenmez; mevcut güvenli ayarlar-dışı kurulum rotası korunur. Receiver/tray komşuları ve tek mounted background sahibi değişmez. |
| D12-3 | Önce en dar App/settings sıra ve komşu davranış testleri, scoped ESLint + renderer tsc. Ardından sahipli izole renderer build ve tek 521×849/TR/koyu karşılaştırma; aynı c144 görünümü reuse. Farkları kaydet, 1440/native OS/M13-alt veya bütün P3-10 PASS iddiası yok. |

Tek Sonnet yazıcı. Ürün dosya sınırı: `apps/desktop/src/app/App.tsx`,
`apps/desktop/src/features/desktop-background/{DesktopBackground,AppearanceSettings}.tsx`,
yalnız gerekirse `apps/desktop/src/app/global.css`, mevcut Desktop TR/EN/DE
locale dosyaları ve `apps/desktop/src/{app/App.spec.tsx,features/desktop-background/DesktopBackground.spec.tsx}`.
Mevcut Tailwind/token/global CSS; yeni inline stil, yeni bağımlılık veya ortak
shell değişikliği yok. Capture'ın `.appearance-settings` ve `kloda-language`
sözleşmeleri korunur. Yeni davranış/dosya gerekiyorsa koordinatöre dön. Ayrı GPT
gerçek diff ve kanıt incelemesi D12 scoped kabul verir, Faz3'ü kapatmaz.

**Goal:** Tek sabit aday üzerinde Faz3 matrisinin her zorunlu satırını geçerli eski
kanıt veya yeni izole koşuyla doğrula; bağımsız GPT review'un tekrar çalıştırmadan
denetleyebileceği tek kabul→kanıt kaydı oluştur. Gerekli satır açıkken Faz3 kapanmaz.
**Non-goals:** Ürün ve final F1 test kaynakları değişmez. Aşağıdaki dar sınırlar
dışında runner/test değişikliği yok; yeni altyapı, yeni fixture recipe,
bağımlılık, tasarım, Faz4, gerçek release, deploy, commit/push yok. Hesap/medya
yetkisi yalnız aşağıdaki 20.11 Dropbox ve izole Nextcloud sınırlarıyla geçerli.

**Kullanıcı onaylı tek final F1 test istisnası (P3-04):**
`AndroidFtpsLifecycleChecks.kt` (`staleOrigin`) ve `AndroidFtpsPolicyChecks.kt`
(`destroyedWatch`) içinde yalnız test bekleme/senkronizasyon düzeni. Üretim
kodu, test beklentileri ve diğer dosyalar değişmez. Olay sırası, gate'in
gerçekten gerekli aşamada çalıştığının kanıtı ve dar doğrulama için
[manifest §P3-04 test düzeneği kararı](../evidence/faz3/MANIFEST.md#p3-04-test-düzeneği-kararı).

| Dosya/yol ve sorumlu | İş / değişiklik |
| --- | --- |
| `apps/mobile/capture/`, `tools/ui-capture/{matrix.json,ios.py,test_matrix.py,test_capture.py}` | **P3-10:** Sonnet tek yazar; gerçek ekranların gerekli görsel alt durumları için capture-only genişletme. Mevcut `check/list/run/cleanup/resume` ve fixture recipe korunur; allowlist dışı ihtiyaç GPT'ye döner. |
| İzole Faz3 kopyasında mevcut test amaçlı JS girişi | **P3-03:** Sonnet yalnız tek kullanımlık B1 probu; gerçek `smb/sftp/ftps.newRequest()` çağrıları, sahipli Android arm64 Hermes ve iOS arm64 Simulator Debug ürün binary'leri. Ürün/native kodu ve kalıcı araç değişmez; üçüncü CDP denemesi yok. |
| `apps/{desktop,mobile}`, `packages/*`, `tools/test-*`; izole F1 `AndroidFtpsScheduler` ve `AndroidFtpsAutomaticChecks` kopyaları | **P3-04:** Eski Job/Scheduler davranışıyla, yalnız geçici kopyada çağrılmayan `Os.pending` uyumluluk üyesi ve iki ayrı RED grup seçimi. Eski çağrı yolu, final test gövdeleri/assertion'ları ve canlı ağaç değişmez. |
| İzole test kopyasındaki `androidTest/res/raw/kloda_dav_fixture_ca.crt` ve ayrılmış DAV scratch kökü | **P3-06/08/12:** Sonnet yalnız mevcut `prepare` yoluyla bir defalık loopback seti oluşturabilir. Tek kaynak farkı izole kopyanın public test CA'sıdır; canlı repo, ürün trust ve Nextcloud değişmez. Yeni CA/test APK hash'i ayrı fixture varyantıdır. |
| `tools/nextcloud-fixture.py` (değişmez), ayrı sahipli Nextcloud scratch ve disposable hedefler | **P3-08:** 20.11 onaylı: mevcut sabit imaj/loopback, izole DAV CA'sıyla tek Nextcloud sunucu sertifikası ve tek sentetik Files girdisi. Normal ürün TLS/güven ayarları değişmez; mevcut güven yolu yoksa bağlı platform BLOCKED. |
| Koşuda `docs/implementation/evidence/faz3/` | Sonnet tek yazar: tek `MANIFEST.md`, komut/exit, log, artifact, satır ve hücre sonucu; GPT bağımsız kabulü ayrı kaydeder. Yeni ürün/test/fixture dosyası yetkisi yok. |

### Aday ve kanıt seçimi

`P3-S0` = `508b3f0486a7ce04628ec0c3681d995573e5721d` + **mevcut tracked/untracked
kaynak snapshot'ı**, 1601 girdi, SHA256
`ecf7b3ad25b799c165027308edc47d8988933935e7639b2f53977555d3a2f353`.
Temiz HEAD aynı aday değildir. Koşu öncesi hash'i yeniden doğrula; üretilmiş
native girdileri/SDK, app binary/bundle, fixture, renderer stamp ve frozen referans
kimliğini ayrıca kaydet. Fark varsa sessizce yeni adayla başlama; değişen yol→kabul
satırını ayır. Onaylı capture delta'sı `P3-S1…` olarak kaynak hash'iyle izlenir;
yalnız runner/ekran girdisi değişen kanıt etkilenir. Geçici `start-compat`
ayrı varyanttır; adayın veya final GREEN'in parçası değildir.

### Ortak kabul tablosu — başlangıç → olay → sonuç/yan etki → dar kanıt

| ID | Gözlenebilir sonuç / korunacak davranış | İlk kontrol → reuse veya tekrar gerekçesi |
| --- | --- | --- |
| P3-00 | Aday+aidiyetli fixture → Desktop TR/light/settings → doğrulanmış PNG+ölçüm/opt-in'siz render, terminal cleanup ve CLI confirmation. | 2.5 FIX-R5 17/17, 71/71 ve cihazsız retry reuse; FIX-R4 smoke ancak provenance/fingerprint/PNG eşinse reuse. Değilse değişen girdi ya da eksik temsilci nedeniyle tek `run`. No fixture/asset/SDK install by default. |
| P3-01 | Expo/Electron kaynakları → normal/hata/recovery → temiz TS/lint, tam Jest/Vitest ve paketlenen JS; çeviri/değişken parity, FSD/Lucide/Tailwind/NativeWind ve ≤300 satır. | Tam mobil suite eksik; ActivityPage ve Settings locale deltası G1/G456 komşularını etkiler. 2.4 377 Vitest ve dar tsc/lint/export kanıtlarını yalnız aynı kapanış girdilerinde reuse. Desktop main/renderer ayrı; iki CSS TS2882 önceki exit 2, PASS değil. |
| P3-02 | Native girdiler → bir Android arm64 app+androidTest ve bir iOS arm64 Simulator ürün build/link → beklenen modüller/paket içeriği; Desktop main/renderer de üretilebilir. | B1/B3 eski build'leri kendi varyantında; F1+S3 Android kaynak/test değişti, final app/artifact kanıtı eksik. iOS native binary yalnız eşleşen input/variant ile reuse; 2.5 fixture normal app değildir. Desktop renderer stamp / main build girdilerini ayrı değerlendir. |
| P3-03 | Gerçek app JS → SMB/SFTP/FTPS native UUID fabrikalarının her biri iki çağrı/platform → altı geçerli benzersiz değer, JS fallback yok. | B1 18/18 kaynak ve scoped dev kanıtı reuse; izole prob onaylı, runtime NOT_RUN. **P3-02 bağımlılığı:** yalnız adayla eşleşen, üç fabrikası bağlı Android/iOS ürün Debug çıktısı ve ona bağlanan izole JS girişi. B1 için ek build/fixture yok; bağ doğrulanamazsa yalnız P3-03 açık. UUID değerlerini kaydetme. |
| P3-04 | F1/FL1–FO1 tablosunu değiştirmeden: locked A → RETRY kararı/OS finish öncesi stop → tek backoff, B'nin token/P/run'ı korunur. WATCH throw→ordinary reconcile → exact kabul/red/belirsiz; UNKNOWN'da iptal/açık admission yok. | FTPS `fix2` final 6/6 LF; önce izole start-compat FL1 + `ftps-fp2-watch-null-throw-clean` davranış RED, sonra değişmemiş final lifecycle/lock GREEN (same-token B ve 6 FP2 varyantı dahil). Eski 7/32 yalnız eski varyant. Kaybolan post-claim FS1 karşıtı ve R2 owner/delivery statik sınırları review'da açık; FO1 prior reuse/delta Faz4. |
| P3-05 | Android gerçek lint → ilgili modül/uygulama raporu ve ayrı FTPS dar sonuç → tam lint saklanır; suppression yok. | Fix2 için R3 dar koşusu eksik. Tam lintte `DeviceCheck:40/45 MissingPermission`, `AndroidS3Automatic:46 NewApi`, worklets `lintAnalyzeDebug` üç açık başlık. Dar rapor, worklets dışlanınca tam PASS olmaz. |
| P3-06 | Native Rust/Swift/JNI + gerçek TLS/LAN izole paket: güvenli kabul ve ret, yanlış kimlik/revoke ve belirsiz sonuçta yayın/retry yok; journal/restore bağları korunur. B4 kilitli/açık politika ve native faz eşleme; sır/fixture üretim yoluna sızmaz. | B3 9/9 Rust kaynak, Drop/unit/Clippy scope reuse; gerçek FTPS/JNI/TLS/LAN eksik. B4 belge kabulü runtime değil; emülatör/host politika, normal/negatif branch, direct-boot wiring statik ayrılır. B2 kod/paket kontrolü ve L15 kaynak/kapı reuse; gerçek Release B15 §20 ayrı. |
| P3-07 | Dropbox Android seçili etkin hedef → **otomatik** JobService delivery (UI elle tetiklemez) → bir çalışma, doğrulanmış tamamlama, sonraki plan. iOS >150 MiB → `upload_session` chunk+finish → aynı byte/hash; kesintide sahte başarı yok. | Ağsız wiring ve elle JobService/real-account çalışması kendi sınırında reuse; iki senaryo NOT_RUN. Yalnız test amaçlı Dropbox hesabı ve sentetik veri 20.11'de onaylı; live publication komutu veya manuel tetik otomatik kanıt değildir. |
| P3-08 | Hedef kartı → Dropbox Photos ve eklenmiş Nextcloud restore → yalnız doğru hedef/fiş, hash/boyut/Photos sonucu, tekrar duplicate yok; bağlam değişimi/auth kaybı güvenli durur. | 18B/5r iki platform Files PASS prior; Photos/ekli DAV ve ilgili olumsuz dallar eksik. `cloud18-targets`/Nextcloud aşamasında hazır CA+sunucu eşleşmesini doğrula; fixture anahtarı eksikse BLOCKED, CA politikası değişmez. |
| P3-09 | Eski kurulu Android build+sentetik veri → aynı kimlikle silmeden upgrade → hedefler/ayar/journal/fiş korunur. Recovery gizli → kullanıcı deseni → göster/kopyala → hassas işaretli pano, süre/arka plan temizliği; retle gizli. | Host/Android migration ve `recovery29` kanıtı birim sınırında, gerçek Android upgrade + göster/kopyala NOT_RUN; EN/DE ve a11y açık. Sırları UI capture/log'a alma. |
| P3-10 | Frozen ekran → tüm ilgili dil/tema/yazı hücreleri → görsel bağ, gerçek font, taşma/hiyerarşi yok. **G1-07** M11 Şu an/Geçmiş/all/done/issues/açık filter; **G456-07** M13 üst+alt; **G24-07** WebDAV form/help/diagnostic ve pairing idle/help/protected. | 2.5 `list` tüm envanteri korur; `ready` üret, `interaction_required/state_unavailable/blocked` hücreleri neden ve ID ile açık tut. G23 D12/D13, Desktop storage/D10 ve kalan sayfa/provider ailesini kapsa; önceki görsel yalnız aynı key/API/viewport hash'lerinde. Render/a11y mock'u, Android yerine iOS veya zoom yerine büyük yazı kullanılamaz. |
| P3-11 | Normal+hata UI → klavye/odak, screen reader rol/ad/durum/hata, kontrast ve büyük yazı; aynı fixture → açılış/etkileşim, CPU/bellek, I/O/disk/journal ölçümü → karşılaştırılabilir kanıt. | G1/G456/G24 render/a11y scoped reuse; TalkBack, iOS EN/DE Bağlantılar/kurtarma ve gerekli erişilebilir gezinme kanıtı eksik. Performans için mevcut ölçer+aynı fixture baseline; eşik yoksa ölçüm ve fark kaydedilir, bütçe PASS uydurulmaz. Fiziksel pil/ısıl ve üretim OS ölçümü ayrı. |
| P3-12 | Birleştirilmiş normal/recovery/hata akışı → kesintide/stale ownership'te fail-closed; doğru ACL/retain, tek işlem, kalıcı sonuç. | §20 host/`cloud18-*`, recovery, DAV çok hedef, sunucu uyuşmazlığında iptal ve etkilenen native çağıranları eşle; H15/P15 23/23 giriş reuse, tam Android/iOS runtime sayma. Tarihî iOS dev-reload `candidate_stale` üretim kök nedeni değildir; ayrı sınıflandır. |

### Tek koşu sırası (onaydan sonra)

1. Snapshot/iş alanı ve önkoşullar: workspace paketleri/lock ve yerel binary'ler;
   renderer stamp+Playwright/Chromium; iOS fixture `.app`/identity/hash, Xcode/runtime/
   Ruby/Pods; Android SDK/NDK/JDK, ön-üretilmiş Gradle projesi, disk, owned AVD;
   yerel servis/CA, medya, eski APK ve hesap iznini yalnız bağımlı satır için kontrol et.
   `check`/`list`, sonra P3-00 **tek** temsilci. Artefakt kaybında önce mevcut
   doğrulanmış olanı bul, başarılı davranışı sırf eksik kopya nedeniyle tekrar etme.
2. P3-10 capture-only delta'sında önce M13-alt TR/light/normal: dar capture
   tsc/lint, etkilenen Python kontrolleri ve tek doğrulanmış alt durum. Mevcut
   capability sınırında üretilemeyen diğer hücreler açık kalır. Bağımsız F1
   yolunda dar compile ve P3-04 FL1, ardından ayrı R2 clean; RED varyantı
   önce derlenebilir olmalı.
   Native build genişletmeden önce ilgili arm64/Simulator çıktısının kimliğini kanıtla.
   Sonra yalnız eksik veya etkilenmiş JS/host/native/lint paketleri (P3-01/02/04/05/06/12).
3. Doğrulanmış preflight/temsilciden sonra P3-03/07–09 izole işlevler ve P3-10/11
   görsel/a11y/ölçüm matrisi. Aynı cihaz/Metro/build dir için tek koşu;
   başarısız önkoşul yalnız bağımlı satırları durdurur. Hesap/medya ayrı izin;
   bölümler ayrı kullanıcı görevi veya onay değildir.
4. Tek manifest: `REUSE`, `FRESH PASS`, `FAIL-PRODUCT`, `FAIL-TEST/FIXTURE`,
   `BLOCKED-ENV`, `DECISION`, `DEFERRED` (yalnız onaylı) ve `NOT_RUN` ayrı.
   İlk beklenmeyen hata: kaynak/varyant, komut/gerçek exit, ilk ilgili hata ve
   beklenen/gerçek olay, log/artifact ve komşu etkisi. Sonuç ve cleanup ayrı.
   Sonnet run/kanıt sahibi, GPT bağımsız review; zorunlu açık varken checkbox açık.

**Hata kapsamı:** Ürün bulgusunda invariant/kök neden + mevcut en dar test/normal,
recovery, hata komşuları; ayrı yetkili scoped FIX olmadan edit yok. Fixture/test
bulgusunda ürün beklentisini değiştirme, ortam engelinde bağımlıları işaretle ve
bağımsız kalanları sürdür. Runner `RESTORE_PENDING`/3 ise aidiyet kanıtsız sinyal
yok; bağlı kaynak serbest kalmadan yeniden koşma. Bir sonraki adayda sadece etkilenen
satır/hücre; iki başarısız aynı yaklaşımda DECISION ve daha sade mekanizma.
§3 sayaçları korunur; UNKNOWN/15000 yeni onay kapısı değildir.

**Ayrı kapılar:** §21/Faz4 FO1 success→tek completion→UI'sız sonraki callback,
gerçek Android/iOS lock/unlock/Doze/reboot/force-stop/ilk unlock/CE/BG, fiziksel
Photos/iCloud/custody ve Desktop OS tray/signing/storage/saha; step19 Live Activity/
kilit ekranı ve iOS16, ADR0029 kararı; P5/production provider, gerçek Release B2,
notice paketlemesi ve dağıtım. Hiçbiri emülatör/build/render sonucu ile kapanmaz.
Yeni uygulama oturumu yalnız hazır ve onaylı Faz3 sözleşmesinden sonra, Sonnet 5.5
medium (kullanıcı kararı); mevcut aynı iş oturumu varsa reuse. Bu planda Haiku yazma görevi yok.

### Tek devir — 20.11

- **Önce P3-00:** P3-S0 (1601 girdi) eşleşti. Desktop TR/light/settings
  temsilcisi **REUSE**: güncel kaynak/renderer stamp'i, kayıtlı PNG hash'i,
  CLI confirmation ve `CLEANED` eşleşiyor. Sırf yeni kanıt üretmek için koşma;
  yalnız girdi değişirse yeniden değerlendir. iOS fixture app tree, kayıtlı
  dosya girdileri ve FIX-R4 smoke kimliği eşleşti; etkin Xcode/runtime ve
  recipe uyumu teyit edilirse fixture/temsilci reuse, otomatik rebuild yok.
  Bu fixture ürün binary'si değildir. Bu tur yalnız statik eşleme yapıldı.
- **Onaylı ama NOT_RUN:** P3-04 izole F1 start-compat/final; P3-10 dar capture
  genişletmesi; P3-06/08/12 izole DAV seti; P3-03 tek kullanımlık B1 probu.
  Bunlar yeniden onay istemez. B1, P3-02 ile eşleşen ürün binary'lerini bekler;
  Android eldeki APK eski, iOS'ta bulunan paketler fabrikaları içermiyor.
- **P3-07/08 Dropbox kapsamı ONAYLI (20.11):** Yalnız test amaçlı Dropbox
  hesabı ve sentetik dosya/fotoğraf. Hesap/hedef ve senaryo girdileri henüz
  doğrulanmadı; koşu NOT_RUN. Bu izin Nextcloud veya kişisel veriyi kapsamaz.
- **P3-08 Nextcloud kapsamı ayrıca ONAYLI (20.11):** [İzole loopback fixture ve
  tek sentetik Files restore](faz3-research.md#2011--p3-08-nextcloud-için-dar-kapsam).
  Sertifika/servis NOT_RUN. **Android ürün restore: BLOCKED-ENV.** Salt okunur
  incelemede onaylı güven yolu bulunmadı: ürün Debug APK'sında test CA'sı veya
  özel ağ güven yapılandırması yok; CA yalnız `androidTest` paketinde. Test
  paketi ürün PASS'i sayılmaz; kapsam ve bağımsız satırlar değişmez.
- **P3-07/08 salt okunur sonuç:** Doğrudan yayın ve elle JobService tetikleme
  otomatik teslim kanıtı değil. Android sentetik büyük dosya örneği var,
  iOS >150 MiB dosya/hash çifti doğrulanmadı. Dropbox Photos fişi/boş hedef
  doğrulanmadı; Nextcloud giriş/kuyruk araçları ekli hedef restore'unu
  kanıtlamıyor ve yerel sunucu sertifika seti yok.
- **Hâlâ açık koşu girdileri:** P3-07/08 sahipli Dropbox hedefi ve sentetik
  senaryo girdileri, Nextcloud hedef/fiş ve güven zinciri; P3-09 eski
  Android APK'nın kimlik/imza/kurulu durum kanıtı ve sahipli recovery profili;
  P3-10/11 kalan Desktop/Android hücreleri, erişilebilirlik ve ölçüm yolu.
  Bilinen TS2882 ve tam Android lint bulguları P3-01/05'te açık; PASS veya
  araç kurulumu varsayma. Ayrıntı [önkoşul tablosunda](faz3-research.md#kalan-yürütme-önkoşulları).
- **Yalnız önceki kapsamda REUSE:** P3-07/08 Dropbox Files hash/readback;
  P3-09 migration/recovery bileşenleri; P3-10/11 kayıtlı görseller ve
  staging/hash maliyeti. Bunlar otomatik teslim, >150 MiB, Photos/ekli
  Nextcloud restore, Android kurulu yükseltmesi, göster/kopyala veya tam
  görsel/a11y/performance PASS'i değildir.
- Tam matris hazır değil. Bir dalın engeli bağımsız satırları bloke etmez;
  kabul satırları ayrı kullanıcı görevleri değildir. Faz4/step19/release
  kapıları yerinde. Bu devir onaylı kapsamı genişletmez.

**İlk koşu sırası — yalnız ayrı başlatma talimatından sonra:**

1. **P3-00:** Sabit adayı ve sahipli hedefleri doğrula. Eşleşen Desktop
   temsilcisini reuse et; iOS fixture'ını Xcode/runtime ve recipe uyumu
   teyit edilirse reuse et.
2. **İlk dar yollar:** P3-04 izole start-compat'te önce FL1, sonra ayrı R2
   clean; ardından değişmemiş final lifecycle/lock ve dar lint. Bağımsız
   P3-10 görsel kolunda önce M13-alt TR/light/normal.
3. **Eksik/etkilenen kapsam:** JS/native build, test, lint ve paket
   kontrollerini kanıt farkına göre genişlet. P3-03 B1 yalnız adayla eşleşen
   P3-02 ürün çıktılarıyla; B1 için ayrı build veya fixture yok.
4. **Önkoşulu sağlanan dallar:** İzole DAV, Dropbox, iOS Nextcloud ve kalan
   görsel/a11y/performance kontrolleri kendi hazır girdileriyle ilerler.
   Android P3-08 **BLOCKED-ENV** kalır; açık satırlar tek manifestte,
   Faz4 ve release kapıları ayrı kalır.

**20.11 P3-00 başlangıç checkpoint'i (GPT, salt okunur):** P3-S0 1601 girdi
ve sabit SHA256 yeniden eşleşti. Desktop temsilcisi REUSE. iOS için kayıtlı
recipe ve etkin Xcode 27.2/27B52 eşleşti; iOS 26.5 runtime paketi diskte.
Hedefin kullanılabilirliği/aidiyeti ve runner preflight ana uygulayıcıda;
build/fixture üretimi/capture/regresyon bu GPT sohbetinde başlatılmadı.
Android P3-08 BLOCKED-ENV; yalnız bağımsız onaylı dallar.
