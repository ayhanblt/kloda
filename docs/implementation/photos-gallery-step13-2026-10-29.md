# Mobil galeri/detay —13. adım /29 Ekim2026

Durum: onaylı dar kaynak/otomatik/izole iOS kapsamı uygulandı. Android native
runtime/görsel ve fiziksel kabul açık;13 ürün/platform kabulünün tamamı değildir.
[ADR0021](../decisions/0021-read-only-selected-photos-gallery.md) kullanıcı kararıdır.

## Uygulama

- Yeni native page/preview/history metotları mevcut seçili Photos kaynaklarını
  okur. Page24öğe; sonraki/önceki sayfa eskisini değiştirir. Kalıcı medya kataloğu,
  app-owned disk thumbnail cache veya bağımlılık yok. OS Photos/MediaStore cache'i
  ayrı; PhotoKit ağ indirmesi kapalı. Preview256px/detail1024px, JPEG≤1MiB;
  bir anda tek thumbnail decode. API24–26 video poster yok; okunabilir fallback.
- Galeri→detay ayrı görünür, geri dönüş ve gerçek dil anahtarları var. OS tarih,
  boyutlar ve read-only favorite/video işareti gösterilir. Yeni arama, EXIF,
  paylaşım, favori değişimi, playback veya yerel silme eklenmedi.
- İzin reddi, limited, boş ve hatalı/erişilemez kaynak ayrı. iOS limited izinde
  user-album üyeliği görünmezse açık kapsam uyarısı; library'ye sessiz genişleme
  yok. Kullanıcının ayrıca seçtiği library yalnız OS-izinli öğeleri gösterir.
  Android'in mevcut yeni backup-source seçimi tam izin gereksinimi korunur;
  var olan kaynakta izin daralması salt okunur galeriyle değerlendirilir.
- Sayfa/preview/history native tarafında güncel kaynak ve izin kontrolü yapar.
  Arka plana çıkınca JS medya state'i boşalır; geç sonuçlar generation fence ile
  atılır, dönüşte izin/kaynak yeniden okunur. Kaynak/offset/detay değişiminde
  yalnız görsel surface remount olur; galeri hook'u/iş/pairing modeline taşınmaz.
- Detayda en yeni16yerel transfer kaydı, PC record kimliği ve media/manifest
  ayrımı vardır. SQLite read-only açılır; yoksa DB yaratılmaz. Geçmiş Completed
  güncel içerik/PC/ACL/remote existence kanıtı değildir; locator yeniden kullanımı
  açıklanır. Kayıt yoksa bilinmiyor. Backup/full-membership/import kuralları,
  identity/pin/grant/receiver/suppression ve restore değiştirilmedi.

## Yeni doğrulama ve review

[Kanıtlar ve kaynak SHA256](evidence/gallery-step13-2026-10-29/manifest.json).

|Kontrol|Gerçek sonuç/sınır|
|---|---|
|Mobil tam Jest|142test/16suite PASS, son ek guard'lar öncesi|
|Son etkilenen kontroller|39test/3suite PASS; ardından strict native type guard13test PASS|
|Lint/TypeScript|Son kaynak PASS; FSD/max-lines dahil|
|JS export|İki platform PASS; son strict type guard daha sonra test/lint/TS ile kontrol edildi|
|Android|Production+androidTest Kotlin compile PASS; belgeli `-Pandroid.lint.useK2Uast=false` K1 lint0hata/34uyarı|
|iOS uygulama|Son arm64 Simulator Debug build PASS; iPhone/signing kabulü değil|
|PhotoKit/SQLite native smoke|Seçili albüm24+2page/dedup, gerçek decode/bounds, başka albüm öğesi/removed source reddi, DB yokken yaratmama/var receipt'i DB'ye dokunmadan okuma PASS|
|Gerçek Expo köprüsü|Native source selection→page24+2→preview→history[] PASS; PC/session yok|
|Gerçek limited|Normal OS seçicisi sonrası sadece1izinli öğe+preview PASS; album üyeliği unavailable uyarısı PASS|
|Gerçek denial|Disposable fixture'da izin geri alımı→boş page+preview refusal PASS|
|Native UI|TR grid; TR/EN/DE detay; gerçek native detay açma/geri ve dikey sürükleme; limited album/library capture. Dar kapsam, tam responsive/a11y matrisi değil|

İlk hedefli koşuda test fixture listener/type/token sorunları düzeltildi. İlk
Android komutu yanlış modül adıyla başarısızdı; `:my-module` doğru hedefle geçti.
Yanlış K1 bayrağındaki Worklets KaModule çöküşü korunur; belgeli komut sonradan
geçti. İlk generic iOS link, mevcut arm64-only Rust XCFramework için eşleşmeyen
slice/library nedeniyle başarısızdı; desteklenen arm64 hedefiyle son build geçti.
Native fixture ilk pre-grant'ta `.notDetermined` gördü; normal OS full-access
aksiyonu sonrası PASS. İlk limited fixture1beklerken0gördü; bunu PASS saymadık.
Native seçicide tek sentetik öğe onayı+fresh process sonrası1+preview PASS ayrı
kayıttır; ilk sonucun kesin nedeni çıkarılmadı ve veri sızıntısı iddia edilmedi.

Aynı ana ajan ayrı review geçişi yaptı: native/JS trust boundary, source membership,
read-only journal, background late-result, historical status ve tasarım ayrımı
incelendi. 1970öncesi tarih/finite native date, strict native string types,
mevcut palette sınıfları, detayda galeri özetini kaldırma ve limited-album uyarısı
giderildi. Bağımsız ajan review'u yapılmadı/iddia edilmedi.

## Korunan açıklar ve sonraki iş

12Android native görsel (`adb unauthorized` tarihsel; bu başlangıçta ADB cihaz
listesi boş), gerçek horizontal son-sekme swipe/VoiceOver/landscape açık. Yeni
galeri native dikey hareketi bunların tamamını kapatmaz. Android instrumentation
fixture'ına kaynak/preview/out-of-source kontrolleri eklendi ve derlendi; bu koşuda
Android runtime çalıştırılmadı. iPhone, büyük arşiv/alan/performance, eskiOS/16KB,
LivePhoto/RAW/iCloud, PC/LAN ve tüm fiziksel/platform kapıları korunur.

Owned Metro/result server durduruldu; geçici fixture entry ürün ağacından arşive
alındı; yalnız yeni disposable Simulator kapatıldı. Yetki/key/auth reset, mevcut
arşiv/cihaz cleanup, Git add/commit/push yok. Başlangıçta değişmiş Expo log'u
korundu; bu koşunun Metro log ekleri de bulunur.

Sıradaki14:16protocol/provider için resmi API/auth/custody/restore/idempotency/
limit/maliyet matrisi ve gerçek karar kapıları; yeni provider implementasyonu yok.
