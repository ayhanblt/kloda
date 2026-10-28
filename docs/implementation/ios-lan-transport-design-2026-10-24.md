# iOS LAN taşıma tasarımı — 24 Ekim 2026

## Kapsam ve sonuç

Kullanıcının “sonraki adıma geç” talimatıyla önceki dar Network.framework tasarım
önerisi değerlendirildi. Bu talimat güvenlik şartlarını değiştirme veya yeni
transport/dependency adoption izni sayılmadı. **İncelenen seçenekler mevcut V1
route sözleşmesini henüz karşılamıyor; production bağlantısı açılmadı.**

Network.framework'e byte taşımasını geçirmek no-gateway/before-connect kanıt
boşluğunu çözmüyor ve gereksiz ortak sender değişikliği doğuruyor. Öneri mevcut
BSD/Rust taşımasını korumak, locality kanıtı/ürün güvenlik sözleşmesi netleşene
kadar yeni async transport katmanı yazmamak. Bu bütün public iOS API'lerinin
imkânsızlık ispatı değildir; aşağıdaki adaylar için yeterli kanıt yoktur.

## Sözleşme eşlemesi

| Gereken davranış | Aday / kaynak | Değerlendirme |
| --- | --- | --- |
| Gerçek interface kimliği/sınıfı | nw_interface_get_type/index, requiredInterface; getifaddrs | Native eşleme tasarlanabilir. en0 adı veya usesInterfaceType true değeri yeterli değil. Exact type ile BSD index/address aynı lifetime'da bağlanmalı |
| Literal QR IP, DNS/remote fallback yok | Mevcut parser + native BSD bound socket | Mevcut kod korunabilir; Network framework yeni DNS kullanımını gerektirmez ama API seçimi route proof değildir |
| Bağlanmadan default+scoped doğrudan route / no gateway | macOS RTM_GET + PF_ROUTE | iOS desteklenen API değil. SDK route.h yok; Mac deklarasyonları kopyalanmaz |
| Local-only ayarı | NWParameters.acceptLocalOnly / C local_only | Yalnız inbound listener kapsamı; outbound phone→PC için yeterli değil |
| Kesin proxy kullanmama | preferNoProxies / C prefer_no_proxy | Tercih, mutlak yasak değil. SDK ve Apple DTS fallback ihtimalini açıklar; güvenlik admission koşulu yapılamaz |
| Network/framework path uygunluğu | NWPath status/interface/gateways | Ready/available veya gateway listesi gerçek hedefin doğrudan kernel rotasını kanıtlamaz |
| Rota değişiminde geri dönülmez ret | connection path callbacks/monitor | Native generation+sticky invalidation tasarlanabilir; callback teslim gecikmesi ve before-I/O doğrulama eşdeğerliği henüz kanıtlanmadı |
| TLS1.3/SPKI/exporter/secret/ACL | Mevcut rustls/native core | Değişmez; Network TLS/key signer'ına taşınmaz |

