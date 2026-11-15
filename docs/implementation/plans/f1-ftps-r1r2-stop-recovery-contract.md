# F1-FTPS R1/R2 — tek dar çözüm sözleşmesi

16.11.2026 · GPT tasarım değerlendirmesi tamam · **KULLANICI ONAYLI / SCOPED FIX READY**.
Kullanıcı CURRENT'ın FIX'e geçirilmesini ve mevcut Opus devrini onayladı;
uygulama otomatik başlatılmayacak. Onay, ürün/review kabulü veya sayaç sıfırlama değildir.
Ana sözleşme [next-plan §1–6](next-plan.md); aynı goal/bitti ve FL1–FO1 ID'leri geçerli.
Bu belge yalnız R1/R2 mekanizmasını kesinleştirir; ikinci bir goal/kabul tablosu üretmez.
Dayanak: [son review](../evidence/f1-ftps-automatic-lock-2026-11-15/fix-r1r2/review.md),
[araştırma](../evidence/f1-ftps-automatic-lock-2026-11-15/fix-r1r2/design-research.md).
HEAD `f26e425`; ürün başlangıcı `fix-r1r2/source-final.sha256`. Uygulama öncesi yeniden baseline alınır.

## 1. Seçilen çözüm / sınır

- **R1:** worker yan-etki yetkisi ile geç OS stop cevabı ayrı ömürlerdir. Completion
  kararı worker yetkisini kapatır; OS stop/retry bilgisini hemen silmez. `jobFinished`
  void dönüşü, zaman aşımı veya pending yokluğu terminal acknowledgment sayılmaz.
- **R2:** FTPS WATCH initial install / replace / ordinary recovery aynı sınıflandırılmış
  OS-result yolunu kullanır. Shared `AndroidBackupScheduler.watch` FTPS'te bypass edilir;
  ortak helper değiştirilmez, mevcut URI/flag anlamı FTPS içinde aynen korunur.
- K/AndroidFtpsJob.kt: Execution/live, onStart/onStop/onDestroy, execute prepare/claim, catch/finally.
  K/AndroidFtpsScheduler.kt: complete/reportCurrent/changed/defer/finished; WATCH build,
  dispatch/resolve/reconcile ve Os portu. Queue/Runtime/Schedule/Vault/receiver salt-okunur.
- T/AutomaticChecks: mevcut Recorder; T/PolicyChecks: bu dar R1/R2 regresyonlarının
  mevcut yerleşimi korunur; T/LifecycleChecks: yalnız gereken helper erişimi/barrier uyumu.
  Ana planın Policy için eski FP1-only yerleşiminin bu FIX'teki istisnası budur;
  ürün kapsamı büyümez. Başka kaynak/helper/fixture dosyası veya dependency yok.
- Sekiz-kaynak sınırı ve her dosya ≤300 korunur; sığmıyorsa sıkıştırma/izinsiz yeni dosya
  yerine kapsam kararı gerekir. TLS/LAN/şema/kalıcılık/ABI/JS/iOS/Rust ve S3 kapsam dışı.

## 2. R1 — kayıt ve yetki modeli (FL1 / FS1 / FS2)

E = service instance + lane + saved start params + envelope + benzersiz yerel kimlik.
Her service/lane için **en fazla bir E slotu**; slot terminal stop bilgisi de taşıyabilir.
`RUNNING`: yalnız map[lane]===E, phase RUNNING ve güncel D/config guard'ı worker'a yetki verir.
`COMPLETING`: worker yetkisi kapalı, tek completion kararı sürüyor; stop yükümlülüğü kayıtlı.
`RETAINED`: worker/lease yok; yalnız bu E'nin olası geç stop cevabı korunuyor.
`STOPPED/REVOKED`: worker yetkisi yok; eski closure yalnız exact-E cleanup yapabilir.
Bu fazlar RAM'dir; yeni DB/prefs/reboot garantisi veya terminal-ack API'si yok.

Scheduler monitorü E fazı/slot, D sahipliği, stop kararı ve kısa mutation/OS kararının
ortak arbiter'ıdır; **onStart/onStop/onDestroy da bu karar sınırına katılır**.
Stop sadece lock-free map.remove ile yarış seçmez. SourceLock altındaki lease/current
okuması monitor ALMAZ; volatile/immutable E yetki snapshot'ını okur. Lock sırası değişmez.
Capture/hazırlık uzun lifecycle kritik bölgesi değildir; commit öncesi current E/D,
source/header revision ve expected P yeniden doğrulanır. Monitor altında worker/main
callback bekleme veya Runtime begin/end/queue.pause yapılmaz; cleanup karar sonrası dışarıdadır.
`execute` plan/run claim'i de aynı **monitor→sourceLock** commit sınırından geçer;
sourceLock tutulurken monitor istenmez. Ön hazırlıkta alınmış header/source binding,
commit'te `journal.context()` ve güncel source/config revision ile eşlenir; metadata
capture yerine grant olmaz, mevcut taze credential/source admission reddi korunur.
E.claimed ve P.run kararı aynı kritik bölgede yayımlanır; stop eski claim bilgisini okumaz.

