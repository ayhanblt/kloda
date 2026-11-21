# P3-10 M13-alt manuel temsilci — ön kontrol (20.11.2026)

Durum: **BLOCKED (HUMAN_ACTION açılmadı).** Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Hiçbir Simulator/Metro/süreç/dosya başlatılmadı → cleanup gerekmedi. M13-alt `state_unavailable` + 5 FAIL korunur; ürün/araç/fixture değişikliği yok.

## Doğrulananlar
- P3-02 Debug `.app` (`/private/tmp/kloda-p3-02-ios-dd/.../KlodaSecurePhotosSync.app`, `com.kloda.app`): `debug.dylib` sha256 `bc7b6bfd…60a9` = P3-02/P3-03 kaydı; üç fabrika bağlı; P3-03'te aynı `.app` Metro `--initialUrl` ile açıldı (hazır yol var). 18081 dinleyen yok; Simulator `P303/M13` yok.
- Normal ürün girişi `expo/AppEntry` → `App.tsx` → `src/app/App.tsx`.

## Engel
`src/app/App.tsx:30` `useState<MobilePage>('welcome')`; `Linking/useURL/getInitialURL/SecureStore` ile başlangıç sayfası yok, kalıcı durum yok. Yani normal üründe Ayarlar'a **gerçek dokunuşsuz ulaşılamaz** (Karşılama → "Şimdilik atla" → alt sekme "Ayarlar"). Bende dokunma girdisi yok (Accessibility/idb/XCUITest/yeni araç yasak, `m13-bottom-feasibility.md`); ürün/capture girişi değiştirmek (kopya ekran/wrapper) yasak. Dolayısıyla "Ayarlar üst konumda hazır" durumunu ben kuramam ve yanlış state vermem.

## Koordinatör için tek soru (rutin yöntem değil, HUMAN_ACTION kapsamı)
Kullanıcı onayı yalnız **kaydırma** içindi. Normal akış için iki ek dokunuş gerekiyor (skip, Ayarlar sekmesi; yan etkisiz, navigasyon). Kabul edilirse HUMAN_ACTION tek hedef olarak: «Simulator (benim vereceğim UDID) → "Şimdilik atla" → alt "Ayarlar" sekmesi → Ayarlar'ı parmakla en alta kaydır; "Hakkında / Yapılandırma sürümü" satırı alt çubuğun üstünde tam görününce "hazır" de.» Ben: sahipli iPhone 17 Pro oluştur, P3-02 `.app` kur, loopback Metro (klon `apps/mobile`, port serbest, `CI=1`) başlat, TR/light/normal (`simctl ui` + app dili TR varsayılanı doğrulanacak) ile açıp PNG0 (welcome), kullanıcı "hazır" deyince PNG1 + UDID/PID/port kaydı, sonra cleanup. Ölçüt: PNG1'de Hakkında/sürüm satırı tam görünür ve PNG0/ara Ayarlar-üst PNG'sinde görünmezdi; Ayarlar-üst PNG'si kullanıcı 'skip+Ayarlar' sonrası alınır (kaynak/varyant: P3-02 hash, TR, light, normal, 402×874). Dev-client "Tools" düğmesi PNG'de kalabilir (not edilir). Tam görsel/matris PASS iddiası yok.
Onay gelmezse M13-alt `state_unavailable` kalır.
