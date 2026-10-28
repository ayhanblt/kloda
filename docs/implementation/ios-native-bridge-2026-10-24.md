# iOS native köprü temeli — 24 Ekim 2026

Sonraki izinli [simulator doğrulaması](ios-simulator-validation-2026-10-24.md) tamamlandı. Aşağıdaki ilk tablo tarihsel source/host kapsamıdır; canlı sender açık. İlk kaynak SHA snapshot korunur; fixture tampon düzeltmesinin yeni hash kaydı simulator kanıtındadır.

## Tamamlanan dar kapsam

Mevcut Rust phone owner/sender için beş C ABI girişi, native owner registry,
Swift yanıt çözümleyicisi ve yanıt belleği sahipliği eklendi. Yeni aktarım günlüğü,
TLS/protokol veya bağımlılık oluşturulmadı. `ios-ffi` default-off; Desktop/Android
production yolları değiştirilmedi. Mevcut iOS identity/storage/route/clock
`native_unsupported` kapıları korunur. Expo modülü henüz kaydedilmedi.

- `open`: yalnız Swift'in özel app-data yolu; JS yolu kabul eden uygulama API'si yok.
- `request`: bounded ve strict phone komutları; PC grant/receiver/sign/context override yok.
- `suspend`: actor I/O beklemeden mevcut foreground ticket'larını geçersizleştirir.
- `transfer`: mevcut native sender/operation/ACL kontrollerini kullanır; native FD'yi
  çoğaltır, çağıranın FD sahipliği korunur. JS'ye doğrudan FD API'si verilmez.
- `reply_free`: native yanıt bir kez geri verilir; Rust byte buffer temizlenir.

Registry kilidi actor I/O boyunca tutulmaz; owner Arc ömrü korunur. Strict JSON,
UTF-8/boyut/canonical kimlik kontrolleri ve stale-owner ret vardır. Swift boolean
ve envelope anahtarlarını doğrular; bozuk JSON'u tek `invalidReply` durumuna çevirir.
262164-byte sınır mevcut sender List yanıtı ve ABI envelope içindir. İç `Any` bir
JS sözleşmesi değildir; gelecekte operasyon türüne göre doğrulanmalıdır. Swift
worker/gerçek aktif pencere ömrü ayrıca bağlanmadan hassas çağrı açılamaz.
Rust panic ABI dışına taşmaz; mevcut panic hook'un iç log davranışı değiştirilmedi.

## Gerçek doğrulama

[Seçilmiş kanıt ve tekrar kaynakları](evidence/ios-native-bridge-2026-10-24/README.md).

| Kontrol | Sonuç ve sınır |
| --- | --- |
| Rust1.99 locked/offline ABI testleri | 7 PASS; host open testte zorunlu unsupported, gerçek owner açılmaz |
| Rust1.99 fmt | Yeni dört Rust kaynak dosyasında PASS |
| Rust1.99 clippy `-D warnings` | Host lib+tests ve arm64 iOS simulator lib PASS |
| Swift decoder + ownership | Host PASS; ownership C stub kullanır, gerçek Rust owner runtime değildir |
| Swift/C iOS16.4 simulator typecheck | PASS; çalıştırma yok |
| Device+simulator static library / XCFramework | Debug PASS, beş C export mevcut; yalnız arm64 dilimleri |
| Device+simulator C link harness | PASS; beş export'a referans, hiçbir fonksiyon çalıştırılmaz |
| Rust dosya boyutu / native dependency policy | PASS / 15 negatif self-test PASS; yeni bağımlılık yok |
| Gerçek uygulama/QR/Files/Photos/foreground/cihaz | NOT_RUN / açık |

Başlangıçta Homebrew1.98.1 clippy ile Rust1.99 artifact karışması E0514/E0463
verdi; bu denemeler PASS değildir. Rust1.99 rustfmt/clippy bileşenleri kuruldu,
PATH/RUSTC/clippy-driver tam yolu sabitlendi ve ayrı validation target klasöründe
son kontroller geçti; default toolchain değiştirilmedi, cache temizlenmedi.
İlk nm denemelerinde LLVM bitcode/çıktı sınırı hatası görüldü; Mach-O sembollerini
`--no-llvm-bc` ve bounded8MiB capture ile kontrol eden son paketleme geçti.
Xcode CoreSimulator/cache uyarıları paketlemeyi engellemedi; simulator boot veya
ağ testi yapılmadı. Debug paket dağıtım/signing kabulü değildir.

## Ayrı güvenlik incelemesi

Sol reviewer ilk geçişte Phone rolüne uygun olmayan JSON suspend komutunu,
yetersiz Swift yanıt sınırını ve normalize edilmeyen decoder hatasını bildirdi.
Üçü giderildi. Son salt okunur bağımsız geçişte engelleyici kaynak bulgusu yok;
registry/close/FD ve Swift exact-once free yolları incelendi. Reviewer test veya
owner çalıştırmadı. Astra yalnız sonraki LAN planına danışıldı, review yapmadı.

## Açık kapılar ve sonraki iş

macOS `SCNetworkInterfaceCopyAll/GetBSDName` iOS SDK'da unavailable. Wi-Fi arayüzü,
prefix veya gateway listesi mevcut direct-route/same-interface/değişim invalidation
kanıtı yerine kullanılamaz. Mevcut BSD taşımasını koruyacak public iOS witness
kanıtı araştırılmalı; mümkün değilse Network.framework ham-byte adaptasyonu
ayrı tasarım kararıdır. [Sabah karar ve açık iş listesi](mobile-questions-2026-10-24.md).

Identity/custody, özel storage+backup exclusion, gerçek clock/route, Expo foreground
ve worker ömrü; uygulama linkinde Swift system SQLite/Rust bundled SQLite ilişkisi;
iOS Files/Photos queue/ACK/resume/import/restore/suppression ve background/schedule
kapsamları açık. Köprü derlemesi iOS eşleştirme veya aktarım başarısı değildir.
Android mevcut sender yeniden yazılmadı; Android runtime ve tüm fiziksel kabul
kapıları açık. Windows işleri ayrı oturumda sürer.

Kullanıcı arşivi/anahtar/pin/sertifika/epoch/authority açılmadı veya değiştirilmedi.
Git add/commit/push/reset/clean/stash ve fiziksel/device/probe çalıştırması yok.
