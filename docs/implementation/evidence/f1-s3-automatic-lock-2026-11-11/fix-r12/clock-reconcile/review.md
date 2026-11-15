# F1/S3 clock-reconcile — bağımsız GPT FIX review

12.11.2026 · **KABUL EDİLMEDİ — FIX: R13 ve R14 engelleyici.** 1.4b `[ ]` kalır.

Reviewer: GPT-6.1 Sol (`openai/gpt-6.1-sol`), kullanıcı-başlatmalı bu GPT review
oturumu. Oturum ID'si araçlarda gösterilmiyor; uydurulmadı. Bu oturumda uygulama
yapılmadı; ayrı Opus uygulamasının MANIFEST devri incelendi. Öz-review bağımsız
kabul sayılmadı. Alt ajan, ürün/test değişikliği, stage/commit/push yok.

## Kapsam ve kanıt bütünlüğü

- Start ve review HEAD: `650ec17f300ebdeee804bd4218f5b57356eecb21`; staged boş.
- Okuma sırası: AGENTS → CURRENT aktif iş → son review/tur manifesti/round.diff →
  ilgili onaylı scoped sözleşme. Eski plandan yalnız §6.1 komşu sahiplik/throw
  şartları okundu. Araştırma eki ve tarihî CURRENT açılmadı; ADR kararı değişmiyor.
- 11 baseline kaynak içinde yalnız sözleşmenin 5 dosyası değişmiş. Beş final hash
  eşleşiyor; `round.diff` baseline `.pre` metinlerine bellekte uygulandığında
  gerçek beş güncel dosyayı üretiyor. Önceki turlar bu turun diff'i sayılmadı.
- **Git sınıflaması düzeltmesi:** bu beş Kotlin dosyası hem başlangıçta hem şimdi
  **untracked**; MANIFEST'in “tracked-dirty” ifadesi yanlış. Başlangıç snapshot'ları
  tur aidiyetini doğruladığından bu idari hata tek başına engel değil.
  Diğer altı kaynak değişmemiş; işe ait tracked HEAD diff'i başlangıç kaydıyla aynı
  (`review-tracked-scope.diff`). Tüm status `review-status.txt`; ilgisiz dirty
  dosyaların içeriği topluca okunmadı.
- Satır sınırı: Coordinator 296, Plan 173, LockChecks 300, PlanChecks 253,
  OsChecks 85 nonblank/noncomment; schema/ABI/dependency değişikliği yok.
- Taze: kaynak/caller/event ve diff/hash incelemesi, `review-integrity.log`.
  APK hash kontrolünün ilkinde yanlış cwd kullanıldı; logdaki düzeltilmiş kontrol
  `apps/mobile/android` tabanıyla final `bcb65ade…` APK eşleşmesini doğruluyor.
- Yeniden kullanılan: `build-final.log` BUILD SUCCESSFUL; final lock (representative
  + interleavings), plan, os loglarında PASS ve instrumentation code=-1. Önceki
  değişmeyen Queue/Runtime/contract/pause/global-pause kanıtı MANIFEST yönlendirmesiyle
  korunur; bu review'da yeniden koşulmadı veya taze runtime PASS sayılmadı.
  Yeni runtime/build/lint/cihaz/ağ testi **NOT_RUN**.

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

## Karşılanan hedefler / incelenen komşular

R12 erken gate capture/fold önünde korunuyor (`K/AndroidS3AutomaticCoordinator.kt:82–94`);
ordinary foreground explicit clock request yaratmıyor. Clock RAM isteği ayrı;
normal active run sırasında clock-CAS erteleniyor, saf-clock wake korunuyor,
epoch ilerliyor. Plan.clock exact CAS ve exact old/new/unreadable ayrımı ile
Queue'nun manual dahil plan.fenced gate'i incelendi. Migration settle/cleanup,
exact lease/pause, current envelope admission, config revoke, nonce proof ve
process-reopen yolları komşu incelemeye dahildir. Aşağıdaki iki olay dizisi mevcut
başarılı matrisin kapsamadığı kabul açıklarıdır; kilitli secret erişimi veya çift
run/accept gözlendiği iddia edilmiyor.

