# Kloda — güvenli eşleştirme ve kontrol kanalı sözleşmesi

## Durum ve kapsam

Bu belge [ADR 0003](../decisions/0003-secure-pairing-and-offline-authorization.md) politikasının tasarım sözleşmesidir. Uygulanmış API, wire şeması, DB migration veya seçilmiş kriptografik protokol değildir. Üretim kodu, PoC kaynakları, cihazlar, bağımlılıklar, cloud hesapları ve hosting bu tasarım çalışmasında değiştirilmez.

Hedef, USB test provisioning/signaling yerine geçecek güven sınırlarını tanımlamaktır. Aynı hesap, PC'de bir kez onay ve iki uçta transcript'e bağlı kısa doğrulama seçilmiştir; QR zorunlu değildir. İlk pairing veya recovery sonrası yeniden pairing, normal otomatik/manual sync'ten ayrı kullanıcı etkileşimidir.

Fiziksel Android transport matrisi **14 pass / 1 direct-connectivity inconclusive**; genel `complete: false` ve production-ready false korunur. iOS: simulator inconclusive; physical-device validation pending; architecture retained; not production-ready. Bu sonuçlar production pairing, key management, gerçek signaling servisi veya iOS background doğrulaması değildir.

## Güven sınırları

| Sınır | Sağladığı ispat/yetki | Sağlamadığı garanti |
|---|---|---|
| Hesap oturumu | İlgili hesap/session'ın doğrulanmış kimliği | Peer private key sahipliği, PC onayı veya dosya anahtarı |
| Taze işlem yükseltmesi | İlgili yüksek riskli işlem için taze kullanıcı doğrulaması | Diğer işlemlere açık yetki veya otomatik peer trust |
| Cihaz kimliği | Doğrulanacak uç kimliği ve ilgili özel anahtara sahiplik | Cihaz adının güvenilirliği veya hesap oturumunun yeterliliği |
| Cihaz çifti | İki uçta doğrulanmış görüşme/kimlik bağlamı ve onay | Hesaptaki bütün cihazlara otomatik erişim |
| PC izinli alanı ve işlem kapsamı | Belirli peer'in seçilmiş alandaki izinleri | PC'nin tüm dosya sistemine erişim veya kapsam genişletme |
| Signaling | Görüşme kontrol metadata'sının taşınması | Sunucunun verdiği kimliği körlemesine güvenilir kabul etme |
| TURN yetkisi | Payload relay hizmetini kullanabilme | Peer trust, dosya erişimi veya recovery yetkisi |
| Dosya receipt'i | Yetkili işlem için doğrulanmış durable part/final sonucu | Yeni işlemler veya journal resume için geçerli erişim yetkisi |

Supabase Auth + Postgres hesap/cihaz/eşleşme metadata'sı için seçilmiş ürün yönüdür; çalışan entegrasyon olduğu varsayılmaz. NestJS'in önerilen kontrol rolü hesap/cihaz yetkisini denetlemek ve uçları buluşturmaktır; kesin hosting ve üretim API seçilmemiştir. Backend'e dosya byte'ı, uç private key'i, pair secret, plaintext dosya kataloğu veya medya hash listesi verilmez. Medya ve dosya/album metadata'sı uçlar arası koruma kapsamındadır; merkezi dosya indeksi eklenmez.

Signaling kontrol metadata'sını, TURN payload byte'larını taşır. Relay'in içerik okuyamaması hedefi üretim session/key derivation ve peer kimlik bağlamının ayrıca doğrulanmasını gerektirir. TURN credential dosya anahtarı değildir; Cloudflare Tunnel ve TURN farklı hizmetlerdir. PoC'de USB üzerinden verilen test pair secret üretim provisioning yolu olmaz.

Hesap yetkilendirme otoritesi ile signaling taşıyıcısının rolleri ayrıdır: peer key substitution'a direnç, ele geçirilmiş hesap yetkilendirme otoritesinin bütün kararlarının doğru olduğu garantisi değildir. Metadata gözlemi ve hizmet engelleme riski E2EE ile yok olmaz. Ele geçirilmiş uç veya PC'deki yerel erişim riski JWT/TOTP ile çözülmüş sayılmaz.

