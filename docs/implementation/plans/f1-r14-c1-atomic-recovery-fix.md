# F1/S3 R14-C1 — atomik plan-proof recovery dar sözleşmesi

15.11.2026 · GPT · **ONAYLI / READY / FIX**.
Kullanıcı bu sohbette dar sözleşmeyi, internal test observer ve üç-dosya sınırı dahil
onayladı; ayrı Opus sohbetinde uygulama yetkilidir. Ürün/review kabulü değildir.
Dayanak: [review](../evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/r13-r14/review.md),
[manifest](../evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/r13-r14/MANIFEST.md).
HEAD `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; başlangıç ürün snapshot'ı tur `source-final.sha256`.

## 1. Aynı goal; yalnız kalan G14 açığı

Goal **F1-S3-R13R14** değişmez: eski lifecycle yeni projection yetkisini bozmaz;
kanıtlanmış clock commit yeniden tüketilmez. Yeni ürün hedefi/arbiter/mimari yok.
Önceki [sözleşme](f1-r13-r14-clock-reconcile-fix.md) §2 G13, §3 çözülmüş sequential
G14 ve eski R12 sınırları korunur. Bu belge yalnız R14-C1 atomik recovery devamıdır.

| Mevcut ID | Başlangıç → olay | Beklenen sonuç / kanıt |
|---|---|---|
| G14 | R committed+ack/read kaybı; M pause ile aynı-config context yenilenmiş; iki ordinary reconcile yarışır | R.due/wake/retry korunur; fresh context; toplam clock-CAS=1; tek recovery projection; aşağıdaki shared-path RED→GREEN |
| G13 | Eski lifecycle/sonuç yeni ticket'a yetişir | Review'da desteklenen kaynak davranışı ve kayıtlı throw/success/nonce/inflight kanıtı korunur; değişmeyen test yeniden koşulmaz |
| GP | Recovery değişikliği sonrası fence/cleanup/revoke/lease yolları | Unreadable/mismatch kapalı; rollback yeniden denenebilir; migration ve gerçek NoFence disarm korunur; mevcut etkilenen plan karşıtları |

**Bitti:** mevcut G13/G14/GP manifesti bu regression ve bağımsız GPT review ile tamamlanır.
Scoped goal kabulü üst 1.4b/FTPS/fiziksel/production kabulü değildir; hiçbir checkbox şimdi kapanmaz.
**Non-goals:** reconcile'ın tümünü seri hale getirme, yeni executor/lock, kalıcı proof/intent,
Queue/Runtime/facade/receiver değişikliği; yeni guard/liveness/ürün beklentisi yok.

## 2. Kesin dosya ve kritik bölge sınırı

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.
Ürün: yalnız K/AndroidS3AutomaticCoordinator.kt `unblock()` ve instance-bound test observer'ı.
Test: T/AndroidS3AutomaticPlanChecks.kt regression; T/AndroidAutomaticLockChecks.kt mevcut
S3TestBoundary/S3AutoFixture içinde yalnız gerekli bariyer/sayaç desteği. Plan.kt salt-okunur;
OsChecks, facade, Queue, Runtime ve diğer ürünler değişmez. Yeni kaynak/helper/schema/dependency yok.
Her dosya ≤300 nonblank/noncomment; aşılırsa genişleme izni iste, başka dosyaya taşıma.

**Tek kritik bölge:** `unblock()` plan-proof dalı, mevcut `sourceLock` üzerinde:
1. Monitor alındıktan SONRA `blocked` ve `blockedAttempt` tekrar okunur.
   `!blocked` ise true dön; daha önce okunmuş blocked snapshot'ı NoFence recovery yetkisi değildir.
2. Plan-proof dalında `settle(legacy)` çağrısı ve sonucu aynı monitor kapsamındadır.
3. ClockCommitted yalnız güncel exact Clock request/epoch/old-new pair'e bağlanır;
   ClockRolledBack committed bağlamaz. NoFence/MigrationSettled mevcut disarm kuralını korur.
4. Başarıda blocked/blockedAttempt temizliği ve STORAGE_BLOCKED→IDLE aynı monitor içinde;
   ardından monitor bırakılır. Binding/temizlikten önce başka çağrı NoFence/disarm'a giremez.
5. Exception'da mevcut başarısız sonuç/fence davranışı korunur; erken başarı temizliği yok.

Sınır `settle` ÖNCESİ durum kontrolünde başlar, binding ve başarı temizliği SONRASI biter.
Plan'ın reentrant mevcut DB/sourceLock kullanımı değişmez. Admission-attempt (`blockedAttempt!=null`)
recovery algoritması değiştirilmez; bu dal yanlışlıkla plan.settle/disarm'a yönlendirilmez ve
çözüm sonucu temizliği mevcut kimliğe uygulanır. Yeni queue-resolution politikası eklenmez.
**Dışarıda:** `queue.authority()`/source-profile-vault capture, reconcile migrate/arm/revise
akışının geri kalanı ve bütün OS schedule/pending/cancel/finish çağrıları. Tüm reconcile'ı
monitor içine alma; yeni global senkronizasyon/OS-altında-kilit yok.

## 3. İki gerçek reconcile ile deterministik regression

Mevcut isolated SQLite + Queue + Coordinator + FakeOs kullan; private unblock'ı doğrudan
çağırma, ayrı model/simülasyon yazma. Önkoşullar mevcut `committed(commit)` temsilcisidir:
M önce manual çalışır; explicit clock R commit'i after-commit ack loss + read-deny ile fence
olur; M exact pause context'i yeniler; zaman ilerler; read-deny kalkar. Request aynı epoch'tadır.
R'nin tam snapshot'ı, run/accept ve schedule sayıları recovery'den ÖNCE kaydedilir.

**Tek dar seam:** Coordinator içinde varsayılan null, internal, instance-bound
`afterPlanSettleForTest: ((S3Settle) -> Unit)?` observer; settle dönüşünden hemen sonra,
binding/cleanup'tan önce çağrılır. Production null kalır; yeni JS/JNI/native ABI yok.
Test ataması worker thread'ler başlamadan, temizleme ikisi join olduktan sonra yapılır.
Observer karar/sonuç değiştirmez; test dışında bekleme yok. Baseline'a yalnız bu seam +
regression eklenir; atomik fix henüz yokken temsilci invariant RED kanıtı alınır.

1. T1 gerçek `c.reconcile()` çalıştırır. Observer yalnız T1'in ClockCommitted sonucunda
   `Thread.holdsLock(sourceLock)` bilgisini kaydeder, `settled` latch'ini açar ve `release`
   latch'inde bekler. T2'nin NoFence çağrısını aynı bariyerde durdurma.
2. Driver `settled` sonrası T2'de AYNI coordinator'a ikinci gerçek `c.reconcile()` başlatır.
   T1 monitörü tutmuyorsa (RED baseline) T2'nin tamamlanmasını bekler; tutuyorsa (fix)
   T2'nin sourceLock girişinde BLOCKED olduğunu, stack'te `unblock` girişini doğrular.
   İkinci durumu tamamlanma timeout'u ile tahmin etme. Bounded state observation/yield
   yalnız bariyere ulaşmayı denetler; sleep veya yarışın tesadüfen oluşmasını bekleme yok.
3. Driver T1'i bırakır, iki thread'i bounded join eder; worker exception'larını driver'a
   taşır; sonra main-lane kuyruğunu pompalar. finally release/join/observer cleanup zorunlu.
   Fixed sürümde T2'nin monitörde beklemesi beklenen davranıştır, deadlock değildir.
4. Beklenti iki sürümde de AYNI: R.wake/due/retry korunur, fresh M context, request
   tüketilmiş/fence açık, yalnız bir recovery schedule, ek run/accept/lease/finish/cancel yok.
   RED baseline T2'nin NoFence→disarm→arm yoluyla wake'i rotate ettiğini bu invariant'ta
   göstermeli; timeout/compile/yalnız holdsLock assertion'ı RED sayılmaz.
5. Clock-CAS sayısını due'dan türetilmiş `cas=1/2` etiketiyle raporlama. Instance-bound
   S3TestBoundary.commit sayacı gerçek Plan.clock çağrı fazını gözlemlesin (test stack'inde
   AndroidS3AutomaticPlan.clock frame'iyle ayrılabilir); setup'ta R için bir, recovery'de
   sıfır ek clock transaction. Observer transaction çalıştırmaz/sonuç değiştirmez.

Kontrol akışının holdsLock'a göre ayrımı yalnız interleaving'i seçer; ürün beklentisini
baseline davranışından türetmez. İlk hata expected/actual wake/due/context/counter'ı sırsız versin.

## 4. Dar yürütme ve onay

Önce yeni başlangıç HEAD/status/staged + izinli kaynak snapshot/hash/diff kaydı; birikmiş
G13/sequential G14 diff'ini bu fix diye yeniden sahiplenme. Alt evidence ve manifest bağlantısı kullan.
İlk aşama yalnız yukarıdaki tek temsilci RED → minimum atomic fix → GREEN + ilgili dar
`s3-automatic-plan` koşusu; existing runner'ı genişletmeden kullan. Başarılı eski lock/os
kontrollerini yeniden başlatma. Test desteği fixture davranışını etkilerse yalnız o etkiyi doğrula.
[execution-budget.md](../execution-budget.md): güvenilir usage yoksa UNKNOWN; temsilci GREEN
sonunda genişletmeden kullanıcı yanıtını bekle. F1 Opus, pilot değil; model/effort değişmez.
Sonraki izinli kapsam yalnız etkilenen mevcut rollback/unreadable/mismatch/config/revoke ve
migration/NoFence plan kontrolleri; ilk dar runner koşusunda geçenler yeniden koşulmaz.
Tam matris yok. Kanıt taze/reused ayrımıyla manifestte G14/GP'ye bağlanır.
Sayaçlar early=1, stale=2 tarihî tur, clock-stop=1, migration=1, clock-proof=2 reddedilen tur;
reset yok. Yeni atomik yaklaşım henüz denenmedi. Yeni başarısızlıkta iki-deneme/DECISION kuralı korunur.
Lint iki-deneme NOT_RUN; fiziksel/Doze/doğal teslim, CE/reboot/force-stop/signing/storage,
RAM intent/geri saat sınırlaması, FTPS/Faz3–4/B4/P5 açık. Commit/push yok.
CURRENT=FIX; ayrı Opus `/implement`; implementer REVIEW bırakır, checkbox kapatmaz.
**Onay kaydı:** kullanıcı “sözleşmeyi onaylıyorum oluştur ve opus sohbeti için kayıtları oluştur”
dedi. Kritik bölüm ve internal observer dahil yalnız yukarıdaki üç-dosyalık dar kapsam onaylıdır.
**Opus başlangıcı:** CURRENT → son review R14-C1/DECISION → mevcut tur manifesti → bu sözleşme;
ilk planı yeniden uygulama. Yeni fix evidence'ını mevcut tur altında `r14-c1/` dizininde oluştur;
başlangıç snapshot/diff'ini uygulamadan önce al, G13/G14/GP'yi mevcut manifestten bağla.
