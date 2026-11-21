# P3-05-S3-3 — `s3-automatic-contract` sınır koşusu (21.11.2026)

Durum: **REVIEW — P3-05-S3-3 dar regression kanıtı tamam; bağımsız kabul/üst kapılar açık.** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Kod/test kaynağına dokunulmadı; commit/push yok; sayaçlar değişmedi.

## Aday ve artefakt
Hash-eşleşen hazır test APK'sı yoktu (P3-02 androidTest APK `e75ddfa3…` eski kaynaklı). Dar build, mevcut P3-05 klonunda (`/private/tmp/kloda-p3-05-bio`; canlı `AndroidS3Automatic.kt`, `KlodaS3Module.kt`, `AndroidS3AutomaticChecks.kt` ile `cmp` eşit):
`./gradlew :my-module:assembleDebugAndroidTest -PklodaSmb/Sftp/Ftps/S3Native=true -PreactNativeArchitectures=arm64-v8a --console=plain --offline` → **exit 0**, BUILD SUCCESSFUL 34 s ([build-androidtest.log](build-androidtest.log)). androidTest APK sha256 `5ef0eab57e01c88cfbde4de64c3d216a623f9328906659520ba0ea66ce982cad` ([sha](androidtest-apk.sha256)). P3-02 orijinal APK'ları önce/sonra aynı (`2966a0d0…`, `e75ddfa3…`; [önce](p3-02-before.sha256)/[sonra](p3-02-after.sha256)).

## Cihaz ve aidiyet
Sahipli AVD `KlodaFtps16c` (P3-12 ile aynı; API35 google_apis arm64), `emulator -read-only -port 5590 -no-snapshot-save -no-window`; başlangıçta `adb devices` boş ve emulator süreci yoktu, süreci ben başlattım. Doğrulama ([device.log](device.log)): `emulator-5590`, `ro.build.version.sdk=35` (Android 15), abi arm64-v8a, `emu avd name`=KlodaFtps16c, user 0 `running` (kilitsiz). İlk deneme yanlış `tools/emulator` stub'ıyla başlamadı ([emulator.log](emulator.log) üzerine yazıldı); ikinci deneme tam yoldaki emulator ile.

## Koşu
`pm clear com.kloda.sync.test` sonrası:
`adb -s emulator-5590 shell am instrument -w -r -e scope s3-automatic-contract com.kloda.sync.test/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation` → **`INSTRUMENTATION_CODE: -1`, EXIT 0, 2 s**; `START/PASS s3-automatic-manual-authority`; sonuç "S3 default-off/automatic survives UI leave/authority revocation/manual pause/callback-once/fake-key cleanup PASS; no network/media" ([log](run-s3-automatic-contract.log)). Yalnız bu tek scope; yerel izole, bulut/kimlik bilgisi/ağ yok.

## 24/25/26/35 assertion'ları gerçekten koşuyor mu
`AndroidS3AutomaticChecks.run` bu scope'un tek grubunun ilk satırlarıdır; `check()` başarısızsa grup `FAIL`/exception verirdi. Test APK dex'i ([dex-boundary-calls.txt](dex-boundary-calls.txt)): `run` içinde `const 24/25/26/35` → `AndroidS3Automatic.automaticSupported(int)` dört çağrı (`0010/0021/0032/003c`). Bu APK'dan `PASS` → `24,25 → false`, `26,35 → true`. Kırmızı (eski kaynak) koşu yapılmadı.

## Sınır — bu NEDİR / DEĞİLDİR
Bu, API35 cihazında **saf fonksiyonel sınır sözleşmesi** (`sdk` parametresi) kanıtıdır. Gerçek API 24/25 JobScheduler/cihazı, `reconcile`/`onStartJob`'ın API<26'da erken dönmesi, gerçek API26+ constraint projection/teslim DEĞİLDİR; bunlar açık. Tam K2/worklets, üst P3-05, Faz3/Faz4 açık.

## Cleanup
Emülatör `emu kill` ile kapandı (`adb devices` boş, qemu süreci yok); AVD `-read-only` olduğundan veri değişmedi. Gradle daemon durduruldu. Test APK AVD'de kalmadı (read-only). Klon bırakıldı. Fixture/sunucu/ağ yok.

## Sonraki adım
Koordinatör S3-3 satırını "dar API35 parametre sözleşmesi PASS; gerçek API24/25 ve API26+ projection açık" olarak işler; bağımsız review/Faz3 sırası koordinatörde.
