# Kloda — güvenli eşleştirme ve kontrol kanalı sözleşmesi

## Durum ve kapsam

Bu belge ADR0003 offline file authorization ve ADR0004 exact-DER capability sınırlarını [ADR0012](../decisions/0012-kloda-owned-p256-device-identity.md) P-256 identity ve [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) backend-independent QR LAN trust kararıyla uygular. Matrix/SAS current pairing path değildir. ES256 server signer ayrı ve provisional; QR/native protocol, enrollment/time/fence implementation açık, production proof yoktur.

İlk QR trust internet/backend/login olmadan tamamlanabilir. Same-account eligibility, step-up, PC scope approval ve capability yalnız ayrı file authorization koşullarıdır; local pin dosya yetkisi yaratmaz.

[Transport evidence](poc-transport-evidence.md): physical Android **14pass/1direct-connectivity inconclusive**, `complete:false`/production false; eski iOS URLSession simulator **inconclusive**, physical pending. [Historical native verification/TLS](poc-native-verification-evidence.md) Rust17, native52, later TLS25/pair+host8 eski Matrix same-key scope sonuçlarıdır; yeni QR/P-256 session/remote kanıtı değildir. Dar Android hardware TLS signer PASS ayrı [production gate](production-gates.md) kaydıdır; iOS simulator pass background/physical gate kapatmaz.

## Güven sınırları

| Sınır | Sağladığı ispat/yetki | Sağlamadığı garanti |
|---|---|---|
| Hesap oturumu | İlgili hesap/session'ın doğrulanmış kimliği | Peer private key sahipliği, PC onayı veya dosya anahtarı |
| Taze işlem yükseltmesi | İlgili yüksek riskli işlem için taze kullanıcı doğrulaması | Diğer işlemlere açık yetki veya otomatik peer trust |
| Kloda cihaz kimliği | Ayrı P-256 key ile gerçek channel başlangıcında mutual possession ve durable local peer pin | Registry, cihaz adı veya login JWT tek başına trust değildir; hardware universal garanti değil |
| İlk cihaz pairing'i | QR PC SPKI equality + gerçek mutual TLS possession + aynı channel/transcript secret HMAC + exact candidate PC approval + durable pins | Account/file grant, scope veya capability yaratmaz; QR library güven protokolü değildir |
| PC izinli alanı ve işlem kapsamı | Belirli peer'in seçilmiş alandaki izinleri | PC'nin tüm dosya sistemine erişim veya kapsam genişletme |
| Signaling | Görüşme kontrol metadata'sının taşınması | Sunucunun verdiği kimliği körlemesine güvenilir kabul etme |
| TURN yetkisi | Payload relay hizmetini kullanabilme | Peer trust, dosya erişimi veya recovery yetkisi |
| Dosya receipt'i | Yetkili işlem için doğrulanmış durable part/final sonucu | Yeni işlemler veya journal resume için geçerli erişim yetkisi |

[ADR0006](../decisions/0006-account-mfa-and-recovery-policy.md) Supabase Auth+Postgres ve MFA/operation-step-up/recovery politikasını kabul eder; entegrasyon yoktur. [ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md) Nest control–PC scope/admission/file/fence ayrımı kabul; ES256 provisional/platform-TLS-device-key production gate açık. Hosting/custody ve gerçek API seçilmedi. Backend file bytes/endpoint private key/pair secret/plaintext media catalog/media hash listesi tutmaz; [ADR0005](../decisions/0005-computer-first-files-and-photos-backup.md) PC-first medya/organizasyon metadata'sı E2EE sınırıdır.

Remote yönü **WebRTC/DTLS + signed signaling/fingerprint + Kloda mutual device proof**; direct ICE P2P mümkünse tercih, **Cloudflare TURN relay fallback**. Signaling kontrol metadata'sını, TURN şifreli kanal byte'larını taşır; relay trust/store authority değildir, Tunnel ile aynı hizmet değildir. Exact proof/encoding/freshness/native APIs, credentials/bootstrap/cost/limits/redundancy/hosting/distribution ve background/physical proof açık; sessiz backend payload fallback yok. USB test pair secret production provisioning yolu olmaz. Optional payload encryption TLS/DTLS üstünde defense-in-depth'tir, kanal veya peer auth yerine geçmez.