## R13 — Orta / engelleyici: eski unresolved stop yeni projection'ın owner/throw fence'ini bozuyor

**Aile:** stale ownership (OS handoff etkisi). **Köken:** önceki turlardan kalan
installed-unresolved alt yolu; ilk kez bu review'da engelleyici olarak kaydedildi.
MANIFEST:77–79 gözlemi doğrulandı; yalnız pending adoption ile self-heal varsayımı
generic-throw karşıtını kapsamıyor. Yeni ürün beklentisi değil.

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:49,209–226,298–303,320–327`.
`active()` unresolved Exec'i dışlar; `revision()` bu eski Exec'i done yapmaz.
`onStop()` eski epoch için retry=false hesaplasa da sırf `installed != null`
olduğu için **yeni** owner'ı IDLE'a yazar. `schedule()` OS çağrısından sonra
owner REPLACING değilse throw sonucu/unresolved kaydını yapmadan çıkar.

**Başlangıç → olay → sonuç:** A'nın replacement'ı unproven throw ile unresolved;
source/config yenilenir → yeni epoch ve REPLACING, projection main'de bekler →
exact eski stop(A) → owner IDLE → yeni projection da unproven generic throw.
Gerçek sonuç IDLE + unresolved=false; ordinary reconcile, pending yoksa yeniden
schedule edebilir. Yeni projection'ın belirsiz sonucuna rağmen ikinci deneme
yetkisi doğar. Başarılı schedule karşıtında da owner yanlış IDLE kalır.

**Karşılanmayan kabul:** scoped sözleşme §3.7, §4 eski params/no-op ve generic
throw hükümleri, §6 R3-B/R3-C/R9; eski plan §6.1 ProjectionUnresolved tablosu.
Eski lifecycle'ın kapanması güncel projection sahipliği değildir.

**Scoped düzeltme/devri:** Coordinator `onStop`/`revision`/`schedule`; önce T/LockChecks
shared coordinator'da iki aşamalı throw+config revision+main bariyeri regression'ı.
Eski stop false dönmeli; yeni owner/epoch/request değişmemeli. Yeni unproven throw
OS_OWNED+unresolved kalmalı; tekrar foreground/pending=null schedule/finish üretmemeli.
SUCCESS, proven nonce, exact güncel stop, pause/lease ve R12 capture=0 korunmalı.
Yalnız owner adını düzeltip stale stop'un continuation tetiklemesini bırakma.

## R14 — Orta / engelleyici: kanıtlanmış clock commit context refresh sonrası yeniden hesaplanıyor

**Aile:** clock transaction proof / storage fence. **Köken:** bu turun yeni clock
proof yolundaki hata; migration R10/R11'in tekrarı değil.

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:249–257,267–272,281–284`;
`K/AndroidS3AutomaticPlan.kt:112–117,149–151`.
`settle()` exact committed yeni planı kanıtlar; fakat reconcile, `revise` proof'u
kullanmadan önce `arm()` çalıştırır. Aynı target/binding'de context yenilenmişse
arm occurrence/context'i değiştirir. `r.proof == current` artık false olduğundan
`next(clock())` ve ikinci clock-CAS yapılır; tek isteğin committed due'su kaybolur.

**Başlangıç → olay → sonuç:** manuel run M açık, aynı config'te explicit clock
revision R commit olur fakat ack/read kanıtı okunamaz → fenced/request bekler →
M exact pause ile journal context'i yeniler → zaman ilerler → proof okunur hale
gelir → normal reconcile. Exact R kanıtına rağmen ikinci clock revision ve yeni
due üretilir. M clock'tan önce zaten açık olabilir; fence yeni manual start'ı
engeller ama mevcut run'ın pause'unu engellemez (`K/AndroidS3Queue.kt:41–65,84–87`;
context invalidate `K/AndroidS3Jobs.kt:57`). Configuration binding context içermez
(`K/AndroidS3AutomaticPlan.kt:8–12`), bu config revocation değildir.

