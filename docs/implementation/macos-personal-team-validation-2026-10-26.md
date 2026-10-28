# macOS Personal Team — güvenli anahtar ve native alıcı doğrulaması

26 Ekim 2026. Kullanıcı ücretsiz Personal Team ile bu Mac'in güvenli anahtar/alıcı
testini onayladı ve Apple Development sertifikasını Xcode'da oluşturdu. Ücretli
üyelik/yayınlama işlemi yapılmadı. Bu kayıt aynı günün önceki imzasız Electron ön
kontrolünü aşağıdaki dar kapsamda ilerletir; bütün Desktop kabulü değildir.

## Gerçek doğrulamalar

| Kontrol | Sonuç |
| --- | --- |
| Apple Development imzası | PASS; resmî WWDR G3 eklendikten sonra gerçek imzalama/doğrulama |
| Ücretsiz Mac provisioning | PASS; bu Mac Xcode ile kaydedildi, development profili üretildi |
| Gerçek host profili/Team/app kimliği/Keychain grubu | PASS; com.kloda.desktop.dev |
| Yeni Secure Enclave P-256 anahtarı | PASS; ilk owner açılışında gerçek certificate-TBS imzası ve kriptografik doğrulama |
| İlk test state'inin düzeltme sonrası açılışı | PASS; epoch/DER/initialized değişmedi, anahtar yeniden üretilmedi |
| Son kaynakla signed native create + farklı-PID reopen | İki koşu PASS; receiver ready, suspend sonrası ready, explicit close |
| Gerçek signed Electron host + production NAPI | İki koşu PASS; fresh create/farklı-PID reopen, receiver ready ve suspend sonrası ready |
| Electron imza kontrolü | PASS; 23 nesne imzalandı, deep/strict verify exit0 |
| Yeni negatif anahtar testleri | 2 PASS; yazılım/private ve public anahtar production identity olarak reddedilir |
| Desktop native addon build | PASS; mevcut build driver, Rust1.99.0 |
| Değişen dosyalar fmt / production-library strict Clippy | PASS; Rust1.99.0, pinned compiler/plugin PATH, warnings denied |
| Ayrı kaynak/güvenlik incelemesi | Engelleyici bulgu yok; reviewer runtime tekrar çalıştırmadı |

[JSON sonuç](evidence/macos-personal-team-2026-10-26/result.json), gerçek stdout ve
özel fixture yollarından arındırılmış kaynak/replay şablonları
[kanıt dizinindedir](evidence/macos-personal-team-2026-10-26/README.md).
Eski PASS sayıları yeni koşulara eklenmedi.

## Kanıtlanan sorun ve düzeltme

İmzalama hatası: yeni development sertifikası WWDR G3 istiyordu. Login keychain'de
yoktu; System'de yalnız 2023'te bitmiş eski WWDR vardı. Gerçek codesign zincir
hatası/valid-identity=0 gözlendi. Apple'ın HTTPS üzerinden alınan resmî G3 sertifikası
mevcut Apple root'a doğrulanıp public intermediate olarak eklendi; valid-identity=1
ve gerçek imzalama PASS oldu. Yeni root veya Always Trust yok.
[Apple PKI](https://www.apple.com/certificateauthority/),
[WWDR tablosu](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates/).

İlk native create başarılı, process-reopen native_unsupported idi. Yalnız yeni test
anahtarı üzerindeki exact salt okunur sorgu OSStatus0 verdi. Type/private/Enclave/
256-bit doğru; CanSign CFBoolean yerine CFNumber olduğu için eski CFEqual kontrolü
reddediyordu. Sayısal değer veya genel truthy dönüşüm varsayılmadı. Doğrulama,
doğrudan kullanılan ECDSA-SHA256 Sign işleminin SecKeyIsAlgorithmSupported desteğine
bağlandı. Diğer custody, entitlement, private/P-256/size ve gerçek imza hata
kontrolleri korundu. [Apple API](https://developer.apple.com/documentation/security/seckeyisalgorithmsupported(_:_:_:)).

Xcode27.1 SDK SecKey.h: işlem tipi CF_ENUM(CFIndex, SecKeyOperationType),
kSecKeyOperationTypeSign=0; Rust FFI isize/u8 kullanır. Negatif testler yalnız
bellekteki, permanent/tag içermeyen anahtarları kullanır; production fallback yok.

## Kabul sınırları

- Electron testi ELECTRON_RUN_AS_NODE=1 ile gerçek signed executable ve NAPI'yi
  çalıştırır. Normal Kloda başlangıcı, initializeDesktopProfile, renderer/QR/tray
  veya pencere UI kabulü değildir. Suspend sonrası native receiver devamı doğrulandı.
- Receiver available gerçek route/listener/guard sonucudur; telefon eşleşmesi, izin,
  başarılı mTLS/upload/finalize veya arşiv kabulü değildir. Reopen mevcut DER/epoch
  ve hardware key lookup'u doğrular; yeni imza veya TLS handshake iddia edilmez.
- Ana uygulama profili/Keychain yetkisi yalnız main host'tadır. Restricted yetki
  framework/helper'lara kopyalanmadı. Addon aynı Team ile imzalandı; library validation
  kapatılmadı, unsigned-executable-memory eklenmedi. Electron'a yalnız allow-jit
  eklendi. Profil normal development debug yetkisi içerir; release kabulü değildir.
- Profil 2 Kasım 2026 07:30:50 UTC'de sona erer; yerel test için yenilenmelidir.
  Yenileme mevcut key reset/authority taşıma izni değildir. Production signing,
  notarization ve dağıtım açık kalır.
- Üç yeni özel disposable authority/test anahtarı korundu. Mevcut dev/prod authority,
  arşiv ve telefon açılmadı; export/reset/migration/cleanup, Git mutation, üyelik
  satın alma yok. Asıl node_modules/Electron.app değil, yalnız geçici kopyalar imzalandı.
- İlk profile üretimi, restricted ortam negatif-test hatası, fmt farkı, geçici helper
  link/lock ve mixed-PATH Clippy hataları JSON'da korunur. Başarısız koşular PASS
  sayılmadı; final kontroller ayrı başarılı koşulardır.

Tek sonraki iş: Normal imzalı Kloda development uygulamasını mevcut profile
izolasyonuyla açıp ayrı disposable hedef ve yapay Files verisiyle gerçek Android↔Mac
QR → ayrı PC izni → aktarım → yeniden açılış akışını doğrulamak. Photos, diğer
platformlar ve geniş fiziksel kabul bu kanıtla kapanmaz.