## İlk eşleştirme

### Sıralı akış

1. Uçlar aynı hesap bağlamında işlem başlatır. Yeni istemci yetkilendirmesi taze yüksek riskli işlem doğrulaması ister. MFA kapalı hesapta mevcut parola + mevcut doğrulanmış e-posta kodu; MFA açık hesapta seçilmiş MFA/step-up politikası geçerlidir. Hesap ispatı peer doğrulamasının yerine geçmez.
2. Kullanıcı PC'de aday cihazı ve verilecek izinli alan/işlem kapsamını onaylar. Cihaz adı bilgilendirmedir, kriptografik kimlik değildir. Başka bir alanın onayı bu alana yetki vermez.
3. Uç kimlikleri, uç rolleri ve görüşme bağlamı doğrulama transcript'ine bağlanır. Commitment ve karşılıklı anahtar doğrulama belgelenmiş tam protokolle sağlanmalıdır; bu belge algoritma veya mesaj sırası icat etmez.
4. Uçlar kendi transcript'lerinden hesaplanan kısa doğrulama bilgisini gösterir; kullanıcı iki uçta karşılaştırıp onaylar. Sunucunun ürettiği eşleştirme numarası veya yalnız public key hash'inden kısaltılmış sayı yeterli değildir.
5. PC onayı, iki kullanıcı karşılaştırma onayı ve karşılıklı kriptografik key-confirmation tamamlanıp yerel güven kaydı kalıcılaşmadan dosya erişimi açılmaz. Görüşmenin tamamlanması ve kapsamın yetkilendirilmesi ayrı koşullardır.
6. Mismatch, cancel veya görüşme süresinin dolmasında geçici anahtar/yetki atılır; doğrulanmamış anahtar trusted kayda yükseltilmez. Pairing süresi ve tam protokol uygulama öncesi ayrı seçimdir; burada keyfi timeout değeri tanımlanmaz.

### Mantıksal durum/geçiş tablosu

Bu isimler tasarım durumlarıdır; mevcut kod enum'u veya onaylı wire alanı değildir.

| Önce | Olay ve zorunlu koşul | Sonra | Dosya erişimi |
|---|---|---|---|
| `unpaired` | Aynı hesap ve taze işlem ispatıyla yeni görüşme başlar | `pending_verification` | Kapalı |
| `pending_verification` | Görüşmeye bağlı peer/transcript doğrulaması karşılaştırma aşamasına ulaşır | `awaiting_both_confirmations` | Kapalı |
| `awaiting_both_confirmations` | PC kapsam onayı + iki kullanıcı onayı + karşılıklı key-confirmation ve durable güven kaydı | `trusted` | Yalnız ayrıca geçerli kapsam/yetki varsa |
| Her tamamlanmamış durum | Mismatch, cancel veya süre dolması | `unpaired` | Kapalı; geçici materyal/yetki atılır |
| Her tamamlanmamış durum | Restart; tamamlanmış görüşmenin durable ispatı yok | `unpaired` | Yarım görüşme trusted'a dönüştürülemez |
| Her durum | Eski görüşmenin onayı/key-confirmation'ı veya başka kimlik/rol bağlamı | Değişmez; mesaj reddedilir | Yeni trust veya kapsam açılmaz |
| Her durum | Aynı mesajın mükerrer teslimi | Yeni trust yaratmaz | Eksik koşul tamamlanmış varsayılmaz |
| `trusted` | Peer anahtarı değişir | Yeni kimlik için `unpaired` | Yeni key eski trust'ı miras alamaz |
| `trusted` | Yerel veya öğrenilmiş merkezi iptal | İptal edilmiş güven kaydı | Kapalı; stale yetki iptali geri alamaz |

Yalnız PC onayı, tek uçta kısa doğrulama onayı, sunucunun “onaylandı” mesajı veya yeniden hesap girişi `trusted` oluşturamaz. Tamamlanmış güven kaydı ile hâlâ geçerli erişim yetkisi aynı şey değildir. İptal geçmişi, yeni pairing'i aynı eski güveni diriltme işlemine dönüştürmez.

