# P3-03 JS→native UUID fabrikaları — 20.11.2026

Durum: **PASS (iki platform, kendi kapsamında).** Android arm64 ve iOS arm64 Simulator ürün Debug binary'lerinde SMB/SFTP/FTPS `newRequest()` her biri 2 çağrı → platform başına 6 geçerli, benzersiz değer; JS fallback yok. UUID değerleri kaydedilmedi/loglanmadı.
Variant metadata: `claude-agent/sonnet#medium` (Sonnet 5.5); reasoning_effort sayısından sonuç çıkarılmadı. Ürün/native kodu, P3-02 artefaktı, canlı ağaç, ana manifest/CURRENT/plan değişmedi. Commit/push, ayrı review yok.

## Provenance (preflight, değişmedi)
- Android `…/kloda-p3-02/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` sha256 `2966a0d07bc6…dbfa` (P3-02 ile eşit; sonda yine eşit). Paket `com.kloda.app`, DEX'te `smbRequest/sftpRequest/ftpsRequest` (P3-02 §3).
- iOS `KlodaSecurePhotosSync.debug.dylib` sha256 `bc7b6bfd1492…60a9` (P3-02 `ios-artifact-check.txt` ile eşit; sonda yine eşit); üç fabrika sembolü debug.dylib'de.
- `src/shared/api/{smb,sftp,ftps}.ts` klon ↔ canlı `cmp` byte-eş. Wrapper'lar `requireOptionalNativeModule(...).xRequest()` çağırıp yoksa `native_unsupported` fırlatır, `uuid` regex'iyle doğrular → JS fallback yolu yok.
- Prob girişi: klonda geçici `apps/mobile/capture/p3-03-probe.tsx` (kopya + sha256 `4558c167…b85c`: `p3-03-probe.tsx.txt`, `probe.sha256`). Her fabrikayı 2 kez çağırır, yalnız sayıları (calls/valid/unique/nativeModulePresent/error adı) loopback sink'e POST eder; değer göndermez.

## Koşu (tek ortak cihaz sırası: Android → iOS)
Metro: sahipli `expo start --dev-client --localhost --port 18081` (klon `apps/mobile`, `CI=1`), sink `127.0.0.1:18403`; yalnız loopback, ağ/protokol hedefi, hesap, transfer, pairing yok. Ham: `metro-android.log` (iki platformun Metro çıktısı), `sink*.log`.
| Adım | Sonuç |
| --- | --- |
| Bundle ön kontrol (android) | HTTP 200 |
| Android: owned AVD `KlodaFtps16c` `-read-only` port 5590 arm64, API35; `adb install -r` P3-02 APK exit 0 (`android-install.log`); `adb reverse` 18081/18403; dev-client deep link `exp+kloda://expo-development-client/?url=…p3-03-probe.bundle?platform=android…` | **PASS** (`android-sink.jsonl`): smb/sftp/ftps → calls 2, valid 2, unique 2, nativeModulePresent true, error null; totalValues 6, totalUnique 6 |
| iOS: run-created `Kloda-P303-<ts>` (iPhone 17 Pro, iOS 26.5) boot/install P3-02 `.app`, `simctl launch com.kloda.app --initialUrl <bundle> -EXDevMenuIsOnboardingFinished 1 -EXDevMenuShowsAtLaunch 0` (ios.py tarifi) | **PASS** (`ios-sink.jsonl`): aynı sayılar, totalValues 6, totalUnique 6 |

## Başarısız/yeniden denemeler (dürüst kayıt — ürün/test başarısızlığı değil, düzenek)
iOS ilk iki launch rapor üretmedi: (1) ilk launch'ta ios.py'deki `LAUNCH_ARGS` verilmemişti (dev-launcher menüsünde kaldı, ekran görüntüsü kanıt); (2) ikinci launch'ta iOS sink süreci arka plan kabuğu bitince ölmüştü (port dinlemiyordu, `sink-ios.log` boş) → JS POST'u sessizce düştü. Üçüncü launch (sink `nohup` ile, bayraklarla) PASS. Bunlar ortam/düzenek hatalarıydı; CDP kullanılmadı, hiçbir üçüncü-CDP/aynı-mekanizma tekrarı yok; sayaç artmadı.

## Cleanup (doğrulandı)
Emülatör `emu kill` → `adb devices` boş, qemu yok. iOS Simulator `Kloda-P303-*` shutdown+delete, listede 0. Metro/sink sonlandı, 18081/18403 dinleyen 0. Klondaki geçici prob dosyası silindi (`capture/` yalnız orijinal 5 dosya). P3-02 artefaktları ve `/private/tmp` klonları bırakıldı. Başka sürece dokunulmadı. Repo tracked-değişiklik sayısı dilim öncesine göre eklenmedi (yalnız evidence/faz3/p3-03 yeni).

## Kapsam sınırı / açık
Bu bir Debug-build, JS bundle'ı Metro'dan yüklü, sentetik prob kanıtıdır: native→JS UUID fabrikaları çalışıyor. Ürün çağıranlarının (`use-*-items`) UI akışı, Release build, gerçek cihaz ve Android emülatör imajının önceden kurulu `com.kloda.app` kopyası üstüne `install -r` yapılması (read-only AVD, çıkışta atıldı) bu kanıtın dışındadır.

## Sonraki adım
Koordinatör MANIFEST'te P3-03'ü PASS (iki platform, scoped) işlesin; kalan P3 satırları sırasına devam.
