# F1/S3 R13–R14 — scoped FIX tasarım sözleşmesi

12.11.2026 · GPT tasarım netleştirme · **READY / FIX**; ürün/test kabulü değildir.
Başlangıç referansı HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`.
Dayanak: [son review](../evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/review.md),
[tur manifesti](../evidence/f1-s3-automatic-lock-2026-11-11/fix-r12/clock-reconcile/MANIFEST.md).
Bu belge [onaylı sözleşmenin](f1-r12-clock-reconcile-fix.md) yalnız R13/R14 devamıdır;
ilk uygulamayı yeniden başlatmaz. Kök neden/tasarım kapısı bu belgeyle tamamlandı.

## 1. Sınır ve doğrulanmış başlangıç

**Tek goal — F1-S3-R13R14:** eski lifecycle olayının yeni projection yetkisini
bozmamasını ve kanıtlanmış clock commit'in yeniden tüketilmemesini sağlamak.
Aşağıdaki tablo mevcut §2–§3 sözleşmesinin ortak indeksidir; yeni kapsam/karar
eklemez. Opus ve GPT review aynı ID'leri manifestte kanıta bağlar.

| ID | Başlangıç / olay | Beklenen sonuç | Kabul kanıtı |
|---|---|---|---|
| G13 | Eski unresolved A; yeni ticket kurulmuş; exact stop(A) | Yeni owner/ticket/fence değişmez; eski olay yeni OS yan etkisi üretmez | §2 ilk temsilci + etkilenen SUCCESS/nonce/current-stop karşıtları |
| G14 | Clock commit+ack loss; aynı config'te context refresh; recovery | Clock-CAS bir kez; committed due/wake/retry korunur; fresh context ve tek projection | §3 ilk temsilci + rollback/unreadable/mismatch/config karşıtları |
| GP | R13/R14 değişikliği sonrası ilgili komşu olaylar | R12 capture=0, lease/manual fence, revoke ve migration cleanup korunur | §2–§3'te belirtilen etkilenen negatif yollar |

**Bitti:** G13/G14/GP kanıtları + bağımsız GPT kabulü; test/build yapılmadan
karşılandı sayılmaz. Bütçe kontrol noktasında kısmi kalabilir, goal kapatılamaz.
**Kapsam dışı:** FTPS ve üst 1.4b'nin bütünü, fiziksel/production kabul; §1/§4
sınırları geçerli. Bu goal'un kapanması üst backlog maddesini tek başına kapatmaz.

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.
İzinli ürün: K/AndroidS3AutomaticCoordinator.kt ve K/AndroidS3AutomaticPlan.kt.
İzinli test: T/AndroidAutomaticLockChecks.kt, T/AndroidS3AutomaticPlanChecks.kt,
T/AndroidS3AutomaticOsChecks.kt; OS testi yalnız etkilendiğinde. Beş dosya üst sınır,
beşini de değiştirme zorunluluğu değil. Her biri ≤300 nonblank/noncomment satır.
Yeni helper dosyası/schema/kalıcı intent/ABI/dependency/policy yok. Queue/Runtime/
facade/Journal/Profiles/Vault/receiver/runner ve FTPS/JS/iOS/Rust salt-okunur.
Belge izni: bu ve önceki sözleşme, CURRENT, ilgili manifest/evidence/review notu.
Beş kaynak son review hash'leriyle aynı; henüz R13/R14 runtime regression yok.
Ürün etkileri source/event incelemesiyle doğrulandı; önerilen düzeltme test edilmiş değildir.

## 2. R13 — lifecycle kimliği projection yetkisi değildir

Kök neden: Coordinator.active unresolved Exec'i dışlıyor; revision onu emekli etmiyor.
onStop, eski epoch'a rağmen installed!=null ile yeni owner'ı yazıyor. schedule sonucu
yalnız owner enum'una bakınca yeni generic throw'un unresolved fence'i kaybolabiliyor.
Semboller: Exec/active, onStop, revision/revise, apply/replace, schedule/submit,
revoke ve resume çağrı kapıları; komşu install epoch kontrolü korunacak.

**Kimlik:** Exec nesnesi + exact params yalnız o OS lifecycle'ını tanımlar.
Güncel projection yetkisi ayrı RAM ticket'tır: benzersiz nesne/generation kimliği,
epoch, wake ve varsa origin Exec. Owner enum'u tek başına yetki değildir.
Ticket aynı dosyada, sourceLock altında OS işleminden önce kurulur; yeni projection/
revision/revoke eskisini geçersiz kılar. Wake aynı kalabilse de ticket yeniden kullanılmaz.
Execution ve non-execution projection aynı yetki kontrolünü kullanır; ikinci arbiter yok.

**onStop:** exact lifecycle bulunması güncel owner'ı değiştirmeye yetmez. Eski epoch,
emekli Exec veya başka ticket'ın origin'i olan stop false/no-op'tur: güncel owner,
unresolved, clock request, projection, lease/run değişmez; resume/relay tetiklenmez.
Güncel unresolved lifecycle kapanabilir ama retry/finish/yeni projection üretmez;
belirsiz projection ticket/fence'i korunur. Güncel executing Exec'in exact stop'u
mevcut tek retry/relay kararını korur; yalnız kendi lease/run'ını bırakır ve izinli
clock continuation'ı bir kez başlatır. Main-lane onStop sonrası jobFinished yok.

**revision/revise:** epoch ve ticket birlikte yenilenir. Eski installed Exec unresolved
olsa da lifecycle yetkisi emekli edilir; active() filtresi emeklilik kriteri olamaz.
Gerçek aktif run'ın mevcut exact pause/end davranışı korunur; unresolved diye başka
run'a veya global queue'ya pause uygulanmaz. Eski candidate/completion/stop yeni işi alamaz.
**schedule/replace:** OS çağrısı öncesi ve sonuç uygulanırken exact ticket+epoch
eşleşir; enum'un tesadüfen REPLACING olması yeterli değildir. OS çağrıları main'de,
monitor dışında kalır. Eski sonuç güncel ticket'a owner/fence yazamaz.
Güncel SUCCESS→OS_OWNED; kanıtlı FAILURE mevcut execution/non-execution ayrımında;
generic throw yalnız exact yeni nonce ile SUCCESS, aksi OS_OWNED+unresolved.
Pending=null/foreground belirsiz sonucu tekrar schedule/finish yetkisine çeviremez.

### İlk temsilci R13 — önce tek RED/GREEN

T/LockChecks içinde mevcut S3AutoFixture + S3AutoFakeOs + shared coordinator kullan.
1. Armed planın current callback A'sı erken/deferred replacement'ta unproven throw
   görsün; installed A unresolved olsun (salt non-execution throw yeterli değil).
2. Gerçek fixture source değişimi + reconcile → yeni epoch/ticket, REPLACING;
   main projection kuyruğunu pompalamadan exact stop(A)'yı araya koy.
3. Stop=false; owner/ticket/epoch/request değişmemeli. Yeni projection da nonce
   kanıtı olmayan throw görsün; pending sorgusunda eski nonce veya absence kullan.
4. Sonuç OS_OWNED+unresolved; tekrarlı ordinary reconcile/pending=null aynı schedule
   sayısını korusun; yeni finish/cancel/lease/run/accept yok. İlk assertion kimlik,
   epoch ve owner expected/actual'ını sırsız versin. Bariyerler deterministik, sleep yok.
**Kabul R13:** bu olay baseline'da invariant RED, minimum fix'te GREEN; compile
hatası RED sayılmaz. Sonra SUCCESS/proven-nonce ve güncel exact-stop karşıtlarını
yalnız etkilenen testlere ekle; R12 capture=0 ve stale candidate/lease korunsun.

## 3. R14 — kanıt bir olay sonucudur, değişebilir snapshot eşitliği değildir

Kök neden: settle Boolean'ı committed/rollback ayrımını siliyor; reconcile önce arm
ile context/occurrence yeniliyor, revise r.proof==current bozulunca ikinci clock-CAS
ve next(now) yapıyor. Aynı target/binding'deki pause context'i config değişimi değildir.
Semboller: Plan.Uncertain/settle/clock/arm; Coordinator.Clock/unblock/reconcile/revise.

**settle dönüşü:** mevcut Boolean yerine aynı dosyada ayrık internal sonuç:
NoFence, MigrationSettled, ClockCommitted(expected,revised), ClockRolledBack(expected,revised).
Clock sonuçları tek consistent read'deki exact yeni/eski proof'tan gelir. Mismatch/
unreadable exception ve fence korunur; sonuç üretilmeden uncertain temizlenmez.
Migration cleanup/disarm davranışı bu ayrımla değişmez. Clock proof legacy cleanup
veya disarm yaptırmaz. NoFence genel blocked recovery'nin eski disarm kuralını korur.

**Bağ ve sıra:** unblock clock proof'u exact RAM Clock request kimliği+epoch ve
beklenen old/new çiftiyle eşler; proof yalnız wake eşleşmesiyle sahiplenilemez.
Reconcile/revise, proof'u değiştirebilecek arm'dan ÖNCE committed/rollback sonucunu
request'e bağlar. Guard/capture beklerken committed bilgisi RAM'de kalır; foreground
yeni clock isteği yaratmaz. Hazırlık exact request kimliğini taşır; gecikmiş sonuç
yeni request'i silemez. Karar/DB yazısı sourceLock altında mevcut arbiter'dadır.
Committed: taze unlocked/enabled/automatic/target/binding authority doğrula; aynı
config'te ordinary arm(changed=false) ile gerekirse fresh context/occurrence yenile,
ama committed due/wake/retry'ı koru; clock-CAS ve next(now) TEKRAR YOK. Son fresh
snapshot'ı tek ticket/projection ile devret, request'i tüket. Stale context'i admit etme.
RolledBack: aynı request hâlâ geçerliyse taze authority ile clock-CAS yeniden denenebilir;
henüz commit yoktur. Config/source/profile değişmişse veya revoke epoch'u geçmişse
eski request/proof projection yapamaz; normal revoke/config refresh yolu kazanır.
Locked/paused/active/unresolved/blocked guard'ları bypass edilmez; yeni kalıcı proof yok.

### İlk temsilci R14 — R13 kontrol noktasından sonra

T/PlanChecks.clock + gerçek isolated SQLite/queue/PlanBoundary kullan. Manual M'yi
clock olayından ÖNCE foreground'da başlat; coordinator Exec aktif olmasın. Explicit
clock R commit'inde after-commit ack loss + read-deny hedefle. Boundary instance'ında
clock commit fazını bariyer/sayaçla seç; önceki arm transaction'ına fault verme.
M zaten açıkken fence yeni manual start'ı kapatsın. M exact pause → context yenilensin;
target/binding aynı kalsın. Recovery öncesi clock'u ilerlet, read-deny kaldır, reconcile.
İlk assertion old/new context, R.due/actual due, clock-CAS sayısını sırsız göstersin.
**Kabul R14:** baseline'da due/clock-CAS invariant RED; fix'te committed clock-CAS=1,
R.due/wake/retry korunmuş, fresh context doğrulanmış ve tek recovery projection.
Context refresh occurrence'ı değiştirebilir: R.occurrence eşitliği burada şart değildir.
M'nin mevcut manual run'ı dışında yeni run/accept yok. Ardından exact-old rollback,
unreadable/mismatch/manual fence ve config/revoke karşıtları; migration cleanup korunur.

## 4. Yürütme, bütçe ve devir

[Execution budget](../execution-budget.md) zorunlu. İlk aşama yalnız R13 temsilcisi,
minimum fix ve mevcut S3=true arm64 dar `s3-automatic-lock` koşusu; R14 altyapısını
peşinen yazma. Owned emulator/paket/fixture preflight; native rebuild gerekirse dur.
R13 GREEN sonrası güvenilir usage yoksa UNKNOWN kaydet ve GENİŞLETMEDEN kullanıcı
yanıtını bekle (aynı Opus sohbeti). Usage varsa 15000 output/thinking soft eşiğini
izle; aşınca yeni edit/build yok. UNKNOWN'dan kota tahmini üretme. F1 Sonnet pilotu değil.
İzinli devamda R14 temsilcisi/minimum fix → dar `s3-automatic-plan`; sonra yalnız
etkilenen karşıtlar/OS harness. Başarılı değişmeyen kontroller tekrar yok; lint iki
deneme NOT_RUN kalır. Ham loglar ilgili evidence altında; yeni baseline/hash/round diff.
Sayaçlar: early=1 çatışma, stale=2 tur, clock-stop=1, migration=1, clock-proof=1;
reset yok. Bu tasarım değerlendirmesi sayaç silmez; aynı yaklaşım ikinci başarısızsa
DECISION, testi gevşetme/yeni ID ile devam yok. Kapsam/satır sınırı aşılacaksa dur.
Opus CURRENT=REVIEW bırakır; bağımsız GPT gerçek-diff review olmadan checkbox kapanmaz.
Fiziksel/Doze/doğal teslim, RAM intent/geri saat sınırlaması, FTPS/Faz3–4/B4/P5 korunur.
**Devir:** YENİ SOHBET · Opus uygulama · `/implement`; bu belge yalnız scoped FIX'tir.