Completion önce E'yi COMPLETING yapar ve **stop disposition** yayımlar: kabul öncesi
locked/rejected kendi JOB için RETRY, kesin replacement/revoke için NO_RETRY;
WATCH rejected için kendi backoff RETRY; UNKNOWN için HOLD (ikinci retry/finish yok).
OS sonucu disposition'ı aynı arbiter turunda kesinleştirir. RUNNING'den sonra eski
worker report/defer/finished/changed/rewatch yapamaz; completion kararı ayrı, tek sahipli yoldur.

| Mevcut kabul / olay | Slot ve sonuç | Temizlik sınırı |
|---|---|---|
| FL1/FS2: E RUNNING iken exact OS stop | Worker kapanır; pre-admission current JOB retry=true, WATCH normal stop=false; claim edilmiş yolun kayıtlı-run recovery politikası korunur | Cevap/cleanup yükümlülüğü alınır; yalnız aynı E slotu çıkarılır; Runtime cleanup dışarıda |
| FL1/FS2: E COMPLETING/RETAINED iken stop | Yayımlanmış RETRY hâlâ güncel ve successor yoksa true; installed successor/revoke/HOLD ise false; finish yeniden çağrılmaz | Aynı E'nin stop cevabı tüketildikten sonra slot çıkarılır; B slotu asla silinmez |
| FL1/FS2: finish çağrıldı, henüz stop yok | E RETAINED kalır; eski worker'ın yetkisi geri açılmaz | finish dönüşü/elapsed süre/pending null nedeniyle silinmez |
| FS1/FS2: yeni geçerli delivery B | Eski E worker-closed ise terminal slot atomik olarak B ile değiştirilir; aynı token olsa da farklı E | Eski terminal bilgi B teslimiyle emekli olur; A closure B'yi token'dan bulamaz |
| FS2: hâlâ RUNNING/COMPLETING A varken duplicate start | İkinci aktif E kabul edilmez; A slotu/stop bilgisi ezilmez | Retained retry delivery ile aktif duplicate karıştırılmaz |
| FS1: başka D'nin **kanıtlı** installation'ı / explicit revoke | Eski E yetkisi ve stop retry yükümlülüğü kapanır; B korunur | Yalnız o E çıkarılır; proposed token yazımı veya UNKNOWN tek başına installation değildir |
| FS1: onDestroy | Bu service'in E'leri kapanır; cleanup listesi çıkarılır | Service slotları temizlenir; Runtime cleanup dışarıda; başka service B etkilenmez |

Stop start/stop params nesne eşitliği aramaz; service+lane+envelope ile kendi slotunu
eşler. Aynı-envelope yeni delivery'nin OS lifecycle sırası ve captured-E worker ayrımı
korunur. Eski service'in stop'u yeni service slotuna yönlendirilmez.
RETAINED sınırsız arşiv değildir: slot başına tek kayıt; timer/poll/kalıcı tombstone yok.
Claim edilmiş stop'un mevcut retry budget/run-result recovery davranışı değiştirilmez:
gerekli recovery yalnız **güncel D'ye ait ayrı tek karar** olabilir; eski worker finally'si
ordinary reconcile başlatamaz. B kurulmuşsa eski recovery kararı no-op'tur.
Bu karar stop sırasında exact D/yerel generation ile ayrılmış tek recovery ticket'ıdır;
Runtime cleanup dışarıda tamamlandıktan sonra asenkron işlenir. Commit/OS öncesi aynı
D/generation ve taze guard'lar tekrar aranır; yeni attempt/revoke/B ticket'ı hükümsüz
kılar. Token eşitliği tek başına yetmez; ticket worker E'yi yeniden live yapmaz.
Main-thread'e taşıma tek başına çözüm sayılmaz; retained stop yükümlülüğü yine gereklidir.

## 3. R2 — tek WATCH sonuç/recovery protokolü (FP2 / FW / FS1)

Her kurulumdan **önce** RAM attempt kaydı: exact origin (callback varsa E), eski D veya
ABSENT, önerilen D (yeni token+service+URI/flags), current attempt kimliği. Aynı lane'de
tek karar vardır; replacement ve ordinary recovery aynı fonksiyon/Os.schedule yolundadır.
Os.pending sınırı mevcut portta dar okuma enjeksiyonuna açılabilir; üretimde doğrudan OS.
JOB dispatch yeni tasarım goal'u değildir; mevcut token restore/envelope ve hata politikası korunur.

| OS/proof sonucu | D/error/admission | Callback / sonraki işlem |
|---|---|---|
| RESULT_SUCCESS veya throw sonrası exact proposed pending | INSTALLED; proposed current; yalnız aynı attempt'in belirsizliği kalkar | Kendi callback'i replacement ile tamam; ek finish/cancel yok |
| RESULT_FAILURE veya throw sonrası exact previous pending | REJECTED; previous korunur, automatic_unavailable; başarı raporu yok | Hâlâ yetkili E varsa tek finish(true) + retained stop bilgisi; callback yoksa finish yok, yeni kör schedule/cancel yok |
| Throw + null/foreign/unreadable pending | UNKNOWN; current attempt retained, outcome_unknown; automatic admission kapalı | İkinci finish/retry/cancel/schedule yok; yalnız exact-E cleanup |
| Önkoşul/read/storage hatası, schedule'a henüz girilmemiş | OS rejection/credential_locked gibi gösterilmez; özgün sırsız hata, fail-closed | Yeni grant yok; başka owner'a cleanup yok; pending okunamaması yokluk değildir |

