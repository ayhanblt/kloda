# iOS background, zamanlama ve retry — mobil liste8

28 Ekim 2026: kaynak entegrasyonu ve aşağıdaki izole doğrulamalar tamamlandı. Gerçek iPhone/PC veya iOS OS-delivery kabulü değildir. [Seçilmiş kanıt](evidence/ios-background-2026-10-28/validation.json).

## Uygulanan davranış

- Mevcut `kloda-sync.sqlite` içinde dar automatic run/plan/control kayıtları kullanılır; Files/Photos byte, operation, ACK, finalize ve suppression kayıtları mevcut günlüktedir. İkinci aktarım günlüğü, bağımlılık veya genel scheduler yoktur.
- Live ilk uygun OS fırsatıdır; 12/24 saat yerel program alternatifleri korunur. Native `BGProcessingTask` kaydı, app delegate subscriber ve izin verilen task kimliği bağlıdır. Submission yürütme veya tam saat garantisi değildir; internet/power gereksinimi eklenmedi, gerçek native LAN denetimi üstündür.
- Erişim bütçesi toplam5/60 saniye, OS kesintisi bütçesi ayrı toplam5/300 saniyedir. Sayaçlar ve retry deadline/boot/monotonic bağlamı kalıcıdır. Saat ileri alınması erken retry doğurmaz; reboot/kanıtsız clock durumu bütçeyi sıfırlamaz. Sırf request submission/delivery gecikmesi deneme sayılmaz.
- `Duraklat` çalışan işi ve otomatik yedeklemeyi durdurur; açık `Devam` olmadan yeniden başlamaz. Yazma hatasında yalnız bu süreçte duruş ve pause kaydının kaydedilemediği görünür; restart sonrası kalıcı Pause garantisi uydurulmaz. Manual Sync Now otomatik fırsatı tüketmez veya kalıcı Pause'u açmaz.
- Kaynak/program/PC bağlamı değişince mevcut iş durur; ACK ve toparlanma kayıtları korunur. Dar kalıcı bağlam revision'ı aynı ayarlara aynı milisaniyede geri dönülse bile eski işin yeni fırsatı tüketmesini önler. Eski callback yeni planı tamamlayamaz.
- Native OS callback'inin oluşturduğu kayıt-bağlı lease yalnız create/chunk/finalize/status aktarımını açar. JS background bayrağı yoktur. Güncel native Complete/pin/TLS/route/PC-local ACL ve her I/O kontrolü korunur. Eski journal kayıtları erişim yetkisi değildir. QR/trust/izin/list/restore ön plan sınırları korunur.
- UI ayrılışı foreground epoch'unu kapatır; process-owned session geçerli OS işi için yaşayabilir. Background soğuk açılış mevcut kurulum dosyalarını ister; sessiz yeni kurulum yaratmaz. Simulator Secure Enclave reddi korunur.
- Gerçek expiration veya protected-data kullanılamaması lease'i kapatır, mevcut OS-stop yolunu kaydeder; Files admission öncesinde erişim denemesi tüketmez. Sonuç callback'i expiration ile yarışırsa tamamlandı sayılmaz. Anahtar `WhenUnlockedThisDeviceOnly`, snapshot `Complete` korunur; kilitliyken çalışma garantisi verilmez.
- Aktif sistem bildirimi ve gerçek terminal hata bildirimi yalnız kullanıcı izni varsa gönderilir. İptal/çıkışta ilerleme bildirimi temizlenir. TR/EN/DE genel metinleri özel dosya/cihaz adı içermez; native bildirim dili OS tercihidir. Bildirim reddi yedekleme başarısızlığı değildir.
- OS scheduler reddi görünür kalır; güvenli ön plan çalışma fırsatını engellemez. Gerçek terminal hatalar `updated=0`, anlaşılır hata ve needs-attention görünümüyle kalır. UI ayrı erişim/OS sayaçlarını gösterir; iOS Live/program ve arka plan açıklaması bağlıdır.

## Gerçek doğrulamalar ve sınırları

| Kontrol | Sonuç |
| --- | --- |
| Mobil Jest | 9 suite /70 test PASS; iOS erişim–OS sayaçları üç dilde ayrı |
| Root lint, mobil TypeScript | PASS; ara max-lines hatası test dosyası ayrılarak giderildi |
| iOS + Android JS export | PASS |
| Gerçek Expo iOS Debug arm64 Simulator uygulama derlemesi | PASS; dependency uyarıları strict Swift6 kabulü değildir |
| Swift saf policy/journal/plan | Host warnings-as-errors compile + yeni DB seed/ayrı süreç reopen PASS |
| Aynı saf kontroller iOS Simulator | iOS16.4 hedef compile + güncel26.5 runtime seed/ayrı süreç reopen PASS |
| Gerçek Expo native smoke | Live/program, boş gerçek durum, sahte trust yaratmadan Continue, açık Pause, UI close ve farklı PID reopen Pause korunması PASS |
| Native Rust çalışma grubu | 27Ekim tarihli lease4 + ABI9 + foreground7 PASS; host strict Clippy/fmt PASS; rapor için yeniden koşulmadı |
| Native iOS paket | Device/Simulator ve9 export build PASS; cihaz runtime değildir |
| Android ortak Rust regresyonu | Dört JNI ABI build PASS; mevcut9 uyarı, Android runtime/strict Clippy değildir |
| Bağımsız güvenlik review | Terminal hata, scheduler reddi, context ve expiry yarış bulguları giderildi; son dar review engelleyici bulgusuz |

İlk Expo denemesi callback timeout ile durdu: CI Metro yeni fixture'ı listeye almamıştı (bundle404). Dosya oluşturulduktan sonra Metro yeniden başlatıldı; bundle200 ve ayrı iki süreç smoke PASS. Ara başarısızlık kanıtta korunur. Saf host compiler'ın ilk sandbox macro hatasında test başlamadı; yetkili host derlemesiyle doğrulandı.

## Açık kabul ve sonraki iş

- Gerçek iPhone Secure Enclave/QR/PC ayrı ACL/LAN, revoke, kilitli protected-data, gerçek OS teslim/expiration/force-quit/reboot ve bildirim izin/ret runtime kabulü yapılmadı. Simulator'da özel Apple launch API'siyle OS fırsatı taklit edilmedi.
- Cihaz/PC gerektiren pozitif background aktarım, büyük arşiv/alan, PhotoKit LivePhoto/RAW/edited/iCloud ve eski16.4 runtime kabulü liste10–11'de açık. Anahtar/snapshot koruması bu kabulü kolaylaştırmak için gevşetilmedi.
- Cancellation yeni I/O ve sonuç kabulünü keser; bekleyen native network future hemen uyanmayabilir, mevcut I/O/30s sınırına kadar sürebilir. Gönderilmiş isteğin kayıp sonucu aynı operation/status günlüğüyle yeniden doğrulanmalıdır; otomatik başarı/adoption yoktur.
- Eski locator kaybı, Desktop Windows/macOS/Linux platform kapıları ve geniş E2EE/recovery/remote/versions/migration backlog'u kapanmadı. Kullanıcı arşivi ve mevcut güven verisi kullanılmadı; Git mutation yapılmadı.
- Sıradaki tek iş: liste9 ortak WebDAV kayıt/ayar/hata tutarlılığı değerlendirme ve dar giderim. Bu çalışma grubunda başlatılmadı.
