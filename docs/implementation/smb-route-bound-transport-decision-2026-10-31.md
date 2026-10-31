# SMB16a D8 — bağlı socket girişi: tüketici kontrolü ve düzeltilmiş kapsam / 31 Ekim2026

Düzeltilmiş tip uyumlu SDK girişi ve dar native köprü kullanıcı tarafından A ile açıkça onaylandı; uygulandı ve aşağıdaki kapsamda doğrulandı. SMB ürün kapalıdır. [Güncel uygulama/kanıt manifesti](evidence/smb-native-publication-step16-2026-10-30/bound-socket-2026-10-31.json).

Tek satırlık ilk görünürlük önerisi yeterli çıkmadığı için geri alınmıştı. Aşağıdaki eski başarısız tüketici kaydı bu düzeltmenin gerekçesidir; bekleyen karar değildir. Önceki otomatik inceleme engeli yeni açık onayla çözüldü.

## Kontrolün gösterdiği eksik

Önceki incelemede constructor'ın parametresinin de private olduğu atlandı. `vendor/smb2/src/transport/tcp.rs` içindeki `from_stream`, Tokio socket'i doğrudan değil private `rt::net::TcpStream` sarmalayıcısını alıyor. `rt::net` ve tipi `pub(crate)`; Tokio `From` dönüşümü yalnız `cfg(test)` altında. Gerçek dış tüketici testi E0308, ardından E0277 ve `private_interfaces` uyarısı verdi. Salt `fn`→`pub fn` kullanılabilir bir giriş sağlamıyor. [Kaydedilen başarısız tüketici ve kanıt](evidence/smb-native-publication-step16-2026-10-30/d8-consumer/manifest.json).

İlk ek native bağlantı denemesi otomatik incelemede reddedilmişti. Sonraki açık kullanıcı onayı bu engeli giderdi ve köprü uygulandı. İlk ret gerekçesi: D8/A tek satırlık SDK görünürlüğünü onaylıyor, yeni native ABI/header, FD sahipliği ve ağ davranışının yetkisi ayrıca gösterilmeli. Bu bir derleme hatası değil, onay kapsamı engelidir.

## Düzeltilmiş dar SDK girişi — onaylandı/uygulandı

[Somut 29 satırlık diff](evidence/smb-native-publication-step16-2026-10-30/d8-consumer/typed-sdk-ingress-proposal.patch). İki küçük wrapper:

- Public `TcpTransport::from_tokio_stream(tokio::net::TcpStream)` mevcut `from_stream` gövdesini kullanır.
- Private runtime tipine `pub(crate) from_tokio` factory eklenir; iç tip dışarı açılmaz. İkisi de mevcut Tokio feature'ına bağlıdır.

Framing, crypto, auth, negotiated capability, dependency veya sürüm değişmez. Exact hash gate iki değişen SDK dosyası için güncellenir; upstream destek geldiğinde kaldırma koşulu korunur. SDK diff’i uygulandı; dış tüketici ve temsilci Android/iOS linkleri PASS.

## Bu girişi kullanacak dar native köprü — onaylandı/uygulandı

[Somut 157 satırlık diff](evidence/smb-native-publication-step16-2026-10-30/d8-consumer/native-bound-socket-proposal.patch). Mevcut müzakere/şifreleme kodu ortak kalır; native bağlı-socket yolu ve C header girişi eklenir. Seçili Files kapsamındaki Kotlin/JNI/Swift sahipleri bu handoff'a bağlanır:

- OS sahibinin doğruladığı Wi-Fi/Ethernet socket'i; JSON/JS kaynaklı LAN iddiası yetki olmaz. Ortak Rust tam numeric peer eşitliğini auth öncesi doğrular; bound giriş yeni bağlantı/DNS veya şifresiz fallback açmaz.
- Snapshot ve socket FD'leri her dönüşte kapanır; aynı FD iki argümana verilirse tek kez tüketilip reddedilir. Native sahip diğer kopyaları kapatır. Bozuk istek/iptal/kapanma/yanlış peer yolları, mevcut ACK ve tam byte kontrolleri test edilir.
- Profil/vault/credential generation, güncel kaynak ve OS route sahibi callback0'da ve yerel Completed anında yeniden doğrulanır. Köprü tek başına bu yetkiyi vermez. Kayıp ACK/hash eşitliğiyle adoption yok; PC/DAV kayıtları değişmez.
- Yeni dependency, Photos mutation/signing izni, JS/UI aktivasyonu, SFTP/FTPS veya fiziksel cihaz testi bu kapsamda yok. OS owner ve runtime/fault kapıları geçmeden SMB kapalı kalır. Eski wire/altı-target kanıtı yeni köprünün PASS'i sayılmaz.

Bu, yeni bir engine seçimi değildir; aynı ortak Rust/Kotlin/Swift sınırında eksik native bağlantı adımının somut uygulama kapsamıdır. Alternatif: mevcut D6 SDK ile SMB'yi kapalı tutmak.

## İlk denemenin geri alma kontrolü — tarihsel

Başarısız kendi tüketici testi referans kanıtına alınıp üretim test setinden kaldırıldı. Geri yüklenmiş kaynakla Rust10 test ve host Cargo check PASS. Hash kapısı, transport/runtime/ilk manifest dosyasındaki kasıtlı değişiklikleri ayrı ayrı reddediyor. Ağ testleri, mobil matris ve yeni bridge çalıştırılmadı. İlk başarısız öneri tarihi kayıttır; düzeltilmiş diff’ler yeni açık onaydan sonra uygulandı.

## Son doğrulama ve kalan iş

Rust13 test, doğru peer/iptalde sıfır-byte/FD kapanma kontrolleri, supplied-socket7 gerçek yayın/fault durumu, Swift host C ABI+SQLite seed/ayrı süreç reopen ve disposable Android JNI+SQLite runtime PASS. Dar Kotlin, iki temsilci mobile link, hash bozulma kapısı ve sabit1.99Clippy PASS. Bu kanıtlar gerçek OS route/vault/seçili kaynak sahibini taklit etmez; onların entegrasyonu sıradaki dar iştir. Test için açılan owned strict container/AVD durduruldu; eski kabul kapıları açık.