Proof token tek başına değil: WATCH service+token+URI/flags; JOB mevcut tam envelope.
UNKNOWN generic exception catch→cancel'e düşmez; typed sonuç tüketilir ve başarıyla
`report(null)` edilmez. Başka lane'in başarısı error/blocked kaydını temizleyemez.
Yeni ordinary recovery'de önce taze pause/opt-in/profile/source guard'ları, sonra aşağıdaki
proof kararı alınır; capture başarısızsa recovery yetkisi türetilmez. Explicit pause/disable
revoke, kendi yetkisiyle unresolved dahil iptal edebilir; UNKNOWN tek başına revoke değildir.

| UNKNOWN sonrası ordinary reconcile | Kesin sonuç / attempt temizliği |
|---|---|
| Exact proposed pending veya eşleşen native start/delivery kanıtı | INSTALLED; aynı attempt kapanır, ikinci projection kurulmaz |
| Exact previous; eski callback hâlâ worker/completion sahibi | Eski E'ye REJECTED fallback kararı yayımlanır; ordinary yol finish etmez veya ikinci kurulum yapmaz; E tek kararı tüketir |
| Exact previous; eski callback artık worker-closed | Taze guard'larla **tek** replacement attempt'i; önceki pending kör cancel edilmez; yeni sonuç aynı protokolden geçer |
| Kesin null; o D'ye ait start/admitted run/lease/aktif karar yok | Eski attempt atomik olarak yeni attempt'e devredilir; tek kurulum aynı protokolden geçer |
| Null ama ilgili callback/teslim/lease var, foreign veya read-fail | BLOCKED; proof gelmeden reproject/cleanup yok; sonraki ordinary tur beklenir, busy-loop kurulmaz |

`resolve` yalnız okuma yapıp unresolved'u erkenden silmez. Attempt değişimi/temizliği
exact kimlik CAS'ıyla aynı arbiter kararındadır; geç A sonucu yeni B'yi clear edemez.
Yeni attempt de throw/null olursa yeni UNKNOWN kalır; global clear/cancel yok.
Recovery'de callback yoksa hiçbir sonuç `jobFinished` üretemez. R1 stop receipt'i
yalnız E lifecycle'ını kapatır; UNKNOWN D kaydını veya başka E'yi temizlemez.

## 4. Dar kanıt / bitti / devir

Önce yalnız **FL1/FS2 R1 temsilcisi**: locked due A'da completion kararı sonrası,
finish'in OS'a tesliminden önce barrier → gerçek stop → aynı P/token için retry korunur,
run/attempt/lease yok; geç finish stop kararının yerine sayılmaz. Test monitorünü tutup
OS main stop'un bitmesini bekleyerek deadlock yaratma; barrier asenkron bırakılır.
Sonra ters sıra (finish önce), RETAINED temizliğinin stop/new-delivery/revoke/destroy
karşıtları ve **gerçek aynı-token B Execution**: A'nın geç report/defer/cleanup'ı B'ye dokunmaz.
R2 temsilci: UNKNOWN null/old → ordinary recovery schedule'ında accepted-then-throw;
fault portu recovery öncesi kaldırılmaz. Ardından rejected / kanıtsız throw / read-fail,
callback-yok finish=0, exact-new delivery ve yabancı owner karşıtları aynı sözleşmeye eşlenir.
İlk RED→minimum fix→GREEN sonrası yalnız etkilenen yollar; eski 7/32 sonuçlarını sırf yeni
oturum diye tekrarlama. Ortak production/helper değişirse etkilenen scope yeniden seçilir.
Kotlin compile/AndroidTest build, ilgili dar lint ve ≤300/diff-check kanıtları gerekir;
R3 mevcut scoped kabul değişmeyen kaynakta reuse, üç dış-kapsam lint teşhisi açık kalır.
Tek manifest ID→kanıt/fresh/reuse/deferred eşlemesini ve R1/R2 **2 ret** sayaçlarını korur.
Yeni yaklaşım eski sayacı sıfırlamaz; başarısızlıkta aynı GPT'de yeniden DECISION.
FO1 yeniden test/fixture yok; success-chain §21/Faz4 DEFERRED; S3/fiziksel/release kapıları açık.
Goal ancak bu sözleşme + ana tablo zorunlu satırları kanıtlı ve bağımsız GPT review kabulünde
kapanır. Bu belge test veya ürün PASS'i değildir. **Mevcut Opus sohbetinde kullanıcı `/implement`
ile başlatır; GPT burada uygulama/ajan başlatmaz.**
