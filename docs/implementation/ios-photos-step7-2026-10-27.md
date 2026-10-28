# iOS Photos — mobil liste7, 27 Ekim2026

Onaylı sıranın7. adımı kaynak, host ve izole Simulator kapsamında tamamlandı. Gerçek iPhone/PC LAN veya bütün Photos ürün kabulü değildir. [Seçilmiş koşu ve hash kanıtları](evidence/ios-photos-2026-10-27/validation.json).

## Uygulanan kapsam

- Mevcut `kloda-sync.sqlite` ve `IosFilesUpload` kullanılır. Kaynak/asset/album için yerel opaque kimlik ve metadata revision kayıtları; gerçek kaynak byte'ları, hash/size, native ACK, operation/finalize ve resume aynı Files job günlüğündedir. İkinci genel aktarım günlüğü veya bağımlılık eklenmedi.
- PhotoKit'in orijinal kaynakları özel snapshot'a parçalı aktarılır; kaynak değişimi, eksik orijinal, bilinmeyen/tekrarlı resource ve temsil edilemeyen metadata başarı sayılmaz. V1 strict manifest codec Android/PC alanlarıyla uyumludur; yalnız doğrulanmış Completed resource'lar referanslanır. Metadata-only değişim yeni manifest sürümü oluşturur, mevcut Completed medyayı tekrar yüklemez.
- Kalıcı kaynak imzası sıralıdır. Değişmemiş silinen sürüm normal Sync Now ile geri gelmez; explicit rebackup mevcut native `owner_deleted` kanıtını ister. Kaynak seçimi değişince eski pending bağlamı ilerletilmez; eski kayıt korunur, yeni seçimin immutable işi açılabilir. Kayıp asset/seçim ve unresolved işler toplu sonucu tam başarıya dönüştürmez. Photos locator isim alanı geçerli Files göreli yollarından ayrıdır; `photo:notes.txt` gibi gerçek dosyalar Photos işi sanılmaz.
- Own-list/status/download sınırı korunur; her sidecar ve resource yeniden native current-scope status ve gerçek byte/hash ile kontrol edilir. Kayıp download yanıtı aynı journal/staging offset'iyle toparlanır; doğrulanmamış kuyruk verisi erişim izni değildir.
- Import intent'i PhotoKit yaratımından önce kalıcılaşır. Creating/album intent'leri aynı SQLite transaction'dadır; target placeholder kimliği platform işlem bloğunda kaydedilir. Bilinen target tekrar gerçek byte, resource, favorite ve album üyeliğiyle doğrulanır. Bilinmeyen yaratım sonucu otomatik yeni asset oluşturmaz. Henüz platform yazımı başlamamış preflight hatası ise `prepared` + görünür hata kalır; aynı manifestle kullanıcı başlatmalı retry güvenlidir.
- Album mapping source-device+albumID ile yapılır; aynı isimli mevcut album benimsenmez. Mevcut medya üzerine yazılmaz/silinmez. Farklı retained manifest veya doğrulanamayan target review gerektirir. Media ve organization sonuçları ayrı kalır.
- Toplu restore, mevcut Android katalog davranışı gibi önce her source-device/asset'in en yüksek doğrulanmış revision'ını seçer. Aynı revision/farklı hash reddedilir. Katalog mevcut journal connection'ında geçici SQLite tablodur; kaynak medya veya bütün manifest payload'ları bellekte biriktirilmez. Bağımsız review durumları diğer asset'leri durdurmaz; final sonuç review'ı gizlemez.
- iOS Expo Photos metotları Activity'ye bağlandı; Android-only kapısı kaldırıldı. TR/EN/DE, mevcut Stitch bileşenleri ve erişilebilir kontroller kullanılır. Eski import sonucu son doğrulama kaydı olarak etiketlenir; izin kaybında eski Completed güncel doğrulama gibi gösterilmez.

## Bu dilimde gerçekten çalıştırılan kontroller

