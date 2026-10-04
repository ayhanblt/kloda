# ADR 0003 — Güvenli eşleştirme ve offline yetkilendirme

- Tarih: 2026-10-02
- Durum: Tasarım politikası kabul edildi; sonraki capability/mTLS yönleri ADR0004 ile kabul, ürün implementasyonu/production doğrulaması açık
- Karar sahibi: Ayhan

## Bağlam ve yetki sınırı

Telefon–PC erişiminde hesap, pairing ve dosya yetkisi ayrı tutulur. Fiziksel Android transport'taki USB pair-secret/ADB signaling production provisioning değildir. İlk kayıt davranış politikasını kabul etti; sonraki [ADR0007](0007-matrix-verification-and-device-continuity.md) Matrix verification ve [ADR0004](0004-certificate-bound-capability-and-authority-responsibilities.md) capability/mTLS/certificate lifecycle yönlerini kaydeder. Exact production API/crypto storage/hosting ve runtime gate'leri hâlâ açıktır.

[ADR0002](0002-first-vertical-slice-scope.md) ilk WebDAV baseline'ıdır; güncel PC-first ürün yönü [ADR0005](0005-computer-first-files-and-photos-backup.md), account/recovery policy [ADR0006](0006-account-mfa-and-recovery-policy.md) içindedir. WebDAV/SMB/relay sınırları sessiz değiştirilmez. Başlangıçta öneri olan Nest control–PC local enforcement rolü ADR0004 ile kabul edilmiştir; aşağıdaki politika çalışan ürün özelliği değildir.

## Eşleştirme ve anahtar güveni

1. Ana akış aynı Kloda hesabı, bilgisayarda bir kez kullanıcı onayı ve iki uçta kısa doğrulama karşılaştırmasıdır. QR zorunlu değildir. Cihaz adı veya sunucunun ürettiği numara peer kimliği sayılmaz.
2. Kısa doğrulama uçlarda anahtar alışverişi transcript'inden hesaplanır. Kimlikler, uç rolleri ve görüşme bağlamı doğrulamaya bağlanır. Commitment, iki kullanıcı onayı ve karşılıklı kriptografik key-confirmation tamamlanmadan kalıcı dosya yetkisi açılmaz. Yalnız public key hash'ini birkaç basamağa kısaltan özel protokol kurulmaz.
3. Aynı hesap ve taze yüksek riskli işlem doğrulaması gerekli fakat tek başına yeterli değildir. Signaling sunucusunun onayı veya eski görüşmeden gelen mesaj güven oluşturamaz. Normal, onaylı cihazın otomatik yedeklemesi her çalışmada yeniden TOTP istemez.
4. Private key'ler uçlarda OS korumalı storage'da kalır. Backend public key/cihaz kayıtları bunların yerine geçmez; private key, pair secret ve plaintext dosya içeriği merkezi servise verilmez. Donanımda non-exportable key veya background erişim garantisi native API seçimi yapılmadan vaat edilmez.
5. PC'de dosyalar normal formatta kalır. Aktarım E2EE kapsamındadır; PC at-rest gizliliği OS disk şifrelemesi ve yerel erişim kontrollerine dayanır. Kloda'ya özel kapalı encrypted vault bu karardan türetilmez.

## 24 saatlik offline LAN yetkisi

Önceden doğrulanmış telefon–PC eşleşmesi, son başarılı merkezi yetki kontrolünden sonra **en fazla 24 saat**, aynı izinli alan ve işlem kapsamında LAN erişimini sürdürebilir. Pencereyi ölçen başlangıç sınırı başarılı kontrol denemesinin başlangıcıdır; geç gelen yanıt süreyi ileri taşımaz. Yeni pencere yalnız yeni başarılı merkezi kontrolle açılır. LAN kullanımı, yerel timer veya eski yetki belgesinin tekrar sunulması ömrü uzatmaz.

Güvenilir geçen süre üst sınırı 24 saate eşit veya daha büyükse erişim kapalıdır. Gecikmiş başarılı yanıt pencere dolduktan sonra erişim açmaz; yeni merkezi kontrol gerekir.

