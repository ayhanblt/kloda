# F1-FTPS — güncel bağımsız review işaretçisi

**Son review kararı: R1/R2 ikinci bütün-invariant reddi; ürün kabulü yok.**
Sonraki dar tasarım kullanıcı onaylandı: CURRENT **FIX**, mevcut Opus `/implement` devri
MANIFEST §Onaylı scoped FIX devri'nde. Uygulama otomatik başlatılmadı; sayaçlar korunur.
FIX review: [fix-r1r2/review.md](fix-r1r2/review.md). R3 dar lint kanıtı kabul;
üç mevcut kapsam dışı lint error'u genel regresyon kapısında açık izlenir.
FTPS ve üst F1 geliştirme checkbox'ları açık; FO1 ertelemesi/S3 kabulü korunur.
Onaylı sözleşmenin uygulama sonucu aynı GPT review sohbetinde değerlendirilecek.

---

# İlk toplu review — tarihî kayıt, 16.11.2026

Aşağıdaki ilk FIX yönlendirmesi güncel değildir; son karar yukarıdaki FIX review'undadır.

## Karar / kimlik / kapsam

**REJECTED / scoped FIX gerekli.** F1-FTPS ve üst 1.4b/F1 geliştirme checkbox'ları açık.
Tek goal ve kabul tablosu `plans/next-plan.md` §1–6'dır; yeni goal eklenmedi.
FO1 kullanıcı ertelemesi blocker değildir; S3 scoped kabulü yeniden açılmadı.

- Gerçek reviewer: **GPT-6.1 Sol, `openai/gpt-6.1-sol`**, OpenCode mevcut GPT review sohbeti.
  Bu sohbette ürün uygulaması yapılmadı; Opus uygulama devri MANIFEST §Review devri'nden alındı.
  Mevcut/Opus sohbetlerinin opaque session ID'leri araç bağlamında yok; uydurulmadı.
  Bu karar bağımsız kaynak review reddidir, implementer self-review kabulü değildir.
