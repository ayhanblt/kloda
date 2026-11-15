# F1/S3 R14-C1 — bağımsız GPT review

15.11.2026 · **KABUL — scoped goal F1-S3-R13R14.** G14/R14-C1 engeli kapandı;
G13/G14/GP zorunlu sözleşme ölçütleri aşağıdaki kanıtlarla destekleniyor. Üst 1.4b/F1,
FTPS ve ertelenmiş fiziksel/release kapıları kabul edilmiş değildir; tam ürün PASS yok.

## Reviewer / kapsam bütünlüğü

- Reviewer GPT-6.1 Sol (`openai/gpt-6.1-sol`), Opus uygulamasından ayrı bu GPT sohbeti.
  Bu sohbet önceki review/tasarım/onay kayıtlarını yürüttü, ürün/test uygulaması yapmadı.
  Oturum ID'si görünmüyor; uydurulmadı. Opus'un kendi sohbetinde uygulamaya devam etmesi
  bu GPT incelemesini self-review yapmaz. Alt ajan/ürün değişikliği/stage/commit/push yok.
- Start/review HEAD `f26e425dd808daf206ee7bd8ec6fe9402fbd1119`; staged boş.
  Tracked ve untracked status incelendi. Baseline beş `.pre` hash'i önceki tur final
  hash'leriyle eşleşiyor; `round-c1.diff` hunks'ları baseline'a bellekte uygulandığında
  tam güncel üç dosyayı üretiyor. Beş güncel final hash eşleşiyor; Plan/OsChecks değişmemiş.
  HEAD'den biriken R13/R14 diff'i C1'e mal edilmedi. Üç command/AGENTS/önceki plan diff'i
  önceki baseline ile aynı; içerikleri yeni ürün kapsamı olarak topluca alınmadı.
- C1 kapsamı: Coordinator.unblock + null instance observer; LockChecks boundary sayacı;
  PlanChecks parallel regression ve gerçek CAS assertions. Yeni ürün dosyası/schema/ABI/
  dependency yok. Nonblank/noncomment satırlar: Coordinator 299, Plan 179, LockChecks 300,
  PlanChecks 293, OsChecks 85; sınır karşılanıyor.
- İdari sınırlama: C1 baseline'ında CURRENT `.pre` yok; bu belgenin tur-içi tarihî
  satır aidiyeti tam yeniden kurulamaz. Mevcut durum kaynak/log/onayla doğrulanıyor;
  ürün snapshot/diff aidiyeti tam. Tek başına kapanış engeli veya yeni review turu değil.

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

## Kabul / aynı goal ve durum-geçiş tablosu

| ID | Başlangıç → olay → beklenen sonuç | Kanıt / karar |
|---|---|---|
| G14 | Committed R+ack/read kaybı, M pause/context refresh; iki ordinary reconcile → R.due/wake/retry korunur, fresh context, toplam CAS=1, tek projection | `PlanChecks:23–63` gerçek iki thread/shared coordinator; red-c1 invariant wake rotate FAIL; g-c1 parallel GREEN. Sequential commit/rollback/mismatch/config/revoke ve clock/reopen aynı final plan koşusunda başarılı. **Karşılandı** |
| G13 | Eski unresolved lifecycle/sonuç yeni ticket'a gelir → yeni owner/fence değişmez | C1 bu yolları değiştirmiyor; final g-c1-lock representative/interleavings içinde stale throw/success/nonce/inflight başarılı; red1/red2 tarihî kanıtı parent'tan. **Korundu** |
| GP | Recovery değişikliği → storage/manual gate, lease, revoke ve migration/cleanup korunur | Final g-c1 plan + g-c1-lock; kaynakta NoFence/disarm/exception ve attempt cleanup aşağıda incelendi. Önceki gerçek OS adapter/JobScheduler kanıtı yeniden kullanıldı, taze OS testi değil. **Dar sözleşme karşılandı**, ertelenmiş kapılar açık |

### Kritik bölüm ve regression değerlendirmesi

`K/AndroidS3AutomaticCoordinator.kt:292–299`: monitor içinde fresh blocked/attempt okuma,
plan.settle, observer, exact epoch/old-new pair binding ve başarı cleanup tek karardır.
Non-local return'un runCatching/isSuccess/clear değerlendirmesi synchronized bloğunun
içindedir; T2 ancak blocked=false görülecek duruma geldikten sonra girebilir. Clock
rollback committed bağlamaz; NoFence/MigrationSettled eski disarm dalında kalır; exception
clear çağırmaz. `queue.authority` ve OS port çağrıları bu kritik bölgeye taşınmamış.

