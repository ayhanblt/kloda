# ADR 0002 — İlk vertical slice kapsamı

- Tarih: 2026-09-29
- Durum: Kabul edildi
- Karar sahibi: Ayhan

## Karar

İlk vertical slice Android, iOS ve Electron desktop'ta onboarding, kaynak seçimi, 12/24 saatlik yerel zamanlı otomatik sync, Sync Now, WebDAV credentials, WebDAV erişim/yazma testi ve tek kaynak işi içerir.

- Otomatik sync gerçek OS/native yürütmesidir; JS `setInterval` değildir.
- Mobil, Expo development build içinde yerel Swift/Kotlin modülü kullanır.
- Program cihazın yerel saatini korur.
- Bağlantı testi WebDAV authentication, dizin erişimi ve yazma yeteneğini doğrular. WAN/public-IP karşılaştırması bu dilimin kabul kriteri değildir; başarılı test CGNAT veya dış ağ erişimi garantisi değildir.
- Uygulama kimlikleri Android ve iOS için `com.kloda.app` olarak seçildi.

## Sınır

Bu karar FolderSync migration tespit yöntemi, medya encryption/key yönetimi, relay teknolojisi, premium AWS kapsamı veya NestJS backend rolünü belirlemez.