## Kalıcı kullanım ve journal resume

Private key'ler uçlarda OS korumalı storage'da kalır; backend public key kaydı bunların yerine geçmez. Doğrulanmış peer kimliği PC'de izinli alan ve işlem kapsamına bağlanır. Account JWT, peer private key sahipliğini veya dosya kanalı anahtarını ispatlamaz.

Dosya kanalı açılmadan peer, doğrulanmış kimliğine ait ilgili private key'in sahipliğini kanıtlamalıdır. Hesap oturumu, cihaz adı veya geçmiş journal bu güncel sahiplik ispatının yerine geçmez.

Her yeni session, mevcut doğrulanmış peer kimliğine ve izinli bağlama bağlanmalıdır. Signaling servisinin key/SDP/aday değiştirmesi başka bir peer'e güven veya dosya yetkisi açamaz. Session bağlama, sertifika/fingerprint politikası ve key derivation tam üretim protokolünün ayrıca onaylanacak parçalarıdır; taşıma bağlantısının açılması yetki kabulü değildir.

Normal onaylı cihaz yedeklemesi her çalışmada yeniden TOTP istemez. Yeni cihaz, yeni kapsam veya recovery sonrası pairing bu normal kullanım istisnasından yararlanamaz. Korunmuş transfer UUID, ciphertext, eski receipt ve journal yalnız veri devamlılığı kanıtıdır; yetki kontrolünü atlayamaz.

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
| İlk pairing, yeni cihaz, yetki genişletme, hesap recovery veya remote erişim | Offline LAN istisnası yetki vermez | Eski pencere yeni yetki üretmez |
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

MFA recovery code hesap/faktör kurtarma ispatıdır; peer kısa doğrulama bilgisi veya dosya anahtarı değildir. Peer kısa doğrulama TOTP değildir. Normal sync, yüksek riskli işlem ispatını her upload'da tekrar istemez; bu, iptal ve süre denetimlerini atlama hakkı değildir.

## Doğrulanmış kanıt ve sınırları

Kaynaklar tasarım sırasında okunmuştur. Bu tablo kitaplık seçimi, uygulama audit'i veya production güvenlik kanıtı değildir.

