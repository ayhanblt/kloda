# F1/S3 — R8–R11 FIX bağımsız review

12.11.2026 — **KABUL EDİLMEDİ: R8–R11 hedefleri karşılanıyor; komşu erken-wake
invariant'ı R12 açık. S3 ve 1.4b kapanmaz. Durum: FIX.**

Reviewer: GPT-6.1 Sol (`openai/gpt-6.1-sol`), bu kullanıcı-başlatmalı GPT review
oturumu. Oturum ID'si gösterilmiyor; uydurulmadı. Oturumda yalnız review/belge
kaydı yapıldı; ayrı Opus uygulaması `MANIFEST.md` ile devredildi. Önceki GPT
review açıklamalarıyla aynı GPT sohbetinde devam edildi; uygulama yapılmadı.
Opus öz-review'u bağımsız kabul sayılmadı. Alt ajan kullanılmadı.

## Gerçek kapsam / taze doğrulama

- Start/review HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`; staged boş.
- Önce son bulgular (önceki review bu sohbetin bağlamında mevcut), tur manifesti
  ve iki round diff okundu; ilk uygulama veya tarihî CURRENT yeniden açılmadı.
  Planın yalnız ilgili early-wake/OS ownership bölümü kontrol edildi; bu yeni
  beklenti değil, onaylı §6.1 ve §8.2 şartıdır. ADR/vault/ABI/FTPS kararı değişmiyor.
- Güncel 11 kaynak `final-sources.sha256` ile aynı. Başlangıç 11 `.pre` kopyası
  önceki `fix-r1-r7/final-sources.sha256` ile aynı. Üç ürün + iki test değişmiş;
  diğer altı dosya değişmemiş. Queue'nun bu tur tracked farkı dahil gerçek HEAD
  diff'i `tracked-scope-after.diff` ile aynı. Beş untracked Kotlin de kapsama dahil.
- `round-product.diff` ve `round-test.diff` başlangıç snapshot'larına bellekte
  uygulandığında gerçek güncel dosyaları üretiyor. İlk difflib metin karşılaştırması
  eşdeğer hunk hizalaması yüzünden eşleşmedi; kaynak farkı sanılmadı. Açıklama
  `review-integrity.log` içinde; diskte ürün/test patch'i uygulanmadı.
- `green-src` üç ürün kopyası ve mevcut APK hash'i g1 ile eşleşiyor:
  `3613ed1a4f7e674762fca27cc73645eae91f66909ba44c78b9056e43891f120e`.
  Değişen dosyaların nonblank/noncomment sayıları 297/154/191/224/300; sınır içinde.
- Bütün ağaç status'u `review-status.txt` içinde; ilgisiz birikmiş değişikliklerin
  diff'leri yüklenmedi veya bu tura mal edilmedi. Yeni test/build/lint/cihaz/ağ yok.

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
T = aynı modülün `src/androidTest/java/com/kloda/sync/` dizini.

## R8–R11 sonucu ve korunmuş komşular

| Bulgu / invariant | Kaynak ve sonuç |
|---|---|
| R8 — stale ownership | Coordinator `:59–76,232–233`: marker sonrası legacy/invalid aday install öncesi reddediliyor; OSOwned/Unresolved sahibi değişmiyor. PlanChecks.stale backoff + unresolved + current fresh callback'i kapsıyor. |
| R9 — clock fold / OS handoff | Coordinator `:98–103,211–228`: fold sourceLock altında stopped kontrolüyle carry kaydediyor; exact stop yeni wake için relay kuruyor. LockChecks.fold completion ve backoff'ta replacement öncesi stop'u araya koyuyor. Bildirilmiş teslim kaybı giderilmiş; R12 farklı erken giriş alt koşulu. |
| R10 — migration storage fence | Queue `:21–24,67–78,89–106,173–180`: aynı-journal plan attach, manuel/automatic/status ortak blocked kontrolü. PlanChecks.fence toggles+manual reddini ve exact proof sonrası manual dönüş/no-auto-write'ı kapsıyor. |
| R11 — migration proof | Plan `:94–115`: marker+uyuşmaz plan unreadable proof gibi fenced; settle mismatch'i kabul etmiyor. PlanChecks.mismatch tekrarlı lifecycle/toggle/manual/current callback'i kapsıyor. |

Exact pause/owner lease, revocation epoch, nonce proof, uncertain admission,
manuel automaticPaused ayrımı ve provider sınırı incelenen komşu yollardır.
Queue attach production'da coordinator kurulurken aynı journal ile bağlanıyor;
normal manual start plan migration/accept yazmıyor. Bulguların numarasını
değiştirerek önceki başarısız fix geçmişi sıfırlanmadı (aşağıdaki tablo).

## Engelleyici R12 — Orta: dirty early wake, eligibleAt öncesinde capture yapıyor

**Invariant ailesi:** erken eligibleAt / fresh capture sıralaması.
**Köken:** bu turda yeni eklenen hata değil; R3 düzeltmesiyle admission önüne
alınan dirty fold yolundan kalan, bu review'da ilk kez saptanan komşu eksik.

**Yer:** `K/AndroidS3AutomaticCoordinator.kt:78–84,98–102,296–298`;
`K/AndroidS3Queue.kt:84–87`; `K/AndroidS3Sources.kt:11–15`.

**Başlangıç → olay → gerçek sonuç:** current locked defer planı P,
retryNotBefore=due+5dk ve owner=OSOwned. Kilit açıldıktan sonra sıradan foreground
reconcile, `idleProject` içinde dirty=true bırakır (token/deadline değişmez).
now<P.eligibleAt iken current wake'in forced/erken callback'i gelir. `admit`
eligibleAt kontrolünden **önce** `fold(e,current)` çağırır. Dirty+unlocked yolunda
fold `queue.authority()` çalıştırır: source capture/bindSources ve profile/vault
capture yapılır. Ancak bundan sonra `:84` erken callback'i replacement'a çevirir.
Gerçek unlocked/vault guard'ı kaldırılmıyor; lease/run/network başlaması veya
kilitli sır erişimi saptanmadı. Sorun, bekleme kapısının yasakladığı capture ve
source-binding yan etkisinin erken değerlendirmede gerçekleşmesidir.

**Karşılanmayan kabul:** onaylı §6.1 “Erken callback” ve §8.2 erken-wake matrisi:
now<eligibleAt iken lease/**capture**/admission=0, aynı logical plan ve retry
deadline. S4 erken-wake şartı tamamlanmış sayılamaz. Mevcut representative testi
kilit reddini kaldırdıktan sonra araya foreground/dirty olayı koymuyor; yalnız
run/lease/held/deadline kontrolü capture olmadığını kanıtlamıyor.

**Beklenen sonuç / scoped FIX:** sadece bu giriş sırasını düzelt; erken kapı
dirty authority capture'dan önce etkili olsun. Dirty clock/completion carry,
R9 exact-stop relay, config/source revocation ve fresh eligible admission
korunsun. Yeni schema/policy/ABI/dosya veya global mutable override yok.

**Önce dar regression:** `T/AndroidAutomaticLockChecks.kt` representative/early
yolunda shared coordinator+gerçek isolated queue/store kullan. P→locked defer→
unlocked→normal foreground reconcile (dirty=true)→now<eligibleAt current callback.
Mevcut isolated ContextWrapper'da source/profile okuma sayacı gibi instance-bound
gözlemle callback aralığında capture=0'ı kanıtla; sayaç foreground işleminden
sonra sıfırlansın. Run/accept/worker/lease=0; P ve retry değişmesin; yalnız tek
remaining-latency replacement olsun. Aynı callback tekrarı ve now=eligibleAt'te
taze capture+tek kabul karşıtını koru. Önce bu invariant'ın RED'i, sonra GREEN;
sleep/compile failure/no-run assertion'ı capture=0 kanıtı sayılmasın.

**Dar doğrulama:** ilk `s3-automatic-lock`; R9 fold/stop assertions'ları aynı
scope'ta korunur. Sonraki batch yalnız gerçekten değişen davranışa göre seçilir;
plan/contract/pause/global-pause/OS başarılı koşuları değişiklik etkilemiyorsa
tekrarlanmaz. 300 satır sınırı için yeni dosya açarak kapsam genişletilmez.

## Invariant bazlı başarısız fix geçmişi (reset yok)

| Aile | Önceki başarısız hedefli tur | Bu tur / kalan sayaç |
|---|---|---|
| Stale ownership | fix-r1-r7: R1 kısmi, R8 kaldı → 1 | R8 hedefi karşılanıyor; geçmiş 1 korunur. |
| OS handoff / clock-stop | fix-r1-r7: R3 kısmi, R9 kaldı → 1 | R9 bildirilen stop aralığı karşılanıyor; geçmiş 1 korunur. |
| Migration proof/storage fence | fix-r1-r7: R5 kısmi, R10/R11 kaldı → 1 tur (iki bulgu iki deneme değil) | R10/R11 karşılanıyor; geçmiş 1 korunur. |
| Early eligibleAt/capture | Önceki hedefli fix denemesi kaydı yok | R12 ilk bulgu; hedefli başarısız fix=0. Yeni invariant diye eski ailelerin geçmişi silinmez. |

Aynı yaklaşımın iki başarısız **hedefli düzeltmesi** bu yeni bulgu için kanıtlanmış
değil; ilk scoped FIX yetkilendirmesi önerilir. Geniş “S4” etiketini tüm farklı
ihlalleri aynı deneme sanmak için kullanmadım. Aynı yaklaşım iki kez başarısızsa
yeni ID/sohbet açarak devam yok; CURRENT=DECISION ve GPT tasarım değerlendirmesi.
Lint'in iki başarısız denemesi ayrıca korunur; üçüncü koşu yok.

## Kanıt ayrımı / açık kapılar

**Taze:** kaynak/diff/snapshot/APK bütünlüğü, dar source/caller/event incelemesi;
`review-integrity.log`, `review-status.txt`. Yeni runtime PASS/FAIL iddiası yok.

**Yeniden kullanılan:** `build-g1.log` BUILD SUCCESSFUL ve g1'in altı instrumentation
logunda PASS+code=-1 doğrulandı: automatic-plan/lock/os/contract, pause/global-pause.
RED'ler de gerçek assertion failure+code=0: red1 PlanChecks.fence:184 (R10),
red1 LockChecks “R9 completion revised plan lost”, mutation R8 ownership,
mutation R11 mismatch. Bunlar kaynak/APK eşleşmeli **uygulama kanıtı**, taze
review koşusu değil; R12'nin eksik foreground→early capture sırasını kapsamıyor.

**Açık:** R12 runtime regression NOT_RUN; lint NOT_RUN (dependency lint crash).
Gerçek OS g1 harness synthetic-clock smoke'u korunur; doğal teslim/Doze/gerçek
keyguard/vault/ilk unlock CE/reboot/force-stop/production service/signing/storage
Faz3/4'te açıktır. FTPS F1, B4 kalan riskleri ve P5 kapanmaz. Kod review'u tam PASS
ve S3 kabulü tüm 1.4b kapanışı değildir.

## Checkpoint / devir

Ürün/test/ADR/plan değişmedi; yalnız review/evidence ve CURRENT/manifest kaydı.
Checkbox açık; commit/push/stage yok. İdari eksiklik için yeniden review istenmiyor.

**Durum:** FIX — R8–R11 hedefleri doğrulandı, R12 erken capture engelleyici.
**Devam:** YENİ SOHBET — uygulama rolü; review açıklaması gerekiyorsa AYNI SOHBET.
**Rol:** GPT review → Opus uygulama.
**Tam komut:** `/implement`