Hesap yetkilendirme otoritesi ile signaling taşıyıcısının rolleri ayrıdır: peer key substitution'a direnç, ele geçirilmiş hesap yetkilendirme otoritesinin bütün kararlarının doğru olduğu garantisi değildir. Metadata gözlemi ve hizmet engelleme riski E2EE ile yok olmaz. Ele geçirilmiş uç veya PC'deki yerel erişim riski JWT/TOTP ile çözülmüş sayılmaz.

## İlk eşleştirme

### Frozen KLODA-QR-PAIR-V1

[Frozen protocol and minimum native behavioral contract](qr-pairing-v1-protocol.md) is the sole normative byte/native/state source; [synthetic vectors](qr-pairing-v1-protocol-vectors.json) provide documentation consistency fixtures. Actual platform API/ABI/adoption/integration and implementation remain unverified/not-executed.

Local PC QR carries sid, canonical actual P-256 SPKI fingerprint, one-time secret and validated LAN hint. Fresh full mutual TLS possession and phone same-channel exporter-bound HMAC precede exact PC candidate approval. Native strict parsing/locality/certificate profile are mandatory, not accept-all. Phone durably writes PENDING before proof; PC atomically consumes invitation with its peer pin; phone durably pins before ACK. Fresh exact-key recovery finishes lost result/ACK/completion without retaining the secret or reopening consumed sid. One sid cannot durably trust two keys; distributed all-or-nothing is not claimed.

Initial trust works without backend/login/internet. Local pins/pending do not create file authority; account/step-up/scope/capability/time/deny/fence remain separate. Stolen/live QR racers, mistaken approval, fake-QR endpoint intent and DoS remain residual risks. [Roadmap](../implementation/qr-pairing-implementation-roadmap.md) requires separately authorized implementation and actual native/physical evidence; no second QR/SAS comparison is a required V1 gate.

## Kalıcı kullanım ve journal resume

Kloda private key'ler platform mümkünse non-exportable güvenli donanımda tercih edilir: iOS/macOS Secure Enclave, Android Keystore StrongBox/TEE, Windows TPM. Exact API/ABI/encoding/availability/no-per-run-userPresence/background compatibility, hardware olmayan cihaz/fallback/Linux policy açık; plaintext/export/silent identity fallback yok. Backend key registry local peer pin'in yerine geçmez; hesabın JWT'si yalnız backend user session'dır.

Peer, session/channel **başlangıcında** doğrulanmış local Kloda pin'ine ait key possession'ını mutual proof ile canlı channel/role/flow'a bağlamalıdır. Exact signed proof/freshness/encoding/cancel/close/generation contract açık; her request'e hardware ECDSA signature/nonce sistemi eklenmez. Sonrasında TLS/DTLS kanalı korur, capability/time/scope/current deny/revoke/fence denetimi sürer.

LAN initial QR profile'da actual TLS SPKI **Kloda P-256 key'in kendisidir**; QR canonical SPKI SHA256 hash'i capability exact leaf-DER hash'i değildir. Pairing-only channel capability istemez; file admission fresh full pinned TLS1.3 + actual exact leaf-DER-bound capability/time/scope/deny/fence ister. PSK/0-RTT/replayed proof yeni admission açmaz. Remote DTLS binding bu initial LAN equality'den türetilmez. [Profile](capability-profile.md) encoding/enrollment/clock/fence implementation kanıtı değildir.

Normal onaylı cihaz yedeklemesi her çalışmada yeniden TOTP istemez. Yeni cihaz, yeni kapsam veya recovery sonrası pairing bu normal kullanım istisnasından yararlanamaz. Korunmuş transfer UUID, ciphertext, eski receipt ve journal yalnız veri devamlılığı kanıtıdır; yetki kontrolünü atlayamaz.

Required Kloda key/pin/pairing/epoch/authorization state kaybı veya restore şüphesi fresh local QR re-trust + ayrı gerekli online PC scope approval/yeni grant ister; key retention install continuity değildir. Matrix store current mechanism veya continuity gate değildir.

PC'de dosyalar normal formatta kalır. Aktarım E2EE ile PC at-rest gizliliği farklıdır; disk gizliliği OS disk şifrelemesi/yerel erişim kontrollerine dayanır. Kayıp mobil anahtar yeni cihaz pairing'iyle değiştirilebilir; hesap recovery kayıp dosya private key'ini sunucudan üretmez.

## Offline LAN yetkisi

### Kapsam ve süre

