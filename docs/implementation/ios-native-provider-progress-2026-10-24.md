# iOS native sağlayıcı: saat tamamlandı, LAN tasarım kapısı açık

Sonraki [dar Network.framework tasarım incelemesi](ios-lan-transport-design-2026-10-24.md) tamamlandı; aşağıdaki ilk tasarım sorusu yeniden sorulmaz. Yeni açık konu locality sözleşmesidir; production LAN kapalı kalır.

## Uygulanan en küçük değişiklik

`route_clock.rs` mevcut macOS elapsed_ms gövdesini iOS için de derler. Apple
mach_continuous_time + mach_timebase_info, checked u128 dönüşüm ve hata davranışı
aynen kullanılır. macOS/Android/Windows davranışı veya timeout/retry değerleri
etkilenmez. SDK mach/mach_time.h iOS10+ desteğini ve sistem uykusunda ilerlemeyi
belirtir; minimum ürün hedefi16.4 korunur. Yeni bağımlılık veya C ABI eklenmedi.
[Apple saat API](https://developer.apple.com/documentation/kernel/1646199-mach_continuous_time).

İki Rust test eklendi: thread beklemesinde ilerleme ve eşzamanlı çağrılarda
azalmama. Gerçek iOS26.5/arm64 simulator üzerinde iki exact test PASS; aynı Rust
test ikilisinde7 ABI negatif regresyon PASS. Host clock2, host+sim clippy, fmt,
arm64 device cargo check ve Rust boyut kontrolleri PASS. Güncel device+simulator debug XCFramework/beş C export paketlemesi de exit0; Xcode cache/servis uyarıları platform kabulü sayılmaz. [Seçilmiş kanıt](evidence/ios-native-clock-2026-10-24/README.md).
Gerçek cihaz sleep/wake kabulü değil; duvar saati/boot sürekliliği veya mobil
OS scheduler/retry bütçesi uygulandığı iddia edilmez. Sol bağımsız kaynak review
engelleyici bulgu bulmadı; ayrı final review kaynak/ikili hash ve sonuç kayıtlarını doğruladı. Reviewer runtime çalıştırmadı.

## LAN için kaynaklardan kesinleşen sınır

| Mevcut gereksinim / kaynak | iOS sonucu |
| --- | --- |
| macOS fiziksel interface seçimi | SCNetworkInterfaceCopyAll/GetBSDName iOS SDK'da unavailable; kopyalanmaz |
| RTM_GET default+scoped direct rota / PF_ROUTE monitor | Apple routing-socket API'sini iOS için desteklemiyor; SDK'da net/route.h yok. Mac deklarasyonlarını kopyalama veya simulator'de tesadüfi çalışmayı destek sayma yok |
| Interface zorlaması | BSD IP_BOUND_IF/IPV6_BOUND_IF ve Network.framework requiredInterface desteklenen yollar; tek başına no-gateway/direct-route kanıtı değil |
| NWPath usesInterfaceType | Fiziksel tipin tünel üzerinden kullanılmasını da kapsayabilir; true değeri VPN yok/direct peer anlamına gelmez |
| NWPath availableInterfaces/gateways | Kullanılabilir arayüz/konfigüre gateway bilgisi; hedefe gerçek default+scoped kernel kararına eşit olduğuna dair kanıt yok |
| Değişim sonrası sticky invalidation | Async path callback ile mevcut per-I/O güvenlik/fence koşulu eşlemesi ayrıca tasarlanmalı |

Kaynaklar: Apple DTS [Network Interface Concepts](https://developer.apple.com/forums/thread/734293),
[Network Interface Techniques](https://developer.apple.com/forums/thread/734359),
[usesInterfaceType sözleşmesi](https://developer.apple.com/documentation/network/nw_path_uses_interface_type(_:_:)),
[NWPath](https://developer.apple.com/documentation/network/nwpath). SDK27.1 Network
path.h/interface.h ve SystemConfiguration SCNetworkConfiguration.h yerel olarak
karşılaştırıldı. macOS routing yaklaşımı iOS'a source cfg değişimiyle taşınamaz.
Bu tablo bütün olası public API'lerin imkânsızlık ispatı değildir; mevcut yolun
uygunsuzluğunu ve önerilen alternatifte kanıtlanmamış koşulları gösterir.

## Gereken tek tasarım kararı

Network.framework yalnız byte taşıması ve native path/lifetime sınırı için dar
bir tasarım çalışmasına geçilsin mi? Öneri bu çalışmanın aynı before-connect
no-gateway/Wi-Fi-Ethernet/bound-interface/sticky-change koşullarına kanıt araması;
karşılayamazsa production bağlantıyı açmaması. Bu, Network.framework'i şimdiden
benimseme veya güvenlik şartını düşürme onayı değildir. TLS/rustls/P-256/QR/ACL
korunur. Yeni transport framework, dependency veya fallback uygulanmadı.

iOS storage/identity/route unsupported kalır; saat desteği owner/key veya ağ
başlatmaz. Expo/Swift foreground/worker kaydı, final-app SQLite bağlamı, Files/
Photos queue/restore/suppression ve background/schedule işleri açık. [Tam açık liste](mobile-questions-2026-10-24.md).
Simulator izni fiziksel duraklatmayı kaldırmaz. Kullanıcı arşivi/key/pin/epoch/
authority değiştirilmedi; Git add/commit/push/reset/clean/stash yapılmadı.