- Start ve review HEAD: `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; staged boş.
- Tracked ürün: `AndroidFtpsScheduler.kt`, `AndroidFtpsJob.kt`, `AndroidFtpsQueue.kt`.
  Başlangıç `.start` kopyalarının HEAD'e eşitliği taze doğrulandı; HEAD→working-tree
  diff'i bu üç dosyada işe aittir. Runner'ın FTPS allowlist/delegasyonu incelendi.
- Untracked ürün testi: `AndroidFtpsAutomaticChecks.kt`, `AndroidFtpsLifecycleChecks.kt`,
  `AndroidFtpsPolicyChecks.kt` bütünü okundu. `AndroidFtpsOsChecks.kt` değişmemiştir.
  K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
  T = aynı modül `src/androidTest/java/com/kloda/sync/`.
- Dirty S3/AGENTS/commands/diğer planlar bu diff'e katılmadı. Salt-okunur komşular:
  Runtime lease, Schedule CAS, Profiles/Sources/custody, BackupScheduler.watch,
  receiver ve ilgili modül caller'ları. ADR0022 D1/practical ve B4 sınırları korundu;
  TLS/LAN/ABI/şema/secret bayrağı değişikliği görülmedi.
- Taze statik kontrol: `review-checks-2026-11-16.log` (HEAD, staged, baseline,
  sekiz final hash, scoped diff-check, log özetleri). Yeni runtime/build/lint **NOT_RUN**.
  Dış araştırma **NOT_NEEDED**: bulgular onaylı yerel sözleşme ile gerçek kod arasındaki
  farklardır; yeni Android API garantisi varsayılmadı. Graphify graph'ı bulunmadı;
  kurulum/yeniden haritalama yapılmadı.

## Tek konsolide engelleyici liste

### FTPS-R1 — HIGH — stale ownership / exact-E ve OS stop çiti eksik

**K/AndroidFtpsJob.kt:30–42,51–62,102,128;
K/AndroidFtpsScheduler.kt:24–25,55–67,190–206,217–224.**
Kabul: **FS1, FS2; FL1'in stop sırasında korunması**, plan §4.4–6/§4.7.
Yeni finding ID; mevcut FS1/FS2 invariantının kalan açığıdır, yeni ürün beklentisi değil.

Execution yalnız yerel map/lease cleanup'ında exact kimlikle kullanılıyor. Scheduler'a
`reportCurrent/defer/finished/changed/rewatch` için E değil token gidiyor; `complete`
ise kilit alınmadan okunmuş stopped/claimed boolean'larını alıyor. onStop/onDestroy
Scheduler arbiter'ına katılmıyor. Token eşitliği lifecycle yetkisi yerine geçiyor.

Somut kaynak olay dizileri (reviewer runtime repro **NOT_RUN**):

1. Kilitli A catch-report önünde bekler → gerçek OS stop A'yı map'ten silip retry ister
   → OS aynı envelope/token ile B'yi teslim eder → A geç `reportCurrent` ile B.error'u
   yazar. Benzer şekilde `defer` önünde duran A, B ile aynı P/token korunmuşsa B'nin
   due'sunu değiştirebilir. Eski captured-E emekli olmasına rağmen token guard geçer.
2. Kilitli A `finally:38` ile map'ten çıkar, henüz `complete` monitorünü alamamıştır
   → OS stop `:52` E bulamaz, **false** döner; A.stopped da işaretlenmez
   → A `complete(locked=true,stopped=false)` ile stop edilmiş params'a finish ister.
   Stop'un gerekli retry kararı kaybolur; P dururken sonraki OS wake garanti edilmez.
3. WATCH worker'ı stop/destroy sonrası pending token hâlâ aynıysa `changed/rewatch`
   çağrılarını yapabilir; bu yollar stopped/exact-E okumaz. Tek başına pending token
   emekli worker'a yeniden plan yazma/re-arm yetkisi vermemelidir.

Mevcut kanıt neden yeterli değil: T/LifecycleChecks:135–153 B için yeni token kurar;
aynı-token retry B karşıtı yok. FS2 `:173–194` A'yı catch-report'ta, hâlâ map'te
tutar; `finally remove → complete` stop penceresini sınamaz. Destroy testi de yeni
token B kurar. Bu PASS'ler korunur fakat tüm FS1/FS2 satırları kapanmaz.

Scoped FIX: önce bu event sequence'lerden üretim yolunda dar regression; E'nin
emekliliği, OS-stop kararı ve yan-etki yetkisini tek arbiter sözleşmesiyle bağla.
Map kaydını yetkili completion kararından önce kaybetme; token tek başına yeterli
olmasın. Start/stop params nesne eşitliği getirme; saved start params finish için
korunsun. Runtime endAutomatic/queue pause/worker wait monitor dışında; sourceLock
altındaki current okumasına ters kilit sırası eklenmesin. Aynı-token B ve finalization
penceresini, JOB/WATCH karşıtlarını mevcut sınır içinde doğrula.

### FTPS-R2 — HIGH — OS handoff / WATCH sonucu Boolean'a indirgenmiş

**K/AndroidFtpsScheduler.kt:58–60,205–215**;
komşu `AndroidBackupScheduler.kt:181–191`; T/LifecycleChecks:31–73.
Kabul: **FP2, FW1/FW2'nin WATCH yeniden gözlemi**, plan §4.7–8 ve onaylı
araştırma eki §OS sonuç protokolü:91–120. Yeni bulunan uygulama açığı; FP2/OS
handoff invariant ailesi sürer.

JOB dispatch rejected/unknown ayrımını tutarken WATCH `rewatch` yalnız Boolean
döndürür. Schedule throw ve pending read throw/null, ordinary FAILURE gibi false
olur; WATCH için unresolved kaydı/ayırt edilmiş recovery yoktur.

- Güncel A WATCH → replacement throw (sonuç belirsiz) → ilk pending okuma başarısız
  → `rewatch=false` → `complete` ikinci okumada eski token'ı görürse
  **finish(false)+cancel(WATCH)+reconcile** yapar. Sözleşme belirsizlikte ikinci
  schedule/cancel/finish'i yasaklıyor; yeni seri recovery bu old worker'dan gelemez.
- Kesin RESULT_FAILURE + eski WATCH hâlâ pending → aynı fallback, eski callback'i
  bitirip WATCH'ı iptal eder ve ortak helper ile yeniden schedule eder; §4.7–8'deki
  tek yetkili retry fallback'i değildir. Bu ek schedule `Os.schedule` portundan da
  geçmez; Recorder onu saymaz.
- Pending null kalırsa hata/blocked durumu kaydedilmez, `admits()` true kalır ve
  yeniden gözlem kanıtlanmadan worker çıkar. WATCH error dalı ayrıca JOB token'lı
  reportCurrent'a dayanır; WATCH için bu bir hata rapor çiti değildir.

Mevcut altı FP2 testi yalnız **JOB** `osFault` replacement'ını sınar; WATCH failure,
accepted-then-throw, null/read-failure ve reentrant stop karşıtları yoktur.
FW GREEN yalnız başarılı replacement/CAS yoludur. Bu yüzden FP2'nin tüm OS satırları
kanıtlanmış değildir. Reviewer yeni runtime iddiasında bulunmuyor.

Scoped FIX: mevcut WATCH sınırında explicit rejection / proven installation /
unknown ayrımını koru; exact-E emekliliğiyle birlikte tek completion kararı uygula.
Unknown'ı başarıya/fallback'e çevirme; ordinary recovery ve pause/disable revoke
korunsun. Regression önce WATCH fault yolunda, mevcut port/fixture ile; JOB'un
mevcut exact-new/exact-old/null/storage sonuçlarını ve FL1 backoff'unu koru.
İzinli dosyalar dışında ortak BackupScheduler'ı sessizce değiştirme.

### FTPS-R3 — MEDIUM — zorunlu doğrulama / lint kapısı tamamlanmamış

**plans/next-plan.md:160–167,171–173; MANIFEST.md:43,269–270.**
Kabul: §5 review-ready ve §6 bitti (FL1–FO1 ortak goal kapanışı).
Bu tarihî açık kapının devamıdır; yeni runtime hatası veya isteğe bağlı temizlik değil.

Plan açıkça eski lint blokajının çözülmüş/ertelenmiş sayılmadığını ve zorunlu eksikte
review-ready olunmadığını söylüyor. Devirde lint NOT_RUN; FO1 kararı yalnız FO1'i
erteler. `ktlint/detekt yok` Android lint kanıtı yerine geçmez: eski `lint-1.log` ve
`lint-2.log:263–273` gerçek Android lint'in `:react-native-worklets:lintAnalyzeDebug`
Kotlin standalone project crash'ini gösterir. FTPS kaynaklarına taze lint sonucu yok.

Üçüncü kör koşu yapılmadı/istenmiyor. Mevcut altyapı kök nedeni/dar doğrulama seçeneği
kanıtlanmalı; aynı başarısız komutu tekrarlama veya test/dev dependency ekleme yok.
Çözülemiyorsa yalnız bu lint kapısının açık erteleme kararı gerekir; reviewer kendisi
waive edemez. S3 scoped kabulünün eski lint kararı burada yeniden yargılanmıyor.

## Kabul/kanıt eşlemesi — bütün goal tek review

| Kabul ID / bütün alt satırlar | Yeniden kullanılan iş kanıtı | Review durumu |
|---|---|---|
| FL1 locked pre-admission | `fs-rest/run-green-1-ftps-automatic-lock.log` | Normal callback P/run/lease/backoff PASS reuse; stop/finalization karşıtı R1 açık |
| FL2 pending / absent / disabled | Aynı log, üç FL2 grup | PASS reuse; metadata-only wake sır/admission yerine kullanılmıyor |
| FL3 due single claim / future | Aynı log, iki FL3 grup | PASS reuse; replacement-as-completion beklentisi §4.7 ile uyumlu |
| FW1 locked WATCH | `fs-rest/run-fp1-3-lifecycle.log` | Normal replacement PASS reuse; OS fault karşıtı R2 açık |
| FW2 valid / capture fail / CAS / claimed | Aynı log, dört FW2 grup | PASS reuse; WATCH fault protocol R2 açık |
| FS1 finally / throw / locked / defer / WATCH / result / destroy | Aynı log, yedi FS1 grup | Yeni-token B PASS reuse; exact-E/same-token/stopped karşıtları R1 açık |
| FS2 gerçek platform stop / eski worker-service | Aynı log, bir FS2 grup | Parcel/platform stop normal pencere PASS reuse; finalization ve same-token B R1 açık |
| FP1 busy / retry-clock / old-wake busy-defer / pause / disable / revision | Aynı log, altı FP1 grup (+ FP2 null-pause) | Dar yollar PASS reuse; R1/R2 düzeltmesinden etkilenenler ayrıca seçilecek |
| FP2 storage / CAS / FAILURE / old-new-null throw | Aynı log, altı FP2 + FW2 CAS | JOB alt kapsam PASS reuse; WATCH/read-failure/reentrant lifecycle karşıtları R1/R2 açık |
| FO1 gerçek OS aktarımı/completion/sonraki JOB | `fo1-evidence-audit-2026-11-16.md` ve tarihî 03.11 PASS | Prior PASS reused; yeni success→tek completion→sonraki callback DEFERRED/NOT_RUN, §21/Faz4; blocker değil |
| İlgili build / typecheck | `fs-rest/build-7-fp1-retry.log`, önceki `build-1-green.log` | Kotlin compile + AndroidTest assembly PASS reuse; yeni build yok. JS/TS/iOS değişikliği yok, ilgisiz typecheck istenmedi |
| Kod standartları / dar lint | `lines-final-2.txt`, taze scoped diff-check | Sekiz dosya ≤300; whitespace temiz. Lint NOT_RUN, R3 açık |

Sekiz final kaynak hash'i taze OK. Scheduler/Job/Queue, lock GREEN hash'lerine de
eşit; lifecycle FP1 son logu 25 PASS ve instrumentation code -1; lock 7 PASS ve -1.
Hash eşleşmesi bu testlerin **kapsamadığı** interleaving'i PASS'e çevirmiyor.
APK hash'leri manifestten reuse: lock `45b145b4…`, lifecycle `0dbab472…`;
APK yeniden kurulmadı/çalıştırılmadı. Build, lint veya fiziksel kabul için taze PASS yok.

## Temizlik / sorumluluk / korunacak sınırlar

- İsteğe bağlı: Scheduler'daki kullanılmayan `journal` yerelleri ve Job'daki gereksiz
  yerel çıkarımlar temizlenebilir; tek başına kabul engeli veya ayrı review turu değil.
- Queue metadata wake dar ve sırsız; şema/alias/Keystore değişikliği yok. Test hooks
  grant üretmiyor. Runner delegasyonu eski ftps-product sıra/anlamını koruyor.
- Mevcut sekiz-dosya sınırı, ≤300 ve test sorumlulukları korunmalı; özellikle Lifecycle
  299/300. Yeni helper/fixture/dosya veya kapsam genişlemesi gerekiyorsa önce karar;
  satır sıkıştırma veya FL gövdelerini taşıma yoluyla sınırı aşma yok.
- S3 scoped kabul ve sayaçlar; SNAPSHOT-OPEN ayrı kapsam; gerçek lock→unlock/Doze,
  ilk unlock/CE/reboot/force-stop, signing/storage, P5 ve Faz3–4 kapıları açık kalır.

## Sayaç / tek FIX devri

İlk toplu review reddi; yeni review ID'leri eski deneme sayaçlarını sıfırlamaz.
FS1 JOB finally deneme 1 önceki dar PASS korunur; fs-rest FS1 WATCH/defer yaklaşımının
exact-E bütünlüğü bu review'da kabul edilmedi: **1 başarısız bütün-invariant kabulü**.
FS2 stop retry yaklaşımı **1 başarısız bütün-invariant kabulü**; FP2 Boolean WATCH/OS
handoff yaklaşımı **1 başarısız bütün-invariant kabulü**. Kontrollü yeni RED henüz yok;
bunlar runtime deneme sayısı değil review başarısızlığıdır. R3 lint iki tarihî başarısız
koşu korunur; üçüncü kör deneme yok. İki başarısız aynı yaklaşımda GPT DECISION gerekir.

**Mevcut Opus sohbeti: `/implement`.** R1–R2'yi birlikte tek scoped FIX olarak ele al:
kök neden doğrulama → mevcut üretim yolunda dar regression → minimum fix → etkilenen
callers/test/build kontrolleri. R3 için kör retry/waiver yok; çözülemeyen altyapı veya
tasarım çelişkisini açık DECISION ile aynı GPT review sohbetine getir. Kabul satırlarına
ayrı review açma. FO1 testi/fixture kurma yok, S3 düzeltme yok, commit/push yok.
Sonuç/kanıt devrini bu GPT review sohbetinde değerlendir; kayıt için yeni Opus oturumu açma.
