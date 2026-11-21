# P3-04 sonuç kaydı — 20.11.2026 (Sonnet 5.5, tek yazıcı; MANIFEST/CURRENT işlenmedi)

Ham kanıt: `../logs/p3-04-*`, bu dizin (`*.diff`, `*.sha256`, `anr-*.txt`). Koordinatör MANIFEST'e işler.

## 1. Önkoşul / aidiyet / aday

- Eski Sonnet/cihaz/build çakışması: **yok**. Başlangıçta Kloda'ya ait Gradle/kotlin daemon, emülatör, Metro (8081),
  xcodebuild/simctl süreci yok; `adb devices` boş. Başkasına ait süreç sonlandırılmadı.
- Cihaz aidiyeti: `KlodaFtps16c` (API35 arm64, `ftps-native-checkpoint-2026-11-03` ve `fo1-evidence-audit-2026-11-16`
  "Owned KlodaFtps16c"), `-port 5590 -no-window -no-snapshot -read-only` ile **bu çağrıda başlatıldı**, `adb emu avd name`
  ile doğrulandı. `-read-only`: AVD kalıcı verisi değişmedi (`userdata-qemu.img.qcow2` mtime 11 Kas, değişmedi).
  KlodaCloud18/Pixel_9_Pro kullanılmadı. Bitişte kendi emülatörüm kapatıldı, Gradle daemon durduruldu.
- **P3-S0**: HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, staged boş. Taze hash **1604 girdi,
  `b6eddf88c9f1ca8d07b8b35af0a5d9969d7c3b19291d65148d1689fd8f0f9037` ≠ P3-S0 (1601, `ecf7b3ad…`)**.
  Fark = yalnız P3-S1 capture/test altyapısı: yeni `apps/mobile/capture/scroll.ts` (+1) ve `tools/ui-capture/__pycache__/*.pyc`
  (+2, `git ls-files --others` bunları ignore etmiyor; Python test koşularının yan ürünü). Değişen kaynaklar
  (`entry.tsx protocol.ts screens.tsx scroll.ts`, `tools/ui-capture/{matrix.json,ios.py,test_matrix.py,test_capture.py}`) yalnız
  P3-10 capture-only delta'sıdır. **F1 altı kaynak ve ürün kaynakları P3-S0 değerinde**: LF-normalize sha256
  `Job f84caf65…`, `Scheduler 511b51b1…`, `Queue 06b0b00b…`, `Automatic 736e7653…`, `Lifecycle c1bf4a2c…`, `Policy 43fe1aab…`
  = `fix2/resume-win/source-final-lf.sha256`; koşu sonunda yeniden doğrulandı (değişmedi). P3-04 kanıtı capture deltasından etkilenmez;
  P3-S0 "sessizce eşit" sayılmadı, hash farkı kaydedildi.
- Canlı ağaç değiştirilmedi: tüm derleme/koşu `/private/tmp/kloda-p3-04` (APFS clone, `cp -cR`: `apps/mobile`, `node_modules`,
  `packages`, `tools`, root package*.json). Klon bırakıldı (CoW; koordinatör isterse silinir).

## 2. Varyantlar (hepsi klonda; canlı kaynak/final test gövdeleri değişmedi)

| Varyant | Üretim | Test | APK sha256 | Diff |
| --- | --- | --- | --- | --- |
| **start-compat / FL1** | `fix2/start` Job + Scheduler (hash = `start/sha256.txt`) **+ tek üye** `Os.pending(scheduler,id)` (final ile aynı imza, hiçbir start yolu çağırmaz) | final Lifecycle/Policy/Queue; `AutomaticChecks` yalnız `ftps-fl1-stop-after-decision` dispatch + `ran==1` doğrulaması, özet "SELECTED ONLY" | `2148833e…fc6dff48` | `compat-*.diff`, `selector-fl1-automaticchecks.diff` |
| **start-compat / R2 clean** | aynı | seçici sabiti `ftps-fp2-watch-null-throw-clean` | `35416713…db3f66b` | aynı + sabit |
| **final (değişmemiş)** | final Job/Scheduler/Queue byte-eş (`cmp`) | final altı dosya byte-eş | `7d87bc10…e510` | yok |
| **final-eksi-7 (seçici)** | final | `AutomaticChecks` yalnız 7 `ftps-fs1-stale-*-keeps-b` grubunu atlar | `7a358a5b…d7` | `selector-final-minus7-automaticchecks.diff` |
| **final-kalan-9 (seçici)** | final | 9 `ftps-fp2-watch*` grubu (zaten PASS olanlar yeniden koşulmadı) | `8aa128ea…d3c` | `selector-final-remaining9-automaticchecks.diff` |

