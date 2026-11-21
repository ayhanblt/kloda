# P3-04 scoped FIX (test bekleme düzeni) — 20.11.2026, Sonnet 5.5, tek yazar

Plan/CURRENT/MANIFEST işlenmedi (koordinatör). Ham kanıt bu dizinde (`*.log`, `*.diff`, `*.sha256`).
Effort bilgisi: bu oturumda görülebilen tek değer çalışma bağlamındaki sayısal `reasoning_effort = 10`; bunun medium/high karşılığı oturumdan doğrulanamıyor (ekip kurulum kaydında "Sonnet high" yazıyordu, güncel değer doğrulanmadı). Tahmin edilmedi.

## 1. Başlangıç (düzenlemeden önce)
`fix-start-baseline.txt`: HEAD `508b3f0486…`, iki dosya `git diff` boş (HEAD ile eşit). LF sha256: Lifecycle `c1bf4a2c59458d01ee583cf4b4aa28b8d9af679a68d4d21409a7533d494d7157` (352 satır), Policy `43fe1aabb34dbeecd0a4aeac89867b2cf42540edd8df20f09ade3109b43aac2d` (361). Kopyalar `start/*.start`. Etkin (yorum/boş hariç) satır: 296 / 300.

## 2. Gerçek diff (canlı ağaç, yalnız iki dosya) — `fix-test-wait-order.diff` (112 satır, +28/−14)
Sonrası sha256 `fix-sources-after.sha256`: Lifecycle `09b584b478e7…`, Policy `66221b393d24…`; Job/Scheduler/Queue/AutomaticChecks aynı (`f84caf65 511b51b1 06b0b00b 736e7653`). Etkin satır **299 / 300** (≤300). Assertion/beklenti satırı eklenmedi/silinmedi.
- `held(...)`: yeni isteğe bağlı `frame` parametresi; `frame` verilirse yeni run zorlanmaz, zaten kapılanmış callback'in `kloda-ftps-job` thread'inin **BLOCKED ve stack'inde o metot** olması beklenir (aşama kanıtı). `frame == null` davranışı aynı (`gated`/`osStop` kullanıcıları etkilenmedi).
- `staleOrigin`: A'nın capture sonucu `capture` lambda'sına taşındı; A mevcut arbiter-dışı yolla (`AndroidFtpsPolicyChecks.gated`) ilk capture'ında **WAITING** bekletilir → test monitor'ü alır → `gate.countDown()` → A'nın aşamasının kendi metodunda BLOCKED olduğu kanıtlanır (`finally→complete`, `defer→defer`, `result→arbiter` [claim commit], `throw/locked/destroy→reportCurrent`) → ancak sonra B/destroy olayları (aynı monitor bloğu, aynı sıra, aynı assertion'lar). `finally` bloğu gate'i her durumda bırakır (başarısızlık dahil). Monitor, worker beklenirken artık main'in `onStartJob`'unu engellemiyor (A zaten onStartJob'dan geçmiş).
- `watch` dalı ve `Policy.destroyedWatch`: **fail-fast** `error("DECISION P3-04 …")` (aşağıda §5). Diff'te açık; PASS yok.

## 3. Komutlar / sonuç (varyantlar P3-04 klonu `/private/tmp/kloda-p3-04`: üretim 3 dosya byte-eş final, iki düzenli test dosyası canlıdan kopya; yalnız `AutomaticChecks` klonda geçici seçici)
Build: `./gradlew :my-module:compileDebugKotlin :my-module:assembleDebugAndroidTest -PklodaFtpsNative=true -PreactNativeArchitectures=arm64-v8a --console=plain --offline` → **exit 0**, `^e:` 0 (`build-fix-*.log`). Cihaz: sahipli `KlodaFtps16c` emulator-5590 `-read-only -no-snapshot`, bu çağrıda açılıp kapatıldı; `adb -s emulator-5590 shell am instrument -w -r -e scope ftps-automatic-lifecycle com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation` (adb exit hep 0; sonuç `INSTRUMENTATION_CODE`: −1=OK).

| Koşu | APK sha256 | Sonuç |
| --- | --- | --- |
| **Temsilci** `ftps-fs1-stale-finally-keeps-b` | `3cf354a4…315f3c` | **FRESH PASS** (CODE −1, ANR yok) — `run-fix-rep.log` |
| **Küme (11)** | `13a7447e…dee7f03` | **FRESH PASS 11/11** (CODE −1): `stale-{throw,locked,defer,result,destroy}`, `fs2-os-stop-locked-retry`, `fl1-stop-after-decision`, `fs2-stop-held-{finalization,report,same-token-b}`, `fp2-watch-null-throw-clean` — `run-fix-set.log` |
| `ftps-fs1-stale-watch-keeps-b` | `apk-fix-ftps-fs1-stale-watch-keeps-b.sha256` | deterministik **FAIL (fail-fast DECISION)**, CODE 0, ANR/hang yok |
| `ftps-fs1-destroyed-watch` | `apk-fix-ftps-fs1-destroyed-watch.sha256` | deterministik **FAIL (fail-fast DECISION)**, ANR/hang yok |

