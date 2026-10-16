# ADR 0003 — Güvenli eşleştirme ve offline yetkilendirme

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) approves native-owned PC-local SQLite ACL with separate explicit backup-scope approval. Below, central first-grant/account/step-up/issuer requirements, `<24h` LAN cache and online exact-DER reissue are historical/superseded for this ACL, not current V1 LAN requirements. TLS/native pins/possession/installation continuity/current operation/local revoke/publication fence remain. Central recovery/revocation versus offline PC/local grants and FINAL remote authorization are OPEN; the historical recovery reset and delay guarantees below do not decide them. Approved direction is not implemented authority/unpair/receiver proof.

2026-10-15 status clarification: dated “pairing not implemented” and central24h sections below describe earlier decision checkpoints, not current source. ADR0014/0016 native QR/ACL/receiver and ADR0017 Android Photos are implemented with bounded host/API36 evidence; physical/platform acceptance remains OPEN. See [current handoff](../implementation/codex-migration-handoff.md).

- Tarih: 2026-10-02
- Durum: Tasarım politikası kabul edildi; sonraki capability/mTLS yönleri ADR0004 ile kabul, ürün implementasyonu/production doğrulaması açık
- Karar sahibi: Ayhan

2026-10-07 kapsamlı supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) ilk peer trust için eski account/short-comparison ve QR-optional koşullarını backend-independent yerel QR ile değiştirir. Dosya yetkisi, `<24h`, revoke ve recovery politikaları korunur; ürün pairing implementasyonu yapılmadı.

## Bağlam ve yetki sınırı

Telefon–PC erişiminde hesap, pairing ve dosya yetkisi ayrı tutulur. Fiziksel Android transport'taki USB pair-secret/ADB signaling production provisioning değildir. İlk kayıt davranış politikasını kabul etti; [ADR0007](0007-matrix-verification-and-device-continuity.md) tarihsel Matrix verification ve korunan continuity sınırlarını, [ADR0004](0004-certificate-bound-capability-and-authority-responsibilities.md) capability/mTLS/certificate lifecycle yönlerini kaydeder. Güncel ilk trust ADR0013'tedir; exact production API/crypto storage/hosting ve runtime gate'leri hâlâ açıktır.

[ADR0002](0002-first-vertical-slice-scope.md) ilk WebDAV baseline'ıdır; güncel PC-first ürün yönü [ADR0005](0005-computer-first-files-and-photos-backup.md), account/recovery policy [ADR0006](0006-account-mfa-and-recovery-policy.md) içindedir. WebDAV/SMB/relay sınırları sessiz değiştirilmez. Başlangıçta öneri olan Nest control–PC local enforcement rolü ADR0004 ile kabul edilmiştir; aşağıdaki politika çalışan ürün özelliği değildir.

## Eşleştirme ve anahtar güveni

1. Ana ilk trust akışı PC'nin aktif eşleştirme ekranındaki yerel QR invitation'ının telefonda taranmasıdır. İnternet, backend veya login gerekmez. QR LAN adresi yalnız bağlantı ipucudur; canonical P-256 SPKI SHA256 fingerprint ve one-time secret taşır. Cihaz adı veya sunucunun ürettiği numara peer kimliği sayılmaz.
2. Aynı gerçek fresh full TLS1.3 kanalında PC'nin actual Kloda P-256 SPKI fingerprint eşitliği ve iki uç private-key possession doğrulanır; secret HMAC proof'u aynı kanal/transcript'e bağlanır. Provisional phone TLS possession durable trust değildir. Exact aday için explicit PC approval, tek kullanımlık durable consume/pin ve phone PENDING-before-proof/durable pin/ACK/recovery akışı [KLODA-QR-PAIR-V1 frozen sözleşmesinde](../security/qr-pairing-v1-protocol.md) tanımlıdır. Protocol bytes ve minimum native davranış frozen; actual API/ABI/adoption/integration unverified, implementation not executed. İkinci QR/SAS/fingerprint comparison V1 required gate değildir.
3. Yerel trust dosya yetkisi oluşturmaz. Same-account file eligibility, enrollment, taze işlem-bağlı step-up, PC scope approval ve signed capability ayrı gerekliliklerdir. Signaling veya registry onayı eski görüşmeden gelen mesaj gibi trust yaratamaz. Normal, onaylı cihazın otomatik yedeklemesi her çalışmada yeniden TOTP istemez.
4. Private key'ler uçlarda OS korumalı storage'da kalır. Backend public key/cihaz kayıtları bunların yerine geçmez; private key, pair secret ve plaintext dosya içeriği merkezi servise verilmez. Donanımda non-exportable key veya background erişim garantisi native API seçimi yapılmadan vaat edilmez.
5. PC'de dosyalar normal formatta kalır. Aktarım E2EE kapsamındadır; PC at-rest gizliliği OS disk şifrelemesi ve yerel erişim kontrollerine dayanır. Kloda'ya özel kapalı encrypted vault bu karardan türetilmez.

## 24 saatlik offline LAN yetkisi

