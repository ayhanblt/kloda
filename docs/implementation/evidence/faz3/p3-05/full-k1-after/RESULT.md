# P3-05 tam K1 lint — biyometrik + S3 sonrası (21.11.2026)

Durum: **REVIEW — tam K1 (app+modül+worklets) lint exit 0; K2/cihaz/runtime PASS değil.** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Ürün/test kaynağı, CURRENT/plan/manifest değişmedi; commit/push yok; sayaçlar aynı.

## Provenance
Aday: `/private/tmp/kloda-p3-05-bio` (P3-02 APFS klonu; biyometrik manifest + S3 FIX kaynakları zaten klonda). Güvenli eşleme: canlı↔klon `diff -rq` (build/.gradle/node_modules/.cxx hariç) `apps/mobile/android`, `package.json`, `package-lock.json`, `apps/mobile/{package.json,app.json}` **eşit**; `apps/mobile/modules` tek fark iki P3-04 FTPS androidTest dosyası (klonda eski) → canlıdan klona kopyalandı, `cmp` eşit; sonra `modules` canlı==klon ([provenance-sync.log](provenance-sync.log)). Canlı kaynağa yazılmadı. Not: JS/TS ve docs değişiklikleri Android lint girdisi değildir.

## Komut (yalnız bir kez; [log](lint-k1-full.log), [exit](lint-k1-full.exit))
`./gradlew :app:lintDebug :my-module:lintDebug :my-module:compileDebugAndroidTestKotlin --offline --console=plain --continue -Pandroid.lint.useK2Uast=false -PklodaSmbNative=true -PklodaSftpNative=true -PklodaFtpsNative=true -PklodaS3Native=true -PreactNativeArchitectures=arm64-v8a` (klon `apps/mobile/android`) → **exit 0**, BUILD SUCCESSFUL 2m10s, 831 task (395 yürütüldü). worklets hariç tutma/suppression/baseline yok; varsayılan K2 koşmadı (log'da "KaModule"/çöküş yok).

## Task sonuçları
| Alan | Sonuç |
|---|---|
| `:app:lintDebug` ([txt](app-lint.txt), [xml](app-lint.xml)) | **0 error / 28 warning** |
| `:my-module:lintDebug` ([txt](module-lint.txt), [xml](module-lint.xml)) | **0 error / 78 warning** |
| `:my-module:compileDebugAndroidTestKotlin` | başarılı |
| `:react-native-worklets:lintAnalyzeDebug` | **UP-TO-DATE** (klondaki önceki K1 çıktısı; bu koşuda yeniden yürütülmedi, çökme yok); `lintAnalyzeDebugAndroidTest/UnitTest` yürütüldü, başarılı. worklets için ayrı `lintDebug` raporu komutta istenmedi/üretilmedi |

## Önceki tam K1 ile fark (`../full-*-lint-results-debug.xml`)
- Modül: 3 error / 78 warning → **0 / 78** (81→78 issue). Kaldırılan: `MissingPermission` `AndroidDeviceCheck.kt:40` ve `:45`, `NewApi` `AndroidS3Automatic.kt:46`. **Eklenen issue yok**; 78 warning kümesi aynı (UseKtx `AndroidFtpsScheduler.kt:317` dahil, dokunulmadı).
- App: 0/28 → **0/28**, kümesi aynı (eklenen/kaldırılan yok).

## Kapsam sınırı
İki rapor da issue konumlarında test kaynağı içermiyor (0); `lintAnalyzeDebugAndroidTest/UnitTest` yürütüldü ama androidTest kaynaklarında bulgu üretmedi/raporlanmadı. K1 sonucu **K2 varsayılan lint değildir**; native cihaz/runtime PASS değildir. Üst P3-05 ve Faz3/Faz4 açık.

## Cleanup
Gradle daemon `--stop` (süreç yok). P3-02 orijinal APK'ları önce/sonra aynı (`2966a0d0…`, `e75ddfa3…`; [önce](p3-02-before.sha256)/[sonra](p3-02-after.sha256)). Emülatör/cihaz/ağ yok. Klon bırakıldı.

## Sonraki adım
Koordinatör P3-05 satırına "tam K1 lint exit 0 (app 0/28, modül 0/78, worklets analyze OK); K2 açık" işler. İstenirse K2 ayrı karar (tarihî iki çöküş).
