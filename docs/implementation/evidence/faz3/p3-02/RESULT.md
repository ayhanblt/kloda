# P3-02 sonuç kaydı — 20.11.2026 (Sonnet 5.5, tek yazıcı; CURRENT/plan/MANIFEST işlenmedi)

Ham kanıt: `../logs/p3-02-*` (`.log` + `.exit`), bu dizin (`*.sha256`, `ios-artifact-check.txt`). Koordinatör MANIFEST'e işler.
Kapsam: plan §3 P3-02 — bir Android arm64 app+androidTest, bir iOS arm64 Simulator ürün build/link, modül/paket içeriği, Desktop main/renderer.
P3-04 test klonu (`/private/tmp/kloda-p3-04`, seçici/compat varyantları) ve 2.5 capture fixture app **kullanılmadı, ürün sayılmadı**. P3-03 runtime burada yok.

## 1. Provenance eşlemesi (önce) → reuse / taze kararı

| Girdi | Bulgu | Karar |
| --- | --- | --- |
| Android `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` | sha256 `1f873905da7fc900f0e577ce61ce4f1b6ddd4078c415c3955e5dc3d3dbe98145` (11 Kas, B1/B3 varyantı, flag'siz). Aralarında `AndroidFtps{Job,Scheduler,Queue}`, S3 `AndroidS3*` Kotlin ve androidTest kaynakları + mobil `src` (webdav/pairing/settings/locale) APK'dan **yeni** | **Aday değil** (tarihî varyant). Taze build gerekti. Canlı dosya **değişmedi**. |
| iOS yerel Simulator Debug `.app` (DerivedData `…-djiegxtov…` 30 Eyl, `…-futgxlkz…` 4 Kas) | `smbRequest/sftpRequest/ftpsRequest` üçü de **0** (executable + debug.dylib); B1 `/tmp/kloda-b1-ios-dd` yok | **Aday değil**. Taze build gerekti. |
| Desktop renderer `apps/desktop/dist/renderer` | `renderer_provenance`: `fresh:true`, stamp source `286fb4ed…`, renderer `477e940a…`, global `e0f6528c…` (P3-00 ile aynı, Desktop kaynakları değişmedi). Klonda da `fresh:true`, aynı hash'ler | **REUSE** (yeniden Vite yok) |
| Desktop main `apps/desktop/dist/main/main.js` | 5 Kas; `electron/**` kaynakları ondan yeni | Taze build gerekti |

Çakışma/aidiyet: başlangıçta Gradle/Kotlin daemon, emülatör (`qemu-system`), xcodebuild, Simulator yok; hiçbir cihaz/Simulator açılmadı, kurulum/deploy yok; bitişte süreç kalmadı (Gradle daemon betikle durduruldu).
Aday: HEAD `508b3f0486…`, staged boş, P3-S0 taze hash 1604 girdi `b6eddf88…` (P3-04 kaydıyla aynı; P3-S1 capture deltası ürün bundle'ına girmez); koşu sonunda aynı (canlı ağaç değişmedi), F1 altı kaynak hash'i aynı.
İzolasyon: `/private/tmp/kloda-p3-02` = canlı ağacın APFS klonu (`apps packages tools assets node_modules` + root dosyaları); F1 altı kaynak `cmp` byte-eş, `apps/mobile/src` ve `apps/desktop/src` `diff -rq` boş. iOS DerivedData `/private/tmp/kloda-p3-02-ios-dd`.
Tek sahipli sıralı koşu (betik `/private/tmp/p3-02-scripts/run.sh`, repo dışı): Android → Desktop main → iOS pod install → iOS build.

## 2. Komutlar / exit

| # | Komut (cwd) | Exit | Süre | Log |
| --- | --- | --- | --- | --- |
| A | `./gradlew :app:assembleDebug :my-module:assembleDebugAndroidTest -PklodaSmbNative=true -PklodaSftpNative=true -PklodaFtpsNative=true -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a --console=plain --offline` (klon `apps/mobile/android`) | **0** | 4m36s, 384 task yürütüldü | `p3-02-android-build.{log,exit}` |
| D | `npm run build:main --workspace @kloda/desktop` (klon kök) | **0** | ~4 s (cargo `Finished release 0.27s`, sqlite stamp eşit → atlandı) | `p3-02-desktop-main.{log,exit}` |
| I1 | `LANG=en_US.UTF-8 KLODA_SMB_NATIVE=1 KLODA_SFTP_NATIVE=1 KLODA_FTPS_NATIVE=1 pod install --no-repo-update` (klon `apps/mobile/ios`; B1 §20 tarifi, mevcut xcframework'ler) | **0** | ~1 dk | `p3-02-ios-pod-install.{log,exit}` |
| I2 | `xcodebuild -workspace KlodaSecurePhotosSync.xcworkspace -scheme KlodaSecurePhotosSync -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/kloda-p3-02-ios-dd ARCHS=arm64 build` | **0** (`** BUILD SUCCEEDED **`, `error:` 0) | ~4 dk | `p3-02-ios-build.{log,exit}` |

Bayrak seçimi: Android dört native opt-in (B1 Android derlemesi flag'siz idi; S3 `-PklodaS3Native` ve F1 `-PklodaFtpsNative` ayrı ayrı kanıtlıydı) — tek "ürün" varyantı olarak hepsi açık; iOS B1'in SMB/SFTP/FTPS tarifi (mevcut Pods yapılandırmasıyla aynı). Kompilasyon hatası 0 (`^e:` 0).

## 3. Artefaktlar ve içerik kontrolü (hepsi FRESH PASS, klon çıktısı)

**Android app** `/private/tmp/kloda-p3-02/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
sha256 `2966a0d07bc65f940a87773d9be585cf2da4d0d13f98af845bb7d59f3877dbfa` (108 111 973 B). `com.kloda.app` v0.0.0, `native-code: 'arm64-v8a'` (yalnız arm64), targetSdk 36.
`lib/arm64-v8a`: `libhermesvm.so`, `libhermestooling.so`, `libkloda_{ftps,pairing,s3,sftp,storage}_native.so`. DEX: `smbRequest`=1 `sftpRequest`=1 `ftpsRequest`=1; sekiz modül sınıfı (`KlodaSyncRuntime/Pairing/Backup/Smb/Sftp/Ftps/Cloud/S3Module`) ve `AndroidFtpsJob`. Manifest: `AndroidFilesService`, `AndroidBackupJob`, `AndroidWebDavJob`, `AndroidSmbJob`, `AndroidSftpJob`, `AndroidS3JobService`, `AndroidFtpsJob`, `KlodaOAuthRedirectActivity`, `AndroidBackupReceiver`.
**Android androidTest** `…/modules/my-module/android/build/outputs/apk/androidTest/debug/my-module-debug-androidTest.apk`
sha256 `e75ddfa31fd1b8de7a96fd081bb84322a3609af2adfe275fca326eb53936dbd8` (196 678 941 B), `com.kloda.sync.test`. Not: test paketi modül `jniLibs` nedeniyle dört ABI (arm64-v8a/armeabi-v7a/x86/x86_64) taşır; app arm64-only. P3-04 varyantından (FTPS-only bayrak, seçici) ayrı varyant; **çalıştırılmadı**.
**Rust native (arm64)** klonda yeniden üretilen `.so`'lar canlı ağaçtaki önceki `jniLibs` ile **byte-eş** (ftps `74c22414…`, pairing `0577cebf…`, s3 `61145ec9…`, sftp `586f3c1b…`, storage `bd31f327…`; `android-jnilibs-arm64.sha256`). Tasks: `buildFtpsNative/buildSftpNative/buildS3Native/buildStorageNative` yürütüldü, `buildPairingNative` UP-TO-DATE.

**iOS Simulator Debug** `/private/tmp/kloda-p3-02-ios-dd/Build/Products/Debug-iphonesimulator/KlodaSecurePhotosSync.app` (`com.kloda.app`, `iphonesimulator`, MinimumOS 16.4, `lipo -archs` = **arm64** hem executable hem debug.dylib).
- executable `ecb14e3de349f644697cf53e776815a2823573060c360862809154c1522f7e69`; `KlodaSecurePhotosSync.debug.dylib` `bc7b6bfd1492e8e17b050dae9c1db8a295550bd8bf5f13e36d892c19fc4960a9`.
- debug.dylib: `smbRequest`=1 `sftpRequest`=1 `ftpsRequest`=1 (executable'da 0 — debug.dylib mimarisi, B1 ile aynı); `IosSmbQueue/IosSftpQueue/IosFtpsQueue` = 354 (native-branch derlendi); Rust C export'ları `kloda_storage`=28, `kloda_sftp`=23, `kloda_ftps`=18; sekiz Expo modül sınıfı adı mevcut. B1 `22-ios-symbols.log` ile (3/3 fabrika, 3 queue, sftp/ftps export) uyumlu.
- Build logunda canlı ağaca yol referansı **0**, klon yolu 182 → izole.
- Ayrıntı: `ios-artifact-check.txt`.

**Desktop main** klon `apps/desktop/dist/main/main.js` sha256 `acb1f49a…ca0a127` (güncel `electron/**` kaynağından yeniden üretildi), `dist/native/kloda_pairing.node` `7f173731…`, `better_sqlite3.node` `788aea8f…` (sqlite stamp electron 44.4.5/12.11.1 darwin-arm64 eşit, yeniden derlenmedi); 50 çıktı hash'i `desktop-main-dist.sha256`. Renderer REUSE (yukarıda).

## 4. Durum

| Parça | Durum |
| --- | --- |
| Android arm64 app + androidTest build/paket içeriği | **FRESH PASS** (derleme + içerik; çalıştırma yok) |
| iOS arm64 Simulator ürün build/link + sembol/modül içeriği | **FRESH PASS** |
| Desktop main | **FRESH PASS** |
| Desktop renderer | **REUSE** (stamp taze, P3-00/01 ile aynı) |
| Eski `app-debug.apk` / eski iOS DerivedData | tarihî varyant, aday dışı, silinmedi/değiştirilmedi |

Statik P3-03 önkoşulu karşılandı: iki ürün binary'sinde de üç fabrika bağlı (Android DEX, iOS debug.dylib). **Runtime kanıtı yok**; Debug build'ler JS'i Metro'dan yükler → P3-03 izole Metro + sahipli hedef ister (burada başlatılmadı).

## 5. Açıklar / sınırlar (PASS'e çevrilmedi)

- Artefaktlar canlı `apps/mobile/android/app/build` altında **değil**, klon yollarında; canlı eski APK'yı kullanan bir sonraki adım yanlış (eski) binary'ye bağlanır. P3-03 yukarıdaki yol+hash'i kullanmalı.
- iOS S3 native opt-in (`KLODA_S3_NATIVE`) **derlenmedi** (`IosS3Queue`=0, `kloda_s3` export 0): mevcut kanıtlı iOS tarifi (B1) yalnız SMB/SFTP/FTPS; iOS S3 native için doküman/kanıt tarifi bulunmadı, eklenmedi. `KlodaS3Module` sınıf adı JS yüzeyinde var. P3-02 satırı için iOS S3 gerekiyorsa koordinatör kararı.
- Klonda `Podfile.lock` `ExpoModulesCore` SPEC CHECKSUM satırı canlıdan farklı (`ce95aad8…` vs `e3465005…`); yol normalleştirilince `ExpoModulesCore.podspec.json` byte-eş (podspec `file:///…/ExpoModulesCore.tar.gz` mutlak yol içerir) → yol kaynaklı, içerik farkı değil. Canlı `Podfile.lock` değişmedi (`383cf439…`).
- Lint (P3-05), gerçek koşu/instrumentation, UUID runtime (P3-03), Android 8 açık P3-04 grubu bu çağrıda yok. Gradle uyarıları incelenmedi (tam lint P3-05).
- Klonlar (`/private/tmp/kloda-p3-02`, `/private/tmp/kloda-p3-02-ios-dd`, `/private/tmp/kloda-p3-04`) bırakıldı (CoW; yeni disk yazımı: build çıktıları). Koordinatör istemedikçe silinmedi.

## 6. Tek sonraki adım

P3-02 kanıtı hazır; bir sonraki bağımsız satır **P3-05** (Android dar lint, aynı klon/Gradle: `./gradlew :my-module:lintDebug -x :react-native-worklets:lintAnalyzeDebug -PklodaFtpsNative=true -PreactNativeArchitectures=arm64-v8a`, tam lint ayrı kayıt). P3-03 önkoşulu (iki ürün binary'si) bu çağrıyla açıldı; runtime koşusu ayrı devir. P3-04'ün 8 grubu ve sayaçlar korunuyor, test kaynağı değiştirilmedi.
