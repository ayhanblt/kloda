# P3-05 Aile 1 — dar biyometrik izin bildirimi (21.11.2026)

Durum: **FIX uygulandı; hedef iki MissingPermission kapandı; tam lint PASS DEĞİL.** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Commit/push yok. MANIFEST/CURRENT/plan koordinatörde.

## Değişiklik (tek dosya, tek satır)
`apps/mobile/modules/my-module/android/src/main/AndroidManifest.xml` + `<uses-permission android:name="android.permission.USE_BIOMETRIC" />` (POST_NOTIFICATIONS'ın altı). `live-manifest.diff`, önce `AndroidManifest.before.xml` / `before.sha256` (`037f6090…cb03`, git temiz = HEAD), sonra `after.sha256` (`7350a6d2…5d1`). Başlangıç `start-status.log`/`start-diffstat.log` boş (dosya HEAD ile aynıydı). Üretim auth kodu, ADR0029, başka izin, bağımlılık, suppression, S3/diğer kaynak değişmedi.
İzin provenance'ı: birleşik Debug'da `USE_BIOMETRIC`/`USE_FINGERPRINT` zaten `androidx.biometric:biometric:1.1.0` kütüphane manifestinden geliyordu (`lint-design-note.md`).

## İzole yöntem
Canlı ağaç dışında `/private/tmp/kloda-p3-05-bio` = P3-02 klonunun APFS kopyası (aynı aday/bayraklar: 4 native bayrak + arm64 + `--offline`). Özgün P3-02 klonu/artefaktları dokunulmadı: `app-debug.apk` `2966a0d0…`, androidTest `e75ddfa3…` aynı, `/private/tmp/kloda-p3-02` modül manifesti `before` ile byte-eş. Düzenleme önce kopyada, sonra aynı bayt canlı ağaca (`live==clone` `cmp`).

## Birleşik manifest önce/sonra (`:app:processDebugMainManifest`, exit 0/0)
`merged-before.xml` ↔ `merged-after.xml`: **dosya baytı birebir eşit**; `uses-permission`/`permission` öğeleri ve nitelikleri 20=20, `equal True` (`permission-compare.log`). Yani nihai izin kümesi değişmedi; yeni satır mevcut birleşik girdiyle birleşti. Loglar `logs/merge-{before,after}.{log,exit}`.

## Dar modül lint (tek koşu, kopyada)
`./gradlew :my-module:lintDebug -x :react-native-worklets:lintAnalyzeDebug <bayraklar> --offline` → **exit 1** (beklenen; kalan S3 NewApi). `logs/lint-narrow.{log,exit}`, `lint-after.{txt,xml}`, `lint-compare.log`:
- Önce (P3-05 `full-module`): hata 3 = MissingPermission `AndroidDeviceCheck.kt:40`, `:45` + NewApi `AndroidS3Automatic.kt:46`.
- Sonra: hata 1 = yalnız NewApi `AndroidS3Automatic.kt:46`. Toplam issue 81→79; fark yalnız `MissingPermission` −2, başka kategori değişmedi.
Bu P3-05/lint PASS değil: S3 NewApi (kullanıcı kararı bekliyor), `UseKtx` uyarısı ve K2 durumu açık. Cihaz, auth denemesi, S3 değişikliği yok.

## Cleanup
Gradle daemon'ları `./gradlew --stop` ile durduruldu (kontrol: süreç yok). Klon `/private/tmp/kloda-p3-05-bio` (CoW) bırakıldı; koordinatör istemedikçe silinmedi.

## Sonraki adım
Koordinatör MANIFEST'te Aile 1'i kapat (2/3 hata), Aile 2 (S3 API 26) kullanıcı kararı (A/B/C, `lint-design-note.md`) bekliyor. Bağımsız review koordinatörde.