PC, ilgili mobil kimliği/pair, izinli alan/işlem ve güvenlik sürümüne bağlı doğrulanmış merkezi yetki sonucunu **en fazla 24 saat** kullanabilir. Bunlar gerekli davranış kapsamlarıdır, imza algoritması, serialization veya DB alanı seçimi değildir. Merkezi kontrol hesap/session/device/pair iptallerini birlikte değerlendirmeden yeni pencere açılmaz.

Pencere başlangıcı başarılı merkezi kontrol denemesinin başlangıcıdır. Geç gelen yanıt, eski belgenin yeniden sunulması, LAN kullanımı, timer veya process başlangıcı ömrü ileri taşımaz. Yeni pencere yalnız yeni başarılı merkezi kontrolle açılır. Başlatılan fakat başarısız kontrol önceki pencereyi yenilemez.

Geçen zamanın güvenilir üst sınırı sleep/suspend ve restart dahil kanıtlanmalı ve erişim için 24 saatten küçük olmalıdır. Üst sınır 24 saate eşitse veya daha büyükse yetki dolmuştur. Merkezi yanıt geldiğinde pencere zaten dolmuşsa başarılı yanıt erişim açmaz; yeni merkezi kontrol gerekir. Cihaz duvar saatini geri almak süreyi uzatamaz. Platformda güvenli süre üst sınırı doğrulanamıyorsa erişim çevrimiçi doğrulama bekler; restart sonrası otomatik yeni 24 saat veya kesintisiz offline çalışma garantisi verilmez.

### Yetki karar tablosu

| Gözlem | Karar | Pencere üzerindeki etkisi |
|---|---|---|
| Yerel PC iptali veya öğrenilmiş merkezi iptal | Yeni işlem/publication kapalı | Eski yetki iptali geri alamaz |
| Merkez erişilebilir ve açıkça reddeder | Erişim reddedilir; offline fallback yok | Eski geçerli pencere ret kararını aşamaz |
| Merkezi kontrol yeniden başarılı, kapsam ve güven sürümü uygun, yeni kontrolün başlangıcından ölçülen pencere henüz dolmamış | Doğrulanan kapsamda yetki | Yalnız yeni kontrolün başlangıcından yeni pencere |
| Merkez ulaşılamıyor; mevcut güven ve aynı kapsamlı LAN yetkisi henüz 24 saatten kısa; süre doğrulanabilir | Aynı kapsamlı LAN işlemleri çalışabilir | Önceki pencere uzamaz |
| Merkez ulaşılamıyor; süre dolmuş veya süre/kapsam güvenle doğrulanamıyor | Çevrimiçi doğrulama beklenir | Pencere yenilenmez |
| İlk file grant, yeni cihazın file authorization'ı, yetki genişletme, hesap recovery veya remote erişim | Offline LAN authorization istisnası yetki vermez; offline QR trust mümkündür | Eski pencere yeni yetki üretmez |
| PC offline veya izinli alan erişilemiyor | İş bekler/gerçek engel gösterilir | Yetki varlığı dosyanın aktarıldığı anlamına gelmez |

Bu tablo offline LAN davranışını tanımlar; remote yetkinin ömrünü veya yenileme protokolünü seçmez. Erişilebilir otoritenin açık reddi ile ağ/servis erişilemezliği ayırt edilmelidir; ret cevabını bağlantı hatası diye gizleyip offline moda düşmek yasaktır.

### Süre dolması, iptal ve publication fence'i

Status/list/download/upload/commit dahil yeni işlem kabulünde ve devam eden işin publication sınırında yetki uygulanır. Aktif stream süresi dolmuş yetkiyle devam edemez. Süre dolması/iptal ile part veya final publication aynı yetki fence'i üzerinden tutarlı karar vermelidir; önce kontrol edip sonra iptalden habersiz commit etmek geçerli değildir.

| Sınırdaki olay | Zorunlu davranış | Korunan durum |
|---|---|---|
| Yeni işlem veya yeni part publication sırasında expired/revoked yetki | Kabul/publication yok | Durable journal ve doğrulanmış ciphertext korunur |
| Aktif upload/download/list stream sırasında yetki biter veya iptal öğrenilir | Yeni iş durur, aktif akış kapatılır | O ana kadar geçerli durable durum korunur; sahte completion yok |
| Final commit yetki fence'inden önce geçerli biçimde durably tamamlanmıştır | Sonradan gelen expiry/revoke final dosyayı silmez | Commit edilmiş final ve doğrulanmış sonucu korunur |
| Final commit yetki fence'inden sonra kabul edilecektir | Commit yapılamaz | Resume için durable journal/ciphertext korunur |
| Yeni merkezi yetki başarıyla alınır | Yeni session/yetki altında authenticated reconcile | Aynı transfer/journal yalnız eksik işten devam edebilir |