| Kaynak / sürüm | Bulgular | Kanıtlanmayan sınır |
|---|---|---|
| [vodozemac SAS rustdoc](https://docs.rs/vodozemac/latest/vodozemac/sas/index.html), okunan sürüm **0.11.1** | DH tabanlı kısa doğrulama primitive'i ve ZRTP hash commitment gerekçesi belgeleniyor | Örnek iki uç DH/SAS çıktısını karşılaştırır; tam uygulama commitment/kimlik bağlama/cancel/key-confirmation state machine'i değildir. Aday kitaplık; seçilmiş protokol veya Kloda audit'i değil |
| [Supabase sign-out rehberi](https://supabase.com/docs/guides/auth/signout), sürümlenmemiş çevrimiçi rehber | Global logout refresh token'ları iptal eder; eski access JWT `exp` zamanına kadar geçerli kalabilir | Logout tek başına PC dosya yetkisini anında iptal etmez. Merkezi cihaz/pair/session iptal denetimi ve yerel fence ayrıca gerekir |
| [API app module](../../apps/api/src/interface/http/app.module.ts), mevcut repository kaynağı | `@Module({})` boş | Hesap kontrolü, signaling, cihaz iptali veya production pairing servisi uygulanmış değil |
| [Electron credential vault](../../apps/desktop/electron/runtime/vault.ts), mevcut repository kaynağı | Yalnız `webdavPassword`; `safeStorage.isEncryptionAvailable()` ve Linux `basic_text` engeliyle yazma tarafı fail-closed | Pairing key store değil; mobil/desktop non-exportable key, background erişim veya secure clock garantisi kanıtı değil |
| [ADR 0002, Sınır](../decisions/0002-first-vertical-slice-scope.md#sınır), mevcut karar | Encryption/key yönetimi, relay teknolojisi ve backend'in rolünü belirlemiyor | Bu tasarım bunları uygulanmış/onaylanmış üretim seçimine dönüştürmez |

## İmplementasyon öncesi onay kapıları

| Açık konu | Gerekli karar / doğrulama | Bugünkü sınır |
|---|---|---|
| Tam SAS protokolü ve kitaplık | Commitment, transcript/identity/role bağlama, iki onay, mutual key-confirmation, cancel/replay/restart akışlarının tamamı; bağımsız review | Primitive gösterimi yeterli değil; vodozemac seçilmedi |
| Üretim session ve key derivation | Peer kimliğine bağlı oturum ve dosya koruma protokolü; anahtar yaşam döngüsü | Yeni algoritma, cipher veya sertifika sistemi burada seçilmedi |
| OS key storage adapter'ları | Android/iOS/Electron storage ve yaşam döngüsü; kayıp/erişilemez anahtarda fail-closed davranış | Native API/paket, hardware non-exportability ve background accessibility doğrulanmadı |
| Güvenilir süre/fence uygulaması | Sleep/restart dahil süre üst sınırı, durable iptal ve commit yarışının gerçek platform ispatı | Güvenilir süre kanıtı yoksa online doğrulama beklenir; yeni offline pencere yaratılmaz |
| USB'siz signaling ve kontrol servisi | Yetki denetimi, metadata sınırları, hosting ve gerçek uçlarla entegrasyon | NestJS rolü öneri; servis/hosting kurulmadı, hesap/cloud ayarları değiştirilmedi |
| Minimum OS | Native gereksinimler ve destek kapsamının Ayhan onayı | Minimum sürüm burada seçilmedi |
| Fiziksel iOS | Gerçek cihazda transport, storage ve background davranışı | Simulator inconclusive; physical-device validation pending; architecture retained; not production-ready |

Bu kapıların kapatılması ayrı onay ve implementasyon işidir. Storage yok/uygunsuzken plaintext key fallback veya sunucudan private-key recreation yapılmaz. Geçici OS erişim engeli erişimi bekletir; gerçekten kayıp anahtar yeni pairing gerektirir. Bu durumlar normal PC dosyalarını silmez.

## Adversarial kabul senaryoları

Aşağıdakiler implementasyonun sağlaması gereken tasarım kabul sonuçlarıdır; çalıştırılmış test veya penetration test sonucu değildir. “24 saat” başarılı merkezi kontrol denemesinin başlangıcından ölçülür; 24 saate eşit süre artık geçerli offline yetki değildir.

| # | Girdi | Eylem | Beklenen yetki kararı | Korunan veri |
|---|---|---|---|---|
| 1 | Aynı hesap/cihaz adı altında signaling sunucusu peer key'i değiştirir | Kullanıcı iki uç transcript doğrulamasını karşılaştırır; saldırgan mevcut pair'e bağlanmayı dener | Kimlik/transcript uyuşmazlığında trust ve dosya erişimi açılmaz; yeni key eski trust'ı miras alamaz | Mevcut geçerli pair kayıtları ve PC dosyaları korunur; saldırgana dosya verilmez |
| 2 | Yalnız PC onayı veya yalnız bir uçta kısa doğrulama onayı vardır | Eksik onayla dosya erişimi istenir; başka görüşmenin key-confirmation'ı tekrar gönderilir | İki onay ve bu görüşmeye bağlı mutual key-confirmation olmadan trusted değil; eski confirmation reddedilir | PC dosyaları ve tamamlanmış önceki kayıtlar değişmez; geçici materyal cancel/expiry'de atılır |
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

Doküman incelemesi çalışan güvenlik protokolünü doğrulamaz. Bu görevde fiziksel PoC, test/build/lint veya ürün runtime'ı yeniden çalıştırılmaz; cihaz/network/cloud değişikliği yapılmaz. Üretim implementasyonu onay kapıları kapatıldıktan sonra ayrı davranış testleri, gerçek platform smoke'ları ve güvenlik incelemesi gerektirir.
