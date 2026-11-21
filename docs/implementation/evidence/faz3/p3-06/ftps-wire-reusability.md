# P3-06 — normal FTPS wire reusability (salt-okunur, 21.11.2026)

Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Yalnız repo/kanıtta işaretli yollar okundu/listelendi; sır/özel anahtar okunmadı veya kopyalanmadı, tüm-disk taraması yok. Kod, recipe, CA, build, servis, hedef, cihaz yok; commit/push yok. [RESULT.md §4](RESULT.md) tekrarlanmadı.

## Sonuç: **uygun, çalıştırılabilir yol YOK — BLOCKED-ENV, kapanış engeli somutlaştı**

| Aranan | Bulgu | Kullanılabilir mi |
|---|---|---|
| Çalıştırılabilir loopback FTPS tarifi | `/private/tmp/kloda-ftps16c-engine/fixed-fixture-server.py` yok; repo `tools/` altında FTPS fixture sunucusu yok (yalnız `build-ftps-native.mjs`, `check-ftps-native.mjs`, `test-ios-ftps-contracts.py`). Kanıttaki `ftps-preflight-2026-11-03/practical.py`, eksik `check.py`'ye `exec` bağımlı (dizinde yok); `ftps-native-step16c-2026-11-03/server-teardown.json`: sunucu durduruldu, **server özel anahtarı silindi, CA imzalama anahtarı yok**, parola girdileri yok | Hayır |
| Tutulmuş eşleşen artefakt/trust | Takipli `androidTest/assets/kloda-ftps16/{libkloda_ftps_native.so,sha256.txt,hostname.txt,owned-photo.png}`: `.so` sha256 `04cf489a…` = `sha256.txt` (eşit), `hostname.txt=localhost`, CA bu `.so`'ya gömülü. Bu CA'ya karşılık gelen imzalama/sunucu anahtarı yok → bu `.so` ile konuşacak bir sunucu **yeniden kurulamaz** | Hayır (karşı taraf yok) |
| Aday binary/trust yolu | Üretim FTPS yalnız sistem/ürün trust'ı kullanır; test CA yalnız fixture `.so` asset'inde (`AndroidFtpsFixture.kt`: "never an app production CA override"). Aday APK'da bu fixture olmadan loopback test CA güveni yok | Hayır (fixture olmadan) |
| Eşleşme / eski sonucu reuse | Fixture `.so` **f9bbcc1d (04 Kas)** kaynağından; sonra `packages/ftps-native` 6 dosya değişti (`bridge.rs` +174, `request.rs`, `session.rs`, `android_jni.rs`, Cargo) ve Android `AndroidFtpsJob/Queue/Scheduler/Module` (F1 fix2) değişti; çalışma ağacı=HEAD. Yani gömülü `.so` **güncel adayın native kodu değil**; 03 Kas kabulleri değişen kaynağa otomatik reuse edilemez, tutulmuş `.so` ile koşmak adayı değil eski native'i test eder | Hayır |

## Minimum kapanış engeli ve karar
Önceki "yeni fixture onaylanacak mı" sorusunun üstüne yeni bilgi: **tutulmuş `.so` da bayat**, dolayısıyla sorun yalnız kayıp sunucu değil; FTPS wire/TLS (Android JNI + iOS Simulator, `ftps-files/-sources/-owned-os-files/-photos-owned`, Rust `#[ignore]` fixture testleri) için gereken tek yol, güncel `packages/ftps-native` kaynağından **bir defalık, izole loopback FTPS fixture seti (yeni test CA + sunucu) + o CA'yı gömen yeni owned-fixture `.so`/test APK varyantı**'dır (DAV `prepare` emsali; canlı ürün trust'ı/üretim kodu değişmez, yeni varyant eski APK/CA hash'leriyle karıştırılmaz).

**Koordinatör kararı (tek):** (A) bu yeni, izole FTPS fixture varyantını onayla — plan §3'ün "yeni fixture recipe yok" kuralına kullanıcı/plan istisnası gerekir (DAV `prepare` onayı FTPS'i kapsamaz) — **veya** (B) FTPS wire/TLS satırını P3-06'dan Faz4/ayrı kapıya BLOCKED-ENV olarak bırak (P3-06 kapanmaz). Onay yoksa satır açık kalır; durum `state_unavailable`/blocked, çözüm veya PASS değil. Yeni recipe/CA/build/exploit bu notta yapılmadı.