Yetki yokken scheduled veya Sync Now işi bekliyor durumunu gösterir; network enqueue, session açılması veya korunmuş receipt yeni completion kanıtı değildir. Kapatılmış erişim, sonradan alınan bir receipt ile publication fence'ini geriye dönük geçerli yapamaz.

## İptal ve hesap recovery

Yerel PC peer iptali yeni işlem/publication'ı hemen durdurur. Merkezi iptal bilgisi öğrenildiğinde durable yerel denetimde aynı şekilde uygulanır; eski yetki replay'i veya eski session bunu geri alamaz.

Merkez erişilemiyorsa yalnız önceden doğrulanmış, kapsamı değişmemiş, süresi dolmamış LAN yetkisi kullanılabilir. Uzaktan cihaz/recovery iptali PC'ye ulaşmadığında kalan pencere kadar gecikebilir; anında uzaktan iptal vaat edilmez. Merkeze tekrar erişildiğinde açık ret öğrenilmişse offline pencere geçerli görünse bile kullanılmaz.

Recovery reset eski hesap session/device/pair yetkilerini merkezi olarak iptal eder. Yeniden giriş eski trust'ı canlandırmaz; yeni MFA kurulumu ve yeniden PC onayı/peer doğrulaması gerekir. Çevrimdışı PC için bu iptalin gecikmesi aynı 24 saat sınırına tabidir. Hesap kurtarma, dosyaları veya mevcut private key'leri silmez; kayıp private key'i sunucudan geri üretmez.

MFA recovery code hesap/faktör kurtarma ispatıdır; QR invitation secret veya dosya anahtarı değildir. TOTP setup QR ayrı hesap akışıdır. Normal sync yüksek riskli işlem ispatını her upload'da istemez; iptal ve süre denetimi sürer.

## Doğrulanmış kanıt ve sınırları

Aşağıdaki primitive/provider kaynakları **eski scope historical** gözlemlerdir. Aktif identity/channel yönü ADR0012; source support library adoption/audit/runtime proof değildir. Eski Matrix single-key, software-only ve byte signer sonuçları yeni Kloda P-256 gate'lerine taşınmaz. [Native/TLS](poc-native-verification-evidence.md), [transport](poc-transport-evidence.md) ve [public inspection](evidence/certificate-binding-inspection.json) ayrı historical kayıtlardır.