Tam sha256 değerleri `apk-*.sha256`. Hiçbir seçici varyantı final PASS'in parçası değildir; hepsi geçici start-compat/seçici varyantıdır.

## 3. Komutlar / exit / sonuç

Build (her varyant, klon `apps/mobile/android`):
`./gradlew :my-module:compileDebugKotlin :my-module:assembleDebugAndroidTest -PklodaFtpsNative=true -PreactNativeArchitectures=arm64-v8a --console=plain --offline`
→ hepsi **EXIT=0**, derleme hatası 0 (`p3-04-build-{fl1,r2clean,final,final-minus7,final-remaining9}.log`). `buildFtpsNative` klonda çalıştı.
Kurulum `adb -s emulator-5590 install -r -t <apk>` exit 0. Koşu
`adb -s emulator-5590 shell am instrument -w -r -e scope <scope> com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation`
(**adb exit her zaman 0**; sonuç `INSTRUMENTATION_RESULT/CODE` satırlarındadır, -1=OK, 0+stack/"Process crashed"=FAIL).

| Kontrol | Sonuç | Log |
| --- | --- | --- |
| **FL1 start-compat** (`ftps-fl1-stop-after-decision`) | **davranış RED (beklenen)**. Önkoşullar geçti: A kendi `finish`'ine ulaştı, `finishes==[JOB→true]`, cancel/schedule yok, P/run korunmuş, `admits`; sonra `Policy.kt:81` "stop after the decision lost the retry: finish=[(2710, true)] … JOB=null" | `p3-04-run-fl1-startcompat.log` |
| **R2 clean start-compat** (`ftps-fp2-watch-null-throw-clean`) | **davranış RED (beklenen)**. Null-throw → `outcome_unknown`, ordinary reconcile'a ulaşıldı; `Policy.kt:216` `recorder.schedules.size==2` başarısız: `schedule=[2711]` (ikinci WATCH schedule port'tan geçmedi, bypass), `cancel=[] finish=[]` | `p3-04-run-r2clean-startcompat.log` |
| **final lock** `ftps-automatic-lock` | **FRESH PASS 7/7** (`INSTRUMENTATION_CODE -1`) | `p3-04-run-final-lock-2.log` |
| **final lifecycle, tam kapsam** (`ftps-automatic-lifecycle`) | 6. grupta (`ftps-fs1-stale-finally-keeps-b`) **ANR → process kill**; 5 grup PASS (fw1, fw2×4) | `p3-04-run-final-ftps-automatic-lifecycle.log`, `p3-04-final-lifecycle-anr-excerpt.log`, `anr-final-lifecycle-fs1.txt` |
| (ilk lock denemesi) | `resetRunless:230` fail-closed — yukarıdaki crash'in bıraktığı fixture kalıntısı; cihaz `-read-only` yeniden açılınca lock 7/7 PASS | `p3-04-run-final-ftps-automatic-lock.log` |
| **final-eksi-7** | **22 grup FRESH PASS**, 23. `ftps-fs1-destroyed-watch` aynı ANR (WATCH 2711 `No response to onStartJob`) | `p3-04-run-final-minus7.log`, `anr-final-minus7-destroyed-watch.txt` |
| **final-kalan-9** | **9/9 FRESH PASS**: `fp2-watch-{failure,old-throw,new-throw}` ve `null-throw-{clean,accepted,unknown,rejected,unreadable,foreign}` (R2 clean + 6 FP2 varyantı) | `p3-04-run-final-remaining9.log` |

