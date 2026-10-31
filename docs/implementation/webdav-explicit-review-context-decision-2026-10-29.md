# WebDAV15 — ayar değişimi sonrası açık inceleme kararı

Durum: 30 Ekim2026 kullanıcı A seçeneğini onayladı; ADR0025. Uygulama/doğrulama sürüyor. ADR0023 otomatik yeniden bağlamayı yasaklar.

## Somut tetikleyici

Dosyanın PUT ACK'i kalıcı olarak alınmıştır; MOVE öncesi program/kaynak/hedef
etkinliği değişir. Eski iş `settings_changed` ile durur ve header/ACK/snapshot
korunur. Ayarlar geri alınsa bile yeni generation farklıdır. Mevcut native review
aynı binding istediği için recheck/keep-both kapalıdır. Skip geçmişi kapatır,
Completed yapmaz; aynı byte/referansın otomatik tekrar gelişi de review_required
kalır. Bu güvenli fakat bu öğenin kullanıcı tarafından toparlanma yolu eksiktir.

## A — açık, dar yeniden yetkilendirme önerisi

Yalnız görünür aktif uygulamada ayrı kullanıcı eylemiyle, aynı target kimliği
(endpoint/path/kullanıcı) ve aynı halen seçili kaynak kimliği için izin verilir.
Yeni kaynak/target'a taşıma veya toplu/otomatik yetki yoktur. Kaynak byte/hash/boyut,
rol ve varsa Photos albüm/favori metadatası güncel kaynaktan tekrar doğrulanır.

Eski immutable header/binding değişmez. Ayrı append-only review yetki kaydı eski
intent'i güncel context ve tek istek nonce'una bağlar; context değişimi/uygulamadan
ayrılma kaydı yeniden kullanılabilir yetki yapmaz. Yalnız bilinen PUT ACK'i ve
halen doğrulanmış temp varsa no-overwrite MOVE; alınmış MOVE ACK'i varsa yeniden
GET doğrulama ile settlement. Kayıp PUT/MOVE yanıtı salt hash eşitliğiyle ACK veya
sahiplik kazanmaz. Uzakta bilinmeyen final/temp, kayıp kaynak veya değişmiş içerik
review_required kalır. Skip geri alınmaz, Completed sayılmaz.

PC authority/sidecar/restore ve otomatik run fırsatları değişmez. Native API/UI,
her iki native journal/Review/Context kapısı, cancellation ve crash/reopen
fixture'ları birlikte uygulanıp doğrulanır. Yeni protokol/provider yoktur.

## B — eski bağlamları kalıcı engelli tut

Mevcut aynı-binding politikası korunur; eski işler yalnız okunur veya skip olur.
UI bu öğelerin uygulama içinden toparlanamadığını açıklar. Yeni bir manuel kopya
başlatma politikası ayrıca kararlaştırılmadan eklenmez. Bu ürün kısıtı step15
kabulünde açık kalır.

Karar gerekçesi: kalıcı eski intent'in yeni context altında ilerlemesi bir yetki
politikasıdır; yalnız uygulama detayı sayılıp varsayılmayacak.
