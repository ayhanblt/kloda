# iOS native pairing — mobil liste5 (27 Ekim 2026)

## Sonuç ve kapsam

Liste5 kaynak entegrasyonu ve izole Simulator doğrulaması tamamlandı. Gerçek iPhone
Secure Enclave, QR/mTLS eşleştirme veya PC aktarımı kabulü değildir. Liste6 Files,
liste7 Photos ve liste8 background/zamanlama bu görevde başlatılmadı.

[ADR0020](../decisions/0020-ios-local-network-admission-and-native-pairing.md)
kullanıcı tarafından26Ekim onaylanan iOS locality farkını kaydeder. Android/macOS/Windows
rota politikası değişmez. iOS doğrudan rota/gateway/VPN yokluğu veya değişimin anında
algılanması iddiasında bulunmaz. Donanım anahtarı/TLS/QR-SPKI/exporter/PC onayı ve
ayrı PC-local dosya erişim izni korunur; pairing dosya izni vermez.

## Uygulanan dar değişiklik

- Mevcut Rust phone owner/TLS/protokol kullanıldı. iOS, mevcut Secure Enclave
  P-256 provider'ına ve özel/backup-excluded storage yoluna bağlandı. Simulator
  authority dosyası veya anahtar oluşturmadan native_unsupported döndürür.
- İki native Wi-Fi/Ethernet Network.framework monitor gözlemi, gerçek getifaddrs
  interface/index/address/prefix ile eşlenir; belirsiz adaylar reddedilir.
  Tek seçim sonrası gözlenen değişim sticky ret olur. Raw socket/TLS Rust'ta kalır;
  interface binding/readback ve mevcut I/O sınırındaki kontroller kullanılır.
- UIKit gerçek görünür/aktif pencereyi kontrol eder. Synchronous inactive fence,
  queued native işlerde aynı foreground epoch'u doğrular. Arka plan→ön plan sonrası
  eski istek yeni epoch'u benimsemez; durable trust yazısı mevcut fence'i kullanır.
- KlodaPairing Expo modülü mevcut JS sözleşmesine bağlandı. Owner/path/key/context
  JS'e verilmez. Close belirsizliğinde ikinci owner açılmaz. Observer cleanup ve
  delayed-open/destroy yarışları kapsandı. Transfer API'si/sender eklenmedi.
- Device+host-Simulator debug XCFramework gerçek generated klasör olarak yayınlanır;
  önceki generated çıktı korunur, tanınmayan klasörün üzerine yazılmaz.
  Apple usage description eklendi; paket sürümleri/lock/dependency değişmedi.

## Gerçek doğrulamalar

Tümü bu uygulama grubunda çalıştırıldı; eski tarihli PASS kayıtları yeniden koşulmuş
sayılmaz. [Seçilmiş kanıtlar](evidence/ios-native-pairing-2026-10-27/README.md).

| Kontrol | Sonuç / sınır |
| --- | --- |
| Host Rust foreground / ABI |7 filtered ve8 ABI PASS; filtreler örtüşür, toplam15 ayrı test iddiası yok |
| Yeni iOS26.5 arm64 Simulator Rust |19 test PASS: foreground6, ABI8, prefix2, clock2, unsupported-storage1 |
| Gerçek Rust+Swift Simulator ABI |7 grup PASS; custody refusal/reply free/bounds, canlı peer değil |
| Swift session C fixture |4 grup PASS; delayed open, destroy, inactive/reactivation stale epoch, close failure |
| Typed reply decoder |3 grup PASS; private alanlar, canonical owner/epoch ve lifecycle |
| Native route witness |2 grup PASS; typed metadata, one-time selection, diğer/selected değişim fence'i; peer bağlantısı yok |
| SQLite joint fixture |Sentetik insert/remove/readback ve gerçek Rust ABI ret PASS;3.51.3 |
| Gerçek iOS Simulator uygulaması |Debug arm64 build exit0; gerçek Expo modül metotları/status refusal/boş journal/close4 kontrol PASS |
| Authority sınırı |Yeni app container'da authority klasörü yok; mevcut Swift journal var, source rows0 |
| Mobile regresyon |64 test/8 suite, lint, typecheck, iOS+Android JS export PASS |
| Android |Dört native ABI build PASS; yeni runtime/physical testi değil; mevcut9 uyarı korunuyor |
| Native kalite |Host+iOS Simulator lib/tests strict Clippy, scoped rustfmt,300-line sınırı, dependency policy ve root lint PASS |
| Ayrı review |Frozen epoch ve typed monitor bulguları düzeltildi; paketleme/Swift queue/final kaynak review'ında engelleyici bulgu yok |

Gerçek uygulamanın debug dylib'ında bundled SQLite ve native ABI sembolleri tanımlı;
Swift journal'ın system-sqlite link girdisi de korunur. Aynı uygulamada boş mevcut
journal açılışı çalıştı; sonraki Files/Photos concurrency/transaction kabulü değildir.

## Bulunan ve giderilen engeller

Kurulu ExpoModulesJSI57.1.1 script'i Swift'in __ObjC:: uzantısını public interface'ten
temizlemiyordu. Paket yükseltmeden mevcut private-extension temizleme regex'i
nokta/iki-nokta yazımına genişletildi; sürüm/tek-kalıp kontrolleri fail closed.
Expo'nun kendi Simulator build yolu ve ardından gerçek app build geçti. Bu dar
uyumluluk yaması tools/build-native-ios.mjs içinde, upstream düzeltince kaldırılacak
shortcut olarak kayıtlıdır. Genel C++ interop ayarı yayılmadı.

Expo runOnQueue(.main), Swift actor annotation değildir. Synchronous
MainActor.assumeIsolated kontrolüyle aynı request girişinde gerçek executor doğrulanır;
ek async hop/epoch yenilemesi yoktur. Gerçek Expo runtime çağrısı geçti. Scheduler'sız
native testlerin ana kuyruktan çağrılması gerekir; yanlış executor trap ile durur.

İlk app smoke deep-link sistem onayı nedeniyle inactive kaldı ve FAIL kaydedildi.
Yalnız yeni Simulator restart ve Expo --initialUrl ile son koşu PASS oldu. Önceki
callback/Metro adresi ve fixture compile hataları gizlenmedi; son sonuç ayrı kayıttır.

## Açık kabul sınırları ve sonraki iş

- Gerçek iPhone hardware custody, entitlement/signing, backup exclusion/durability,
  lock/unlock ve gerçek PC QR/mTLS/rota değişimi test edilmedi. Yazılım anahtarı fallback yok.
- Minimum16.4 deployment derlendi;16.4 runtime testi yapılmadı. SDK27.1 ile runtime26.5
  yalnız mevcut Simulator kanıtıdır. Release/distribution kabulü açık.
- Kullanıcının arşivi, mevcut key/pin/cert/epoch/authority'si ve Windows/Linux engelleri
  değişmedi. Yalnız yeni boş Simulator ve sentetik journal kullanıldı; Simulator ve
  yerel test sunucusu kapatıldı, cihaz silinmedi/erase edilmedi.
- Liste4 Android gerçek PC/LAN, Photos/restore, eskiOS/16KB/Doze ve performans
  kapıları açık kalır. iOS Files/Photos/background ve ortak WebDAV/son kabul de açık.

Tek sonraki sıra: liste6 iOS Files kalıcı kuyruk/transfer/resume/geçmiş/restore;
mevcut sender/ACK/journal ve seçilmiş iOS foreground sözleşmesi üzerinden en küçük
bağlantı. Bu rapor liste6'yı uygulanmış saymaz. Git mutation yapılmadı.
