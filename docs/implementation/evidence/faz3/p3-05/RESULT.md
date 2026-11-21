# P3-05 sonuç — 20.11.2026 (Sonnet 5.5; MANIFEST/CURRENT/plan işlenmedi)

Ham: `../logs/p3-05-lint-{narrow,full}.log` (komut+exit+zaman damgası içinde), bu dizinde `narrow-*`, `full-module-*`, `full-app-*` lint raporları (`.txt/.xml/.html`), `p3-02-artifacts-{before,after}.{sha256,mtime}`.
Effort: bu çağrıda görülebilen tek değer sayısal `reasoning_effort = 10`; medium/high karşılığı ve konfigürasyonun yüklendiği doğrulanamıyor, tahmin edilmedi.

## Ortam / aday
P3-02 klonu `/private/tmp/kloda-p3-02` (aynı Gradle, `--offline`), başka Gradle/emülatör/xcodebuild yok (koşu sonunda Gradle daemon durduruldu). Cihaz/Simulator/yeni APK build'i yok.
Aday = P3-02 klonu: ana kaynak canlıyla eşit; **tek delta** canlıdaki `AndroidFtpsLifecycleChecks.kt` ve `AndroidFtpsPolicyChecks.kt` (P3-04 scoped FIX, klonda eski). Lint raporlarında hiçbir test-kaynak konumu yok (0), yani bu iki dosyanın lint etkisi bu raporla ne doğrulandı ne çürütüldü; ürün/ana kaynak etkilenmedi.
Native bayrakları P3-02 build'iyle aynı (`-PklodaSmb/Sftp/Ftps/S3Native=true -PreactNativeArchitectures=arm64-v8a`): derleme girdileri güncel kaldı, yalnız lint önkoşul görevleri koştu. **P3-02 artefaktları değişmedi**: `app-debug.apk` `2966a0d0…`, androidTest APK `e75ddfa3…`, iOS `debug.dylib` `bc7b6bfd…`, Desktop `main.js` `acb1f49a…` hash ve mtime önce/sonra birebir aynı. Suppression/baseline/kaynak değişikliği yok; canlı ağaçta ek değişiklik yok.

## Komutlar / gerçek sonuç
| Koşu | Komut (özet) | Exit | Sonuç |
| --- | --- | --- | --- |
| **FTPS dar** | `./gradlew :my-module:lintDebug -x :react-native-worklets:lintAnalyzeDebug <4 native bayrağı> -PreactNativeArchitectures=arm64-v8a --console=plain --offline` (R3 komutu; yalnız bayrak kümesi P3-02'ye eşitlendi) | **1** | `:my-module:lintDebug FAILED`: **3 error / 78 warning (81 issue)**, çöküş yok, 1m01s |
| **Tam (onaylı K1)** | `./gradlew :app:lintDebug :my-module:lintDebug :my-module:compileDebugAndroidTestKotlin --offline --console=plain --continue -Pandroid.lint.useK2Uast=false <bayraklar>` (25 Eki komutu; `--continue` ve bayraklar eklendi ki app raporu da üretilsin) | **1** | worklets `lintAnalyzeDebug/AndroidTest/UnitTest` **çökmeden tamamlandı**; `:app:lintDebug` **0 error / 28 warning**; `:my-module:lintDebug` **3 error / 78 warning** (dar ile birebir aynı 81 issue); 1m13s, 831 task (220 yürütüldü) |

Dar rapordaki worklets hariç tutma tam lint PASS sayılmaz; tam K1 koşusu da **PASS değil** (modül 3 error, exit 1). Tam lint (K2 varsayılan) bu çağrıda koşulmadı.

## Üç tarihî dış-kapsam bulgu
| Bulgu | Önce (R3) | Şimdi | Sınıf |
| --- | --- | --- | --- |
| `AndroidDeviceCheck.kt:40` MissingPermission (BiometricManager.canAuthenticate / USE_BIOMETRIC) | Error | Error, aynı dosya:satır | **AYNI** (dosya canlı=klon=HEAD) |
| `AndroidDeviceCheck.kt:45` MissingPermission (BiometricPrompt.authenticate) | Error | Error, aynı | **AYNI** |
| `AndroidS3Automatic.kt:46` NewApi (API 26 / min 24) | Error | Error, aynı (dosya HEAD'e eşit) | **AYNI** |
| worklets `lintAnalyzeDebug` K2 "KaModule" çöküşü | tarihî iki çöküş (S3 `lint-1/2.log`) | dar koşuda **hariç**; tam koşuda **K1 ile çökmeden tamamlandı** | **YENİDEN ÜRETİLMEDİ** (K1). Varsayılan K2 çöküşü bu çağrıda koşulmadı → durumu bilinmiyor, kör tekrar yapılmadı |

R3 rapor farkı (81↔81 issue, error kümesi aynı): **yeni** warning `UseKtx` `AndroidFtpsScheduler.kt:317` (`Uri.parse(source).let{…}` `triggers()` içinde; satır fix2 öncesi `start` ve önceki HEAD'lerde yok → fix2 kaynaklı) → R3'ün "FTPS altı dosyada 0/0" ifadesi fix2 final için **artık geçerli değil: 1 warning, 0 error** (**FARKLI**, açık/izlenir; düzeltme/suppression yok). Eski rapordaki `GradleDependency build.gradle:12` (androidx.browser 1.10.0) bu koşuda yok (aracın çevrimdışı/sürüm kontrolü farkı olabilir; kanıtlanmadı).
Ekim 2026 tam lint sayıları (app 0/30 uyarı, modül 0/34) güncel durumla karşılaştırılamaz (modül warning 34→78, app 30→28; kaynak ve araç sürümü farklı); tarihî PASS olarak tekrarlanmadı.

## Reuse / taze / açık
- **Taze:** iki lint koşusu ve raporları (yukarıda). **Reuse:** P3-02 derleme çıktıları (lint önkoşulları güncel kaldı).
- **Açık:** 3 mevcut error (kapsam dışı ürün dosyaları; ürün/izin kararı gerektiriyor — değiştirilmedi); `UseKtx` Scheduler:317 warning; K2 varsayılan tam lint durumu; test kaynaklarının lint'i (rapora girmiyor); lint PASS yok.

## Tek sonraki adım
Koordinatör kararı: 3 error için (a) kapsam dışı ürün bulgusu olarak izle / (b) ayrı onaylı ürün scoped FIX (biometric izin bildirimi/guard, S3 API26 guard — güvenlik/ürün davranışı, bu işte yetkisiz). Bağımsız sıradaki satır: **P3-06** (native Rust/Swift/JNI + TLS/LAN izole paket); P3-05 lint kanıtı için yeni koşu gerekmez.
