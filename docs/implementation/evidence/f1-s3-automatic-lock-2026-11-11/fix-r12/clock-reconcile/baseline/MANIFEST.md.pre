# F1 S3 — R12 scoped fix round (Opus, 12.11.2026)

Status: **DUR — DECISION (sözleşme çatışması).** Uygulama tamamlanmadı; review'a hazır değil.
**Güncel yönlendirme — kullanıcı onayı 12.11:** DECISION çözüldü; **FIX / ayrı
Opus uygulamasına hazır**. [Scoped sözleşme](../../../plans/f1-r12-clock-reconcile-fix.md)
eski clock-dirty/erken-callback/wake/test beklentisini dar kapsamda supersede eder.
Beş dosya (Coordinator/Plan + LockChecks/PlanChecks/OsChecks), aynı configuration'da
saf-clock wake koruma ve kalıcı intent eklememe açıkça onaylandı. Wake tek başına
yetki değildir; güncel plan/guard ve execution–epoch/config kontrolleri korunur.
Commit öncesi death'te RAM clock niyeti kaybı ve geri saat değişiminde gecikme kabul
edilmiş sınırlamadır. Aşağıdaki DECISION/başarısızlık kayıtları tarihî kanıttır;
onay uygulama/test/review başarısı değildir. Tam devam komutu: `/implement`.
R12 strict deneme 1 çatışmayla bloke ve diğer invariant sayaçları korunur.
GPT belge doğrulaması: `contract-verification.log`; sözleşme 149 satır, 5 hedef,
yerel bağlantılar ve FIX/[ ] yönlendirmesi doğrulandı. Bu devamda 11 ürün/test
hash'i değişmedi (`contract-start-source-hashes.json`); test/build/runtime yok.
Findings source: [../fix-r8-r11/review.md](../fix-r8-r11/review.md) §R12. Plan reference only:
[next-plan.md](../../../plans/next-plan.md) §6.1 "Erken callback" + m.5, §8.2 erken-wake, §7.
No new file/schema/policy/ABI. 1.4b stays `[ ]`.

## Start

- HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`, staged empty (`baseline/head.txt`, `staged.txt`);
  `head-after.txt` identical, `staged-after.txt` empty. Nothing committed/staged.
- 11 sources matched `../fix-r8-r11/final-sources.sha256` (`baseline/start-hash-check.txt`);
  tracked diff equalled `../fix-r8-r11/tracked-scope-after.diff` (`baseline/tracked-scope-start.diff`).
- Pre copies: `baseline/*.pre` (`pre.sha256`): Coordinator, LockChecks, CURRENT, parent MANIFEST;
  docs dirty start `baseline/docs-start.diff`. Full status before/after: `baseline/status.txt`,
  `status-after.txt` (differs only by this round's evidence files).

## Matrix

| Finding | Invariant | Event sequence | Symbol | Regression | Before → after |
|---|---|---|---|---|---|
| R12 | now < eligibleAt: lease/capture/admission = 0, same plan + retry, one replacement | P → locked defer (OSOwned) → unlock → foreground `reconcile()` → `idleProject` dirty=true → current early callback | `Coordinator.admit` (fold before early gate) → `fold` → `queue.authority()` | LockChecks `representative`: source-read counter on isolated ContextWrapper (`S3AutoFixture.reads`), reset after foreground; capture=0 per early callback, +1 replacement each, accept/run/lease=0; eligibleAt: fresh capture>0, dirty cleared, one accept | RED `red1` → representative PASS in `g1` |
| R3 (sibling, accepted) | clock change during active run is folded once by the OS-owned backoff callback | B active → `reconcile(true)` dirty+clock → exact stop(B) → OSOwned → backoff callback at now < q1.eligibleAt | same `admit` order | LockChecks `active()` (`:309`) expects that **early** callback to fold (rotate wake, dirty=false) | PASS before → **FAIL** in `g1` |

## Commands / results (emulator-5590 KlodaCloud18 API 35, keyguard open)

- Build (`apps/mobile/android`): `./gradlew :my-module:compileDebugKotlin :my-module:assembleDebugAndroidTest
  -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a --console=plain` → `build-<tag>.log`.
- Run: `adb -s emulator-5590 shell am instrument -w -r -e scope s3-automatic-lock
  com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation` → `run-s3-automatic-lock-<tag>.log`.
- `red1` (baseline product + new test, APK `8c719a33…`): FAIL code=0,
  `R12 early callback captured authority: reads=1 dirty=false` — intended RED on the target invariant.
- `g1` (strict fix, APK `2ebb1a9c…`): `s3-automatic-lock-representative` PASS; interleavings FAIL
  code=0 at `active(AndroidAutomaticLockChecks.kt:309)` (`g1-failure-excerpt.txt`).
- Not run: other scopes (plan/os/contract/pause/global-pause), lint (two attempts already used).

## Conflict (why stopped)

Strict fix (`round-product.diff`): early gate on the current plan before `fold`. It satisfies §6.1
capture=0 for the R12 repro but also skips the clock-dirty fold on an early OS-backoff callback,
which accepted R3 (`active()`) requires. §6.1 "Erken callback" (capture=0) vs. §6.1 m.5 (clock
change = explicit schedule revision) + review "dirty clock carry korunsun" give conflicting
expectations for **clock-dirty + early callback**. User chose: DUR — GPT karar (12.11).
Options presented: (A) early gate only when no clock-dirty (non-clock dirty capture=0; clock fold
stays as explicit revision, admission/lease still 0); (B) strict capture=0, change accepted R3
expectation (clock revision waits for old eligibleAt; long delay risk on backward clock jump).

## Working tree left as-is

`round-product.diff` (Coordinator +4 lines, 298 counted) and `round-test.diff` (LockChecks, 300)
remain on disk; restore from `baseline/*.pre` if the decision requires. Current hashes:
`current-sources.sha256` (2 of 11 changed). Failed targeted fixes, early eligibleAt/capture: the
strict approach met R12's own invariant but broke an accepted sibling; record as **attempt 1
blocked by contract conflict** (reviewer may count it). Other family histories unchanged.
No independent review; no self-review claimed as independent.

## GPT sözleşme değerlendirmesi — 12.11, onay bekliyor

Salt-okunur kaynak/test/log incelemesi: receiver `AndroidBackupReceiver.kt:11–17`
açık saat olayını `reconcile(changed=true)` olarak zaten ayırıyor. Coordinator'ın
pending/OSOwned revision yolu mevcut; active clock olayı ise dirty kalıyor.
`LockChecks.active():304–309` ürünün “clock değişimi kaybolmasın” invariant'ına ek
olarak özellikle erken OS callback'inin fold yapmasını bekliyor; strict gate ile
çelişen bu uygulama-zamanlama beklentisidir. Önceki review'un clock carry koruma
talebi early capture istisnası için onay değildir; bu ayrım netleştirilmelidir.

Tek öneri: erken OS callback capture/lease/admission=0 olarak kalsın. Açık clock
olayının bekleyen işi ayrı, origin/epoch/config-bound yetkili reconcile yolunda;
active run için completion veya exact stop sonrası güvenli devirde işlensin.
Erken callback kendi başına bu reconcile'ı başlatmasın; generic foreground dirty
clock yetkisine çevrilmesin. Clock revision ve eski OS completion/backoff aynı
sahiplik kararında serialize edilmeli; iki paralel schedule/finish üretilmemeli.
Kilit/storage reddinde taze capture zorlanmaz; eski güvenli pending teslim yolu
korunur, UI'sız anında revision garantisi verilmez.

Bu mevcut ayrı girişten yararlanabilen tasarım önerisidir, hazır implementasyon
veya 300 satıra sığma kanıtı değildir. R3 testi explicit clock-event drain ve
stale-envelope fencing üzerinden yeniden sözleşmelendirilmeli; R12 counter testi
korunmalı. Clock istisnasıyla erken capture'a izin vermek veya clock'u eski
eligibleAt'e kadar ertelemek önerilmiyor (geri saat sıçramasında uzun gecikme).
Mevcut kod/test değiştirilmedi; yeni test/build yok. red1/g1 loglarının ilgili
assertion satırları yeniden kullanıldı. Strict deneme 1 / sözleşme çatışması
kaydı ve diğer invariant geçmişi korunur. CURRENT=DECISION; kullanıcı onayı
sonrası aynı GPT sohbetinde dar sözleşme netleşir, otomatik FIX başlatılmaz.
