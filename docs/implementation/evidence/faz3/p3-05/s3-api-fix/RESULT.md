# P3-05 S3 API 24/25 — dar FIX, REVIEW'a hazır (21.11.2026)

Durum: **REVIEW (kanıt hazır; bağımsız kabul YOK).** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5), tek yazıcı. Kullanıcı kararı: Android 7.0/7.1'de yalnız otomatik S3 desteklenmez. Başlangıç HEAD `508b3f04` + dirty ([start-head.txt](start-head.txt), [start-status.log](start-status.log)). Commit/push, ürün/izin/pil/bağımlılık/minSdk/suppression değişikliği yok. D12'ye dokunulmadı.

## Değişiklik (10 izinli dosya; [diff](s3-api.diff), +59/−13, [önce](before.sha256) → [sonra](after.sha256))
- `AndroidS3Automatic.kt`: `automaticSupported(sdk)` (≥26). `reconcile()` API<26'da erken döner (coordinator hiç kurulmaz → yeni iş yok, API26 setter çağrılmaz). `AndroidS3JobService.onStartJob` API<26'da `false` (teslimat başlamaz). `AndroidS3JobOs.schedule` setter'dan önce yerel `SDK_INT < O` guard'ı (throw; `setRequiresBatteryNotLow(true)` korunur, pil kısıtı gevşetilmedi). `cancel()/revoke` değişmedi (disable/pause yolu korunur).
- `KlodaS3Module.kt`: public status'a optional `automaticSupported`; API<26'da `canAutomatic=false`, `automaticEnabled=false` raporlanır (kayıtlı ayar değişmez). `automaticS3(enabled=true)` API<26'da `automatic_unsupported` ile `cancelRestore`/`setAutomatic`'ten ÖNCE reddedilir; `enabled=false` serbest. Manuel enable/run/restore/genel `supported` aynı.
- JS: `s3.ts` `automaticSupported?` opsiyonel boolean (yokluğu = destekli; iOS/eski köprü uyumlu), `false` iken `canAutomatic/automaticEnabled` çelişkisi reddedilir. `s3-page.tsx` `automaticSupported===false` iken `automaticHint` yerine yerelleştirilmiş açıklama; düğme `canAutomatic` ile zaten kapalı. 3 locale `destinations.s3.automaticUnsupported` (TR/EN/DE, parity 695=695=695).
- Testler: `s3-product.spec.ts` (+1), `s3-queue-page.spec.tsx` (+2; mock'a `automatic`), `AndroidS3AutomaticChecks.kt` (sınır sözleşmesi: 24/25 false, 26/35 true).

## Kabul eşlemesi / kanıt
| ID | Kanıt | Düzey |
|---|---|---|
| S3-1 | Kod: reconcile/onStartJob/schedule/automaticS3 guard'ları. Android: `compileDebugKotlin` + `compileDebugAndroidTestKotlin` exit 0; `automaticSupported(24/25/26/35)` instrumented check yalnız **derlendi**, koşmadı | **Derleme + kaynak gözlemi; API24/25 davranışı çalıştırılmadı** (cihaz/emülatör yok, uydurulmadı) |
| S3-2 | jest 16/16 (status uyumu eski/yeni/çelişkili, UI mesaj + disabled düğme + manuel `runS3` çalışır, destekli/yok durumda hint+düğme + `automatic(true)`) | Mock'lu JS/bridge |
| S3-3 | `UNMETERED`/`BatteryNotLow`/`persisted` satırı değişmedi (diff); lint `NewApi` 1→0; biyometrik `MissingPermission` 0 korunur | Dar lint |

Testler uygulamadan SONRA eklendi; eski kaynak üzerinde kırmızı koşu yapılmadı (yalnız yeşil kanıt).

## Komutlar (hepsi taze; [logs/](logs))
| Komut | Exit |
|---|---|
| `npx jest` s3-product/s3-queue-page/s3-page/s3 spec + i18n (apps/mobile) | 0, 16/16 |
| `npx tsc --noEmit -p .` | 0 |
| `npx eslint` s3-page.tsx, s3.ts, 2 spec | 0 |
| Locale parity (python) | 695=695=695 True |
| Klon `/private/tmp/kloda-p3-05-bio` (P3-02 CoW; 3 Kotlin dosyası canlıdan kopyalandı, `cmp` eşit): `./gradlew :my-module:compileDebugKotlin :my-module:compileDebugAndroidTestKotlin :my-module:lintDebug -x :react-native-worklets:lintAnalyzeDebug --continue <4 native bayrak> -PreactNativeArchitectures=arm64-v8a --console=plain --offline` | **0**, BUILD SUCCESSFUL 59 s |

Lint ([lint-after.txt/xml](lint-after.txt)): **0 error / 78 warning** (biyometrik sonrası baseline 1 error `NewApi` AndroidS3Automatic:46 / 79 issue). `NewApi` 0, `MissingPermission` 0. Bu **dar modül lint'i**, tam K2/app lint veya worklets analizi değildir (worklets hariç, önceki koşuyla aynı).

## Sınırlar / açık
- API 24/25 cihaz/emülatör kanıtı yok; native API<26 dalları yalnız derlendi ve kaynak olarak incelendi. Gerçek JobScheduler teslimat/K2 tam lint/Faz3 PASS değil.
- `UseKtx` ve diğer warning'ler dokunulmadı. P3-02 artefaktları ve `/private/tmp/kloda-p3-02` değişmedi; yalnız `kloda-p3-05-bio` klonu güncellendi (3 dosya).

## Cleanup
Gradle daemon `--stop` ile durduruldu (süreç yok). Klon bırakıldı. Simulator/emülatör/ağ/servis kimlik bilgisi yok; S3 testleri yalnız yerel mock.

## Sonraki adım
Ayrı bağımsız GPT reviewer: [diff](s3-api.diff) ve bu kanıt. Kabul sonrası koordinatör CURRENT/MANIFEST/lint notunu (Aile 2 → çözüldü, scoped) günceller.