`T/AndroidS3AutomaticPlanChecks.kt:53–63`: T1 ClockCommitted dönüşünde tutulur; baseline'da
T2 tamamlanır, fixed'te BLOCKED + unblock stack konumu görülür; sonra T1 bırakılıp iki
thread join edilir, hatalar taşınır ve main lane pompalanır. Beklenti holdsLock sonucuna
göre değişmez. RED logu timeout değil gerçek wake uyuşmazlığıdır. `:29,33,45–47` gerçek
boundary clock sayacı, context/due/wake/retry ve tek projection/no cancel kontrolünü yapar.
`S3TestBoundary` sayacı gerçek Plan.clock commit frame'ini gözler; due'dan tahmin etmez.

### İstenen özel inceleme: blockedAttempt === attempt

`K/AndroidS3AutomaticCoordinator.kt:297` **uygun ve kapsam içinde**: attempt sourceLock
altında alınır; queue.resolveAutomatic dış Coordinator monitor kapsamıyla aynı kalır;
başarılı sonucun cleanup'ı yeniden monitor alınarak yalnız aynı nesne için uygulanır.
`K/AndroidS3Queue.kt:115–127` zaten `uncertain !== attempt` için Unresolved döndürür ve
yalnız kanıtlanan attempt'i çözer. Coordinator'daki kimlik kontrolü bu queue kararını
sonraki coordinator cleanup'ına taşır; yeni bir attempt B varsa A'nın geç sonucu B'yi
silmez. clear'ın iki caller'ı da sourceLock altındadır.

Kimlik değişmişse eski çağrının `ok=true` dönmesi yeni fence'i temizlemez: blocked kaydı
yerinde kalır; revise blocked guard'ı, Queue uncertain/plan.fenced admission kapıları ve
Plan.open kontrolleri devam eder. Yeni run/manuel admission yetkisi bu bool'dan türemez.
Yeni queue-resolution politikası veya global serializasyon eklenmemiştir.

Bu `identity mismatch` karşıtı için özel runtime regression **NOT_RUN**. Normal attempt
storage recovery final g-c1-lock ile kapsanıyor; kimlik eşitsizliği dalının değerlendirmesi
kaynak/caller incelemesidir, ayrıca runtime PASS iddiası değildir. Sözleşme bu dal için yeni
bir karşıt runtime testi şart koşmadığından ve mantık mevcut kimliğe cleanup sınırını
doğrudan koruduğundan ek blocker/goal üretilmedi. Genuine NoFence disarm da kaynakta
korunmuş dal olarak değerlendirildi; loglardan ayrı bir NoFence testi varmış gibi sayılmadı.

## Kanıt / açık kapılar / checkpoint

- Taze reviewer kanıtı: kaynak/caller/lock sınırı, baseline→diff uygulaması, source/APK
  hash, satır sınırı ve log-sonuç incelemesi: `review-integrity.log`. İlk hash kontrolü
  baseline manifestindeki current-path adlarını yanlışlıkla güncel dosyalara uyguladı;
  logdaki düzeltilmiş `.pre` kontrolleri beş eşleşmeyi doğruluyor. İlk regenerated diff
  byte karşılaştırması sıra/hunk biçimi nedeniyle false; recorded hunk uygulaması tam eşleşti.
- Yeniden kullanılan Opus kanıtı: red build başarılı, red-c1 instrumentation code=0 ve
  beklenen wake mismatch; build-g-c1/g-c1-lock BUILD SUCCESSFUL; plan ve lock code=-1/PASS.
  Final APK `02488fa5783daba1b3ed4ce34495fd4216ae4541905db86a776b31205c987f02` diskte doğrulandı.
- Yeni reviewer build/runtime/lint/ağ/cihaz koşusu **NOT_RUN**; başarılı kontroller tekrarlanmadı.
  OS adapter/OsChecks değişmedi; `../run-s3-automatic-os-g14c.log` önceki kaynak sürümündeki
  başarılı OS kanıtıdır, C1 üzerinde taze OS PASS sayılmadı. Test-only observer production null.
- Engelleyici bulgu **yok**. Clock-proof/storage-fence aile geçmişi 2 rejected tur korunur;
  atomik yaklaşım deneme 1 GREEN ve bu bağımsız review'da kabul. Stale=2 tarihî tur,
  early=1 çatışma, clock-stop=1, migration=1 silinmez/sıfırlanmaz.
- Lint iki-deneme NOT_RUN, gerçek keyguard/Doze/doğal teslim/ilk unlock/CE/reboot/force-stop,
  production signing/storage, RAM intent kaybı/geri saat sınırlaması, FTPS/Faz3–4/B4/P5 açık.

**Durum:** scoped F1-S3-R13R14 kabul/kapanış; üst 1.4b/F1 açık.
**Devam:** YENİ SOHBET — yeni iş/plan; bu review için ek Opus kayıt oturumu yok.
**Rol:** GPT review → GPT plan.
**Tam prompt:** `CURRENT'tan başlayarak üst 1.4b/F1 için kalan FTPS kapsamını ve açık kabul kapılarını ayıran dar GPT planını hazırla; ürün kodunu değiştirme.`