Final lifecycle toplamı (39 grup; Lifecycle 19 + Policy 20): **31 PASS** (FW1/FW2×4, FS2 os-stop, FP2×6, FP1×6, **FL1 stop-after-decision**,
FS2 stop-held×3 [finalization/report/**same-token-b**], FP2 WATCH×3, R2 recovery×6) + **8 FAIL-ANR** (aşağıda) + 0 dispatch edilmeyen başka grup.
FL1 final GREEN `final-minus7` koşusunda (`stream=PASS ftps-fl1-stop-after-decision`).

## 4. Kök neden (8 grup, tek neden) — FAIL-TEST/FIXTURE ⟷ üretim sözleşmesi uyumsuzluğu

ANR stack (iki koşuda aynı): main thread `AndroidFtpsScheduler.arbiter(Scheduler.kt:47)` ← `AndroidFtpsJob.onStartJob(Job.kt:47)`,
"waiting to lock … held by thread N"; thread N = instrumentation thread, `AndroidFtpsLifecycleChecks.held (Lifecycle:97, Thread.sleep döngüsü)`
← `staleOrigin (Lifecycle:136–137)` / `destroyedWatch (Policy:140–141)` — ikisi `synchronized(AndroidFtpsLifecycleChecks.monitor)` içinde.
`monitor` = `AndroidFtpsScheduler.lock` = fix2 arbiter. fix2 üretimi `onStartJob`'ta kabul kararını main thread'de arbiter altında veriyor (R1 §2) ve
`kloda-ftps-job` worker thread'i ancak sonra oluşuyor; test ise monitor'ü tutarken bu worker'ın BLOCKED olmasını bekliyor (30 sn) →
main kilitli → platform 10 sn `onStartJob` zaman aşımı → ANR → process kill. Eski (fix1) üretimde `onStartJob` hızlı dönüp worker monitor'de bloke olurdu;
bu gruplar o tasarıma yazılmış. Windows fix2 oturumunda yalnız Policy'nin `osStop/stopHeld` kurulumları `gated` capture gate'ine taşınmış
(`Policy.kt:33–38`, "test never holds the monitor while awaiting the platform"); `Lifecycle.staleOrigin` ve `Policy.destroyedWatch` taşınmamış.
Windows'ta derleme/çalıştırma yapılamadığı için (MANIFEST §fix2 Windows devamı) bu uyumsuzluk ilk kez burada gözlendi.
**Üretim FAIL'i kanıtlanmadı**: üretim monitor'ü yalnız kısa karar için tutuyor; sorun testin uzun monitor tutuşu. Ama bunu "ürün doğru" diye PASS'e çevirmiyorum.

Etkilenen gruplar: `ftps-fs1-stale-{finally,throw,locked,defer,watch,result,destroy}-keeps-b`, `ftps-fs1-destroyed-watch`.
Bu 8 grubun karşıt kapsamı (A'nın geç `finished`/report/OS çağrısı B'ye dokunmaz; destroy sonrası yazma yok; claim edilmiş
run sonucu sonrası `finished()`) **PASS değil, NOT_RUN-eşdeğeri (FAIL-TEST)**. Kaybolan post-claim FS1 karşıtı (MANIFEST "Reviewer'a açık
anlam değişikliği") ayrıca review'da açık.

## 5. DECISION (koordinatöre) — tek sonraki adım

P3-04 temsilcileri (FL1, R2 clean, lock 7/7, FP2/R2 6 varyant, same-token B) **kanıtlı**; 8 grup yeni kanıt üretmeden kapanamaz.
Plan §3 "final test kaynakları değişmez" non-goal'ı olduğundan düzeltme yetkisi dışında:

- **Öneri (kapsam-içi scoped FIX adayı, GPT onayı gerekir):** `AndroidFtpsLifecycleChecks.staleOrigin` ve `AndroidFtpsPolicyChecks.destroyedWatch`
  kurulumunu `synchronized(monitor){ held(BLOCKED) }` yerine Policy'de zaten kullanılan `gated` (capture gate, `held(..., WAITING)`) yöntemine taşımak;
  beklenen sonuçlar ve assertion'lar aynı kalır. Dosya sınırı: aynı iki test dosyası (zaten F1'in sekiz dosyasından). Yeni üretim/fixture yok.
  Bu final F1 test kaynağını değiştirir (plan §3 non-goal) → koordinatör onayı + kaynak hash'inin yeni varyant olarak kaydı gerekir.
- Alternatif: 8 grubu "FAIL-TEST/FIXTURE, açık" bırakıp review'a taşımak; Faz3 kapanışını engeller (zorunlu satır).
- Önkoşul saptaması: cihaz yeniden açılmadan (kirli fixture) lock/lifecycle `resetRunless` fail-closed durur; emülatör `-read-only` yeniden başlatma
  çözüm. Bu ürün/test bulgusu değil, ortam sırası notudur.

Sayaçlar: bu çağrıda başarısız FIX denemesi yok (kaynak değiştirilmedi). P3-10/P3-08 ve P3-00/P3-01 dokunulmadı.
Kalan P3-04 açıkları: 8 grup (yukarı), FS1 post-claim karşıtı (review), R2 owner/delivery statik eşleme (review), FO1 delta Faz4.
P3-02/P3-05 (Android lint/native build kanıtı) bu çağrıda yürütülmedi; `buildFtpsNative`+`compileDebugKotlin`+`assembleDebugAndroidTest`
klon varyantında çalıştı ama canlı ağaç adayı/üretim APK kanıtı değildir.