| Kaynak / sürüm | Bulgular | Kanıtlanmayan sınır |
|---|---|---|
| [vodozemac SAS rustdoc](https://docs.rs/vodozemac/latest/vodozemac/sas/index.html), observed **0.11.1** | DH/SAS primitive ve ZRTP commitment gerekçesi kaynakta mevcut | Bare primitive full protocol/key-confirmation/cancel state machine'i değildir; ADR0007 Matrix full verification yönünü seçti, standalone custom-SAS/bare-vodozemac alternatif seçmedi |
| [Supabase sign-out rehberi](https://supabase.com/docs/guides/auth/signout), sürümlenmemiş çevrimiçi rehber | Global logout refresh token'ları iptal eder; eski access JWT `exp` zamanına kadar geçerli kalabilir | Logout tek başına PC dosya yetkisini anında iptal etmez. Merkezi cihaz/pair/session iptal denetimi ve yerel fence ayrıca gerekir |
| [API app module](../../apps/api/src/interface/http/app.module.ts), mevcut repository kaynağı | `@Module({})` boş | Hesap kontrolü, signaling, cihaz iptali veya production pairing servisi uygulanmış değil |
| [Electron credential vault](../../apps/desktop/electron/runtime/vault.ts), mevcut repository kaynağı | Yalnız `webdavPassword`; `safeStorage.isEncryptionAvailable()` ve Linux `basic_text` engeliyle yazma tarafı fail-closed | Pairing key store değil; mobil/desktop non-exportable key, background erişim veya secure clock garantisi kanıtı değil |
| [ADR0002 Sınır](../decisions/0002-first-vertical-slice-scope.md#sınır) | İlk WebDAV slice medya crypto/relay/backend rolü seçmedi | Sonraki ADR0004/0005/0006/0007 yönleri kayıtlı; hosting/runtime/production gate'ler açık, eski slice boundary güncel ürün politikasını veto etmez |

## İmplementasyon öncesi onay kapıları

| Açık konu | Gerekli karar / doğrulama | Bugünkü sınır |
|---|---|---|
| QR payload/lifecycle/native binding | [Frozen V1](qr-pairing-v1-protocol.md); native-owned TLS SPKI/mutual proof/exporter HMAC/reservation/approval/pending/pins/ACK recovery | Rust/Android-Electron implementation/build and43 synthetic native regressions recorded in [QR roadmap](../implementation/qr-pairing-implementation-roadmap.md); physical custody/LAN adoption blocked/unverified, iOS native deferred; no Matrix/SAS gate |
| Native session/channel proof | LAN pinned fresh full TLS1.3/SPKI; remote WebRTC/DTLS signed signaling/fingerprint; mutual Kloda P-256 proof + separate capability | Exact provider/native callbacks/ownership/proof/encoding/freshness/channel association açık; no fake ABI/trusted factory/custom TLS bypass; payload encryption yalnız optional defense-in-depth |
| P-256 hardware provider/storage | Secure Enclave/StrongBox/TEE/TPM, non-exportability, install/key/pin lifecycle, no-per-run-auth/background compatibility | Android/macOS SDK implementations written; actual Mac key creation fails missing entitlement `-34018`. Physical bridge/backup/background/support, Windows TPM and Linux/fallback policy remain open; no software fallback |
| Güvenilir süre/fence uygulaması | Sleep/restart dahil süre üst sınırı, durable iptal ve commit yarışının gerçek platform ispatı | Güvenilir süre kanıtı yoksa online doğrulama beklenir; yeni offline pencere yaratılmaz |
| USB'siz signaling ve remote/provider deployment | WebRTC/DTLS signed signaling/fingerprint + Kloda proof; direct P2P preferred/Cloudflare TURN fallback; Nest control–PC enforcement | Yön seçildi, servis/hosting/credentials/cost/redundancy/distribution ve gerçek account/device/channel proof yok; remote belirsiz yön değil açık deployment/protocol gate |
| OS compatibility/release minimum | iOS16.4+/Android7/API24 kullanıcı destek hedefi, toolchain/API/native crypto compatibility ve release minimum approval/validation | Generated deployment target veya experimental APK minSdk product proof değildir; eski/current physical test gerekli |
| Fiziksel iOS | Real P-256 provider/QR local pin, storage/transport/background/release | Cihaz yokluğu ertelenmiş physical validation; URLSession simulator inconclusive ve eski Matrix SAS/TLS pass ayrı; simulator production proof değil |

Bu kapıların kapatılması ayrı onay ve implementasyon işidir. Storage yok/uygunsuzken plaintext key fallback veya sunucudan private-key recreation yapılmaz. Geçici OS erişim engeli erişimi bekletir; gerçekten kayıp anahtar yeni pairing gerektirir. Bu durumlar normal PC dosyalarını silmez.

## Adversarial kabul senaryoları

Aşağıdakiler implementasyonun sağlaması gereken tasarım kabul sonuçlarıdır; çalıştırılmış test veya penetration test sonucu değildir. “24 saat” başarılı merkezi kontrol denemesinin başlangıcından ölçülür; 24 saate eşit süre artık geçerli offline yetki değildir.

| # | Girdi | Eylem | Beklenen yetki kararı | Korunan veri |
|---|---|---|---|---|
| 1 | LAN hint veya registry PC key'ini değiştirir | QR fingerprint actual TLS SPKI ile karşılaştırılır; mutual possession ve same-channel secret proof uygulanır | Wrong fingerprint/key/channel ret; registry trust yaratmaz | Eski local pin/grant/PC dosyaları korunur |
| 2 | Yalnız PC approval, socket veya başka session'ın secret proof'u | Reservation/trust/file access istenir | Mutual TLS + bound HMAC + exact reserved approval + durable consume/pins olmadan completion yok; pins olsa da ayrı file grant gerekir | Pending invitation failure'da invalid; eski pin ve dosyalar korunur |
| 3 | Önceden doğrulanmış aynı kapsamlı LAN pair; merkez ulaşılamıyor; güvenilir süre 23 saat 59 dakika | LAN işlemi başlatılır; aynı koşullarda süre tam 24 saat olduğunda yeni işlem/publication denenir | 23:59'da aynı kapsam izinli; 24:00'da yeni erişim/publication kapalı ve online doğrulama bekler; pencere yenilenmez | Geçerli committed dosyalar, durable journal ve ciphertext korunur |
| 4 | Süre dolması veya öğrenilmiş/yerel iptal final commit ile yarışır | Final publication yetki fence'ini geçmeye çalışır | Fence'ten önce geçerli durable final kabul edilir; fence'ten sonra yeni publication yok; sahte completed yok | Önceden committed final ve durable journal/ciphertext silinmez |
| 5 | Duvar saati geri alınır, restart olur veya suspend süresi güvenle sınırlandırılamaz | Eski yetkiyle iş sürdürülmeye çalışılır | Pencere uzamaz; güvenilir süre üst sınırı kanıtlanamıyorsa online doğrulama bekler; restart yeni 24 saat vermez | Durable aktarım durumu ve normal PC dosyaları korunur |
| 6 | Eski offline pencerede süre var, fakat online kontrol açık ret verir; ayrı alt durumda PC yerel revoke yapar | İstemci offline fallback veya aktif akışın sürmesini ister | Online ret eski pencereyi aşar; yerel revoke hemen admission/publication'ı keser ve etkilenmiş akışı kapatır | Geçerli committed final, durable journal ve ciphertext korunur |
| 7 | Merkezi recovery eski session/device/pair'i iptal ederken PC offline | Eski LAN yetkisi ve sonra eski JWT/yeniden login ile erişim denenir | İptal öğrenilmeden yalnız kalan en fazla 24 saatlik pencere/scope kullanılabilir; öğrenilince ret; eski JWT/login trust'ı diriltmez; yeniden pairing gerekir | Mevcut PC dosyaları ve uç anahtarları sırf recovery nedeniyle silinmez |
| 8 | Signaling veya TURN kontrol metadata'sı ele geçirilir; saldırgan account JWT sunar | Metadata/relay içeriğinden key elde etme ve farklı peer olarak bağlanma denenir | Private key/pair secret/plaintext merkezi hizmetlere verilmez; JWT tek başına peer trust değil. İçerik koruması tam protokol kapısıdır, audit/pentest kanıtı değildir | Tasarım gereği uç anahtarları ve plaintext dosyalar merkezde bulunmaz; metadata gizliliği veya availability garantisi türetilmez |
| 9 | Key storage yok/uygunsuz, anahtar erişilemez veya gerçekten kayıp | Plaintext fallback veya server'dan key recreation ile devam denenir | Fallback/recreation yok; geçici erişim engelinde bekle, kayıp anahtarda yeniden pairing; onaysız key'e eski trust yok | Normal PC dosyaları ve mevcut durable journal korunur |
| 10 | PC offline veya izinli alan erişilemiyor; eski LAN yetkisi başka cihaz/alan/remote erişim için sunulur | Sync Now/otomatik iş ve yetki genişletme denenir | Ulaşılamayan iş completed değil; eski LAN grant yeni peer/scope/remote hakkı vermez | Önceden geçerli dosyalar ve durable aktarım durumu korunur; izinsiz alana erişilmez |

## Tasarım doğrulama yöntemi

Bu dokümanın kabulü, [ADR 0003](../decisions/0003-secure-pairing-and-offline-authorization.md) ile bağımsız bir tutarlılık geçişinde karşılaştırılır: 24 saat başlangıcı ve tam sınırda ret, online ret önceliği, yerel iptalin hemen etkisi, çevrimdışı merkezi recovery gecikmesi ve veri koruma aynı olmalıdır. On senaryonun kararları ve repository çapraz bağlantıları kontrol edilir.

Historical ve güncel belge review çalışan güvenlik protokolünü doğrulamaz. Bu konsolidasyon fiziksel PoC/test/build/runtime'ı yeniden çalıştırmadı; code/device/network/cloud değiştirmedi. [Production/physical gates](production-gates.md) ve [36 authority target](capability-acceptance.md) ayrı scoped gerçek platform smoke/security review gerektirir; [session coverage index](../implementation/session-documentation-index.md) kritik karar ve kanıtların kalıcı karşılığını tutar.