| Kontrol | Gerçek sonuç ve sınır |
| --- | --- |
| Mobile Jest | 8 suite /68 test PASS; iOS Photos tekil/toplu yönlendirme ve review gösterimi üç dilde |
| TS ve root lint | Exit0 |
| Mobile iOS+Android JS export | Exit0; Android native/runtime koşusu değildir |
| Strict Swift codec | Warnings-as-errors compile +26 hostile vector ret PASS |
| Journal host | Ayrı seed/reopen süreçleri PASS; immutable target/manifest, yaratım replay yasağı, targetsiz Completed ret ve belirsiz sonuç sayımı |
| Gerçek iOS app Debug arm64 Simulator build | Exit0; gerçek Expo/native kaynak bağlantısı derlendi, full PC aktarımı çalıştırılmadı |
| PhotoKit seed | PASS: gerçek PNG kaynak/hash, upload/finalize kayıp yanıtı, suppression/explicit rebackup/shared resource, album/favorite, own-download kayıp yanıtı, bulk latest ve ayrı review, eski/yeni kaynak bağlamı, kayıp kaynak üyeliği |
| PhotoKit PID reopen | Aynı DB/library, farklı süreç PASS: target byte/metadata recheck, canonical revision ve sıfır yeni PC operation, unresolved geçmiş |
| PhotoKit video | Gerçek sentetik H264 PASS; Android `original` role, tekrar import no-duplicate, unsupported role review, bilinen preflight hatasından explicit retry |
| Native policy self-test / Rust size sınırı | Exit0; Rust üretim kaynağı değişmedi, yeni Clippy veya Android native build koşusu değildir |
| Ayrı güvenlik review | Engelleyici kalan bulgu yok; reviewer runtime/test çalıştırmadı |

PhotoKit fixture'ında **SQLite, snapshot, upload state machine ve PhotoKit gerçektir; session ve PC yanıtları sahtedir**. Üretim Simulator Secure Enclave guard'ı aşılmadı; software key, test authority veya native izin fallback'i eklenmedi. SDK27.1/minimum16.4 compile ve iOS26.5 Simulator; gerçek16.4 runtime kanıtı değildir.

## İlk bulgular ve dürüst kanıt sınırı

- İlk izin ön kontrolü `notDetermined` nedeniyle durdu; CLI grant tek başına yeterli görülmedi. Standart Device Hub ekranında yalnız bize ait test Simulator'larında tam izin verildi; uygulama guard'ı gevşetilmedi.
- Yeni Simulator Apple'ın altı örnek fotoğrafıyla geliyor. Boş-library assertion'ı durdu; bu örnekler export/hash/restore hedefi yapılmadı. Test yalnız kendi oluşturduğu kaynak/album/target'ları kullandı; kullanıcı arşivi kullanılmadı.
- Aynı PNG `.snapshot` URL ile PhotoKit3302 `invalidResource`, aynı özel dizinde `.png` ile PASS verdi. Import artık uygun uzantılı korumalı geçici kopyayı tekrar hash'ler; `shouldMoveFile=false`, orijinal snapshot ve journal korunur. Rastgele adla yalnız kendi kopyası temizlenir.
- Review'da sırasız revision imzası, görünmez pending Photos geçmişi ve yeni seçimde eski pending işe takılma açıkları bulundu; düzeltildi ve son fixture'da yeniden açılış/bağlam testleri geçti. Bunlar önceden yapılmış runtime PASS gibi sunulmadı.
- Fixture tekrarında sabit `ambiguous` kimliğinin retained manifest'le çakışması güvenlik trigger'ında reddedildi. Fixture kimliği benzersizleştirildi; journal reset/cleanup yapılmadı. Eski FAIL son PASS ile silinmiş sayılmaz.

## Görünür kalan sınırlar ve sıra

- Full PhotoKit readWrite gerekir; limited izin ve yerelde olmayan iCloud orijinali başarı sayılmaz. İmplicit iCloud download yok.
- V1 resource role/name/MIME/hash/size, album ID/name ve favorite taşır; tarih/konum/caption/folder hiyerarşisi dahil tam Photos-library metadata yedeği olduğu iddia edilmez. LivePhoto/RAW/edited ve diğer çoklu resource birleşimleri yalnız API desteği+exact byte doğrulamasıyla ilerler; gerçek pozitif runtime matrisi yapılmadı.
- Önceden import edilmiş aynı source asset'e farklı manifest geldiğinde otomatik target güncelleme/overwrite/yeni duplicate yapılmaz; review kalır. Bu güvenli sınır yeni sürümlerin kör benimsenmesi değildir.
- Büyük orijinallerin geçici uzantılı kopya maliyeti, kesinti sonrası orphan staging/kopyalar, gerçek kapasite/iCloud/provider, görsel/VoiceOver ve performans kabulü liste10'da açık. Genel tarama veya otomatik cleanup eklenmedi.
- Gerçek iPhone hardware key, QR/PC ayrı izin, TLS/ACL/revoke ve tam transfer/import/restore kabulü liste11; mevcut platform/fiziksel kapıları kapanmadı. Windows/macOS paket/Linux engelleri değişmedi.
- Sonraki tek adım **liste8: iOS background/zamanlama/retry**. Bu dilimde başlatılmadı. WebDAV9 ve geniş E2EE/account/recovery/remote/two-way/versions/migration backlog'u korunur.

Git mutation, kullanıcı arşivi, mevcut authority/key/pin/epoch reset/migration veya yeni fiziksel/probe işlemi yapılmadı. Yalnız sahipli izole Simulator'lar koşu sonunda kapatılır; test kayıtları ve kanıtlar korunur.