Önceden doğrulanmış telefon–PC eşleşmesi, son başarılı merkezi yetki kontrolünden sonra **en fazla 24 saat**, aynı izinli alan ve işlem kapsamında LAN erişimini sürdürebilir. Pencereyi ölçen başlangıç sınırı başarılı kontrol denemesinin başlangıcıdır; geç gelen yanıt süreyi ileri taşımaz. Yeni pencere yalnız yeni başarılı merkezi kontrolle açılır. LAN kullanımı, yerel timer veya eski yetki belgesinin tekrar sunulması ömrü uzatmaz.

Güvenilir geçen süre üst sınırı 24 saate eşit veya daha büyükse erişim kapalıdır. Gecikmiş başarılı yanıt pencere dolduktan sonra erişim açmaz; yeni merkezi kontrol gerekir.

- Merkezi kontrol hesap/session/device/pair iptallerini birlikte değerlendirir. Merkez erişilebilir ve açıkça reddediyorsa süresi dolmamış eski offline yetkiye geri düşülmez.
- İstisna yalnız mevcut, kapsamı değişmemiş LAN **dosya yetkisidir**. İlk file grant, yeni cihazın file eligibility'si, yetki genişletme, hesap recovery veya remote bağlantı hakkı yaratmaz. İlk yerel QR trust ve pinning çevrimdışı tamamlanabilir; bu cache istisnasından dosya yetkisi türetilemez.
- Cihaz duvar saatini geri almak, process/OS restart veya suspend pencereyi yenilemez. Güvenilir geçen zamanın süre üst sınırı platformda kanıtlanamıyorsa erişim yeniden çevrimiçi doğrulama bekler. Restart sonrası kesintisiz offline çalışma taahhüdü yoktur.
- Süre sınırında yeni status/list/download/upload/commit ve publication kabul edilmez. Devam eden akış kapatılır; durable journal ve ciphertext korunur. Commit öncesi yetki tekrar kontrol edilir. Yetki fence'inden önce geçerli biçimde durably committed final dosya, sonraki süre dolması veya iptal nedeniyle silinmez.
- Yeni çevrimiçi yetkiyle aynı transfer journal'ı authenticated reconcile üzerinden sürdürülebilir. Yetki yokken bekleyen iş completed gösterilmez; korunmuş journal erişim yetkisi değildir.

## İptal ve recovery

PC'de yerel peer iptali yeni işlem ve publication kabulünü **hemen** keser. Merkezi iptal öğrenildiğinde aynı durable yerel denetim uygulanır; eski bir yetki kaydı bu iptali geri alamaz.

Merkezi cihaz/recovery iptali çevrimdışı PC'ye anında ulaştırılamaz. Eski LAN yetkisi kalan 24 saatlik pencereye kadar kullanılabilir; bu pencere bitince erişim bekler. Bu karar, önceki recovery hedefindeki bütün PC yollarında anında merkezi iptal beklentisini bu açık gecikme sınırıyla daraltır. Yerel iptal ile uzaktan öğrenilemeyen iptal aynı garanti olarak sunulmaz.

Recovery reset eski hesap oturumlarının ve cihaz/eşleşme onaylarının merkezi yetkilerini iptal eder. Yeniden hesap girişi eski file grant'i diriltmez; yeni MFA kurulumu ve gerekli online authorization/PC scope approval gerekir. Required identity/pin/epoch kaybı veya trust yeniden kurulması gerektiğinde fresh yerel QR trust uygulanır, SAS değil. Recovery, dosyaları veya mevcut uç private key'lerini silmez; kayıp private key'i sunucudan geri üretmez. PC normal dosyaları koruduğu için kayıp mobil anahtar yeni cihaz eşleştirmesiyle değiştirilebilir.

| Kavram | Amaç | Yerine geçemediği yetki |
|---|---|---|
| MFA recovery code | Hesap/faktör kurtarma ispatı | Peer doğrulaması veya dosya anahtarı |
| Peer QR invitation/channel proof | Aynı gerçek kanal ve exact uç anahtarları üzerinden yerel trust kurulması | TOTP, hesap recovery veya file grant |
| Dosya/oturum anahtar materyali | Uçlar arası kriptografik koruma | Hesap JWT'si veya genel hesap kurtarma |

## Sözleşme ve kabul

Akış, durum/geçiş tabloları, kanıt sınırları ve on adversarial kabul senaryosu [güvenli eşleştirme tasarımında](../security/secure-pairing-design.md) tanımlanır. İki belgede 24 saat başlangıcı, online ret önceliği, yerel iptal ve merkezi recovery gecikmesi aynı uygulanacaktır.

[Transport kaydı](../security/poc-transport-evidence.md): physical Android14pass/1direct-connectivity inconclusive, `complete:false`/production false; önceki iOS URLSession simulator yolu inconclusive/physical pending/architecture retained. [Native verification/TLS kaydı](../security/poc-native-verification-evidence.md) daha sonraki iOS simulator native SAS/TLS pass'ini **ayrı deney** olarak tutar; eski transport inconclusive sonucunu kapatmaz. [Production gate kaydı](../security/production-gates.md) fiziksel pairing/background ve authority/runtime eksiklerini ayrı listeler.