- Merkezi kontrol hesap/session/device/pair iptallerini birlikte değerlendirir. Merkez erişilebilir ve açıkça reddediyorsa süresi dolmamış eski offline yetkiye geri düşülmez.
- İstisna yalnız mevcut, kapsamı değişmemiş LAN yetkisidir. İlk pairing, yeni cihaz, yetki genişletme, hesap recovery veya remote bağlantı hakkı vermez.
- Cihaz duvar saatini geri almak, process/OS restart veya suspend pencereyi yenilemez. Güvenilir geçen zamanın süre üst sınırı platformda kanıtlanamıyorsa erişim yeniden çevrimiçi doğrulama bekler. Restart sonrası kesintisiz offline çalışma taahhüdü yoktur.
- Süre sınırında yeni status/list/download/upload/commit ve publication kabul edilmez. Devam eden akış kapatılır; durable journal ve ciphertext korunur. Commit öncesi yetki tekrar kontrol edilir. Yetki fence'inden önce geçerli biçimde durably committed final dosya, sonraki süre dolması veya iptal nedeniyle silinmez.
- Yeni çevrimiçi yetkiyle aynı transfer journal'ı authenticated reconcile üzerinden sürdürülebilir. Yetki yokken bekleyen iş completed gösterilmez; korunmuş journal erişim yetkisi değildir.

## İptal ve recovery

PC'de yerel peer iptali yeni işlem ve publication kabulünü **hemen** keser. Merkezi iptal öğrenildiğinde aynı durable yerel denetim uygulanır; eski bir yetki kaydı bu iptali geri alamaz.

Merkezi cihaz/recovery iptali çevrimdışı PC'ye anında ulaştırılamaz. Eski LAN yetkisi kalan 24 saatlik pencereye kadar kullanılabilir; bu pencere bitince erişim bekler. Bu karar, önceki recovery hedefindeki bütün PC yollarında anında merkezi iptal beklentisini bu açık gecikme sınırıyla daraltır. Yerel iptal ile uzaktan öğrenilemeyen iptal aynı garanti olarak sunulmaz.

Recovery reset eski hesap oturumlarının ve cihaz/eşleşme onaylarının merkezi yetkilerini iptal eder. Yeniden hesap girişi eski eşleşmeyi diriltmez; yeni MFA kurulumu ve bilgisayarda yeniden onay/peer doğrulaması gerekir. Recovery, dosyaları veya mevcut uç private key'lerini silmez; kayıp private key'i sunucudan geri üretmez. PC normal dosyaları koruduğu için kayıp mobil anahtar yeni cihaz eşleştirmesiyle değiştirilebilir.

| Kavram | Amaç | Yerine geçemediği yetki |
|---|---|---|
| MFA recovery code | Hesap/faktör kurtarma ispatı | Peer doğrulaması veya dosya anahtarı |
| Peer kısa doğrulama bilgisi | Uçların aynı görüşme ve anahtarları doğrulaması | TOTP veya hesap recovery |
| Dosya/oturum anahtar materyali | Uçlar arası kriptografik koruma | Hesap JWT'si veya genel hesap kurtarma |

## Sözleşme ve kabul

Akış, durum/geçiş tabloları, kanıt sınırları ve on adversarial kabul senaryosu [güvenli eşleştirme tasarımında](../security/secure-pairing-design.md) tanımlanır. İki belgede 24 saat başlangıcı, online ret önceliği, yerel iptal ve merkezi recovery gecikmesi aynı uygulanacaktır.

[Transport kaydı](../security/poc-transport-evidence.md): physical Android14pass/1direct-connectivity inconclusive, `complete:false`/production false; önceki iOS URLSession simulator yolu inconclusive/physical pending/architecture retained. [Native verification/TLS kaydı](../security/poc-native-verification-evidence.md) daha sonraki iOS simulator native SAS/TLS pass'ini **ayrı deney** olarak tutar; eski transport inconclusive sonucunu kapatmaz. [Production gate kaydı](../security/production-gates.md) fiziksel pairing/background ve authority/runtime eksiklerini ayrı listeler.
