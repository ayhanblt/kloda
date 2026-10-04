# ADR 0002 — İlk vertical slice kapsamı

- Tarih: 2026-09-29
- Durum: İlk WebDAV slice kapsamı kabul edildi; güncel PC-first ürün yönü ADR0005, bu kaydı tamamlanmış implementasyon yapmaz
- Karar sahibi: Ayhan


2026-10-04 notu: bu kayıt ilk WebDAV delivery baseline'ının tarihsel kapsamıdır. Sonraki genel dosya/PC alıcı/default Live/Files–Photos kararları [ADR0005](0005-computer-first-files-and-photos-backup.md), account politikası [ADR0006](0006-account-mfa-and-recovery-policy.md), authority yönü [ADR0004](0004-certificate-bound-capability-and-authority-responsibilities.md) içindedir. Baseline'ın kalan native transfer/recovery/scheduler/UI smoke kabulü [status](../implementation/first-vertical-slice-status.md) içinde açık tutulur; yeni ürün yönü eski işleri done yapmaz.
## Karar

İlk vertical slice Android, iOS ve Electron desktop'ta onboarding, kaynak seçimi, 12/24 saatlik yerel zamanlı otomatik sync, Sync Now, WebDAV credentials, WebDAV erişim/yazma testi ve tek kaynak işi içerir.

- Otomatik sync gerçek OS/native yürütmesidir; JS `setInterval` değildir.
- Mobil, Expo development build içinde yerel Swift/Kotlin modülü kullanır.
- Program cihazın yerel saatini korur.
- Bağlantı testi WebDAV authentication, dizin erişimi ve yazma yeteneğini doğrular. WAN/public-IP karşılaştırması bu dilimin kabul kriteri değildir; başarılı test CGNAT veya dış ağ erişimi garantisi değildir.
- Uygulama kimlikleri Android ve iOS için `com.kloda.app` olarak seçildi.
- Mobile UI NativeWind v4 ile, Electron renderer Tailwind CSS ile stillenecek. JSX/TSX içinde `StyleSheet.create`, inline `style` veya style object kullanılmayacak; ortak token, reset ve az sayıdaki global kural yalnız global stylesheet/config içinde tanımlanacak. Bileşenler yalnız utility class'ları kullanacak.
- Mobile ve desktop için `i18next` + `react-i18next` i18n modülü kullanılır. Desteklenen diller Türkçe (`tr`), İngilizce (`en`) ve Almanca (`de`)dır. Kullanıcıya gösterilen her JSX/TSX metni, hata metni, label, placeholder, aria metni ve button başlığı `t(id)` ile çözülür; statik metin tanımlı locale JSON dosyaları dışında bulunmaz.

## Sınır

Bu karar FolderSync migration tespit yöntemi, medya encryption/key yönetimi, relay teknolojisi, premium AWS kapsamı veya NestJS backend rolünü belirlemez.