**Karşılanmayan kabul:** scoped §4 exact-new → committed/tekrar revision yok;
pause context'i config değişimi saymama; §5 storage proof sonrası aynı request;
§6 Plan “proof sonrası tek devam”. Etki yalnız fazladan UUID değil, committed
logical due'nun recovery zamanına göre ileri taşınmasıdır.

**Scoped düzeltme/devri:** Coordinator `unblock/reconcile/revise`, gerekirse Plan
`settle` mevcut proof dönüşü. T/PlanChecks.clock'ta shared real SQLite/queue ile
M'yi önceden başlat; clock commit-ack-loss+read-deny fazını instance-bound boundary/
lane bariyeriyle hedefle (fault yanlışlıkla arm transaction'ında tüketilmesin).
M pause → context değişimi → clock ilerleme → proof recovery: clock-CAS toplam 1,
R.due/wake korunmuş ve tek recovery projection. Fresh context doğrulaması veya
ordinary occurrence refresh gerekiyorsa koru; stale context'i kabul ettirme.
Exact-old rollback yeniden denemesi, unreadable/mismatch fence, migration cleanup,
config/source invalidation ve manual gate karşıtları korunmalı. Mevcut clock testi
`:285–295` proof beklerken context/zaman değiştirmediği için bu açığı yakalamıyor.

## Invariant sayaçları / yönlendirme

- Early eligibleAt/capture: strict deneme 1 sözleşme çatışması korunur; bu tur R12
  hedefi karşılanıyor, sayaç silinmez.
- Stale ownership: önceki başarısız hedefli tur 1 + bu turun stale/no-op kabul
  açığı = **2 tur**. Önceki candidate/install yolu ile R13 installed-unresolved
  yolu farklıdır; aynı düzeltme yaklaşımının iki kez denendiği kanıtlanmadı.
  Bu ayrım aile sayacını sıfırlamaz. Scoped R13'te lifecycle kimliği ile güncel
  projection yetkisi ayrı değerlendirilmelidir; aynı yaklaşım ikinci kez başarısız
  olursa yeni ID/FIX değil **DECISION / GPT tasarım değerlendirmesi** gerekir.
- Clock-stop geçmiş 1, migration proof/storage fence geçmiş 1 korunur; R13'ü
  ikinci bir clock-stop denemesi diye çift saymadım. Yeni clock-proof yaklaşımı
  R14: başarısız hedefli tur **1**; migration sayacı buna taşınmaz/silinmez.
- Aynı 5 dosya ve ≤300 satır sınırında scoped FIX; yeni schema/helper/ABI/policy
  onayı yok. Sınır genişlemesi veya yeni ürün kararı gerekirse implementer durur.

## Açık kapılar ve checkpoint

R13/R14 runtime regression henüz yok; source/event analizi bulgusudur. Lint NOT_RUN
(iki deneme, üçüncü koşu yok). Fiziksel keyguard/Doze/doğal teslim, ilk unlock/CE,
reboot/force-stop/production signing/storage, FTPS F1, Faz3–4/B4/P5 açıktır.
RAM intent kaybı ve geri saat gecikmesi kabul edilmiş sınırlamalar olarak kalır.
Mevcut test PASS'leri bu review kabulü veya tam ürün PASS'i değildir.

**Durum:** FIX — R13/R14; son manifest bu dizindeki `MANIFEST.md`.
**Devam:** YENİ SOHBET — rol değişimi; açıklama/kanıt tamamlama gerekirse AYNI SOHBET.
**Rol:** GPT review → Opus uygulama.
**Tam komut:** `/implement`.