Sekiz etkilenen grup: **6 PASS** (finally, throw, locked, defer, result, destroy), **2 açık** (watch, destroyed-watch). Cihazda koşu sonrası ANR 0.
Seçici varyantları (`selector-fix-*.diff`) yalnız klonda; final PASS'in parçası değil. Tam `ftps-automatic-lifecycle` scope'u koşulmadı (iki WATCH grubu fail-fast ile bitirir).

## 4. Reuse / yeni / açık
- **Yeni (bu çağrı):** yukarıdaki 6+5 grup, yeni test varyantında. FL1, R2 clean, same-token B, FS2 os-stop `held/gated` yolu değiştiği için bu varyantta taze doğrulandı.
- **Reuse (tekrarlanmadı):** final lock 7/7; final lifecycle 22 PASS (fw1/fw2×4, fs2 os-stop, fp2×6, fp1×6, fl1, stop-held×3) ve 9/9 FP2-watch+R2 recovery; hepsi bu iki dosya değişmeden önceki varyanttır (üretim aynı; Policy'de yalnız `destroyedWatch` değişti, Lifecycle'da yalnız `held`/`staleOrigin`). R2 altı varyantın kalan 5'i (accepted/unknown/rejected/unreadable/foreign) ve `fp2-watch-{failure,old,new}` bu dosyalardaki değişiklikten etkilenmez (kod yolu aynı) → reuse. Eski iki ANR kaydı RED olarak durur (tekrar ANR üretilmedi).
- **Açık (ayrı):** (a) WATCH iki senaryo (DECISION, §5); (b) post-claim: "claim edilmiş run sonucu sonrası emekli E'nin geç `finished()`" runtime kapsamı kaybı — `result` dalı yalnız **claim commit** aşamasını kanıtlar (A, arbiter'daki claim commit'te BLOCKED), post-claim sonrası geç `finished()` karşıtı hâlâ review'da açık; (c) R2 owner fallback / delivery statik eşleme açık; (d) tam lifecycle tek koşu PASS değil; FO1 delta Faz4.

## 5. DECISION — WATCH (2 senaryo)
Kök neden kanıtı: WATCH worker'ı ilk iş `AndroidFtpsScheduler.changed(...)` (`synchronized(lock)` = arbiter) çağırır ve capture'ı **arbiter içinde** yapar; `rewatch/complete` de arbiter altında. Dolayısıyla worker'ın arbiter dışında beklediği hiçbir test-erişilebilir nokta yok (capture kancası `changed()` içinde, monitor tutulurken çalışır). Mevcut `gated` bu yolda monitor'ü tutarak bekler → test thread'i monitor'ü alamaz (kilitlenme); eski düzen ise main `onStartJob`'u ANR'ye götürür. B/destroy'u A'dan önce zorlamak için A'nın arbiter girişinde, monitor başka thread'de tutulurken park etmesi gerekir ve bu ancak `onStartJob` geçtikten sonra monitor alınarak mümkün; WATCH worker'ı onStartJob'dan hemen sonra (µs) arbiter'a girer → determinist değil. Bu nedenle ilgili iki senaryo **PASS verilmedi**, fail-fast bırakıldı (hang/ANR yok, cihaz kalıntısı yok).
Seçenekler (kapsam dışı; koordinatör/kullanıcı kararı): (1) üretimde test-amaçlı dar bir sıralama noktası (ör. WATCH worker'ının `changed` öncesi seam'i) — üretim değişikliği; (2) testten, canlı hizmet örneği üzerinde `onStartJob`'u monitor tutan test thread'inden reentrant çağırmak (JobParameters gerçek teslimden elde edilemediği için sentetik/hidden-API; bu senaryonun gerçek-platform tesliminden ayrılması); (3) iki senaryoyu açık/NOT_RUN bırakmak, review'da statik eşlemeyle (`changed/rewatch/complete` `live()`+`watching()` fence'leri) ele almak. Öneri: (3)+statik eşleme ya da (1); (2) sözleşmedeki "gerçek platform teslimi" özelliğini zayıflatır.

## 6. Cleanup / sayaçlar
Emülatör kapatıldı (`adb devices` boş, süreç yok), Gradle daemon durduruldu, AVD kalıcı verisi değişmedi (`userdata-qemu.img.qcow2` 11 Kas). P3-02 artefaktları değişmedi (`app-debug.apk` `2966a0d0…`, iOS DD, Desktop). P3-S0-algoritması: 1604 girdi, hash `4af8fbfc46ca…` (öncekinden farklı = yalnız bu iki test dosyası). Canlı ağaçta değişen yalnız iki test dosyası. Başarısız FIX sayacı: 0 (ilk yaklaşım 6 senaryoda geçti; WATCH için ikinci bir yaklaşım denenmedi, DECISION).
