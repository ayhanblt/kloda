# 20–21 — toplu kabul /04.11

17’nin uygulama/izole fonksiyonel doğrulaması [kanıtta](evidence/s3-native-step17-2026-11-03/verification-2026-11-04/manifest.json). Android/iOS gerçek owned Photos publish/full readback/metadata/restore/repeat/reopen/cleanup ve yeni automatic/manual yetki bileşenleri PASS. iOS automatic SQLite Int→Int64 hatası düzeltildi; etkilenen native test ve normal Xcode27.2 app build PASS. JNI14yeni paket advisory0eşleşme. Önceki başarılı AWS/core/ABI testleri tekrarlanmadı.

## 20 — Claude bildirimi sonrası hizalama ve genel kapanış

- 18/19 Claude alanında: kullanıcı nihai durumu bildirecek; bu ajan kodlarına dokunmadı. Bildirimden sonra gerçek HEAD/diff, ortak API/schema/build/lifecycle bağlantıları birlikte hizalanacak.
- S3 dağıtım lisans metinleri (16.11, 1.5/L15): cesu8 1.1.0, instant-xml 0.7.7, instant-xml-macros 0.7.2 için
  Apache-2.0 seçimi + resmî standart metin + paketteki gerçek bildirimler `packages/s3-native/THIRD_PARTY_NOTICES.md`
  içinde; belge boşluğu kapandı ([kanıt](evidence/backlog-1.5/MANIFEST.md)). JNI macros exact upstream MIT metni korunur.
  Dağıtım kabul şartı: bu notices metni dağıtılan uygulamanın lisans materyallerinde bulunmalı; yalnız repoda
  bulunması PASS değildir. Gerçek release paketinde bulunurluk denetlenmedi → dağıtım kabulü açık.
- **B2 iOS fixture-CA dışlama kapısı (16.11, 1.5/B15; Claude review B2):** dağıtım kabulü yalnız gerçek Release
  `.app`/archive kanıtıyla verilir. Kaydedilecekler: Info.plist `CFBundleExecutable` ile çözülen app executable yolu,
  Release configuration/SDK/architecture, kaynak revision'ı, executable SHA256 ve build settings çıktısı.
  Swift `SWIFT_ACTIVE_COMPILATION_CONDITIONS`/`OTHER_SWIFT_FLAGS` içinde `KLODA_S3_OWNED_FIXTURE` ve Rust build
  feature'larında fixture/owned-fixture bulunamaz. `xcrun nm --no-llvm-bc <app-executable>` çıktısı ve exit kodu
  saklanır; tam sembol `_kloda_s3_owned_fixture_marker` bulunursa veya fixture bayrağı varsa **FAIL**.
  `tools/check-s3-native.mjs` Rust archive sonucu app kanıtının yerine geçmez. Strip edilmiş/okunamayan sembol
  tablosu veya nm hatası "marker yok/PASS" değildir: aynı link'in strip öncesi executable kanıtı ve final artifact
  bağı yoksa **OPEN**. PASS için bayrak yokluğu + kullanılabilir sembol çıktısında marker yokluğu + artifact/config/
  revision bağı birlikte gerekir; artifact veya kanıt eksikse **OPEN**. Gerçek release koşusu yapılmadı → açık.
- P5 production sağlayıcı ve at-rest seçimi/doğrulaması; production activation kapalı kalır. Yerel MinIO işlev kanıtı provider qualification değildir.
- Normal native ürün UI uçtan uca, görsel/erişilebilirlik, performans/pil/alan ve hata sunumu; son bağımsız Claude review. Aynı-agent review bağımsız sayılmaz.
- Ortak SDK/build durumu: son doğrulama Xcode27.2/SDK27.2; önceki6ABI kanıtı kendi kaynak/toolchain varyantında korunur. Hizalama sonrası yalnız değişen/etkilenen kontroller seçilir.

## 21 — en son toplu gerçek cihaz/OS kabulü

- [ ] **F1-FO1 success-completion — 16.11 kullanıcı onaylı dar erteleme:** Android
  fiziksel test aşamasında gerçek başarılı FTPS aktarımı → yeni completion yolunda
  tek tamamlama → UI açılmadan sonraki JOB callback'i zincirini doğrula. Transfer
  sonucu, completion/OS yan etkileri ve sonraki callback kanıtını kaynak/varyantla
  kaydet. Başarısızsa yalnız ilgili bulgu açılır. Şimdi koşu veya fixture kurulumu yok.
  Önceki PASS ve reuse sınırları: [FO1 audit](evidence/f1-ftps-automatic-lock-2026-11-15/fo1-evidence-audit-2026-11-16.md).
  Bu kontrol NOT_RUN; F1 geliştirme kapanışından ayrı fiziksel kabul kapısıdır.

- Android/iOS gerçek OS delivery, BG expiry/Doze/lock/reboot/recovery; native automatic component testleri gerçek OS teslimi değildir.
- Fiziksel cihaz signing/credential custody, sağlayıcı/iCloud/storage davranışı; büyük dosyalar ve Photos formatları/metadata-revision durumları.
- Gerçek kişisel aktarım yalnız uygulamadaki açık opt-in ve hazır cihaz/hesap kapsamıyla; önceki sentetik AWS izni genişletilmez.

Commit/push yok. Gerçek kullanıcı fotoğrafları/AWS kasası değiştirilmedi; test kaynakları ayrı teardown kaydında.
