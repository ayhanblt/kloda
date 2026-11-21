# P3-05 — bağımsız biyometrik bildirim incelemesi (21.11.2026)

**ACCEPTED — yalnız P3-05 biyometrik bildirim FIX'i (Aile 1).**
Sözleşme: `next-plan.md` §3 “P3-05 dar FIX — biyometrik izin bildirimi”,
Faz3 `MANIFEST.md:57`. Reviewer: GPT-6.2 Sol (`openai/gpt-6.2-sol`),
oturum `ses_e05b3160cffetF78VQHyjKxkcP` (`OPENCODE_SESSION_ID`),
Sonnet uygulamasından ayrı. Uygulayıcı varyantı kayıtta
`claude-agent/sonnet#medium`.

- **Tek dosya / tek bildirim.** HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`,
  staged boş. `AndroidManifest.before.xml` dosyası ilgili HEAD blob'u ve
  `/private/tmp/kloda-p3-02` modül manifestiyle byte-eş (`before.sha256`
  `037f6090…cb03`). Canlı modül manifesti FIX klonuyla byte-eş
  (`after.sha256` `7350a6d2…e5d1`); yeniden çıkarılan diff `live-manifest.diff`
  ile aynı. `apps/mobile/modules/my-module/android/src/main/AndroidManifest.xml:13`
  tek, niteliksiz `android.permission.USE_BIOMETRIC` (`android:name` dışında
  nitelik yok); `USE_FINGERPRINT` veya başka delta yok. Çalışma ağacının tamamı
  temiz varsayılmadı; komşu FTPS androidTest deltaları önceki P3-04, bu FIX değil.
- **Debug izin kümesi aynı.** `logs/merge-{before,after}.{log,exit}`:
  `:app:processDebugMainManifest` 0/0. `merged-before.xml`, `merged-after.xml`
  ve iki klondaki Debug task çıktısı byte-eş, SHA-256
  `272ac79619f7e7e40ce19f3e8c183b5c2723f37af61f75b8ac8e4f4fa5fbb613`.
  XML'den bağımsız sayım: izin öğesi/nitelikleri 20=20, BIO bir kez.
  Debug merger raporlarında öncesi AndroidX Biometric 1.1.0'dan `ADDED`,
  sonrası `:my-module` kaynağına aynı AndroidX girdisi `MERGED`; Fingerprint
  kaynağı değişmedi. İki klonun ilgili Gradle config'leri ve üretilmiş
  `BuildConfig` Debug/dört native flag eşikliği doğrulandı; eski komut ve
  FIX Gradle logu arm64-v8a yolunu gösteriyor. FIX logu tam çağrı satırını
  yinelemiyor; `--offline` ve `-x` kapsamı devir kaydından, tam lint iddiası yok.
  P3-02 orijinal artefakt hash'leri `../p3-02-artifacts-after.sha256` ile eşit.
- **Hedef iki lint hatası gitti.** `../narrow-lint-results-debug.xml` ve
  `../full-module-lint-results-debug.xml` ile `lint-after.xml` lint 8.12.0;
  klon yolları normalize edilip severity/ID/mesaj/konum karşılaştırıldı.
  81→79, eklenen issue yok. Yalnız `MissingPermission`
  (`AndroidDeviceCheck.kt:40,45`) kalktı. `lint-after.xml` FIX klonundaki
  raporla byte-eş (`58f81284…5299`); `logs/lint-narrow.{log,exit}`:
  `:my-module:lintDebug` **exit 1**, 1 hata / 78 uyarı; tek hata
  `AndroidS3Automatic.kt:46` `NewApi` (26 / min 24). Lint PASS değil.
- **ADR0029 değişmedi.** `AndroidDeviceCheck.kt:21–55` güvenli kilit yoksa ret,
  API 30+ `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`, eski API için Keyguard ve
  başarılı sonuç şartı; `KlodaCloudModule.kt:33–41,95–106` onaydan sonra
  reveal/renew ve `FLAG_SECURE`. Bu iki kaynak, S3 kaynağı ve ilgili Gradle
  config'leri canlı/P3-02/FIX klonlarında byte-eş. ADR0029 karar 5 ve
  bağımlılıklarda, auth akışında veya suppression'da scoped değişiklik yok.
  Kaynak incelemesi ve Debug izin eşitliği auth runtime kabulü değildir.

Yeni cihaz, build, lint veya auth koşusu yok; yalnız mevcut kanıt reuse edildi.
**P3-05 tam lint, S3 Android 7.x politika kararı, K2/worklets ve diğer
varyantlar, Faz3 açık.** Eski sayaçlar, D12 kayıtları ve ana kayıtlar
değiştirilmedi; ana kayıtları koordinatör işler.
