# iOS simulator ABI doğrulaması — 24 Ekim 2026

Kullanıcı simulator testlerini açıkça onayladı; fiziksel/probe duraklatması sürer.
[Gerçek kanıt](evidence/ios-simulator-2026-10-24/README.md).

## Tamamlanan kapsam

Yeni boş iOS26.5/arm64 simülatöründe gerçek Rust C ABI+production Swift tüketicisi
7 kontrol grubunu geçirdi: pointer/length/UTF8/JSON, phone-only komut sınırı,
stale owner/lifecycle, FD kullanılmadan ret, unsupported storage ve100 yanıtın
tüketilip serbest bırakılması. Ayrı decoder ve C-stub ownership executable'ları da
exit0 verdi. ABI ayrı süreçte tekrar ve review düzeltmesi sonrası finalde exit0.

Mevcut iOS prepare kolu epoch/key/DB/route öncesinde native_unsupported döndürür.
Random nonexistent simulator temp hedefin oluşmadığı doğrulandı. Gerçek owner veya
ağ açılmaz; no-op başarı üretilmez. Süreç tekrarları persistent journal/owner veya
UI kapat/aç kabulü değildir. Ownership stub sonucu gerçek Rust free için bağımsız
bellek enstrümantasyonu değildir; gerçek ABI yanıtları ayrıca tüketilmiştir.

Bağımsız Sol review güvenlik engeli bulmadı. Oversized test tamponunun C okunabilirlik
önkoşuluna uyması önerildi; Swift ve Rust fixture8193-byte tamponla düzeltildi.
Sonrasında simulator native build/run, Rust1.99 locked/offline host7 test, fmt,
host lib+test clippy, Rust dosya boyutu ve diff whitespace kontrolleri PASS.
Production davranışı değişmedi; reviewer test/runtime çalıştırmadı. Ayrı final sonuç review kaynak/staticlib/executable hash ve çıktılarını doğruladı; engelleyici bulgu yok.

İlk sandbox simctl/cache erişim hatası onaylı dış çalıştırmayla aşıldı; başarısız
başlangıç PASS değildir. Xcode ilk simctl çağrısında Apple component install ve
service-version yenilemesi bildirdi. Mevcut simülatör verilerine dokunulmadı.
Yalnız yeni simulator kapatılır; erase/delete yapılmaz.

## Açık kapılar

Bu dilim canlı QR/Files/Photos aktarımı değildir. [Köprü devri](ios-native-bridge-2026-10-24.md)
içindeki identity/storage/clock/route, Expo foreground/worker, final-app SQLite bağı,
sender/restore/Photos/background işleri açıktır. SDK27.1 minimum16.4 compile eder;
yüklü runtime26.5, eski16.4 runtime NOT_RUN. Gerçek donanım/fiziksel ağ/ürün kabulü
simülatörle kapanmaz. Yeni dependency, key veya güvenlik şartı değiştirilmedi.

Sıradaki öncelik mevcut güvenlik koşullarını koruyan iOS LAN provider eşlemesidir;
[karar ve diğer işler](mobile-questions-2026-10-24.md). Mac route kodunu kopyalama,
Wi-Fi/prefix'i direct-route kanıtı sayma veya software-key fallback yapılmaz.
Android bağlam/OS scheduling işleri de açık; bu testle tamamlandı sayılmaz.
Kullanıcı arşivi/anahtar/pin/epoch/authority değiştirilmedi. Git add/commit/push/reset/clean/stash yapılmadı.