Kaynaklar: [Apple Network Interface Concepts](https://developer.apple.com/forums/thread/734293),
[Network Interface Techniques](https://developer.apple.com/forums/thread/734359),
[acceptLocalOnly](https://developer.apple.com/documentation/network/nwparameters/acceptlocalonly),
[proxy tercihi için Apple DTS açıklaması](https://developer.apple.com/forums/thread/828775),
[NWPath](https://developer.apple.com/documentation/network/nwpath),
[usesInterfaceType](https://developer.apple.com/documentation/network/nw_path_uses_interface_type(_:_:)).
SDK27.1 Network parameters.h, connection.h, path.h ve interface.h karşılaştırıldı.
Context7'nin preferNoProxies kısa özeti mutlak bypass izlenimi veriyordu; SDK ve
DTS açık sınırlaması esas alındı. Yeni iOS26 chainable NWParametersProvider API'si
16.4 hedefinin yerine kullanılmadı; eski property/C API availability kontrol edildi.

## Çağıranlar ve değişiklik etkisi

Mevcut route_socket::connect, bağlantı denemesinden önce ve her poll turunda
Route::check çağırır; actual local/peer adreslerini doğrular. Bu admission native
kalmalı; Swift/JS caller-supplied trusted bool veya interface adı kabul edilmez.

| Katman | Mevcut kaynak | Network byte taşıması seçilse gereken iş |
| --- | --- | --- |
| Route / socket | route.rs, route_socket.rs, runtime_sender.rs | Literal endpoint, platform witness ve gerçek bağlantı ömrünün bağlanması |
| QR TLS | tls.rs Session.socket: std::net::TcpStream | read/write/WouldBlock/EOF/half-close, native deadline ve bounded backpressure eşlemesi |
| File channel | file_sender.rs tokio::net::TcpStream + tokio-rustls | Mevcut async I/O/tls/HTTP sürücüsüne byte adaptörü; ağ hatası/outcome/ACK ve cancellation sınırları |
| Swift worker/lifetime | iOS Expo bridge henüz yok | Güvenli queue/callback lifetime, aktif UI fence ve drop/close drain |

NWConnection'dan desteklenmeyen özel FD çıkarımı, loopback ara sunucu, WebDAV'a
sessiz fallback veya ikinci transfer günlüğü önerilmedi. No-gateway problemi
çözülmeden bu4 katmanı değiştirmek en küçük yeterli çözüm olmaz. Pure modelde
`direct=true` fixture üretmek de eksik OS kanıtının yerine konamaz.

## Yapılan doğrulama

[Seçilmiş SDK/simulator kanıtı](evidence/ios-lan-design-2026-10-24/README.md).
Bağlantı açmayan C fixture minimum16.4 için -Wall/-Wextra/-Werror ile derlendi ve
iOS26.5 simulator üzerinde exit0 verdi. Interface type, multipath/peer-to-peer ve
local-only/proxy-preference flag getter round-trip'leri kontrol edildi. Bu gerçek
interface forcing veya no-gateway/proxy exclusion testi değildir. Canlı ağ/owner/
key/Photos/QR/transfer ve mevcut app UI çalıştırılmadı; physical duraklatma sürer.
Production kaynak değiştirilmedi; yeni dependency veya policy eklenmedi. Ayrı Sol kaynak/sonuç review hash, çıktı ve sözleşme kapsamını doğruladı; engelleyici bulgu yok. Reviewer runtime çalıştırmadı.

## Yeni karar sınırı ve sıradaki iş

Önceki “Network.framework dar tasarımına geçilsin mi?” sorusu bu incelemeyle
karşılandı; aynı soru yeniden sorulmayacak. Tasarım sonucunda Network byte
adaptörünün tek başına mevcut güvenlik koşullarını karşılamadığı ortaya çıktı.

1. **Mevcut katı V1 koşulu korunursa:** iOS LAN entegrasyonu kanıt bulunana kadar
   açık engeldir. Bağımsız Android ayar/iş bağlamı, background ve diğer mobil
   kaynak işleri ilerleyebilir; iOS teslim gereksinimi listeden düşmez.
2. **iOS'a özel farklı locality sözleşmesi istenirse:** önce sağlanabilen OS
   garantileri, kaybolan before-connect/no-gateway/proxy/change garantileri ve
   ret/risk sınırlarıyla somut öneri hazırlanır. Kullanıcı açıkça onaylamadan ADR/
   normative kontrat veya production güvenlik koşulu değiştirilmez. Bu belge
   böyle bir gevşetmeyi önermiş veya kabul etmiş sayılmaz.

Tek önerilen sonraki işlem: bu yeni güvenlik/ürün kararını netleştirmek; aynı
routing/socket araştırmasını veya başarısız PoC'yi tekrarlamamak. Expo kaydını
hazır alıcı gibi açmak yok. iOS identity/storage/foreground, Files/Photos/restore,
final-app SQLite, background/program ve eski/runtime/fiziksel kabul işleri açık.
Kullanıcı arşivi/key/pin/sertifika/epoch/authority ve Git mutation sınırları korunur.
